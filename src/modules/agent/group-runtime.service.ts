import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { AgentRunStatus, AgentRole } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ARTIFACT_SYNC_QUEUE } from '../../queues/queue.constants';
import { ConfirmationService } from '../confirmation/confirmation.service';
import { FeishuService } from '../feishu/feishu.service';
import { RepoSyncService } from '../repo/repo-sync.service';
import { AGENT_OUTPUT_SCHEMA } from './agent.schemas';
import {
  GroupRuntimeAction,
  GroupRuntimeResumeInput,
  PiMonoCreateRunRequest,
} from './agent.types';
import { GroupAgentSessionService } from './group-agent-session.service';
import { GroupRuntimeTaskService } from './group-runtime-task.service';
import { PiMonoAdapter } from './pi-mono.adapter';
import { ProjectRuntimeContextService } from './project-runtime-context.service';
import { RoleProfileService } from './role-profile.service';

@Injectable()
export class GroupRuntimeService {
  private readonly logger = new Logger(GroupRuntimeService.name);
  private readonly maxPasses = 8;
  private readonly maxDurationMs = 120_000;
  private readonly processingReactionType = 'SMILE';

  constructor(
    private readonly prisma: PrismaService,
    private readonly piMono: PiMonoAdapter,
    private readonly groupSessions: GroupAgentSessionService,
    private readonly repoSync: RepoSyncService,
    private readonly runtimeContext: ProjectRuntimeContextService,
    private readonly roleProfiles: RoleProfileService,
    private readonly runtimeTasks: GroupRuntimeTaskService,
    private readonly feishu: FeishuService,
    @Inject(forwardRef(() => ConfirmationService)) private readonly confirmations: ConfirmationService,
    @InjectQueue(ARTIFACT_SYNC_QUEUE) private readonly artifactQueue: Queue,
  ) {}

  async handleMentionMessage(input: {
    projectId: string;
    environmentId: string;
    feishuChatId: string;
    messageSourceId: string;
    feishuMessageId?: string | null;
    prompt: string;
    senderOpenId?: string | null;
    traceId?: string | null;
  }) {
    const lockToken = `runtime-lock:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`;
    const acquired = await this.groupSessions.tryAcquireLock(input.feishuChatId, lockToken);
    if (!acquired) {
      await this.feishu.sendTextMessage('chat_id', input.feishuChatId, this.buildBusyReply());
      return { status: 'rejected_busy' as const };
    }

    try {
      const session = await this.groupSessions.getOrCreateSession(input.feishuChatId, {
        projectId: input.projectId,
        environmentId: input.environmentId,
        feishuChatId: input.feishuChatId,
        agentRole: AgentRole.manager,
        sessionMode: 'active',
      });
      await this.runtimeTasks.cancelQueuedTasksForSession(session.id, {
        excludeMessageSourceId: input.messageSourceId,
        resultSummary: 'Canceled because a newer @Kanban request arrived in the group.',
      });
      await this.clearProcessingReaction(session);
      await this.attachProcessingReaction(session, input.messageSourceId, input.feishuMessageId ?? null);
      return await this.runLoop({
        sessionId: session.id,
        projectId: input.projectId,
        environmentId: input.environmentId,
        feishuChatId: input.feishuChatId,
        messageSourceId: input.messageSourceId,
        senderOpenId: input.senderOpenId ?? null,
        traceId: input.traceId ?? null,
        initialPrompt: input.prompt,
      });
    } finally {
      const session = await this.prisma.groupAgentSession.findUnique({
        where: {
          feishuChatId_agentRole: {
            feishuChatId: input.feishuChatId,
            agentRole: AgentRole.manager,
          },
        },
      });
      if (session) {
        await this.clearProcessingReaction(session);
      }
      await this.groupSessions.releaseLock(input.feishuChatId, lockToken);
    }
  }

