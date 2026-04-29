import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AgentRunStatus } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { assertAgentRunTransition } from '../../common/state/state-machine';
import { AGENT_RUN_QUEUE, ARTIFACT_SYNC_QUEUE } from '../../queues/queue.constants';
import { GroupAgentSessionService } from './group-agent-session.service';
import { SessionSubmitResult } from './group-agent-session.types';
import {
  InteractiveGroupSubmitResult,
  ManagerConfirmationPayload,
  ManagerInteractiveDecision,
} from './agent.types';
import { PiMonoAdapter } from './pi-mono.adapter';
import { ProjectRuntimeContextService } from './project-runtime-context.service';
import { RepoSyncService } from '../repo/repo-sync.service';

@Injectable()
export class AgentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly groupSessions: GroupAgentSessionService,
    private readonly piMono: PiMonoAdapter,
    private readonly runtimeContext: ProjectRuntimeContextService,
    private readonly repoSync: RepoSyncService,
    @InjectQueue(AGENT_RUN_QUEUE) private readonly agentRunQueue: Queue,
    @InjectQueue(ARTIFACT_SYNC_QUEUE) private readonly artifactSyncQueue: Queue,
  ) {}

  async createRun(input: {
    projectId: string;
    environmentId: string;
    messageSourceId?: string;
    prompt: string;
    intent?: string;
    skillName?: string | null;
  }) {
    const project = await this.prisma.project.findUnique({ where: { id: input.projectId } });
    const environment = await this.prisma.projectEnvironment.findUnique({ where: { id: input.environmentId } });
    if (!project || !environment) throw new BadRequestException('Invalid project or environment');
    const run = await this.prisma.agentRun.create({
      data: {
        projectId: project.id,
        environmentId: environment.id,
        messageSourceId: input.messageSourceId,
        runType: 'formal_execution',
        intent: input.intent ?? 'requirement_analysis',
        skillName: input.skillName ?? null,
        prompt: input.prompt,
      } as any,
    });
    await this.agentRunQueue.add('start', { agentRunId: run.id }, { jobId: run.id });
    return run;
  }

  async handleInteractiveGroupMessage(input: {
    sessionId: string;
    projectId: string;
    environmentId: string;
    feishuChatId: string;
    messageSourceId?: string;
    prompt: string;
    senderOpenId?: string;
    traceId?: string;
  }): Promise<InteractiveGroupSubmitResult> {
    const session = await this.prisma.groupAgentSession.findUnique({ where: { id: input.sessionId } });
    if (!session) {
      return { status: 'failed', reason: 'Group session not found' };
    }

    const project = await this.prisma.project.findUnique({ where: { id: input.projectId } });
    const environment = await this.prisma.projectEnvironment.findUnique({ where: { id: input.environmentId } });
    const groupPolicy = await this.prisma.groupPolicy.findFirst({
      where: {
        projectId: input.projectId,
        feishuChatId: input.feishuChatId,
        archivedAt: null,
      },
      orderBy: { updatedAt: 'desc' },
    });
    if (!project || !environment) {
      return { status: 'failed', reason: 'Invalid project or environment' };
    }

    const lockToken = `run-lock:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`;
    const acquired = await this.groupSessions.tryAcquireLock(input.feishuChatId, lockToken);
    if (!acquired) {
      return {
        status: 'rejected_busy',
        reason: (await this.groupSessions.getBusyReason(input.feishuChatId)) ?? 'busy',
      };
    }

    let retainLock = false;
    try {
      const interactiveRepoRefresh = await this.repoSync.maybeRefreshForInteractive({
        projectId: project.id,
        environmentId: environment.id,
        repoUrl: environment.repoUrl,
        repoBranch: environment.repoBranch,
        repoCredentialRef: environment.repoCredentialRef,
        lastRepoSyncAt: environment.lastRepoSyncAt,
        repoSyncStatus: environment.repoSyncStatus,
      });
      const refreshedEnvironment =
        interactiveRepoRefresh.attempted || environment.repoMirrorPath === null
          ? await this.prisma.projectEnvironment.findUniqueOrThrow({ where: { id: environment.id } })
          : environment;
      const projectContextBundle = await this.runtimeContext.assemble({
        projectId: project.id,
        environmentId: refreshedEnvironment.id,
        runtimeSessionKey: session.runtimeSessionKey,
        sessionMode: session.sessionMode,
        sessionStatus: this.runtimeContext.toSessionStatus(session.status),
        memorySummary: session.memorySummary,
      });

      const decision = await this.piMono.runManagerDecision({
        runtimeSessionKey: session.runtimeSessionKey,
        sessionStoreRef: session.sessionStoreRef,
        agentScopeKey: session.agentScopeKey,
        sessionMode: session.sessionMode,
        projectContextBundle,
        project: { id: project.id, name: project.name, feishuChatId: project.feishuChatId },
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
          senderOpenId: input.senderOpenId ?? null,
          traceId: input.traceId ?? null,
        },
        prompt: this.buildInteractivePrompt({
          rawText: input.prompt,
          memorySummary: projectContextBundle.session.memorySummary ?? session.memorySummary ?? null,
          environment: refreshedEnvironment,
        }),
      });

      await this.syncSessionSnapshot(session.id, session.runtimeSessionKey);

      if (decision.action === 'ask_followup') {
        return {
          status: 'followup',
          session: { id: session.id, runtimeSessionKey: session.runtimeSessionKey },
          decision,
          reply: decision.reply,
        };
      }

      const allowedSkills = Array.isArray(groupPolicy?.allowedSkillsJson)
        ? groupPolicy!.allowedSkillsJson.map((item) => String(item))
        : [];
      if (decision.skillHint && allowedSkills.length && !allowedSkills.includes(decision.skillHint)) {
        return {
          status: 'followup',
          session: { id: session.id, runtimeSessionKey: session.runtimeSessionKey },
          decision,
          reply: `当前群策略未启用技能 ${decision.skillHint}，请先在控制台调整策略后再执行。`,
        };
      }

      if (
        decision.action === 'execute' &&
        groupPolicy?.highRiskActionsRequireConfirmation &&
        this.requiresPolicyConfirmation(decision)
      ) {
        return {
          status: 'confirmation_requested',
          session: { id: session.id, runtimeSessionKey: session.runtimeSessionKey },
          decision,
          reply: `${decision.reply}\n\n根据当前群策略，这类高风险动作需要先确认。`,
          actionType: decision.intent,
          confirmationPayload: this.toConfirmationPayload(input.prompt, decision),
        };
      }

      if (decision.action === 'request_confirmation') {
        return {
          status: 'confirmation_requested',
          session: { id: session.id, runtimeSessionKey: session.runtimeSessionKey },
          decision,
          reply: decision.reply,
          actionType: decision.intent,
          confirmationPayload: this.toConfirmationPayload(input.prompt, decision),
        };
      }

      const queued = await this.queueGroupExecution({
        session,
        project,
        environment: refreshedEnvironment,
        lockToken,
        messageSourceId: input.messageSourceId,
        prompt: this.buildExecutionPrompt(input.prompt, decision),
        intent: decision.intent,
        skillName: decision.skillHint ?? null,
      });
      if (queued.status !== 'accepted' || !queued.runId || !queued.lockToken) {
        return {
          status: 'failed',
          reason: queued.status === 'failed' ? queued.reason : 'Failed to queue manager execution',
        };
      }

      retainLock = true;
      return {
        status: 'accepted',
        session: { id: session.id, runtimeSessionKey: session.runtimeSessionKey },
        decision,
        reply: decision.reply,
        runId: queued.runId,
        lockToken: queued.lockToken,
      };
    } catch (error) {
      return {
        status: 'failed',
        reason: error instanceof Error ? error.message : String(error),
      };
    } finally {
      if (!retainLock) {
        await this.groupSessions.releaseLock(input.feishuChatId, lockToken);
      }
    }
  }

  async submitGroupMessage(input: {
    sessionId: string;
    projectId: string;
    environmentId: string;
    feishuChatId: string;
    messageSourceId?: string;
    prompt: string;
    intent?: string;
    skillName?: string | null;
  }): Promise<SessionSubmitResult> {
    const session = await this.prisma.groupAgentSession.findUnique({ where: { id: input.sessionId } });
    if (!session) {
      return { status: 'failed', reason: 'Group session not found' };
    }

    const project = await this.prisma.project.findUnique({ where: { id: input.projectId } });
    const environment = await this.prisma.projectEnvironment.findUnique({ where: { id: input.environmentId } });
    if (!project || !environment) {
      return { status: 'failed', session, reason: 'Invalid project or environment' };
    }

    const lockToken = `run-lock:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`;
    const acquired = await this.groupSessions.tryAcquireLock(input.feishuChatId, lockToken);
    if (!acquired) {
      return {
        status: 'rejected_busy',
        session,
        reason: (await this.groupSessions.getBusyReason(input.feishuChatId)) ?? 'busy',
      };
    }

    try {
      return this.queueGroupExecution({
        session,
        project,
        environment,
        lockToken,
        messageSourceId: input.messageSourceId,
        prompt: input.prompt,
        intent: input.intent ?? 'requirement_analysis',
        skillName: input.skillName ?? null,
      });
    } catch (error) {
      await this.groupSessions.releaseLock(input.feishuChatId, lockToken);
      return {
        status: 'failed',
        session,
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async findRun(id: string) {
    const run = await this.prisma.agentRun.findUnique({ where: { id }, include: { artifacts: true } });
    if (!run) throw new NotFoundException('Agent run not found');
    return run;
  }

  async cancelRun(id: string) {
    const run = await this.findRun(id);
    assertAgentRunTransition(run.status, AgentRunStatus.canceled);

    if (run.status === AgentRunStatus.queued) {
      const queuedJob = await this.agentRunQueue.getJob(id);
      await queuedJob?.remove().catch(() => undefined);

      const updated = await this.prisma.agentRun.update({
        where: { id },
        data: {
          status: AgentRunStatus.canceled,
          finishedAt: new Date(),
          errorCode: 'CANCELED',
          errorMessage: 'Agent run canceled before execution started.',
        },
      });
      await this.groupSessions.handleRunStatusTransition(updated.id, AgentRunStatus.canceled);
      return updated;
    }

    await this.piMono.cancelRun(id);
    return this.prisma.agentRun.update({
      where: { id },
      data: {
        status: AgentRunStatus.canceled,
        finishedAt: new Date(),
        errorCode: 'CANCELED',
        errorMessage: 'Agent run cancellation requested.',
      },
    });
  }

  async transition(id: string, status: AgentRunStatus, data: Record<string, unknown> = {}) {
    const run = await this.findRun(id);
    assertAgentRunTransition(run.status, status);
    const updated = await this.prisma.agentRun.update({ where: { id }, data: { status, ...data } });
    await this.groupSessions.handleRunStatusTransition(
      updated.id,
      status,
      (data.errorMessage as string | undefined) ?? updated.errorMessage,
    );
    return updated;
  }

  async retrySync(id: string) {
    await this.findRun(id);
    await this.artifactSyncQueue.add('sync-run', { agentRunId: id });
    return { queued: true };
  }

  private async queueGroupExecution(input: {
    session: { id: string };
    project: { id: string };
    environment: { id: string };
    lockToken: string;
    messageSourceId?: string;
    prompt: string;
    intent: string;
    skillName?: string | null;
  }): Promise<SessionSubmitResult> {
    const run = await this.prisma.agentRun.create({
      data: {
        projectId: input.project.id,
        environmentId: input.environment.id,
        messageSourceId: input.messageSourceId,
        runType: 'formal_execution',
        intent: input.intent,
        skillName: input.skillName ?? null,
        prompt: input.prompt,
      } as any,
    });

    await this.groupSessions.markRunQueued({
      sessionId: input.session.id,
      runId: run.id,
      lockToken: input.lockToken,
      environmentId: input.environment.id,
    });

    await this.agentRunQueue.add('start', { agentRunId: run.id }, { jobId: run.id });
    const updatedSession = await this.prisma.groupAgentSession.findUniqueOrThrow({ where: { id: input.session.id } });
    return { status: 'accepted', session: updatedSession, runId: run.id, lockToken: input.lockToken };
  }

  private async syncSessionSnapshot(sessionId: string, runtimeSessionKey: string) {
    const snapshot = this.piMono.getSessionSnapshot(runtimeSessionKey);
    if (!snapshot) {
      return;
    }

    await this.groupSessions.syncRuntimeSessionState({
      sessionId,
      piSessionId: snapshot.piSessionId,
      sessionStoreDriver: snapshot.sessionStoreDriver,
      sessionStoreRef: snapshot.sessionStoreRef ?? null,
      memorySummary: snapshot.memorySummary ?? null,
      lastError: null,
      touchMessageAt: true,
      touchRunAt: true,
    });
  }

  private buildInteractivePrompt(input: {
    rawText: string;
    memorySummary?: string | null;
    environment: {
      repoMirrorPath?: string | null;
      repoSyncStatus?: string | null;
      repoSyncError?: string | null;
      repoHeadRef?: string | null;
    };
  }) {
    return [
      'This is an interactive manager decision turn for a Feishu project workspace.',
      'Decide whether to ask a follow-up question, request confirmation, or execute immediately.',
      'If the request is ambiguous or missing key constraints, prefer ask_followup.',
      input.memorySummary ? `Session memory summary: ${input.memorySummary}` : 'Session memory summary: none',
      `Repo mirror path: ${input.environment.repoMirrorPath ?? 'not prepared'}`,
      `Repo sync status: ${input.environment.repoSyncStatus ?? 'unknown'}`,
      `Repo head: ${input.environment.repoHeadRef ?? 'unknown'}`,
      input.environment.repoSyncError ? `Repo sync error: ${input.environment.repoSyncError}` : 'Repo sync error: none',
      `Latest user message: ${input.rawText}`,
    ].join('\n');
  }

  private buildExecutionPrompt(rawText: string, decision: ManagerInteractiveDecision) {
    return [
      'This is a manager-approved formal execution request.',
      `Original user message: ${rawText}`,
      `Execution intent: ${decision.intent}`,
      `Execution goal: ${decision.executionGoal ?? decision.reply}`,
      `Requested output mode: ${decision.outputMode ?? 'summary'}`,
      decision.targetChannels?.length ? `Target channels: ${decision.targetChannels.join(', ')}` : 'Target channels: not specified',
      `Execution request: ${decision.executionPrompt ?? rawText}`,
    ].join('\n');
  }

  private toConfirmationPayload(rawText: string, decision: ManagerInteractiveDecision): ManagerConfirmationPayload {
    return {
      reply: decision.reply,
      intent: decision.intent,
      executionGoal: decision.executionGoal,
      executionPrompt: decision.executionPrompt ?? this.buildExecutionPrompt(rawText, decision),
      outputMode: decision.outputMode,
      targetChannels: decision.targetChannels,
      skillHint: decision.skillHint ?? null,
      metadata: {
        ...(decision.metadata ?? {}),
        confirmationRequested: true,
        decisionReason: decision.reason,
        originalUserMessage: rawText,
      },
    };
  }

  private requiresPolicyConfirmation(decision: ManagerInteractiveDecision) {
    if (decision.intent === 'environment_switch') {
      return true;
    }
    if (decision.outputMode === 'task') {
      return true;
    }
    if (decision.targetChannels?.includes('bitable')) {
      return true;
    }
    return Boolean(decision.metadata?.requiresConfirmation === true);
  }
}
