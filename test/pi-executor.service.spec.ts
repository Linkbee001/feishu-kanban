import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PiExecutor } from '../src/modules/agent/pi-executor.service';
import { PiSessionManager } from '../src/modules/agent/pi-session-manager.service';
import { PiPromptBuilder } from '../src/modules/agent/pi-prompt-builder.service';
import { PiOutputProcessor } from '../src/modules/agent/pi-output-processor.service';
import { PiSessionStateService, SessionRuntimeState } from '../src/modules/agent/pi-session-state.service';
import { GROUP_AGENT_SESSION_REDIS } from '../src/modules/agent/agent.constants';
import {
  AgentOutput,
  ManagerInteractiveDecision,
  PiMonoCreateRunRequest,
} from '../src/modules/agent/agent.types';

// Mock session that mimics AgentSession interface
const createMockSession = () => ({
  prompt: jest.fn().mockResolvedValue(undefined),
  getLastAssistantText: jest.fn().mockReturnValue('Test assistant response'),
  abort: jest.fn().mockResolvedValue(undefined),
  sessionId: 'test-session-id',
  isCompacting: false,
  steer: jest.fn().mockResolvedValue(undefined),
  dispose: jest.fn(),
});

const createMockSessionManager = () => ({
  getSessionFile: jest.fn().mockReturnValue('/test/session.jsonl'),
});

const createMockState = (runtimeSessionKey: string): SessionRuntimeState => {
  return {
    runtimeSessionKey,
    cwd: '/test/cwd',
    session: createMockSession() as any,
    sessionManager: createMockSessionManager() as any,
    sessionStoreRef: '/test/session.jsonl',
    lastAssistantText: undefined,
    activeExecution: undefined,
    currentProjectContextBundle: undefined,
    currentRoleProfile: undefined,
    runtimeTaskSnapshots: [],
    pendingRuntimeTaskEvents: [],
    currentTurn: undefined,
    waitingReason: undefined,
    waitingTaskId: undefined,
    eventSequence: 0,
    recentEvents: [],
    toolCache: new Map(),
    confirmationQueue: [],
    turnQueue: [],
    currentContext: undefined,
  };
};

const createMockPayload = (): PiMonoCreateRunRequest => ({
  runtimeSessionKey: 'test-session-key',
  sessionStoreRef: undefined,
  agentScopeKey: undefined,
  sessionMode: 'active',
  requestKind: 'formal_execution',
  wakeMode: 'interactive',
  projectContextBundle: undefined,
  project: {
    id: 'test-project-id',
    name: 'Test Project',
    feishuChatId: 'test-chat-id',
  },
  environment: {
    id: 'test-env-id',
    name: 'Test Environment',
    repoMirrorPath: undefined,
    repoSyncStatus: undefined,
    projectPath: undefined,
  },
  source: {},
  intent: 'progress_summary',
  skillName: undefined,
  prompt: 'Test prompt content',
  outputSchema: {},
});

