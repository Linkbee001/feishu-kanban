import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { PiEventRecorder } from '../src/modules/agent/pi-event-recorder.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { FeishuService } from '../src/modules/feishu/feishu.service';
import { RuntimeEvent, RuntimeEventType } from '../src/modules/agent/agent.types';
import { RuntimeState } from '../src/modules/agent/session-context.types';
import { SimplifiedContextBinding, SessionRuntimeState } from '../src/modules/agent/pi-session-state.service';

// Mock state type matching SessionRuntimeState
interface MockSessionRuntimeState {
  runtimeSessionKey: string;
  eventSequence: number;
  recentEvents: RuntimeEvent[];
  session: {
    sessionId: string;
    isStreaming: boolean;
  };
  lastAssistantText?: string;
  currentTurn?: {
    turnId: string;
    startedAt: string;
    messageSourceId?: string;
  };
  waitingReason?: string;
  currentContext?: SimplifiedContextBinding;
}

const createMockState = (runtimeSessionKey: string): MockSessionRuntimeState => ({
  runtimeSessionKey,
  eventSequence: 0,
  recentEvents: [],
  session: {
    sessionId: 'pi_session_1',
    isStreaming: false,
  },
});

const createMockPrisma = () => ({
  runtimeEvent: {
    create: jest.fn().mockResolvedValue({ id: 'event_1' }),
  },
  groupAgentSession: {
    findUnique: jest.fn().mockResolvedValue({
      id: 'group_session_1',
      runtimeStateJson: {},
    }),
    update: jest.fn().mockResolvedValue({ id: 'group_session_1' }),
  },
  confirmationRequest: {
    create: jest.fn().mockResolvedValue({
      id: 'confirmation_1',
      projectId: 'project_1',
      environmentId: 'env_1',
      messageSourceId: 'source_1',
      actionType: 'runtime_confirmation',
      payload: {},
      expiresAt: new Date(Date.now() + 30 * 60_000),
    }),
    update: jest.fn().mockResolvedValue({ id: 'confirmation_1' }),
  },
});

const createMockFeishu = () => ({
  sendCard: jest.fn().mockResolvedValue({ data: { message_id: 'card_1' } }),
  removeMessageReaction: jest.fn().mockResolvedValue(undefined),
});

const createMockConfig = () => ({
  get: jest.fn((key: string) => {
    if (key === 'CONFIRMATION_TTL_MINUTES') return 30;
    return undefined;
  }),
});