  async resumeFromConfirmation(id: string, input: GroupRuntimeResumeInput) {
    const confirmation = await this.prisma.confirmationRequest.findUnique({
      where: { id },
      include: { messageSource: true },
    });
    if (!confirmation?.groupRuntimeTaskId || !confirmation.projectId || !confirmation.environmentId) {
      return;
    }

    await this.runtimeTasks.releaseBlockedTask(
      confirmation.groupRuntimeTaskId,
      input.eventText || `Confirmation ${id} resolved.`,
    );

    const session = await this.groupSessions.getOrCreateSession(confirmation.messageSource.feishuChatId, {
      projectId: confirmation.projectId,
      environmentId: confirmation.environmentId,
      feishuChatId: confirmation.messageSource.feishuChatId,
      agentRole: AgentRole.manager,
      sessionMode: 'active',
    });

    return this.runLoop({
      sessionId: session.id,
      projectId: confirmation.projectId,
      environmentId: confirmation.environmentId,
      feishuChatId: confirmation.messageSource.feishuChatId,
      messageSourceId: confirmation.messageSourceId,
      senderOpenId: confirmation.confirmedBy ?? null,
      traceId: confirmation.messageSource.traceId ?? null,
      initialPrompt: input.eventText,
    });
  }

  async getSessionSnapshot(chatId: string) {
    const session = await this.prisma.groupAgentSession.findUnique({
      where: {
        feishuChatId_agentRole: {
          feishuChatId: chatId,
          agentRole: AgentRole.manager,
        },
      },
    });
    if (!session) {
      return null;
    }
    return {
      session,
      tasks: await this.runtimeTasks.listForSession(session.id),
      profile: session.projectId
        ? await this.roleProfiles.compile({
            projectId: session.projectId,
            projectName: session.feishuChatId,
            feishuChatId: session.feishuChatId,
            agentRole: AgentRole.manager,
          })
        : null,
    };
  }

  private async runLoop(input: {
    sessionId: string;
    projectId: string;
    environmentId: string;
    feishuChatId: string;
    messageSourceId: string;
    senderOpenId: string | null;
    traceId: string | null;
    initialPrompt: string;
  }) {
    const startedAt = Date.now();
    let prompt = input.initialPrompt;
    let pass = 0;
    let waitingConfirmation = false;

    while (pass < this.maxPasses && Date.now() - startedAt < this.maxDurationMs) {
      pass += 1;
      const environment = await this.prisma.projectEnvironment.findUniqueOrThrow({
        where: { id: input.environmentId },
      });
      await this.repoSync.maybeRefreshForInteractive({
        projectId: input.projectId,
        environmentId: environment.id,
        repoUrl: environment.repoUrl,
        repoBranch: environment.repoBranch,
        repoCredentialRef: environment.repoCredentialRef,
        lastRepoSyncAt: environment.lastRepoSyncAt,
        repoSyncStatus: environment.repoSyncStatus,
      });
      const refreshedEnvironment = await this.prisma.projectEnvironment.findUniqueOrThrow({
        where: { id: input.environmentId },
      });
      const session = await this.prisma.groupAgentSession.findUniqueOrThrow({
        where: { id: input.sessionId },
      });
      const tasks = await this.runtimeTasks.listForSession(session.id);
      const project = await this.prisma.project.findUniqueOrThrow({
        where: { id: input.projectId },
      });
      const roleProfile = await this.roleProfiles.compile({
        projectId: input.projectId,
        projectName: project.name,
        feishuChatId: input.feishuChatId,
        senderOpenId: input.senderOpenId,
        agentRole: AgentRole.manager,
      });
      const projectContextBundle = await this.runtimeContext.assemble({
        projectId: input.projectId,
        environmentId: input.environmentId,
        runtimeSessionKey: session.runtimeSessionKey,
        sessionMode: session.sessionMode,
        sessionStatus: this.runtimeContext.toSessionStatus(session.status),
        memorySummary: session.memorySummary,
      });

      const result = await this.piMono.runGroupRuntimeTurn({
        runtimeSessionKey: session.runtimeSessionKey,
        sessionStoreRef: session.sessionStoreRef,
        agentScopeKey: session.agentScopeKey,
        sessionMode: session.sessionMode,
        requestKind: 'group_runtime',
        projectContextBundle,
        runtimeTasks: tasks,
        roleProfile,
        project: {
          id: project.id,
          name: project.name,
          feishuChatId: project.feishuChatId,
        },
        environment: {
          id: refreshedEnvironment.id,
          name: refreshedEnvironment.name,
          piMonoEnvId: refreshedEnvironment.piMonoEnvId,
          repoUrl: refreshedEnvironment.repoUrl,
          repoBranch: refreshedEnvironment.repoBranch,
          repoCredentialRef: refreshedEnvironment.repoCredentialRef,
          repoMirrorPath: refreshedEnvironment.repoMirrorPath,
          repoSyncStatus: refreshedEnvironment.repoSyncStatus,
          repoSyncError: refreshedEnvironment.repoSyncError,
          repoHeadRef: refreshedEnvironment.repoHeadRef,
          projectPath: refreshedEnvironment.projectPath,
          modelEndpoint: refreshedEnvironment.modelEndpoint,
          modelName: refreshedEnvironment.modelName,
          skillSet: refreshedEnvironment.skillSet,
        },
        source: {
          messageSourceId: input.messageSourceId,
          senderOpenId: input.senderOpenId,
          traceId: input.traceId,
        },
        prompt,
        outputSchema: AGENT_OUTPUT_SCHEMA,
      });

      await this.groupSessions.syncRuntimeSessionState({
        sessionId: session.id,
        piSessionId: result.session.piSessionId,
        sessionStoreDriver: result.session.sessionStoreDriver,
        sessionStoreRef: result.session.sessionStoreRef ?? null,
        memorySummary: result.session.memorySummary ?? null,
        lastError: null,
        touchMessageAt: true,
        touchRunAt: true,
      });

      const turnResult = await this.applyTurnResult({
        sessionId: session.id,
        projectId: input.projectId,
        environmentId: input.environmentId,
        messageSourceId: input.messageSourceId,
        feishuChatId: input.feishuChatId,
        actions: result.actions,
        outputs: result.outputs ?? [],
      });
      waitingConfirmation = turnResult.waitingConfirmation;

      const updatedTasks = await this.runtimeTasks.listForSession(session.id);
      const runningTask = updatedTasks.find((task) => task.status === 'running') ?? null;
      await this.groupSessions.syncGroupRuntimeState({
        sessionId: session.id,
        currentRuntimeTaskId: runningTask?.id ?? null,
        runtimeStateJson: {
          pass,
          waitingConfirmation,
          pendingTasks: updatedTasks.filter((task) => task.status === 'queued').length,
        },
        touchRuntimeTurnAt: true,
      });

      if (waitingConfirmation || result.status !== 'succeeded') {
        break;
      }
      const hasRunnable = updatedTasks.some((task) => task.status === 'queued' || task.status === 'running');
      if (!hasRunnable) {
        break;
      }
      if (!turnResult.madeRunnableProgress && !runningTask) {
        this.logger.warn(
          `group runtime stalled for session ${session.id}: queued tasks remain but no runnable progress in pass ${pass}`,
        );
        break;
      }
      prompt = 'Continue processing the next runnable todo in the current queue. If nothing remains, finish silently.';
    }

    return { status: waitingConfirmation ? 'waiting_confirmation' : 'completed', passes: pass };
  }

