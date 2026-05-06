import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FeishuService } from '../feishu/feishu.service';
import { RuntimeEvent, RuntimeEventType } from './agent.types';
import { RuntimeState } from './session-context.types';
import { SimplifiedContextBinding, SessionRuntimeState } from './pi-session-state.service';

/**
 * Service for runtime event recording, projection sync, and confirmation creation.
 * Per D-01 (responsibility domains), owns event persistence and GroupAgentSession state sync.
 * Per D-02 (Pi prefix), follows Pi* naming convention for Pi SDK-related services.
 * Per D-03 (coordinator pattern), called by PiMonoAdapter for event-related operations.
 */
@Injectable()
export class PiEventRecorder {
  private readonly logger = new Logger(PiEventRecorder.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly feishu: FeishuService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Records a runtime event to database and syncs session projection.
   * Called by PiMonoAdapter to persist event and update GroupAgentSession state.
   */
  async recordRuntimeEvent(
    state: SessionRuntimeState,
    runtimeStateValue: RuntimeState | null,
    type: RuntimeEventType,
    payload: Record<string, unknown>,
    contextBinding?: SimplifiedContextBinding,
  ): Promise<void> {
    const event: RuntimeEvent = {
      sequence: state.eventSequence + 1,
      at: new Date().toISOString(),
      type,
      payload,
    };
    state.eventSequence = event.sequence;
    state.recentEvents.push(event);
    if (state.recentEvents.length > 100) {
      state.recentEvents.splice(0, state.recentEvents.length - 100);
    }
    this.logger.log(`runtime event: session=${state.runtimeSessionKey} seq=${event.sequence} type=${event.type}`);

    const eventContext = contextBinding ?? state.currentContext;

    await (this.prisma as any).runtimeEvent.create({
      data: {
        runtimeSessionKey: state.runtimeSessionKey,
        groupSessionId: eventContext?.groupSessionId ?? null,
        projectId: eventContext?.projectId ?? null,
        environmentId: eventContext?.environmentId ?? null,
        sequence: event.sequence,
        eventType: event.type,
        payload: event.payload as any,
      },
    });

    await this.projectRuntimeEvent(state, event, eventContext);
    await this.syncRuntimeSessionProjection(state, runtimeStateValue, event, eventContext);
  }

  /**
   * Projects runtime event to downstream effects.
   * Handles confirmation_requested events by creating confirmation.
   */
  async projectRuntimeEvent(
    state: SessionRuntimeState,
    event: RuntimeEvent,
    contextBinding?: SimplifiedContextBinding,
  ): Promise<void> {
    // Note: reply_emitted, todo_changed, outputs_emitted event types removed in refactor
    // Reply and outputs handling moved to applyRuntimeTurnResult
    if (event.type === 'confirmation_requested') {
      await this.createRuntimeConfirmation(state, event.payload, contextBinding);
    }
  }

  /**
   * Syncs runtime session state to GroupAgentSession.runtimeStateJson projection.
   * Updates database for monitoring and recovery.
   */
  async syncRuntimeSessionProjection(
    state: SessionRuntimeState,
    runtimeStateValue: RuntimeState | null,
    event: RuntimeEvent,
    contextBinding?: SimplifiedContextBinding,
  ): Promise<void> {
    const groupSessionId = contextBinding?.groupSessionId ?? state.currentContext?.groupSessionId;
    if (!groupSessionId) {
      return;
    }

    const existing = await this.prisma.groupAgentSession.findUnique({
      where: { id: groupSessionId },
      select: { runtimeStateJson: true },
    });
    const existingState =
      existing?.runtimeStateJson &&
      typeof existing.runtimeStateJson === 'object' &&
      !Array.isArray(existing.runtimeStateJson)
        ? ({ ...(existing.runtimeStateJson as Record<string, unknown>) })
        : {};

    const nextState: Record<string, unknown> = {
      ...existingState,
      runtimeSessionKey: state.runtimeSessionKey,
      piSessionId: state.session.sessionId,
      runtimeState: runtimeStateValue ?? 'idle',
      isStreaming: state.session.isStreaming,
      memorySummary: state.lastAssistantText ?? null,
      currentTurn: state.currentTurn
        ? {
            turnId: state.currentTurn.turnId,
            startedAt: state.currentTurn.startedAt,
            messageSourceId: state.currentTurn.messageSourceId ?? null,
          }
        : null,
      waitingReason: state.waitingReason ?? null,
    };

    if (event.type === 'turn_completed' || event.type === 'session_state_changed') {
      await this.clearRuntimeProcessingReaction(nextState);
    }

    await this.prisma.groupAgentSession.update({
      where: { id: groupSessionId },
      data: {
        runtimeStateJson: nextState as any,
        lastRuntimeTurnAt: new Date(),
      },
    });
  }

  /**
   * Clears processing reaction from Feishu message.
   * Called when turn completes or session state changes.
   */
  async clearRuntimeProcessingReaction(runtimeState: Record<string, unknown>): Promise<void> {
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
          `Failed to clear processing reaction ${reactionId} for message ${messageId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    delete runtimeState.processingReaction;
  }

  /**
   * Creates a confirmation request and sends Feishu card.
   * Called when confirmation_requested event is projected.
   */
  async createRuntimeConfirmation(
    state: SessionRuntimeState,
    payload: Record<string, unknown>,
    contextBinding?: SimplifiedContextBinding,
  ): Promise<void> {
    const binding = contextBinding ?? state.currentContext;
    const chatId = binding?.feishuChatId;
    const messageSourceId = typeof payload.messageSourceId === 'string' ? payload.messageSourceId : null;
    if (!chatId || !messageSourceId) {
      return;
    }
    const ttl = this.config.get<number>('CONFIRMATION_TTL_MINUTES') ?? 30;
    const expiresAt = new Date(Date.now() + ttl * 60_000);
    const confirmation = await this.prisma.confirmationRequest.create({
      data: {
        projectId: binding?.projectId,
        environmentId: binding?.environmentId,
        messageSourceId,
        actionType: typeof payload.actionType === 'string' ? payload.actionType : 'runtime_confirmation',
        payload: (payload.payload ?? {}) as any,
        expiresAt,
      },
    });
    const sent = await this.feishu.sendCard(
      'chat_id',
      chatId,
      this.buildRuntimeConfirmationCard(
        confirmation.id,
        typeof payload.actionType === 'string' ? payload.actionType : 'runtime_confirmation',
        expiresAt,
        typeof payload.summary === 'string' ? payload.summary : undefined,
        typeof payload.detail === 'string' ? payload.detail : undefined,
      ),
    );
    const cardMessageId = (sent as any)?.data?.message_id ?? null;
    await this.prisma.confirmationRequest.update({
      where: { id: confirmation.id },
      data: { cardMessageId },
    });
  }

  /**
   * Builds Feishu confirmation card JSON.
   * Returns card structure with confirm/reject buttons.
   */
  buildRuntimeConfirmationCard(
    id: string,
    actionType: string,
    expiresAt: Date,
    summary?: string,
    detail?: string,
  ): Record<string, unknown> {
    return {
      config: { wide_screen_mode: true },
      header: { title: { tag: 'plain_text', content: '需要确认' }, template: 'orange' },
      elements: [
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: [
              `动作：${actionType}`,
              summary ? `说明：${summary}` : null,
              detail ? `原因：${detail}` : null,
              `过期时间：${expiresAt.toISOString()}`,
            ]
              .filter(Boolean)
              .join('\n'),
          },
        },
        {
          tag: 'action',
          actions: [
            {
              tag: 'button',
              text: { tag: 'plain_text', content: '确认' },
              type: 'primary',
              value: { confirmationId: id, decision: 'confirm' },
            },
            {
              tag: 'button',
              text: { tag: 'plain_text', content: '拒绝' },
              type: 'danger',
              value: { confirmationId: id, decision: 'reject' },
            },
          ],
        },
      ],
    };
  }
}