import * as path from 'path';

describe('conftest', () => {
  describe('createConfigMock', () => {
    it('returns object with get method', () => {
      const { createConfigMock } = require('./conftest');
      const config = createConfigMock();
      expect(config.get).toBeDefined();
      expect(typeof config.get).toBe('function');
    });

    it('returns default PI_MONO_PROVIDER value', () => {
      const { createConfigMock } = require('./conftest');
      const config = createConfigMock();
      expect(config.get('PI_MONO_PROVIDER')).toBe('bailian');
    });

    it('accepts overrides', () => {
      const { createConfigMock } = require('./conftest');
      const config = createConfigMock({ PI_MONO_PROVIDER: 'custom' });
      expect(config.get('PI_MONO_PROVIDER')).toBe('custom');
    });
  });

  describe('createPrismaMock', () => {
    it('returns object with artifact mock', () => {
      const { createPrismaMock } = require('./conftest');
      const prisma = createPrismaMock();
      expect(prisma.artifact).toBeDefined();
      expect(prisma.artifact.findMany).toBeDefined();
    });

    it('returns object with runtimeEvent mock', () => {
      const { createPrismaMock } = require('./conftest');
      const prisma = createPrismaMock();
      expect(prisma.runtimeEvent).toBeDefined();
      expect(prisma.runtimeEvent.findMany).toBeDefined();
      expect(prisma.runtimeEvent.create).toBeDefined();
    });

    it('returns object with project mock', () => {
      const { createPrismaMock } = require('./conftest');
      const prisma = createPrismaMock();
      expect(prisma.project).toBeDefined();
      expect(prisma.project.findUniqueOrThrow).toBeDefined();
    });

    it('returns object with groupAgentSession mock', () => {
      const { createPrismaMock } = require('./conftest');
      const prisma = createPrismaMock();
      expect(prisma.groupAgentSession).toBeDefined();
      expect(prisma.groupAgentSession.findUnique).toBeDefined();
      expect(prisma.groupAgentSession.update).toBeDefined();
    });

    it('returns object with confirmationRequest mock', () => {
      const { createPrismaMock } = require('./conftest');
      const prisma = createPrismaMock();
      expect(prisma.confirmationRequest).toBeDefined();
      expect(prisma.confirmationRequest.create).toBeDefined();
      expect(prisma.confirmationRequest.update).toBeDefined();
    });

    it('returns object with agentRun mock', () => {
      const { createPrismaMock } = require('./conftest');
      const prisma = createPrismaMock();
      expect(prisma.agentRun).toBeDefined();
      expect(prisma.agentRun.create).toBeDefined();
    });
  });

  describe('createFeishuMock', () => {
    it('returns object with sendTextMessage mock', () => {
      const { createFeishuMock } = require('./conftest');
      const feishu = createFeishuMock();
      expect(feishu.sendTextMessage).toBeDefined();
    });

    it('returns object with sendCard mock that returns message_id', async () => {
      const { createFeishuMock } = require('./conftest');
      const feishu = createFeishuMock();
      const result = await feishu.sendCard();
      expect(result).toEqual({ data: { message_id: 'card_1' } });
    });

    it('returns object with removeMessageReaction mock', () => {
      const { createFeishuMock } = require('./conftest');
      const feishu = createFeishuMock();
      expect(feishu.removeMessageReaction).toBeDefined();
    });
  });

  describe('createFeishuReaderMock', () => {
    it('returns object with listProjectFolder mock', () => {
      const { createFeishuReaderMock } = require('./conftest');
      const reader = createFeishuReaderMock();
      expect(reader.listProjectFolder).toBeDefined();
    });

    it('returns object with readProjectDocument mock', () => {
      const { createFeishuReaderMock } = require('./conftest');
      const reader = createFeishuReaderMock();
      expect(reader.readProjectDocument).toBeDefined();
    });

    it('returns object with searchProjectDocuments mock', () => {
      const { createFeishuReaderMock } = require('./conftest');
      const reader = createFeishuReaderMock();
      expect(reader.searchProjectDocuments).toBeDefined();
    });

    it('returns object with readBitableSnapshot mock', () => {
      const { createFeishuReaderMock } = require('./conftest');
      const reader = createFeishuReaderMock();
      expect(reader.readBitableSnapshot).toBeDefined();
    });
  });

  describe('createRedisMock', () => {
    it('returns object with set mock that returns OK', async () => {
      const { createRedisMock } = require('./conftest');
      const redis = createRedisMock();
      const result = await redis.set();
      expect(result).toBe('OK');
    });

    it('returns object with get mock that returns null', async () => {
      const { createRedisMock } = require('./conftest');
      const redis = createRedisMock();
      const result = await redis.get();
      expect(result).toBeNull();
    });

    it('returns object with del mock that returns 1', async () => {
      const { createRedisMock } = require('./conftest');
      const redis = createRedisMock();
      const result = await redis.del();
      expect(result).toBe(1);
    });
  });

  describe('createArtifactQueueMock', () => {
    it('returns object with add method', () => {
      const { createArtifactQueueMock } = require('./conftest');
      const queue = createArtifactQueueMock();
      expect(queue.add).toBeDefined();
    });
  });

  describe('createSessionState', () => {
    it('returns SessionRuntimeState with runtimeSessionKey', () => {
      const { createSessionState } = require('./conftest');
      const state = createSessionState({ runtimeSessionKey: 'test_key' });
      expect(state.runtimeSessionKey).toBe('test_key');
    });

    it('returns SessionRuntimeState with cwd', () => {
      const { createSessionState } = require('./conftest');
      const state = createSessionState({ cwd: process.cwd() });
      expect(state.cwd).toBe(process.cwd());
    });

    it('returns SessionRuntimeState with runtimeTaskSnapshots empty array', () => {
      const { createSessionState } = require('./conftest');
      const state = createSessionState({});
      expect(state.runtimeTaskSnapshots).toEqual([]);
    });

    it('returns SessionRuntimeState with pendingRuntimeTaskEvents empty array', () => {
      const { createSessionState } = require('./conftest');
      const state = createSessionState({});
      expect(state.pendingRuntimeTaskEvents).toEqual([]);
    });

    it('returns SessionRuntimeState with eventSequence 0', () => {
      const { createSessionState } = require('./conftest');
      const state = createSessionState({});
      expect(state.eventSequence).toBe(0);
    });

    it('returns SessionRuntimeState with recentEvents empty array', () => {
      const { createSessionState } = require('./conftest');
      const state = createSessionState({});
      expect(state.recentEvents).toEqual([]);
    });

    it('returns SessionRuntimeState with toolCache as Map', () => {
      const { createSessionState } = require('./conftest');
      const state = createSessionState({});
      expect(state.toolCache).toBeInstanceOf(Map);
    });

    it('accepts overrides for session', () => {
      const { createSessionState } = require('./conftest');
      const mockSession = { prompt: jest.fn() };
      const state = createSessionState({ session: mockSession as any });
      expect(state.session).toBe(mockSession);
    });

    it('accepts overrides for sessionManager', () => {
      const { createSessionState } = require('./conftest');
      const mockManager = { getSessionFile: jest.fn() };
      const state = createSessionState({ sessionManager: mockManager as any });
      expect(state.sessionManager).toBe(mockManager);
    });
  });

  describe('createModelRegistryMock', () => {
    it('returns object with find method', () => {
      const { createModelRegistryMock } = require('./conftest');
      const registry = createModelRegistryMock();
      expect(registry.find).toBeDefined();
    });

    it('returns bailian/kimi-k2.5 model by default', () => {
      const { createModelRegistryMock } = require('./conftest');
      const registry = createModelRegistryMock();
      const model = registry.find('bailian', 'kimi-k2.5');
      expect(model).toEqual({ provider: 'bailian', id: 'kimi-k2.5' });
    });

    it('returns object with getAvailable method', () => {
      const { createModelRegistryMock } = require('./conftest');
      const registry = createModelRegistryMock();
      expect(registry.getAvailable).toBeDefined();
      expect(registry.getAvailable()).toEqual([]);
    });

    it('returns object with getAll method', () => {
      const { createModelRegistryMock } = require('./conftest');
      const registry = createModelRegistryMock();
      expect(registry.getAll).toBeDefined();
      expect(registry.getAll()).toEqual([{ provider: 'bailian', id: 'kimi-k2.5' }]);
    });
  });
});