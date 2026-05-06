import * as path from 'path';

/**
 * Shared test fixtures for Pi service unit tests.
 * Extracted from existing test patterns in pi-mono.adapter.spec.ts.
 */

export function createConfigMock(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    PI_MONO_PROVIDER: 'bailian',
    PI_MONO_MODEL: 'kimi-k2.5',
    PI_MONO_THINKING_LEVEL: 'off',
    PI_MONO_WORKDIR: process.cwd(),
    PI_MONO_AGENT_DIR: path.join(process.cwd(), '.pi-agent-test'),
    AGENT_RUN_TIMEOUT_SECONDS: 30,
    BAILIAN_BASE_URL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    ...overrides,
  };

  return {
    get: jest.fn((key: string) => values[key]),
    getOrThrow: jest.fn((key: string) => {
      const value = values[key];
      if (value === undefined) {
        throw new Error(`Config key ${key} not found`);
      }
      return value;
    }),
  };
}

export function createPrismaMock() {
  return {
    artifact: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    runtimeEvent: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue(undefined),
    },
    project: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        id: 'project_1',
        docFolderToken: 'folder_1',
        bitableAppToken: 'bitable_app_1',
        bitableTableId: 'table_1',
      }),
    },
    groupRuntimeTask: {
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockResolvedValue(undefined),
    },
    groupAgentSession: {
      findUnique: jest.fn().mockResolvedValue({
        runtimeStateJson: {},
      }),
      update: jest.fn().mockResolvedValue(undefined),
    },
    confirmationRequest: {
      create: jest.fn().mockResolvedValue({ id: 'confirm_1' }),
      update: jest.fn().mockResolvedValue(undefined),
    },
    agentRun: {
      create: jest.fn().mockResolvedValue({ id: 'run_1' }),
    },
  };
}

export function createFeishuMock() {
  return {
    sendTextMessage: jest.fn().mockResolvedValue(undefined),
    sendCard: jest.fn().mockResolvedValue({ data: { message_id: 'card_1' } }),
    removeMessageReaction: jest.fn().mockResolvedValue(undefined),
  };
}

export function createFeishuReaderMock() {
  return {
    listProjectFolder: jest.fn(),
    readProjectDocument: jest.fn(),
    searchProjectDocuments: jest.fn(),
    readBitableSnapshot: jest.fn(),
  };
}

export function createRedisMock() {
  return {
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
  };
}

export function createArtifactQueueMock() {
  return {
    add: jest.fn().mockResolvedValue(undefined),
  };
}

export function createModelRegistryMock() {
  return {
    find: jest.fn().mockReturnValue({ provider: 'bailian', id: 'kimi-k2.5' }),
    getAvailable: jest.fn().mockReturnValue([]),
    getAll: jest.fn().mockReturnValue([{ provider: 'bailian', id: 'kimi-k2.5' }],
    ),
  };
}

/**
 * Factory for SessionRuntimeState objects.
 * Used to create test state for PiSessionManager and PiExecutor tests.
 */
export function createSessionState(overrides: Partial<{
  runtimeSessionKey: string;
  cwd: string;
  session: any;
  sessionManager: any;
  sessionStoreRef?: string;
  lastAssistantText?: string;
  activeExecution?: any;
  currentProjectContextBundle?: any;
  currentRoleProfile?: any;
  runtimeTaskSnapshots: any[];
  pendingRuntimeTaskEvents: any[];
  currentTurn?: any;
  waitingReason?: string;
  waitingTaskId?: string;
  eventSequence: number;
  recentEvents: any[];
  toolCache: Map<string, unknown>;
  confirmationQueue?: any[];
  turnQueue?: any[];
  currentContext?: any;
}> = {}) {
  return {
    runtimeSessionKey: overrides.runtimeSessionKey ?? 'chat:test_session:manager',
    cwd: overrides.cwd ?? process.cwd(),
    session: overrides.session ?? { prompt: jest.fn(), dispose: jest.fn(), abort: jest.fn() },
    sessionManager: overrides.sessionManager ?? { getSessionFile: jest.fn().mockReturnValue('/sessions/test.jsonl') },
    sessionStoreRef: overrides.sessionStoreRef ?? '/sessions/test.jsonl',
    lastAssistantText: overrides.lastAssistantText ?? undefined,
    activeExecution: overrides.activeExecution ?? undefined,
    currentProjectContextBundle: overrides.currentProjectContextBundle ?? undefined,
    currentRoleProfile: overrides.currentRoleProfile ?? undefined,
    runtimeTaskSnapshots: overrides.runtimeTaskSnapshots ?? [],
    pendingRuntimeTaskEvents: overrides.pendingRuntimeTaskEvents ?? [],
    currentTurn: overrides.currentTurn ?? undefined,
    waitingReason: overrides.waitingReason ?? undefined,
    waitingTaskId: overrides.waitingTaskId ?? undefined,
    eventSequence: overrides.eventSequence ?? 0,
    recentEvents: overrides.recentEvents ?? [],
    toolCache: overrides.toolCache ?? new Map<string, unknown>(),
    confirmationQueue: overrides.confirmationQueue ?? undefined,
    turnQueue: overrides.turnQueue ?? undefined,
    currentContext: overrides.currentContext ?? undefined,
  };
}