  private async applyTurnResult(input: {
    sessionId: string;
    projectId: string;
    environmentId: string;
    messageSourceId: string;
    feishuChatId: string;
    actions: GroupRuntimeAction[];
    outputs: PiMonoCreateRunRequest['outputSchema'] extends never ? never : any[];
  }) {
    let waitingConfirmation = false;
    let currentTaskId: string | undefined;
    let madeRunnableProgress = false;

    for (const action of input.actions) {
      if (action.type === 'reply_group') {
        await this.feishu.sendTextMessage('chat_id', input.feishuChatId, action.text);
        continue;
      }

      if (action.type === 'todo_write') {
        const taskResult = await this.runtimeTasks.applyAction({
          groupSessionId: input.sessionId,
          projectId: input.projectId,
          environmentId: input.environmentId,
          messageSourceId: input.messageSourceId,
          type: action.action,
          taskId: action.taskId,
          title: action.title,
          description: action.description,
          intent: action.intent,
          skillHint: action.skillHint,
          outputMode: action.outputMode,
          taskPayload: action.taskPayload,
          resultSummary: action.resultSummary,
          errorMessage: action.errorMessage,
        });
        currentTaskId = this.resolveTaskId(action, taskResult) ?? currentTaskId;
        if (this.isRunnableProgressAction(action.action)) {
          madeRunnableProgress = true;
        }
        continue;
      }

      if (action.type === 'request_group_confirmation') {
        const confirmation = await this.confirmations.create({
          projectId: input.projectId,
          environmentId: input.environmentId,
          messageSourceId: input.messageSourceId,
          groupRuntimeTaskId: action.taskId,
          actionType: action.actionType,
          payload: action.payload,
          chatId: input.feishuChatId,
          summary: action.summary,
          detail: action.detail,
        });
        if (action.taskId) {
          await this.runtimeTasks.attachConfirmation(action.taskId, confirmation.id);
        }
        waitingConfirmation = true;
        madeRunnableProgress = true;
      }
    }

    if (input.outputs.length) {
      await this.createAuditRun({
        projectId: input.projectId,
        environmentId: input.environmentId,
        messageSourceId: input.messageSourceId,
        groupRuntimeTaskId: currentTaskId ?? null,
        outputs: input.outputs,
      });
    }

    return {
      waitingConfirmation,
      currentTaskId: currentTaskId ?? null,
      madeRunnableProgress,
    };
  }