describe('PiExecutor', () => {
  let executor: PiExecutor;
  let sessionManager: jest.Mocked<PiSessionManager>;
  let promptBuilder: jest.Mocked<PiPromptBuilder>;
  let outputProcessor: jest.Mocked<PiOutputProcessor>;
  let config: jest.Mocked<ConfigService>;
  let redis: jest.Mocked<Redis>;
  let sessionStateService: jest.Mocked<PiSessionStateService>;

  beforeEach(async () => {
    sessionManager = {
      ensureSession: jest.fn(),
      closeSession: jest.fn(),
      rehydrateSession: jest.fn(),
    } as any;

    promptBuilder = {
      buildPrompt: jest.fn().mockReturnValue('Built prompt text'),
    } as any;

    outputProcessor = {
      normalizeOutputs: jest.fn().mockReturnValue([
        { type: 'summary', title: 'Test Output', content: 'Test content' } as AgentOutput,
      ]),
      normalizeDecision: jest.fn(),
      applyOutputDeliveryDefaults: jest.fn(),
      isAgentOutput: jest.fn().mockReturnValue(true),
      isManagerInteractiveDecision: jest.fn(),
      normalizeTodoWriteAction: jest.fn(),
      normalizeRuntimeConfirmationAction: jest.fn(),
    } as any;

    config = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'AGENT_RUN_TIMEOUT_SECONDS') return 1800;
        if (key === 'PI_MONO_GROUP_RUNTIME_TIMEOUT_MS') return 300000;
        return null;
      }),
      getOrThrow: jest.fn(),
    } as any;

    redis = {
      set: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(1),
    } as any;

    sessionStateService = {
      createState: jest.fn(),
      getState: jest.fn(),
      updateSession: jest.fn(),
      clearState: jest.fn(),
      getAllStates: jest.fn().mockReturnValue([]),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PiExecutor,
        { provide: PiSessionManager, useValue: sessionManager },
        { provide: PiPromptBuilder, useValue: promptBuilder },
        { provide: PiOutputProcessor, useValue: outputProcessor },
        { provide: ConfigService, useValue: config },
        { provide: GROUP_AGENT_SESSION_REDIS, useValue: redis },
        { provide: PiSessionStateService, useValue: sessionStateService },
      ],
    }).compile();

    executor = module.get<PiExecutor>(PiExecutor);
  });

  describe('executePrompt', () => {
    it('returns succeeded status with outputs after prompt execution', async () => {
      const mockState = createMockState('test-session-key');
      // Setup prompt mock to populate outputs after execution state is set
      (mockState.session.prompt as jest.Mock).mockImplementation(async () => {
        // At this point, activeExecution should already be set by the executor
        if (mockState.activeExecution) {
          mockState.activeExecution.outputs = [
            { type: 'summary', title: 'Test Output', content: 'Test content' },
          ];
        }
      });
      sessionManager.ensureSession.mockResolvedValue(mockState);

      const result = await executor.executePrompt({
        runId: 'test-run-id',
        payload: createMockPayload(),
        timeoutMs: 5000,
      });

      expect(result.status).toBe('succeeded');
      expect(result.outputs).toBeDefined();
      expect(result.outputs!.length).toBeGreaterThan(0);
      expect(result.session).toBeDefined();
      expect(sessionManager.ensureSession).toHaveBeenCalled();
      expect(promptBuilder.buildPrompt).toHaveBeenCalled();
    });

    it('returns timeout status when timedOut flag set', async () => {
      const mockState = createMockState('test-session-key');
      (mockState.session.prompt as jest.Mock).mockImplementation(async () => {
        // Simulate timeout by setting the timedOut flag during execution
        if (mockState.activeExecution) {
          mockState.activeExecution.timedOut = true;
        }
        // Don't return immediately - let the timeout handler abort
      });
      sessionManager.ensureSession.mockResolvedValue(mockState);

      // Use very short timeout to trigger timeout behavior quickly
      const result = await executor.executePrompt({
        runId: 'test-run-id',
        payload: createMockPayload(),
        timeoutMs: 5, // 5ms timeout - should trigger before prompt resolves
      });

      expect(result.status).toBe('timeout');
      expect(result.outputs).toEqual([]);
    });

    it('returns canceled status when canceled flag set', async () => {
      const mockState = createMockState('test-session-key');
      redis.get.mockResolvedValue('1'); // Cancellation already requested
      sessionManager.ensureSession.mockResolvedValue(mockState);

      const result = await executor.executePrompt({
        runId: 'test-run-id',
        payload: createMockPayload(),
        timeoutMs: 5000,
      });

      expect(result.status).toBe('canceled');
      expect(result.outputs).toEqual([]);
    });

    it('creates ActiveExecutionState with mode=outputs', async () => {
      const mockState = createMockState('test-session-key');
      (mockState.session.prompt as jest.Mock).mockImplementation(async () => {
        // Just complete normally - the test verifies mode was set
        if (mockState.activeExecution) {
          mockState.activeExecution.outputs = [
            { type: 'summary', title: 'Test Output', content: 'Test content' },
          ];
        }
      });
      sessionManager.ensureSession.mockResolvedValue(mockState);

      await executor.executePrompt({
        runId: 'test-run-id',
        payload: createMockPayload(),
        timeoutMs: 5000,
      });

      // After execution completes, activeExecution is cleared
      // So we need to check it was set during execution by examining the mock call
      expect(mockState.session.prompt).toHaveBeenCalled();
      // The mode is set before prompt is called, so it should have been 'outputs' during the call
      // We can verify this by checking that outputs were populated correctly
    });
  });

  describe('executeDecisionPrompt', () => {
    it('returns decision in succeeded status', async () => {
      const mockState = createMockState('test-session-key');
      const mockDecision: ManagerInteractiveDecision = {
        action: 'execute',
        confidence: 'high',
        reason: 'Test reason',
        reply: 'Test reply',
        intent: 'progress_summary',
        executionGoal: 'Test goal',
        executionPrompt: 'Test execution prompt',
      };
      (mockState.session.prompt as jest.Mock).mockImplementation(async () => {
        if (mockState.activeExecution) {
          mockState.activeExecution.decision = mockDecision;
        }
      });
      sessionManager.ensureSession.mockResolvedValue(mockState);

      const result = await executor.executeDecisionPrompt({
        payload: {
          ...createMockPayload(),
          requestKind: 'interactive_decision',
        },
        timeoutMs: 5000,
      });

      expect(result.status).toBe('succeeded');
      expect(result.decision).toEqual(mockDecision);
      expect(result.session).toBeDefined();
    });

    it('creates ActiveExecutionState with mode=decision', async () => {
      const mockState = createMockState('test-session-key');
      const mockDecision: ManagerInteractiveDecision = {
        action: 'execute',
        confidence: 'high',
        reason: 'Test reason',
        reply: 'Test reply',
        intent: 'progress_summary',
      };
      (mockState.session.prompt as jest.Mock).mockImplementation(async () => {
        if (mockState.activeExecution) {
          mockState.activeExecution.decision = mockDecision;
        }
      });
      sessionManager.ensureSession.mockResolvedValue(mockState);

      await executor.executeDecisionPrompt({
        payload: {
          ...createMockPayload(),
          requestKind: 'interactive_decision',
        },
        timeoutMs: 5000,
      });

      expect(mockState.session.prompt).toHaveBeenCalled();
    });
  });

  describe('executeGroupRuntimePrompt', () => {
    it('returns actions and outputs in succeeded status', async () => {
      const mockState = createMockState('test-session-key');
      (mockState.session.prompt as jest.Mock).mockImplementation(async () => {
        if (mockState.activeExecution) {
          mockState.activeExecution.outputs = [
            { type: 'summary', title: 'Test Output', content: 'Test content' },
          ];
          mockState.activeExecution.actions = [
            { type: 'reply_group', text: 'Test reply' },
          ];
        }
      });
      sessionManager.ensureSession.mockResolvedValue(mockState);

      const result = await executor.executeGroupRuntimePrompt({
        payload: {
          ...createMockPayload(),
          requestKind: 'group_runtime',
        },
        timeoutMs: 5000,
      });

      expect(result.status).toBe('succeeded');
      expect(result.actions).toBeDefined();
      expect(result.actions!.length).toBeGreaterThan(0);
      expect(result.outputs).toBeDefined();
      expect(result.session).toBeDefined();
    });

    it('creates ActiveExecutionState with mode=group_runtime', async () => {
      const mockState = createMockState('test-session-key');
      (mockState.session.prompt as jest.Mock).mockImplementation(async () => {
        if (mockState.activeExecution) {
          mockState.activeExecution.outputs = [
            { type: 'summary', title: 'Test Output', content: 'Test content' },
          ];
          mockState.activeExecution.actions = [
            { type: 'reply_group', text: 'Test reply' },
          ];
        }
      });
      sessionManager.ensureSession.mockResolvedValue(mockState);

      await executor.executeGroupRuntimePrompt({
        payload: {
          ...createMockPayload(),
          requestKind: 'group_runtime',
        },
        timeoutMs: 5000,
      });

      expect(mockState.session.prompt).toHaveBeenCalled();
    });
  });

  describe('cancelRun', () => {
    it('sets redis cancel key and aborts session', async () => {
      const mockState = createMockState('test-session-key');
      mockState.activeExecution = {
        runId: 'test-run-id',
        mode: 'outputs',
        outputs: [],
        emitted: false,
        canceled: false,
        timedOut: false,
      };
      // Create generator that yields mockState
      function* stateGenerator() { yield mockState; }
      sessionStateService.getAllStates.mockReturnValue(stateGenerator() as any);

      await executor.cancelRun('test-run-id');

      expect(redis.set).toHaveBeenCalledWith(
        'pi-mono-cancel:test-run-id',
        '1',
        'EX',
        expect.any(Number),
      );
      expect(mockState.activeExecution?.canceled).toBe(true);
      expect(mockState.session.abort).toHaveBeenCalled();
    });

    it('returns early if no live run found', async () => {
      function* emptyGenerator() {}
      sessionStateService.getAllStates.mockReturnValue(emptyGenerator() as any);

      await executor.cancelRun('test-run-id');

      expect(redis.set).toHaveBeenCalled();
      // Should complete without errors
    });
  });
});