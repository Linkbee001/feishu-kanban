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

  function createPrisma() {
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
      confirmationRequest: {
        create: jest.fn().mockResolvedValue({ id: 'confirm_1' }),
        update: jest.fn().mockResolvedValue(undefined),
      },
      agentRun: {
        create: jest.fn().mockResolvedValue({ id: 'run_1' }),
      },
    };
  }

  function createFeishuReader() {
    return {
      listProjectFolder: jest.fn(),
      readProjectDocument: jest.fn(),
      searchProjectDocuments: jest.fn(),
      readBitableSnapshot: jest.fn(),
    };
  }

  function createFeishu() {
    return {
      sendTextMessage: jest.fn().mockResolvedValue(undefined),
      sendCard: jest.fn().mockResolvedValue({ data: { message_id: 'card_1' } }),
    };
  }

  function createArtifactQueue() {
    return {
      add: jest.fn().mockResolvedValue(undefined),
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
    const adapter = new PiMonoAdapter(
      config as any,
      createPrisma() as any,
      createFeishu() as any,
      createFeishuReader() as any,
      redis as any,
      createArtifactQueue() as any,
    );
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
        tools: expect.arrayContaining([
          'read',
          'grep',
          'find',
          'ls',
          'emit_outputs',
          'emit_decision',
          'list_project_folder',
          'read_project_doc',
          'search_project_docs',
          'read_project_bitable',
          'list_recent_project_artifacts',
        ]),
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
    const adapter = new PiMonoAdapter(
      config as any,
      createPrisma() as any,
      createFeishu() as any,
      createFeishuReader() as any,
      redis as any,
      createArtifactQueue() as any,
    );
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

  it('prefers a ready repo mirror path over the legacy project path when resolving cwd', () => {
    const readyDir = path.join(process.cwd(), '.tmp-ready-repo');
    const projectDir = path.join(process.cwd(), '.tmp-project-path');
    mkdirSync(readyDir, { recursive: true });
    mkdirSync(projectDir, { recursive: true });
    tempDirs.push(readyDir, projectDir);

    const adapter = new PiMonoAdapter(
      createConfig() as any,
      createPrisma() as any,
      createFeishu() as any,
      createFeishuReader() as any,
      createRedis() as any,
      createArtifactQueue() as any,
    );

    const cwd = (adapter as any).resolveCwd({
      repoMirrorPath: readyDir,
      repoSyncStatus: 'ready',
      projectPath: projectDir,
    });

    expect(cwd).toBe(readyDir);
  });

  it('captures group runtime actions and injects virtual role context files', async () => {
    const config = createConfig();
    const redis = createRedis();
    const adapter = new PiMonoAdapter(
      config as any,
      createPrisma() as any,
      createFeishu() as any,
      createFeishuReader() as any,
      redis as any,
      createArtifactQueue() as any,
    );
    const fakeSessionManager = {
      getSessionFile: jest.fn().mockReturnValue('C:\\sessions\\managed\\group-runtime.jsonl'),
    };
    let emitTool: any;
    let todoWriteTool: any;
    let replyGroupTool: any;
    let confirmationTool: any;
    let resourceLoaderArgs: any;
    class FakeResourceLoader {
      constructor(args: any) {
        resourceLoaderArgs = args;
      }

      async reload() {
        return undefined;
      }
    }
    const fakeSession = {
      prompt: jest.fn(async (_prompt: string) => {
        await todoWriteTool.execute('tool-1', {
          action: 'create',
          title: 'smoke task',
          description: 'Check group runtime flow',
          intent: 'progress_summary',
          outputMode: 'summary',
        });
        await todoWriteTool.execute('tool-2', {
          action: 'start',
          taskId: 'task_1',
          resultSummary: 'Started smoke task',
        });
        await replyGroupTool.execute('tool-3', {
          text: 'SMOKE_CREATE_TASK_ACK',
        });
        await confirmationTool.execute('tool-4', {
          taskId: 'task_1',
          actionType: 'document_publish',
          summary: 'Need approval',
          detail: 'Please confirm smoke flow',
          payload: {
            reply: 'Need approval',
            intent: 'document_generate',
            executionPrompt: 'Continue smoke flow',
            outputMode: 'summary',
          },
        });
        await emitTool.execute('tool-5', {
          outputs: [{ type: 'summary', title: 'smoke-summary', content: 'SMOKE_CREATE_TASK_DONE' }],
        });
      }),
      getLastAssistantText: jest.fn().mockReturnValue('runtime summary'),
      abort: jest.fn().mockResolvedValue(undefined),
      dispose: jest.fn(),
      sessionId: 'pi_group_runtime_1',
    };
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
      DefaultResourceLoader: FakeResourceLoader,
      createAgentSession: jest.fn(async (options: any) => {
        emitTool = options.customTools.find((tool: any) => tool.name === 'emit_outputs');
        todoWriteTool = options.customTools.find((tool: any) => tool.name === 'todo_write');
        replyGroupTool = options.customTools.find((tool: any) => tool.name === 'reply_group');
        confirmationTool = options.customTools.find((tool: any) => tool.name === 'request_group_confirmation');
        return { session: fakeSession };
      }),
    };

    (adapter as any).loadSdk = jest.fn().mockResolvedValue(fakeSdk);
    (adapter as any).ensureCustomModelsConfig = jest.fn();

    const result = await adapter.runGroupRuntimeTurn({
      runtimeSessionKey: 'chat:chat_runtime:manager',
      sessionMode: 'active',
      runtimeTasks: [],
      roleProfile: {
        agentRole: 'manager',
        agentsMd: 'agents',
        soulMd: 'soul',
        userMd: 'user',
        standingOrdersMd: 'standing orders',
        promptPreludeMd: 'prelude',
        skills: ['progress-summary'],
        compiledContextFile: '# AGENTS\nsmoke profile',
      },
      project: {
        id: 'project_1',
        name: 'Payments',
        feishuChatId: 'chat_runtime',
      },
      environment: {
        id: 'env_1',
        name: 'Default',
        projectPath: process.cwd(),
        repoSyncStatus: 'ready',
      },
      source: {
        messageSourceId: 'source_1',
        senderOpenId: 'ou_sender',
      },
      prompt: '[SMOKE_CREATE_TASK]',
      outputSchema: {},
    });

    expect(result.status).toBe('succeeded');
    expect(result.actions).toEqual([
      expect.objectContaining({
        type: 'todo_write',
        action: 'create',
        title: 'smoke task',
      }),
      expect.objectContaining({
        type: 'todo_write',
        action: 'start',
        taskId: 'task_1',
      }),
      expect.objectContaining({
        type: 'reply_group',
        text: 'SMOKE_CREATE_TASK_ACK',
      }),
      expect.objectContaining({
        type: 'request_group_confirmation',
        taskId: 'task_1',
        actionType: 'document_publish',
      }),
    ]);
    expect(result.outputs).toEqual([
      expect.objectContaining({
        type: 'summary',
        title: 'smoke-summary',
      }),
    ]);
    expect(fakeSdk.createAgentSession).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: expect.arrayContaining([
          'todo_list',
          'todo_write',
          'reply_group',
          'request_group_confirmation',
        ]),
      }),
    );
    expect(resourceLoaderArgs.agentsFilesOverride({ agentsFiles: [] }).agentsFiles).toEqual([
      {
        path: '/virtual/AGENTS.md',
        content: '# AGENTS\nsmoke profile',
      },
    ]);
  });

  it('starts a runtime turn and records runtime events for idle submitMessage', async () => {
    const config = createConfig();
    const redis = createRedis();
    const prisma = createPrisma();
    const adapter = new PiMonoAdapter(
      config as any,
      prisma as any,
      createFeishu() as any,
      createFeishuReader() as any,
      redis as any,
      createArtifactQueue() as any,
    );
    const fakeSessionManager = {
      getSessionFile: jest.fn().mockReturnValue('C:\\sessions\\managed\\runtime-submit.jsonl'),
    };
    let emitTool: any;
    const fakeSession = {
      isStreaming: false,
      isCompacting: false,
      prompt: jest.fn(async () => {
        fakeSession.isStreaming = true;
        await emitTool.execute('tool-1', {
          outputs: [{ type: 'summary', title: 'runtime-summary', content: 'done' }],
        });
        fakeSession.isStreaming = false;
      }),
      steer: jest.fn().mockResolvedValue(undefined),
      followUp: jest.fn().mockResolvedValue(undefined),
      getLastAssistantText: jest.fn().mockReturnValue('runtime submit summary'),
      abort: jest.fn().mockResolvedValue(undefined),
      dispose: jest.fn(),
      sessionId: 'pi_runtime_submit_1',
    };
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
        emitTool = options.customTools.find((tool: any) => tool.name === 'emit_outputs');
        return { session: fakeSession };
      }),
    };

    (adapter as any).loadSdk = jest.fn().mockResolvedValue(fakeSdk);
    (adapter as any).ensureCustomModelsConfig = jest.fn();

    const result = await adapter.submitMessage({
      runtimeSessionKey: 'chat:chat_submit:manager',
      contextBinding: {
        groupSessionId: 'session_1',
        projectId: 'project_1',
        environmentId: 'env_1',
        feishuChatId: 'chat_submit',
      },
      project: {
        id: 'project_1',
        name: 'Payments',
        feishuChatId: 'chat_submit',
      },
      environment: {
        id: 'env_1',
        name: 'Default',
        projectPath: process.cwd(),
        repoSyncStatus: 'ready',
        repoHeadRef: 'abc123',
      },
      minimalContext: {
        sessionMemorySummary: 'memory summary',
        repoReady: true,
        repoHeadRef: 'abc123',
      },
      envelope: {
        messageSourceId: 'source_1',
        sourceType: 'group',
        senderOpenId: 'ou_sender',
        feishuChatId: 'chat_submit',
        rawText: 'Please summarize the latest progress.',
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(result).toEqual(
      expect.objectContaining({
        accepted: true,
        action: 'run_now',
      }),
    );
    expect((prisma.runtimeEvent.create as jest.Mock).mock.calls.map((call) => call[0].data.eventType)).toEqual(
      expect.arrayContaining(['message_submitted', 'turn_started', 'outputs_emitted', 'turn_completed']),
    );
    expect(adapter.getRuntimeState('chat:chat_submit:manager')).toEqual(
      expect.objectContaining({
        status: 'idle',
      }),
    );
  });

  it('collects a second message while the runtime session is streaming', async () => {
    const config = createConfig();
    const redis = createRedis();
    const prisma = createPrisma();
    const adapter = new PiMonoAdapter(
      config as any,
      prisma as any,
      createFeishu() as any,
      createFeishuReader() as any,
      redis as any,
      createArtifactQueue() as any,
    );
    const fakeSessionManager = {
      getSessionFile: jest.fn().mockReturnValue('C:\\sessions\\managed\\runtime-collect.jsonl'),
    };
    let emitTool: any;
    let releasePrompt!: () => void;
    const promptGate = new Promise<void>((resolve) => {
      releasePrompt = resolve;
    });
    const fakeSession = {
      isStreaming: false,
      isCompacting: false,
      prompt: jest.fn(async () => {
        fakeSession.isStreaming = true;
        await promptGate;
        await emitTool.execute('tool-1', {
          outputs: [{ type: 'summary', title: 'runtime-summary', content: 'done' }],
        });
        fakeSession.isStreaming = false;
      }),
      steer: jest.fn().mockResolvedValue(undefined),
      followUp: jest.fn().mockResolvedValue(undefined),
      getLastAssistantText: jest.fn().mockReturnValue('runtime collect summary'),
      abort: jest.fn().mockResolvedValue(undefined),
      dispose: jest.fn(),
      sessionId: 'pi_runtime_collect_1',
    };
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
        emitTool = options.customTools.find((tool: any) => tool.name === 'emit_outputs');
        return { session: fakeSession };
      }),
    };

    (adapter as any).loadSdk = jest.fn().mockResolvedValue(fakeSdk);
    (adapter as any).ensureCustomModelsConfig = jest.fn();

    const first = adapter.submitMessage({
      runtimeSessionKey: 'chat:chat_collect:manager',
      contextBinding: {
        groupSessionId: 'session_1',
        projectId: 'project_1',
        environmentId: 'env_1',
        feishuChatId: 'chat_collect',
      },
      project: {
        id: 'project_1',
        name: 'Payments',
        feishuChatId: 'chat_collect',
      },
      environment: {
        id: 'env_1',
        name: 'Default',
        projectPath: process.cwd(),
        repoSyncStatus: 'ready',
      },
      envelope: {
        messageSourceId: 'source_1',
        sourceType: 'group',
        senderOpenId: 'ou_sender',
        feishuChatId: 'chat_collect',
        rawText: 'First message',
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    const second = await adapter.submitMessage({
      runtimeSessionKey: 'chat:chat_collect:manager',
      contextBinding: {
        groupSessionId: 'session_1',
        projectId: 'project_1',
        environmentId: 'env_1',
        feishuChatId: 'chat_collect',
      },
      project: {
        id: 'project_1',
        name: 'Payments',
        feishuChatId: 'chat_collect',
      },
      environment: {
        id: 'env_1',
        name: 'Default',
        projectPath: process.cwd(),
        repoSyncStatus: 'ready',
      },
      envelope: {
        messageSourceId: 'source_2',
        sourceType: 'group',
        senderOpenId: 'ou_sender',
        feishuChatId: 'chat_collect',
        rawText: 'Second message',
      },
    });

    releasePrompt();
    await first;
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(second).toEqual(
      expect.objectContaining({
        accepted: true,
        action: 'collected',
      }),
    );
    expect((prisma.runtimeEvent.create as jest.Mock).mock.calls.map((call) => call[0].data.eventType)).toEqual(
      expect.arrayContaining(['message_collected']),
    );
  });
});