describe('PiEventRecorder', () => {
  let recorder: PiEventRecorder;
  let prisma: ReturnType<typeof createMockPrisma>;
  let feishu: ReturnType<typeof createMockFeishu>;
  let config: ReturnType<typeof createMockConfig>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    feishu = createMockFeishu();
    config = createMockConfig();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PiEventRecorder,
        { provide: PrismaService, useValue: prisma },
        { provide: FeishuService, useValue: feishu },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    recorder = module.get<PiEventRecorder>(PiEventRecorder);
  });

  describe('recordRuntimeEvent', () => {
    it('creates RuntimeEvent with incremented sequence', async () => {
      const state = createMockState('session_1');
      await recorder.recordRuntimeEvent(state as any, 'idle', 'message_submitted', { text: 'hello' });

      expect(state.eventSequence).toBe(1);
      expect(state.recentEvents[0].sequence).toBe(1);
      expect(state.recentEvents[0].type).toBe('message_submitted');
      expect(state.recentEvents[0].at).toBeDefined();
    });

    it('persists event to prisma.runtimeEvent', async () => {
      const state = createMockState('session_1');
      const contextBinding: SimplifiedContextBinding = {
        projectId: 'project_1',
        environmentId: 'env_1',
        feishuChatId: 'chat_1',
        groupSessionId: 'group_session_1',
      };

      await recorder.recordRuntimeEvent(state as any, 'idle', 'turn_completed', { turnId: 'turn_1' }, contextBinding);

      expect(prisma.runtimeEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          runtimeSessionKey: 'session_1',
          groupSessionId: 'group_session_1',
          projectId: 'project_1',
          environmentId: 'env_1',
          sequence: 1,
          eventType: 'turn_completed',
        }),
      });
    });

    it('syncs GroupAgentSession projection after recording', async () => {
      const state = createMockState('session_1');
      state.currentContext = {
        projectId: 'project_1',
        environmentId: 'env_1',
        feishuChatId: 'chat_1',
        groupSessionId: 'group_session_1',
      };

      await recorder.recordRuntimeEvent(state as any, 'idle', 'message_submitted', {});

      expect(prisma.groupAgentSession.findUnique).toHaveBeenCalled();
      expect(prisma.groupAgentSession.update).toHaveBeenCalled();
    });

    it('limits recentEvents to 100 entries', async () => {
      const state = createMockState('session_1');
      // Pre-fill with 100 events
      for (let i = 0; i < 100; i++) {
        state.recentEvents.push({
          sequence: i,
          at: new Date().toISOString(),
          type: 'message_submitted',
          payload: {},
        });
      }
      state.eventSequence = 99;

      await recorder.recordRuntimeEvent(state as any, 'idle', 'turn_completed', {});

      expect(state.recentEvents.length).toBe(100);
      expect(state.recentEvents[99].sequence).toBe(100);
    });
  });

  describe('syncRuntimeSessionProjection', () => {
    it('updates runtimeStateJson', async () => {
      const state = createMockState('session_1');
      const event: RuntimeEvent = {
        sequence: 1,
        at: new Date().toISOString(),
        type: 'message_submitted',
        payload: {},
      };
      const contextBinding: SimplifiedContextBinding = {
        projectId: 'project_1',
        environmentId: 'env_1',
        feishuChatId: 'chat_1',
        groupSessionId: 'group_session_1',
      };

      await recorder.syncRuntimeSessionProjection(state as any, 'idle', event, contextBinding);

      expect(prisma.groupAgentSession.update).toHaveBeenCalledWith({
        where: { id: 'group_session_1' },
        data: expect.objectContaining({
          runtimeStateJson: expect.objectContaining({
            runtimeSessionKey: 'session_1',
          }),
          lastRuntimeTurnAt: expect.any(Date),
        }),
      });
    });

    it('clears processing reaction on turn_completed', async () => {
      const state = createMockState('session_1');
      const event: RuntimeEvent = {
        sequence: 1,
        at: new Date().toISOString(),
        type: 'turn_completed',
        payload: {},
      };
      const contextBinding: SimplifiedContextBinding = {
        projectId: 'project_1',
        environmentId: 'env_1',
        feishuChatId: 'chat_1',
        groupSessionId: 'group_session_1',
      };

      // Mock existing state with processing reaction
      prisma.groupAgentSession.findUnique.mockResolvedValueOnce({
        id: 'group_session_1',
        runtimeStateJson: {
          processingReaction: {
            feishuMessageId: 'msg_1',
            reactionId: 'reaction_1',
          },
        },
      });

      await recorder.syncRuntimeSessionProjection(state as any, 'idle', event, contextBinding);

      expect(feishu.removeMessageReaction).toHaveBeenCalledWith('msg_1', 'reaction_1');
    });
  });

  describe('createRuntimeConfirmation', () => {
    it('creates ConfirmationRequest in database', async () => {
      const state = createMockState('session_1');
      state.currentContext = {
        projectId: 'project_1',
        environmentId: 'env_1',
        feishuChatId: 'chat_1',
        groupSessionId: 'group_session_1',
      };
      const payload = {
        messageSourceId: 'source_1',
        actionType: 'runtime_confirmation',
        payload: {},
        summary: 'Please confirm',
      };

      await recorder.createRuntimeConfirmation(state as any, payload);

      expect(prisma.confirmationRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: 'project_1',
          environmentId: 'env_1',
          messageSourceId: 'source_1',
          actionType: 'runtime_confirmation',
        }),
      });
    });

    it('sends Feishu card', async () => {
      const state = createMockState('session_1');
      state.currentContext = {
        projectId: 'project_1',
        environmentId: 'env_1',
        feishuChatId: 'chat_1',
        groupSessionId: 'group_session_1',
      };
      const payload = {
        messageSourceId: 'source_1',
        actionType: 'runtime_confirmation',
        payload: {},
        summary: 'Please confirm',
      };

      await recorder.createRuntimeConfirmation(state as any, payload);

      expect(feishu.sendCard).toHaveBeenCalledWith(
        'chat_id',
        'chat_1',
        expect.objectContaining({
          config: { wide_screen_mode: true },
          header: expect.objectContaining({ template: 'orange' }),
        }),
      );
    });
  });

  describe('buildRuntimeConfirmationCard', () => {
    it('returns valid card JSON', () => {
      const card = recorder.buildRuntimeConfirmationCard(
        'confirmation_1',
        'runtime_confirmation',
        new Date(Date.now() + 30 * 60_000),
        'Please confirm this action',
        'This is a high-risk operation',
      );

      expect(card).toEqual({
        config: { wide_screen_mode: true },
        header: { title: { tag: 'plain_text', content: '需要确认' }, template: 'orange' },
        elements: expect.arrayContaining([
          expect.objectContaining({ tag: 'div' }),
          expect.objectContaining({ tag: 'action' }),
        ]),
      });
    });
  });

  describe('clearRuntimeProcessingReaction', () => {
    it('removes reaction from Feishu message', async () => {
      const runtimeState = {
        processingReaction: {
          feishuMessageId: 'msg_1',
          reactionId: 'reaction_1',
        },
      };

      await recorder.clearRuntimeProcessingReaction(runtimeState);

      expect(feishu.removeMessageReaction).toHaveBeenCalledWith('msg_1', 'reaction_1');
      expect(runtimeState.processingReaction).toBeUndefined();
    });
  });
});