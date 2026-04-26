import { FeishuEventService } from '../src/modules/feishu/feishu-event.service';

describe('FeishuEventService', () => {
  const createPayload = (text: string, chatType: 'p2p' | 'group' = 'p2p') => ({
    header: { event_id: 'evt_1' },
    event: {
      message: {
        chat_id: chatType === 'group' ? 'chat_1' : 'ou_sender',
        message_id: 'msg_1',
        chat_type: chatType,
        content: JSON.stringify({ text }),
      },
      sender: {
        sender_id: {
          open_id: 'ou_sender',
        },
      },
    },
  });

  const createService = () => {
    const prisma = {
      feishuEventDedup: {
        create: jest.fn().mockResolvedValue({ eventId: 'evt_1' }),
      },
      project: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      messageSource: {
        create: jest.fn().mockResolvedValue({ id: 'source_1' }),
      },
    };
    const agent = {
      submitGroupMessage: jest.fn().mockResolvedValue({
        status: 'accepted',
        runId: 'run_1',
      }),
      handleInteractiveGroupMessage: jest.fn().mockResolvedValue({
        status: 'accepted',
        runId: 'run_1',
        reply: '我会开始整理成正式文档。',
        decision: {
          action: 'execute',
          confidence: 'high',
          reason: 'The user explicitly asked for a document.',
          reply: '我会开始整理成正式文档。',
          intent: 'document_generate',
        },
        session: {
          id: 'session_1',
          runtimeSessionKey: 'chat:chat_1:manager',
        },
        lockToken: 'lock_1',
      }),
    };
    const groupSessions = {
      getOrCreateSession: jest.fn().mockResolvedValue({
        id: 'session_1',
        runtimeSessionKey: 'chat:chat_1:manager',
        sessionState: {},
      }),
      tryAcquireLock: jest.fn().mockResolvedValue(true),
      getBootstrapDraft: jest.fn().mockReturnValue({}),
      updateBootstrapState: jest.fn().mockResolvedValue({}),
      syncRuntimeSessionState: jest.fn().mockResolvedValue({}),
      bindProjectSession: jest.fn().mockResolvedValue({}),
      releaseBootstrapLock: jest.fn().mockResolvedValue(undefined),
    };
    const environments = {
      getEffectiveEnvironment: jest.fn().mockResolvedValue({
        id: 'env_1',
        name: '默认主环境',
        repoUrl: 'https://example.com/repo.git',
        repoBranch: 'main',
      }),
      find: jest.fn().mockResolvedValue({
        id: 'env_1',
        name: '默认主环境',
        repoUrl: 'https://example.com/repo.git',
        repoBranch: 'main',
      }),
    };
    const piMono = {
      runPrompt: jest.fn().mockResolvedValue([
        {
          type: 'summary',
          title: 'bootstrap',
          content: JSON.stringify({
            reply: '请告诉我项目名称。',
            ready: false,
            project: {},
            missingFields: ['name'],
          }),
          contentFormat: 'json',
        },
      ]),
      getSessionSnapshot: jest.fn().mockReturnValue({
        runtimeSessionKey: 'chat:chat_1:manager',
        piSessionId: 'pi_session_1',
        sessionStoreDriver: 'local_file',
        sessionStoreRef: '/workspace/.pi-agent/sessions/managed/chat_chat_1_manager.jsonl',
        memorySummary: 'bootstrap summary',
      }),
    };
    const projects = {
      listAvailableForUser: jest.fn().mockResolvedValue([]),
      initFromChat: jest.fn().mockResolvedValue({ id: 'project_1', defaultEnvironmentId: 'env_1' }),
    };
    const conversations = {
      getActiveContext: jest.fn().mockResolvedValue(null),
      selectProject: jest.fn().mockResolvedValue({ id: 'ctx_1' }),
    };
    const confirmations = {
      decideFromCard: jest.fn(),
      create: jest.fn(),
    };
    const feishu = {
      sendTextMessage: jest.fn().mockResolvedValue({}),
    };
    const queue = {
      add: jest.fn(),
    };

    const service = new FeishuEventService(
      prisma as any,
      agent as any,
      groupSessions as any,
      environments as any,
      piMono as any,
      projects as any,
      conversations as any,
      confirmations as any,
      feishu as any,
      queue as any,
    );

    return {
      service,
      prisma,
      agent,
      groupSessions,
      environments,
      piMono,
      projects,
      conversations,
      confirmations,
      feishu,
    };
  };

  it('prompts private-chat users to choose a project when projects are available', async () => {
    const { service, feishu, projects } = createService();
    projects.listAvailableForUser.mockResolvedValue([{ id: 'project_1', name: '支付项目' }]);

    await service.handle(createPayload('帮我生成 PRD'));

    expect(feishu.sendTextMessage).toHaveBeenCalledWith('open_id', 'ou_sender', expect.stringContaining('私聊模式不会自动绑定最近项目'));
    expect(feishu.sendTextMessage).toHaveBeenCalledWith('open_id', 'ou_sender', expect.stringContaining('选择项目'));
  });

  it('selects a project in private chat and stores conversation context', async () => {
    const { service, projects, conversations, feishu } = createService();
    projects.listAvailableForUser.mockResolvedValue([
      {
        id: 'project_1',
        name: '支付项目',
        defaultEnvironmentId: 'env_1',
      },
    ]);

    await service.handle(createPayload('选择项目 支付项目'));

    expect(conversations.selectProject).toHaveBeenCalledWith({
      sourceType: 'private',
      feishuChatId: 'ou_sender',
      userOpenId: 'ou_sender',
      projectId: 'project_1',
      environmentId: 'env_1',
    });
    expect(feishu.sendTextMessage).toHaveBeenCalledWith('open_id', 'ou_sender', expect.stringContaining('已切换到项目：支付项目'));
  });

  it('starts initialization guidance for an uninitialized group via persisted session state', async () => {
    const { service, piMono, feishu, groupSessions } = createService();

    await service.handle(createPayload('大家好，我们要做支付中台', 'group'));

    expect(groupSessions.getOrCreateSession).toHaveBeenCalledWith(
      'chat_1',
      expect.objectContaining({ sessionMode: 'bootstrap' }),
    );
    expect(piMono.runPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ sessionKey: 'chat:chat_1:manager' }),
    );
    expect(groupSessions.syncRuntimeSessionState).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session_1',
        piSessionId: 'pi_session_1',
        sessionStoreDriver: 'local_file',
      }),
    );
    expect(groupSessions.updateBootstrapState).toHaveBeenCalled();
    expect(feishu.sendTextMessage).toHaveBeenCalledWith('chat_id', 'chat_1', expect.stringContaining('请告诉我项目名称'));
  });

  it('returns busy message when the group lock is already held', async () => {
    const { service, groupSessions, feishu } = createService();
    groupSessions.tryAcquireLock.mockResolvedValue(false);

    await service.handle(createPayload('初始化项目 支付中台', 'group'));

    expect(feishu.sendTextMessage).toHaveBeenCalledWith('chat_id', 'chat_1', expect.stringContaining('当前群正在处理上一条任务'));
  });

  it('initializes the group when pi mono says collected info is ready', async () => {
    const { service, piMono, projects, groupSessions, feishu } = createService();
    piMono.runPrompt.mockResolvedValue([
      {
        type: 'summary',
        title: 'bootstrap',
        content: JSON.stringify({
          reply: '信息已齐全。',
          ready: true,
          project: {
            name: '支付中台',
            description: '支付域协同项目',
            repoUrl: 'https://example.com/pay.git',
            repoBranch: 'main',
          },
          missingFields: [],
        }),
        contentFormat: 'json',
      },
    ]);

    await service.handle(createPayload('初始化项目 支付中台，仓库 https://example.com/pay.git，分支 main', 'group'));

    expect(projects.initFromChat).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '支付中台',
        repoUrl: 'https://example.com/pay.git',
        repoBranch: 'main',
      }),
    );
    expect(groupSessions.bindProjectSession).toHaveBeenCalled();
    expect(feishu.sendTextMessage).toHaveBeenCalledWith('chat_id', 'chat_1', expect.stringContaining('项目资源已初始化完成'));
  });

  it('submits initialized group messages through the manager interaction path', async () => {
    const { service, prisma, feishu, agent, groupSessions } = createService();
    prisma.project.findUnique.mockResolvedValue({
      id: 'project_1',
      name: '支付项目',
      feishuChatId: 'chat_1',
    });

    await service.handle(createPayload('帮我生成 PRD', 'group'));

    expect(groupSessions.getOrCreateSession).toHaveBeenCalledWith(
      'chat_1',
      expect.objectContaining({
        projectId: 'project_1',
        environmentId: 'env_1',
        sessionMode: 'active',
      }),
    );
    expect(agent.handleInteractiveGroupMessage).toHaveBeenCalledWith({
      sessionId: 'session_1',
      projectId: 'project_1',
      environmentId: 'env_1',
      feishuChatId: 'chat_1',
      messageSourceId: 'source_1',
      prompt: '帮我生成 PRD',
      senderOpenId: 'ou_sender',
      traceId: expect.any(String),
    });
    expect(feishu.sendTextMessage).toHaveBeenCalledWith('chat_id', 'chat_1', expect.stringContaining('执行ID：run_1'));
  });

  it('sends a manager follow-up reply instead of creating a run when the request is ambiguous', async () => {
    const { service, prisma, feishu, agent } = createService();
    prisma.project.findUnique.mockResolvedValue({
      id: 'project_1',
      name: '支付项目',
      feishuChatId: 'chat_1',
    });
    agent.handleInteractiveGroupMessage.mockResolvedValue({
      status: 'followup',
      reply: '你希望我输出成文档、任务还是只是口头总结？',
      decision: {
        action: 'ask_followup',
        confidence: 'low',
        reason: 'The user request does not specify the desired output.',
        reply: '你希望我输出成文档、任务还是只是口头总结？',
        intent: 'requirement_analysis',
      },
      session: {
        id: 'session_1',
        runtimeSessionKey: 'chat:chat_1:manager',
      },
    });

    await service.handle(createPayload('先帮我看一下这个事情', 'group'));

    expect(feishu.sendTextMessage).toHaveBeenCalledWith('chat_id', 'chat_1', '你希望我输出成文档、任务还是只是口头总结？');
  });

  it('creates a confirmation card from manager decision output', async () => {
    const { service, prisma, confirmations, agent } = createService();
    prisma.project.findUnique.mockResolvedValue({
      id: 'project_1',
      name: '支付项目',
      feishuChatId: 'chat_1',
    });

    const payload = {
      reply: '我建议先确认后再切环境。',
      intent: 'environment_switch',
      executionPrompt: '切换到 release 环境并说明影响。',
      outputMode: 'summary',
      targetChannels: ['group_message'],
      metadata: { risk: 'medium' },
    };

    agent.handleInteractiveGroupMessage.mockResolvedValue({
      status: 'confirmation_requested',
      reply: payload.reply,
      actionType: 'environment_switch',
      confirmationPayload: payload,
      decision: {
        action: 'request_confirmation',
        confidence: 'medium',
        reason: 'Environment switches should be confirmed before execution.',
        reply: payload.reply,
        intent: 'environment_switch',
      },
      session: {
        id: 'session_1',
        runtimeSessionKey: 'chat:chat_1:manager',
      },
    });

    await service.handle(createPayload('切到 release 环境', 'group'));

    expect(confirmations.create).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'environment_switch',
        payload,
        summary: payload.reply,
      }),
    );
  });
});
