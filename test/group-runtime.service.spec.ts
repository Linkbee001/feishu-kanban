import { GroupRuntimeService } from '../src/modules/agent/group-runtime.service';

describe('GroupRuntimeService', () => {
  const createService = () => {
    const session = {
      id: 'session_1',
      runtimeSessionKey: 'chat:chat_1:manager',
      agentScopeKey: 'scope_1',
      sessionStoreRef: 'C:\\sessions\\chat_1.jsonl',
      sessionMode: 'active',
      status: 'idle',
      memorySummary: 'memory summary',
    };
    const environment = {
      id: 'env_1',
      name: 'Default',
      piMonoEnvId: null,
      repoUrl: 'https://example.com/repo.git',
      repoBranch: 'main',
      repoCredentialRef: null,
      repoMirrorPath: 'C:\\repo-mirror',
      repoSyncStatus: 'ready',
      repoSyncError: null,
      repoHeadRef: 'abc123',
      projectPath: 'C:\\workspace\\project',
      modelEndpoint: null,
      modelName: 'kimi-k2.5',
      skillSet: {},
      lastRepoSyncAt: new Date(),
    };
    const project = {
      id: 'project_1',
      name: 'Payments',
      feishuChatId: 'chat_1',
    };
    const projectContextBundle = {
      project: {
        id: 'project_1',
        name: 'Payments',
        feishuChatId: 'chat_1',
      },
      environment: {
        id: 'env_1',
        name: 'Default',
      },
      session: {
        runtimeSessionKey: 'chat:chat_1:manager',
        sessionMode: 'active',
        status: 'idle',
      },
      recentMessages: [],
      recentRuns: [],
      recentArtifacts: [],
      folderEntries: [],
      folderEntriesTruncated: false,
      docSnapshots: [],
      bitableSnapshot: null,
    };
    const roleProfile = {
      agentRole: 'manager',
      agentsMd: 'agents',
      soulMd: 'soul',
      userMd: 'user',
      standingOrdersMd: 'standing orders',
      promptPreludeMd: 'prelude',
      skills: ['progress-summary'],
      compiledContextFile: '# AGENTS\nsmoke profile',
    };
    const prisma = {
      projectEnvironment: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(environment),
      },
      groupAgentSession: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(session),
      },
      project: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(project),
      },
      agentRun: {
        create: jest.fn().mockResolvedValue({ id: 'run_1' }),
      },
      confirmationRequest: {
        findUnique: jest.fn(),
      },
    };
    const piMono = {
      runGroupRuntimeTurn: jest.fn(),
    };
    const groupSessions = {
      tryAcquireLock: jest.fn().mockResolvedValue(true),
      releaseLock: jest.fn().mockResolvedValue(undefined),
      getOrCreateSession: jest.fn().mockResolvedValue(session),
      syncRuntimeSessionState: jest.fn().mockResolvedValue(undefined),
      syncGroupRuntimeState: jest.fn().mockResolvedValue(undefined),
    };
    const repoSync = {
      maybeRefreshForInteractive: jest.fn().mockResolvedValue(undefined),
    };
    const runtimeContext = {
      assemble: jest.fn().mockResolvedValue(projectContextBundle),
      toSessionStatus: jest.fn().mockReturnValue('idle'),
    };
    const roleProfiles = {
      compile: jest.fn().mockResolvedValue(roleProfile),
    };
    const runtimeTasks = {
      listForSession: jest.fn(),
      applyAction: jest.fn().mockResolvedValue(undefined),
      attachConfirmation: jest.fn().mockResolvedValue(undefined),
      releaseBlockedTask: jest.fn().mockResolvedValue(undefined),
    };
    const feishu = {
      sendTextMessage: jest.fn().mockResolvedValue(undefined),
    };
    const confirmations = {
      create: jest.fn().mockResolvedValue({ id: 'confirm_1' }),
    };
    const artifactQueue = {
      add: jest.fn().mockResolvedValue(undefined),
    };

    const service = new GroupRuntimeService(
      prisma as any,
      piMono as any,
      groupSessions as any,
      repoSync as any,
      runtimeContext as any,
      roleProfiles as any,
      runtimeTasks as any,
      feishu as any,
      confirmations as any,
      artifactQueue as any,
    );

    return {
      service,
      prisma,
      piMono,
      groupSessions,
      repoSync,
      runtimeContext,
      roleProfiles,
      runtimeTasks,
      feishu,
      confirmations,
      artifactQueue,
      session,
    };
  };

  it('processes a group runtime turn, persists todo actions, and emits an audit run', async () => {
    const { service, piMono, runtimeTasks, feishu, artifactQueue, prisma, groupSessions } = createService();

    runtimeTasks.listForSession
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'task_1',
          title: 'smoke task',
          description: 'Check runtime flow',
          intent: 'progress_summary',
          skillHint: null,
          outputMode: 'summary',
          orderIndex: 1,
          status: 'completed',
          taskPayloadJson: null,
          resultSummary: 'Done',
          lastError: null,
        },
      ]);

    piMono.runGroupRuntimeTurn.mockResolvedValue({
      status: 'succeeded',
      actions: [
        {
          type: 'reply_group',
          text: 'SMOKE_CREATE_TASK_ACK',
        },
        {
          type: 'todo_write',
          action: 'create',
          title: 'smoke task',
          description: 'Check runtime flow',
          intent: 'progress_summary',
          outputMode: 'summary',
        },
        {
          type: 'todo_write',
          action: 'start',
          taskId: 'task_1',
          resultSummary: 'Started',
        },
        {
          type: 'todo_write',
          action: 'complete',
          taskId: 'task_1',
          resultSummary: 'Done',
        },
      ],
      outputs: [{ type: 'summary', title: 'smoke-summary', content: 'SMOKE_CREATE_TASK_DONE' }],
      session: {
        runtimeSessionKey: 'chat:chat_1:manager',
        piSessionId: 'pi_session_1',
        sessionStoreDriver: 'local_file',
        sessionStoreRef: 'C:\\sessions\\chat_1.jsonl',
        memorySummary: 'updated summary',
      },
    });

    const result = await service.handleMentionMessage({
      projectId: 'project_1',
      environmentId: 'env_1',
      feishuChatId: 'chat_1',
      messageSourceId: 'source_1',
      prompt: '[SMOKE_CREATE_TASK]',
      senderOpenId: 'ou_sender',
      traceId: 'trace_1',
    });

    expect(result).toEqual({ status: 'completed', passes: 1 });
    expect(piMono.runGroupRuntimeTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        runtimeSessionKey: 'chat:chat_1:manager',
        prompt: '[SMOKE_CREATE_TASK]',
      }),
    );
    expect(runtimeTasks.applyAction).toHaveBeenCalledTimes(3);
    expect(feishu.sendTextMessage).toHaveBeenCalledWith('chat_id', 'chat_1', 'SMOKE_CREATE_TASK_ACK');
    expect(prisma.agentRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: 'project_1',
          environmentId: 'env_1',
          groupRuntimeTaskId: 'task_1',
          status: 'syncing',
        }),
      }),
    );
    expect(artifactQueue.add).toHaveBeenCalledWith('sync-run', { agentRunId: 'run_1' }, { jobId: 'run_1-sync' });
    expect(groupSessions.syncGroupRuntimeState).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session_1',
        currentRuntimeTaskId: null,
        touchRuntimeTurnAt: true,
      }),
    );
  });

  it('creates a confirmation request and pauses the runtime when the turn blocks on approval', async () => {
    const { service, piMono, runtimeTasks, confirmations, groupSessions } = createService();

    runtimeTasks.listForSession
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'task_1',
          title: 'smoke confirm task',
          description: 'Need approval',
          intent: 'document_generate',
          skillHint: null,
          outputMode: 'summary',
          orderIndex: 1,
          status: 'waiting_confirmation',
          taskPayloadJson: null,
          resultSummary: 'Waiting for confirmation',
          lastError: null,
        },
      ]);

    piMono.runGroupRuntimeTurn.mockResolvedValue({
      status: 'succeeded',
      actions: [
        {
          type: 'todo_write',
          action: 'start',
          taskId: 'task_1',
          resultSummary: 'Started',
        },
        {
          type: 'request_group_confirmation',
          taskId: 'task_1',
          actionType: 'document_publish',
          summary: 'Need approval',
          detail: 'Please approve the smoke flow',
          payload: {
            reply: 'Need approval',
            intent: 'document_generate',
            executionPrompt: 'Continue smoke flow',
            outputMode: 'summary',
          },
        },
      ],
      outputs: [],
      session: {
        runtimeSessionKey: 'chat:chat_1:manager',
        piSessionId: 'pi_session_1',
        sessionStoreDriver: 'local_file',
        sessionStoreRef: 'C:\\sessions\\chat_1.jsonl',
        memorySummary: 'updated summary',
      },
    });

    const result = await service.handleMentionMessage({
      projectId: 'project_1',
      environmentId: 'env_1',
      feishuChatId: 'chat_1',
      messageSourceId: 'source_1',
      prompt: '[SMOKE_CONFIRM]',
      senderOpenId: 'ou_sender',
      traceId: 'trace_2',
    });

    expect(result).toEqual({ status: 'waiting_confirmation', passes: 1 });
    expect(confirmations.create).toHaveBeenCalledWith(
      expect.objectContaining({
        groupRuntimeTaskId: 'task_1',
        actionType: 'document_publish',
      }),
    );
    expect(runtimeTasks.attachConfirmation).toHaveBeenCalledWith('task_1', 'confirm_1');
    expect(groupSessions.syncGroupRuntimeState).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session_1',
        currentRuntimeTaskId: null,
        runtimeStateJson: expect.objectContaining({
          waitingConfirmation: true,
        }),
      }),
    );
  });
});