  private isRunnableProgressAction(action: string) {
    return ['start', 'complete', 'fail', 'cancel', 'block'].includes(action);
  }

  private resolveTaskId(action: Extract<GroupRuntimeAction, { type: 'todo_write' }>, taskResult: any) {
    if (action.taskId) {
      return action.taskId;
    }
    if (taskResult && typeof taskResult === 'object' && 'id' in taskResult) {
      return String(taskResult.id);
    }
    return undefined;
  }

  private async createAuditRun(input: {
    projectId: string;
    environmentId: string;
    messageSourceId: string;
    groupRuntimeTaskId?: string | null;
    outputs: any[];
  }) {
    const outputSummary = input.outputs.map((output) => `${output.type}:${output.title}`).join(', ');
    const run = await this.prisma.agentRun.create({
      data: {
        projectId: input.projectId,
        environmentId: input.environmentId,
        messageSourceId: input.messageSourceId,
        groupRuntimeTaskId: input.groupRuntimeTaskId ?? null,
        intent: 'requirement_analysis',
        skillName: null,
        prompt: 'Generated by group runtime turn.',
        status: AgentRunStatus.syncing,
        progress: 95,
        outputSummary,
        rawOutputs: input.outputs as any,
        startedAt: new Date(),
      },
    });

    await this.artifactQueue.add('sync-run', { agentRunId: run.id }, { jobId: `${run.id}-sync` });
    return run;
  }

  private buildBusyReply() {
    return '当前群正在处理上一条 @ 任务。为避免上下文冲突，请稍后再 @ 我一次。';
  }

  private async attachProcessingReaction(
    session: { id: string; runtimeStateJson: unknown },
    messageSourceId: string,
    feishuMessageId: string | null,
  ) {
    if (!feishuMessageId) {
      return;
    }
    try {
      const response = await this.feishu.addMessageReaction(feishuMessageId, this.processingReactionType);
      const reactionId =
        response?.data?.reaction?.reaction_id ??
        response?.data?.reaction_id ??
        response?.data?.id ??
        null;
      await this.groupSessions.syncGroupRuntimeState({
        sessionId: session.id,
        runtimeStateJson: {
          ...this.readRuntimeState(session.runtimeStateJson),
          processingReaction: {
            messageSourceId,
            feishuMessageId,
            reactionId,
            reactionType: this.processingReactionType,
          },
        },
      });
    } catch (error) {
      this.logger.warn(
        `failed to attach processing reaction for message ${feishuMessageId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async clearProcessingReaction(session: { id: string; runtimeStateJson: unknown }) {
    const runtimeState = this.readRuntimeState(session.runtimeStateJson);
    const reaction =
      runtimeState.processingReaction &&
      typeof runtimeState.processingReaction === 'object' &&
      !Array.isArray(runtimeState.processingReaction)
        ? (runtimeState.processingReaction as Record<string, unknown>)
        : null;
    const messageId = typeof reaction?.feishuMessageId === 'string' ? reaction.feishuMessageId : null;
    const reactionId = typeof reaction?.reactionId === 'string' ? reaction.reactionId : null;
    if (messageId && reactionId) {
      try {
        await this.feishu.removeMessageReaction(messageId, reactionId);
      } catch (error) {
        this.logger.warn(
          `failed to clear processing reaction ${reactionId} for message ${messageId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    const nextState = { ...runtimeState };
    delete nextState.processingReaction;
    await this.groupSessions.syncGroupRuntimeState({
      sessionId: session.id,
      runtimeStateJson: nextState,
    });
  }

  private readRuntimeState(value: unknown) {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? ({ ...(value as Record<string, unknown>) })
      : {};
  }
}
