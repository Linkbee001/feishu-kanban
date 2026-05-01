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
      project: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(project),
      },
      groupPolicy: {
        findFirst: jest.fn().mockResolvedValue({
          defaultQueueMode: 'collect',
          mentionOnly: true,
          allowDocWrite: true,
          allowTaskBoardWrite: true,
          highRiskActionsRequireConfirmation: true,
        }),
      },
      confirmationRequest: {
        findUnique: jest.fn(),
      },
      groupAgentSession: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    const piMono = {
      submitMessage: jest.fn().mockResolvedValue({
        accepted: true,
        action: 'run_now',
        runtimeSessionKey: 'chat:chat_1:manager',
        activeTurnId: 'turn_1',
      }),
      resumeSession: jest.fn().mockResolvedValue({ accepted: true }),
      getSessionSnapshot: jest.fn().mockReturnValue({
        runtimeSessionKey: 'chat:chat_1:manager',
        piSessionId: 'pi_session_1',
        sessionStoreDriver: 'local_file',
        sessionStoreRef: 'C:\\sessions\\chat_1.jsonl',
        memorySummary: 'updated summary',
      }),
      getRuntimeState: jest.fn().mockReturnValue({
        runtimeSessionKey: 'chat:chat_1:manager',
        status: 'running',
        queue: [],
        isStreaming: true,
        isCompacting: false,
      }),
      pullRuntimeEvents: jest.fn().mockReturnValue([]),
    };
    const groupSessions = {
      getOrCreateSession: jest.fn().mockResolvedValue(session),
      syncRuntimeSessionState: jest.fn().mockResolvedValue(undefined),
      syncGroupRuntimeState: jest.fn().mockResolvedValue(undefined),
    };
    const roleProfiles = {
      compile: jest.fn().mockResolvedValue(roleProfile),
    };
    const runtimeTasks = {
      listForSession: jest.fn().mockResolvedValue([]),
    };
    const runtimeContext = {
      buildManagerResourceSummary: jest.fn().mockResolvedValue({
        hasDocFolder: true,
        hasTaskBoard: true,
        recentDocs: [{ title: 'PRD', updatedAt: '2026-04-30T00:00:00.000Z' }],
        taskBoardSummary: {
          pendingConfirmation: 1,
          blocked: 2,
          inProgress: 3,
        },
        recentArtifacts: [{ title: 'Plan', type: 'document', createdAt: '2026-04-30T00:00:00.000Z' }],
      }),
    };
    const feishu = {
      addMessageReaction: jest.fn().mockResolvedValue({ data: { reaction_id: 'reaction_1' } }),
      removeMessageReaction: jest.fn().mockResolvedValue(undefined),
    };
    const artifactQueue = {};

    const service = new GroupRuntimeService(
      prisma as any,
      piMono as any,
      groupSessions as any,
      roleProfiles as any,
      runtimeTasks as any,
      runtimeContext as any,
      feishu as any,
      artifactQueue as any,
    );

    return {
      service,
      prisma,
      piMono,
      groupSessions,
      roleProfiles,
      runtimeContext,
      session,
    };
  };

  it('submits a group message into the runtime orchestrator', async () => {
    const { service, piMono, groupSessions, runtimeContext } = createService();

    const result = await service.handleMentionMessage({
      projectId: 'project_1',
      environmentId: 'env_1',
      feishuChatId: 'chat_1',
      messageSourceId: 'source_1',
      feishuMessageId: 'msg_1',
      prompt: '[SMOKE_CREATE_TASK]',
      senderOpenId: 'ou_sender',
      traceId: 'trace_1',
    });

    expect(result).toEqual({
      status: 'run_now',
      runtimeSessionKey: 'chat:chat_1:manager',
      activeTurnId: 'turn_1',
    });
    expect(piMono.submitMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        runtimeSessionKey: 'chat:chat_1:manager',
        queueMode: 'collect',
        minimalContext: expect.objectContaining({
          groupPolicy: expect.objectContaining({
            allowDocWrite: true,
            allowTaskBoardWrite: true,
            highRiskActionsRequireConfirmation: true,
          }),
          resourceSummary: expect.objectContaining({
            hasDocFolder: true,
            hasTaskBoard: true,
          }),
        }),
        envelope: expect.objectContaining({
          messageSourceId: 'source_1',
          rawText: '[SMOKE_CREATE_TASK]',
          sourceType: 'group',
        }),
      }),
    );
    expect(runtimeContext.buildManagerResourceSummary).toHaveBeenCalledWith({
      projectId: 'project_1',
    });
    expect(groupSessions.syncRuntimeSessionState).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session_1',
        piSessionId: 'pi_session_1',
      }),
    );
  });

  it('resumes a waiting runtime session from confirmation', async () => {
    const { service, piMono, prisma } = createService();

    prisma.confirmationRequest.findUnique.mockResolvedValue({
      id: 'confirm_1',
      projectId: 'project_1',
      environmentId: 'env_1',
      groupRuntimeTaskId: 'task_1',
      confirmedBy: 'ou_owner',
      status: 'confirmed',
      messageSourceId: 'source_1',
      messageSource: {
        feishuChatId: 'chat_1',
      },
    });

    const result = await service.resumeFromConfirmation('confirm_1', {
      confirmationId: 'confirm_1',
      taskId: 'task_1',
      eventText: 'Continue after confirmation.',
    });

    expect(result).toEqual({ accepted: true });
    expect(piMono.resumeSession).toHaveBeenCalledWith(
      expect.objectContaining({
        runtimeSessionKey: 'chat:chat_1:manager',
        event: expect.objectContaining({
          type: 'confirmation_resolved',
          text: 'Continue after confirmation.',
        }),
      }),
    );
  });
});
