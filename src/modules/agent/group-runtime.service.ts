import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { AgentRole } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FeishuService } from '../feishu/feishu.service';
import { ARTIFACT_SYNC_QUEUE } from '../../queues/queue.constants';
import { GroupRuntimeResumeInput, RuntimeQueueMode, RuntimeStateSnapshot } from './agent.types';
import { GroupAgentSessionService } from './group-agent-session.service';
import { GroupRuntimeTaskService } from './group-runtime-task.service';
import { PiMonoAdapter } from './pi-mono.adapter';
import { RoleProfileService } from './role-profile.service';

@Injectable()
export class GroupRuntimeService {
  private readonly logger = new Logger(GroupRuntimeService.name);
  private readonly processingReactionType = 'SMILE';

  constructor(
    private readonly prisma: PrismaService,
    private readonly piMono: PiMonoAdapter,
    private readonly groupSessions: GroupAgentSessionService,
    private readonly roleProfiles: RoleProfileService,
    private readonly runtimeTasks: GroupRuntimeTaskService,
    private readonly feishu: FeishuService,
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
    const environment = await this.prisma.projectEnvironment.findUniqueOrThrow({
      where: { id: input.environmentId },
    });
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: input.projectId },
    });
    const session = await this.groupSessions.getOrCreateSession(input.feishuChatId, {
      projectId: input.projectId,
      environmentId: input.environmentId,
      feishuChatId: input.feishuChatId,
      agentRole: AgentRole.manager,
      sessionMode: 'active',
    });
    const groupPolicy = await this.prisma.groupPolicy.findFirst({
      where: {
        projectId: input.projectId,
        feishuChatId: input.feishuChatId,
        archivedAt: null,
      },
      orderBy: { updatedAt: 'desc' },
    });
    const roleProfile = await this.roleProfiles.compile({
      projectId: input.projectId,
      projectName: project.name,
      feishuChatId: input.feishuChatId,
      senderOpenId: input.senderOpenId,
      agentRole: AgentRole.manager,
    });
    const runtimeState = this.piMono.getRuntimeState(session.runtimeSessionKey);
    const queueMode = this.resolveQueueMode(input.prompt, ((groupPolicy as any)?.defaultQueueMode as RuntimeQueueMode) ?? 'collect', runtimeState);

    const submission = await this.piMono.submitMessage({
      runtimeSessionKey: session.runtimeSessionKey,
      contextBinding: {
        groupSessionId: session.id,
        projectId: input.projectId,
        environmentId: input.environmentId,
        feishuChatId: input.feishuChatId,
      },
      queueMode,
      project: {
        id: project.id,
        name: project.name,
        feishuChatId: project.feishuChatId,
      },
      environment: {
        id: environment.id,
        name: environment.name,
        piMonoEnvId: environment.piMonoEnvId,
        repoUrl: environment.repoUrl,
        repoBranch: environment.repoBranch,
        repoCredentialRef: environment.repoCredentialRef,
        repoMirrorPath: environment.repoMirrorPath,
        repoSyncStatus: environment.repoSyncStatus,
        repoSyncError: environment.repoSyncError,
        repoHeadRef: environment.repoHeadRef,
        projectPath: environment.projectPath,
        modelEndpoint: environment.modelEndpoint,
        modelName: environment.modelName,
        skillSet: environment.skillSet,
      },
      roleProfile,
      minimalContext: {
        sessionMemorySummary: session.memorySummary,
        repoReady: environment.repoSyncStatus === 'ready',
        repoHeadRef: environment.repoHeadRef,
      },
      envelope: {
        messageSourceId: input.messageSourceId,
        sourceType: 'group',
        senderOpenId: input.senderOpenId ?? null,
        feishuChatId: input.feishuChatId,
        feishuMessageId: input.feishuMessageId ?? null,
        traceId: input.traceId ?? null,
        rawText: input.prompt,
      },
    });
    await this.syncRuntimeState(session.id, session.runtimeSessionKey);
    await this.clearProcessingReaction(session.id);
    await this.attachProcessingReaction(session.id, input.messageSourceId, input.feishuMessageId ?? null);
    return {
      status: submission.action,
      runtimeSessionKey: submission.runtimeSessionKey,
      activeTurnId: submission.activeTurnId ?? null,
    };
  }

  async resumeFromConfirmation(id: string, input: GroupRuntimeResumeInput) {
    const confirmation = await this.prisma.confirmationRequest.findUnique({
      where: { id },
      include: { messageSource: true },
    });
    if (!confirmation?.groupRuntimeTaskId || !confirmation.projectId || !confirmation.environmentId) {
      return;
    }

    const session = await this.groupSessions.getOrCreateSession(confirmation.messageSource.feishuChatId, {
      projectId: confirmation.projectId,
      environmentId: confirmation.environmentId,
      feishuChatId: confirmation.messageSource.feishuChatId,
      agentRole: AgentRole.manager,
      sessionMode: 'active',
    });
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: confirmation.projectId },
    });
    const environment = await this.prisma.projectEnvironment.findUniqueOrThrow({
      where: { id: confirmation.environmentId },
    });
    const roleProfile = await this.roleProfiles.compile({
      projectId: confirmation.projectId,
      projectName: project.name,
      feishuChatId: confirmation.messageSource.feishuChatId,
      senderOpenId: confirmation.confirmedBy ?? null,
      agentRole: AgentRole.manager,
    });

    const result = await this.piMono.resumeSession({
      runtimeSessionKey: session.runtimeSessionKey,
      contextBinding: {
        groupSessionId: session.id,
        projectId: confirmation.projectId,
        environmentId: confirmation.environmentId,
        feishuChatId: confirmation.messageSource.feishuChatId,
      },
      project: {
        id: project.id,
        name: project.name,
        feishuChatId: project.feishuChatId,
      },
      environment: {
        id: environment.id,
        name: environment.name,
        piMonoEnvId: environment.piMonoEnvId,
        repoUrl: environment.repoUrl,
        repoBranch: environment.repoBranch,
        repoCredentialRef: environment.repoCredentialRef,
        repoMirrorPath: environment.repoMirrorPath,
        repoSyncStatus: environment.repoSyncStatus,
        repoSyncError: environment.repoSyncError,
        repoHeadRef: environment.repoHeadRef,
        projectPath: environment.projectPath,
        modelEndpoint: environment.modelEndpoint,
        modelName: environment.modelName,
        skillSet: environment.skillSet,
      },
      roleProfile,
      minimalContext: {
        sessionMemorySummary: session.memorySummary,
        repoReady: environment.repoSyncStatus === 'ready',
        repoHeadRef: environment.repoHeadRef,
      },
      event: {
        type: 'confirmation_resolved',
        payload: {
          confirmationId: id,
          taskId: confirmation.groupRuntimeTaskId,
          messageSourceId: confirmation.messageSourceId,
          decidedStatus: confirmation.status,
        },
        text: input.eventText,
      },
    });
    await this.syncRuntimeState(session.id, session.runtimeSessionKey);
    return result;
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
      runtimeState:
        this.piMono.getRuntimeState(session.runtimeSessionKey) ??
        this.readRuntimeSnapshot(session.runtimeStateJson),
      runtimeEvents:
        this.piMono.pullRuntimeEvents({ runtimeSessionKey: session.runtimeSessionKey }).length
          ? this.piMono.pullRuntimeEvents({ runtimeSessionKey: session.runtimeSessionKey })
          : await this.readPersistedRuntimeEvents(session.id),
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

  private async syncRuntimeState(sessionId: string, runtimeSessionKey: string) {
    const snapshot = this.piMono.getSessionSnapshot(runtimeSessionKey);
    const runtimeState = this.piMono.getRuntimeState(runtimeSessionKey);
    if (snapshot) {
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
    if (runtimeState) {
      await this.groupSessions.syncGroupRuntimeState({
        sessionId,
        currentRuntimeTaskId: null,
        runtimeStateJson: runtimeState as any,
        touchRuntimeTurnAt: true,
      });
    }
  }

  private async attachProcessingReaction(
    sessionId: string,
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
      const currentState = await this.loadPersistedRuntimeState(sessionId);
      await this.groupSessions.syncGroupRuntimeState({
        sessionId,
        runtimeStateJson: {
          ...currentState,
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

  private async clearProcessingReaction(sessionId: string) {
    const runtimeState = await this.loadPersistedRuntimeState(sessionId);
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
      sessionId,
      runtimeStateJson: nextState,
    });
  }

  private async loadPersistedRuntimeState(sessionId: string) {
    const session = await this.prisma.groupAgentSession.findUnique({
      where: { id: sessionId },
      select: { runtimeStateJson: true },
    });
    return this.readRuntimeState(session?.runtimeStateJson);
  }

  private readRuntimeSnapshot(value: unknown): RuntimeStateSnapshot | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as RuntimeStateSnapshot;
  }

  private async readPersistedRuntimeEvents(sessionId: string) {
    const events = await (this.prisma as any).runtimeEvent.findMany({
      where: { groupSessionId: sessionId },
      orderBy: [{ sequence: 'asc' }],
      take: 100,
    });
    return events.map((event: any) => ({
      runtimeSessionKey: event.runtimeSessionKey,
      sequence: event.sequence,
      type: event.eventType,
      payload:
        event.payload && typeof event.payload === 'object' && !Array.isArray(event.payload)
          ? (event.payload as Record<string, unknown>)
          : {},
      createdAt: event.createdAt.toISOString(),
    }));
  }

  private readRuntimeState(value: unknown) {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? ({ ...(value as Record<string, unknown>) })
      : {};
  }

  private resolveQueueMode(
    rawText: string,
    defaultQueueMode: RuntimeQueueMode,
    runtimeState: RuntimeStateSnapshot | null,
  ): RuntimeQueueMode {
    const normalized = rawText.trim().toLowerCase();
    if (!normalized) {
      return defaultQueueMode;
    }

    const interruptSignals = [
      '等等',
      '等下',
      '等一下',
      '先别',
      '先不要',
      '不要做',
      '暂停',
      '停一下',
      '先停',
      'stop',
      'pause',
      'hold on',
      'cancel that',
    ];
    if (interruptSignals.some((signal) => normalized.includes(signal))) {
      return 'interrupt';
    }

    const followupSignals = ['继续', '接着', '按刚才', '照刚才', '往下做', '继续做', 'continue', 'go on'];
    if (followupSignals.some((signal) => normalized.includes(signal))) {
      return 'followup';
    }

    const supplementSignals = [
      '补充',
      '补一个',
      '再加',
      '加一个',
      '另外',
      '还有',
      '顺便',
      '补一句',
      '再补充',
      'also',
      'add ',
      'one more',
    ];
    if (supplementSignals.some((signal) => normalized.includes(signal))) {
      if (runtimeState?.status === 'running' && runtimeState.isStreaming) {
        return 'steer';
      }
      return 'collect';
    }

    return defaultQueueMode;
  }
}
