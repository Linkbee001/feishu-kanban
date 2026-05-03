import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { AgentRole } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FeishuService } from '../feishu/feishu.service';
import { ARTIFACT_SYNC_QUEUE } from '../../queues/queue.constants';
import { GroupRuntimeResumeInput } from './agent.types';
import { RuntimeState } from './session-context.types';
import { GroupAgentSessionService } from './group-agent-session.service';
import { SessionStateService } from './session-state.service';
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
    private readonly sessionState: SessionStateService,
    private readonly roleProfiles: RoleProfileService,
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
    // Get or create session
    const session = await this.groupSessions.getOrCreateSession(input.feishuChatId, {
      projectId: input.projectId,
      environmentId: input.environmentId,
      feishuChatId: input.feishuChatId,
      agentRole: AgentRole.manager,
      sessionMode: 'active',
    });

    // Get project for role profile compilation
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: input.projectId },
    });

    // Compile role profile
    const roleProfile = await this.roleProfiles.compile({
      projectId: input.projectId,
      projectName: project.name,
      feishuChatId: input.feishuChatId,
      senderOpenId: input.senderOpenId,
      agentRole: AgentRole.manager,
    });

    // Direct steer call with role profile
    const result = await this.piMono.steer(
      session.runtimeSessionKey,
      input.prompt,
      {
        projectId: input.projectId,
        environmentId: input.environmentId,
        feishuChatId: input.feishuChatId,
        messageSourceId: input.messageSourceId,
        feishuMessageId: input.feishuMessageId,
        senderOpenId: input.senderOpenId,
        traceId: input.traceId,
      },
      roleProfile,
    );

    // Update state if starting execution
    const currentState = await this.sessionState.getState(session.id);
    if (currentState === 'idle') {
      await this.sessionState.transitionTo(session.id, 'running', 'Message submitted');
    }

    // Sync runtime session state
    await this.syncRuntimeState(session.id, session.runtimeSessionKey);
    await this.clearProcessingReaction(session.id);
    await this.attachProcessingReaction(session.id, input.messageSourceId, input.feishuMessageId ?? null);

    return {
      status: result.action,
      runtimeSessionKey: result.runtimeSessionKey,
      activeTurnId: result.activeTurnId ?? null,
    };
  }

  async resumeFromConfirmation(id: string, input: GroupRuntimeResumeInput) {
    const confirmation = await this.prisma.confirmationRequest.findUnique({
      where: { id },
      include: { messageSource: true },
    });
    if (!confirmation?.projectId || !confirmation?.environmentId) {
      return { accepted: false };
    }

    const session = await this.groupSessions.getOrCreateSession(confirmation.messageSource.feishuChatId, {
      projectId: confirmation.projectId,
      environmentId: confirmation.environmentId,
      feishuChatId: confirmation.messageSource.feishuChatId,
      agentRole: AgentRole.manager,
      sessionMode: 'active',
    });

    // Get project for role profile compilation
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: confirmation.projectId },
    });

    // Compile role profile
    const roleProfile = await this.roleProfiles.compile({
      projectId: confirmation.projectId,
      projectName: project.name,
      feishuChatId: confirmation.messageSource.feishuChatId,
      senderOpenId: confirmation.confirmedBy ?? null,
      agentRole: AgentRole.manager,
    });

    // Clear waiting state
    await this.sessionState.clearWaiting(session.id);

    // Resume with followUp
    const result = await this.piMono.followUp(
      session.runtimeSessionKey,
      {
        type: 'confirmation_resolved',
        text: input.eventText,
        payload: {
          confirmationId: id,
          taskId: confirmation.groupRuntimeTaskId,
          messageSourceId: confirmation.messageSourceId,
          decidedStatus: confirmation.status,
        },
      },
      {
        projectId: confirmation.projectId,
        environmentId: confirmation.environmentId,
        feishuChatId: confirmation.messageSource.feishuChatId,
        messageSourceId: confirmation.messageSourceId,
      },
      roleProfile,
    );

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
      tasks: [], // Tasks removed - GroupRuntimeTask table deprecated
      runtimeState:
        this.piMono.getRuntimeState(session.runtimeSessionKey) ??
        this.readRuntimeSnapshot(session.runtimeStateJson),
      runtimeEvents:
        this.piMono.pullRuntimeEvents({ runtimeSessionKey: session.runtimeSessionKey }).length
          ? this.piMono.pullRuntimeEvents({ runtimeSessionKey: session.runtimeSessionKey })
          : await this.readPersistedRuntimeEvents(session.id),
      profile: null, // Profile removed - use session context instead
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

  private readRuntimeSnapshot(value: unknown): RuntimeState | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    const obj = value as Record<string, unknown>;
    return (obj.runtimeState as RuntimeState) ?? 'idle';
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

  }
