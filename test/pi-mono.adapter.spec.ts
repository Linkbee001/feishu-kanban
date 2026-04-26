import { mkdirSync, rmSync, writeFileSync } from 'fs';
import * as path from 'path';
import { PiMonoAdapter } from '../src/modules/agent/pi-mono.adapter';

describe('PiMonoAdapter', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length) {
      const dir = tempDirs.pop();
      if (dir) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  function createConfig(overrides: Record<string, unknown> = {}) {
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
    };
  }

  function createRedis() {
    return {
      set: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(1),
    };
  }

  function createModelRegistry() {
    return {
      find: jest.fn().mockReturnValue({ provider: 'bailian', id: 'kimi-k2.5' }),
      getAvailable: jest.fn().mockReturnValue([]),
      getAll: jest.fn().mockReturnValue([{ provider: 'bailian', id: 'kimi-k2.5' }]),
    };
  }

  it('stores SDK session metadata after creating a new runtime session', async () => {
    const config = createConfig();
    const redis = createRedis();
    const adapter = new PiMonoAdapter(config as any, redis as any);
    const fakeSessionManager = {
      getSessionFile: jest.fn().mockReturnValue('C:\\sessions\\managed\\new-session.jsonl'),
    };
    const fakeSession = {
      prompt: jest.fn(async (_prompt: string) => {
        await emitTool.execute('tool-1', {
          outputs: [{ type: 'summary', title: 'bootstrap', content: 'ready', contentFormat: 'json' }],
        });
      }),
      getLastAssistantText: jest.fn().mockReturnValue('assistant summary'),
      abort: jest.fn().mockResolvedValue(undefined),
      dispose: jest.fn(),
      sessionId: 'pi_session_1',
    };
    let emitTool: any;
    const fakeSdk = {
      AuthStorage: {
        create: jest.fn().mockReturnValue({}),
      },
      ModelRegistry: {
        create: jest.fn().mockReturnValue(createModelRegistry()),
      },
      SessionManager: {
        create: jest.fn().mockReturnValue(fakeSessionManager),
        open: jest.fn(),
      },
      createAgentSession: jest.fn(async (options: any) => {
        emitTool = options.customTools[0];
        return { session: fakeSession };
      }),
    };

    (adapter as any).loadSdk = jest.fn().mockResolvedValue(fakeSdk);
    (adapter as any).ensureCustomModelsConfig = jest.fn();

    const outputs = await adapter.runPrompt({
      sessionKey: 'chat:chat_1:manager',
      prompt: 'collect init info',
      outputSchema: {},
      timeoutMs: 5_000,
    });

    expect(outputs).toEqual([
      expect.objectContaining({
        type: 'summary',
        title: 'bootstrap',
      }),
    ]);
    expect(fakeSdk.SessionManager.create).toHaveBeenCalled();
    expect(fakeSdk.createAgentSession).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: ['read', 'grep', 'find', 'ls', 'emit_outputs'],
      }),
    );
    expect(adapter.getSessionSnapshot('chat:chat_1:manager')).toEqual(
      expect.objectContaining({
        piSessionId: 'pi_session_1',
        sessionStoreDriver: 'local_file',
        sessionStoreRef: 'C:\\sessions\\managed\\new-session.jsonl',
      }),
    );
  });

  it('reopens the stored session file when a session reference already exists', async () => {
    const storeDir = path.join(process.cwd(), '.tmp-pi-session-open');
    const storeRef = path.join(storeDir, 'existing-session.jsonl');
    mkdirSync(storeDir, { recursive: true });
    writeFileSync(storeRef, '', 'utf8');
    tempDirs.push(storeDir);

    const config = createConfig();
    const redis = createRedis();
    const adapter = new PiMonoAdapter(config as any, redis as any);
    const fakeSessionManager = {
      getSessionFile: jest.fn().mockReturnValue(storeRef),
    };
    const fakeSession = {
      prompt: jest.fn(),
      getLastAssistantText: jest.fn().mockReturnValue('rehydrated'),
      abort: jest.fn().mockResolvedValue(undefined),
      dispose: jest.fn(),
      sessionId: 'pi_session_existing',
    };
    const openSpy = jest.fn().mockReturnValue(fakeSessionManager);
    const fakeSdk = {
      AuthStorage: {
        create: jest.fn().mockReturnValue({}),
      },
      ModelRegistry: {
        create: jest.fn().mockReturnValue(createModelRegistry()),
      },
      SessionManager: {
        create: jest.fn(),
        open: openSpy,
      },
      createAgentSession: jest.fn().mockResolvedValue({ session: fakeSession }),
    };

    (adapter as any).loadSdk = jest.fn().mockResolvedValue(fakeSdk);
    (adapter as any).ensureCustomModelsConfig = jest.fn();

    const snapshot = await adapter.rehydrateSession({
      runtimeSessionKey: 'chat:chat_2:manager',
      sessionStoreRef: storeRef,
      projectPath: process.cwd(),
    });

    expect(openSpy).toHaveBeenCalledWith(storeRef, path.dirname(storeRef), process.cwd());
    expect(snapshot).toEqual(
      expect.objectContaining({
        piSessionId: 'pi_session_existing',
        sessionStoreRef: storeRef,
      }),
    );
  });
});
