import { FeishuEventService } from '../src/modules/feishu/feishu-event.service';

describe('FeishuEventService', () => {
  const createPayload = (
    text: string,
    chatType: 'p2p' | 'group' = 'p2p',
    options?: {
      mentions?: Array<{ id?: string; name?: string; key?: string; mentioned_type?: string }>;
      messageMentions?: Array<{
        id?: string;
        name?: string;
        key?: string;
        open_id?: string;
        display_name?: string;
        mentioned_type?: string;
      }>;
    },
  ) => ({
    header: { event_id: 'evt_1' },
    event: {
      message: {
        chat_id: chatType === 'group' ? 'chat_1' : 'ou_sender',
        message_id: 'msg_1',
        chat_type: chatType,
        content: JSON.stringify({
          text,
          mentions: options?.mentions ?? [],
        }),
        mentions: options?.messageMentions ?? [],
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
        reply: 'Starting execution.',
        decision: {
          action: 'execute',
          confidence: 'high',
          reason: 'The user explicitly asked for a document.',
          reply: 'Starting execution.',
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
    const groupRuntime = {
      handleMentionMessage: jest.fn().mockResolvedValue(undefined),
      resumeFromConfirmation: jest.fn().mockResolvedValue(undefined),
      getSessionSnapshot: jest.fn().mockResolvedValue(null),
    };
    const environments = {
      getEffectiveEnvironment: jest.fn().mockResolvedValue({
        id: 'env_1',
        name: 'Default',
        repoUrl: 'https://example.com/repo.git',
        repoBranch: 'main',
      }),
      find: jest.fn().mockResolvedValue({
        id: 'env_1',
        name: 'Default',
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
            reply: 'Please tell me the project name.',
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
    const policies = {
      findByChat: jest.fn().mockResolvedValue(null),
    };
    const memberProfiles = {
      touchMemberActivity: jest.fn().mockResolvedValue({}),
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
      listChatMembers: jest.fn().mockResolvedValue([]),
    };
    const queue = {
      add: jest.fn(),
    };

    const service = new FeishuEventService(
      prisma as any,
      agent as any,
      groupSessions as any,
      groupRuntime as any,
      environments as any,
      piMono as any,
      projects as any,
      policies as any,
      memberProfiles as any,
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
      groupRuntime,
      environments,
      piMono,
      projects,
      policies,
      memberProfiles,
      conversations,
      confirmations,
      feishu,
    };
  };

  it('prompts private-chat users to choose a project when projects are available', async () => {
    const { service, feishu, projects } = createService();
    projects.listAvailableForUser.mockResolvedValue([{ id: 'project_1', name: 'Payments' }]);

    await service.handle(createPayload('Please generate a PRD'));

    const [receiveType, receiveId, reply] = feishu.sendTextMessage.mock.calls[0];
    expect(receiveType).toBe('open_id');
    expect(receiveId).toBe('ou_sender');
    expect(reply).toContain('Payments');
    expect(reply).toContain('project');
  });

  it('selects a project in private chat and stores conversation context', async () => {
    const { service, projects, conversations, feishu } = createService();
    projects.listAvailableForUser.mockResolvedValue([
      {
        id: 'project_1',
        name: 'Payments',
        defaultEnvironmentId: 'env_1',
      },
    ]);

    await service.handle(createPayload('选择项目 Payments'));

    expect(conversations.selectProject).toHaveBeenCalledWith({
      sourceType: 'private',
      feishuChatId: 'ou_sender',
      userOpenId: 'ou_sender',
      projectId: 'project_1',
      environmentId: 'env_1',
    });
    expect(feishu.sendTextMessage).toHaveBeenCalledWith(
      'open_id',
      'ou_sender',
      expect.stringContaining('Payments'),
    );
  });

  it('starts initialization guidance for an uninitialized group via persisted session state', async () => {
    const { service, piMono, feishu, groupSessions } = createService();

    await service.handle(createPayload('We need to start a payments project', 'group'));

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
    expect(feishu.sendTextMessage).toHaveBeenCalledWith(
      'chat_id',
      'chat_1',
      expect.stringContaining('project name'),
    );
  });

  it('returns busy message when the group lock is already held', async () => {
    const { service, groupSessions, feishu } = createService();
    groupSessions.tryAcquireLock.mockResolvedValue(false);

    await service.handle(createPayload('Initialize payments project', 'group'));

    const [, , reply] = feishu.sendTextMessage.mock.calls[0];
    expect(reply).toContain('任务');
  });

  it('initializes the group when pi mono says collected info is ready', async () => {
    const { service, piMono, projects, groupSessions, feishu } = createService();
    piMono.runPrompt.mockResolvedValue([
      {
        type: 'summary',
        title: 'bootstrap',
        content: JSON.stringify({
          reply: 'Everything is ready.',
          ready: true,
          project: {
            name: 'Payments',
            description: 'Payments project',
            repoUrl: 'https://example.com/pay.git',
            repoBranch: 'main',
          },
          missingFields: [],
        }),
        contentFormat: 'json',
      },
    ]);

    await service.handle(
      createPayload('Initialize project Payments with repo https://example.com/pay.git branch main', 'group'),
    );

    expect(projects.initFromChat).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Payments',
        repoUrl: 'https://example.com/pay.git',
        repoBranch: 'main',
      }),
    );
    expect(groupSessions.bindProjectSession).toHaveBeenCalled();
    const [, , reply] = feishu.sendTextMessage.mock.calls[0];
    expect(reply).toContain('初始化完成');
  });

  it('stores initialized group messages but ignores non-mentioned messages', async () => {
    const { service, prisma, groupRuntime, agent } = createService();
    prisma.project.findUnique.mockResolvedValue({
      id: 'project_1',
      name: 'Payments',
      feishuChatId: 'chat_1',
    });

    await service.handle(createPayload('Please generate a PRD', 'group'));

    expect(prisma.messageSource.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rawText: 'Please generate a PRD',
          isBotMentioned: false,
          mentionsJson: [],
          rawContentJson: expect.objectContaining({
            text: 'Please generate a PRD',
          }),
        }),
      }),
    );
    expect(groupRuntime.handleMentionMessage).not.toHaveBeenCalled();
    expect(agent.handleInteractiveGroupMessage).not.toHaveBeenCalled();
  });

  it('routes mentioned group messages into the group runtime path', async () => {
    const { service, prisma, groupRuntime } = createService();
    prisma.project.findUnique.mockResolvedValue({
      id: 'project_1',
      name: 'Payments',
      feishuChatId: 'chat_1',
    });

    await service.handle(
      createPayload('Please generate a PRD', 'group', {
        mentions: [{ id: 'ou_bot', name: 'bot', mentioned_type: 'bot' }],
      }),
    );

    expect(groupRuntime.handleMentionMessage).toHaveBeenCalledWith({
      projectId: 'project_1',
      environmentId: 'env_1',
      feishuChatId: 'chat_1',
      messageSourceId: 'source_1',
      feishuMessageId: 'msg_1',
      prompt: 'Please generate a PRD',
      senderOpenId: 'ou_sender',
      traceId: expect.any(String),
    });
    expect(prisma.messageSource.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isBotMentioned: true,
          mentionsJson: [{ id: 'ou_bot', name: 'bot', key: undefined, mentionedType: 'bot' }],
        }),
      }),
    );
  });

  it('falls back to message.mentions when content.mentions is empty', async () => {
    const { service, prisma, groupRuntime } = createService();
    prisma.project.findUnique.mockResolvedValue({
      id: 'project_1',
      name: 'Payments',
      feishuChatId: 'chat_1',
    });

    await service.handle(
      createPayload('@_user_1 Please generate a PRD', 'group', {
        mentions: [],
        messageMentions: [{ key: '@_user_1', name: 'Kanban', open_id: 'ou_bot', mentioned_type: 'bot' }],
      }),
    );

    expect(groupRuntime.handleMentionMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: '@_user_1 Please generate a PRD',
      }),
    );
    expect(prisma.messageSource.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isBotMentioned: true,
          mentionsJson: [{ id: 'ou_bot', name: 'Kanban', key: '@_user_1', mentionedType: 'bot' }],
        }),
      }),
    );
  });
});
