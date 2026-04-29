import { AdminService } from '../src/modules/admin/admin.service';

describe('AdminService', () => {
  function createService() {
    const prisma = {
      project: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'project_1',
          feishuChatId: 'chat_1',
          ownerOpenId: 'ou_owner_1',
        }),
      },
      groupAgentSession: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'session_1',
            feishuChatId: 'chat_1',
            projectId: 'project_1',
            sessionMode: 'active',
            status: 'idle',
            lastMessageAt: new Date('2026-04-28T10:00:00.000Z'),
            updatedAt: new Date('2026-04-28T10:00:00.000Z'),
            lastError: null,
            project: {
              id: 'project_1',
              name: 'Payments',
              status: 'active',
              defaultEnvironmentId: 'env_1',
            },
            activeEnvironment: {
              id: 'env_1',
              name: 'Default',
            },
          },
        ]),
        findUnique: jest.fn().mockResolvedValue({
          id: 'session_1',
          feishuChatId: 'chat_1',
          projectId: 'project_1',
          sessionMode: 'active',
          status: 'idle',
          lastMessageAt: new Date('2026-04-28T10:00:00.000Z'),
          updatedAt: new Date('2026-04-28T10:00:00.000Z'),
          lastError: null,
          project: {
            id: 'project_1',
            name: 'Payments',
            status: 'active',
            defaultEnvironmentId: 'env_1',
          },
          activeEnvironment: {
            id: 'env_1',
            name: 'Default',
          },
        }),
      },
      groupRuntimeTask: {
        findMany: jest.fn().mockResolvedValue([
          { groupSessionId: 'session_1', status: 'queued' },
          { groupSessionId: 'session_1', status: 'running' },
          { groupSessionId: 'session_1', status: 'waiting_confirmation' },
        ]),
      },
      agentRun: {
        findMany: jest.fn().mockResolvedValue([
          { projectId: 'project_1', intent: 'progress_summary', skillName: 'progress-summary' },
        ]),
        findFirst: jest.fn().mockResolvedValue({
          projectId: 'project_1',
          intent: 'progress_summary',
          skillName: 'progress-summary',
        }),
      },
      artifact: {
        findMany: jest.fn().mockResolvedValue([
          { projectId: 'project_1', type: 'summary', title: 'Daily digest' },
        ]),
        findFirst: jest.fn().mockResolvedValue({
          projectId: 'project_1',
          type: 'summary',
          title: 'Daily digest',
        }),
      },
      groupPolicy: {
        findMany: jest.fn().mockResolvedValue([
          {
            feishuChatId: 'chat_1',
            enabled: true,
            mentionOnly: true,
            allowedSkillsJson: ['progress-summary'],
            defaultEnvironmentId: 'env_1',
            allowAutoTaskCreation: true,
            allowTaskBoardWrite: true,
            allowDocWrite: true,
            highRiskActionsRequireConfirmation: true,
            archivedAt: null,
          },
        ]),
      },
      messageSource: { findMany: jest.fn().mockResolvedValue([]) },
      confirmationRequest: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const runtime = {
      getSessionSnapshot: jest.fn().mockResolvedValue({
        session: { id: 'session_1' },
        profile: null,
        tasks: [{ id: 'task_1', title: 'Do work', status: 'queued', intent: 'progress_summary' }],
      }),
    };
    const feishu = {
      listChatMembers: jest.fn().mockResolvedValue([
        {
          openId: 'ou_member_1',
          displayName: 'Alice',
          groupNickname: 'Alice',
          metadata: {},
        },
      ]),
    };
    const policies = {
      findByChat: jest.fn().mockResolvedValue({
        id: 'policy_1',
        enabled: true,
        mentionOnly: true,
        allowedSkillsJson: ['progress-summary'],
        defaultEnvironmentId: 'env_1',
        allowAutoTaskCreation: true,
        allowTaskBoardWrite: true,
        allowDocWrite: true,
        highRiskActionsRequireConfirmation: true,
        archivedAt: null,
      }),
      getByChat: jest.fn().mockResolvedValue({
        id: 'policy_1',
        enabled: true,
        mentionOnly: true,
        allowedSkillsJson: ['progress-summary'],
        defaultEnvironmentId: 'env_1',
        allowAutoTaskCreation: true,
        allowTaskBoardWrite: true,
        allowDocWrite: true,
        highRiskActionsRequireConfirmation: true,
        archivedAt: null,
      }),
      updateByChat: jest.fn(),
      toSnapshot: jest.fn((policy: any) => ({
        enabled: policy.enabled,
        mentionOnly: policy.mentionOnly,
        allowedSkills: policy.allowedSkillsJson,
        defaultEnvironmentId: policy.defaultEnvironmentId,
        allowAutoTaskCreation: policy.allowAutoTaskCreation,
        allowTaskBoardWrite: policy.allowTaskBoardWrite,
        allowDocWrite: policy.allowDocWrite,
        highRiskActionsRequireConfirmation: policy.highRiskActionsRequireConfirmation,
        archivedAt: null,
      })),
    };
    const memberProfiles = {
      listByChat: jest.fn().mockResolvedValue([]),
      syncChatMembers: jest.fn().mockResolvedValue([
        {
          id: 'profile_1',
          openId: 'ou_member_1',
          displayName: 'Alice',
        },
      ]),
      updateByChat: jest.fn(),
    };

    return {
      service: new AdminService(prisma as any, runtime as any, feishu as any, policies as any, memberProfiles as any),
      prisma,
      runtime,
      feishu,
      policies,
      memberProfiles,
    };
  }

  it('aggregates robot instance list data', async () => {
    const { service } = createService();

    const items = await service.listRobotInstances();

    expect(items).toEqual([
      expect.objectContaining({
        robotName: 'Payments manager',
        chatId: 'chat_1',
        sessionMode: 'active',
        sessionStatus: 'idle',
        recentSkill: 'progress-summary',
        recentArtifactSummary: 'summary:Daily digest',
        taskCounts: expect.objectContaining({
          queued: 1,
          running: 1,
          waitingConfirmation: 1,
        }),
      }),
    ]);
  });

  it('returns policy snapshots for a robot instance', async () => {
    const { service } = createService();

    const policy = await service.getPolicy('chat_1');

    expect(policy).toEqual(
      expect.objectContaining({
        enabled: true,
        mentionOnly: true,
        allowedSkills: ['progress-summary'],
        defaultEnvironmentId: 'env_1',
      }),
    );
  });

  it('syncs chat members for a legacy group on demand', async () => {
    const { service, feishu, memberProfiles } = createService();

    const result = await service.syncMembers('chat_1');

    expect(feishu.listChatMembers).toHaveBeenCalledWith('chat_1');
    expect(memberProfiles.syncChatMembers).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'project_1',
        feishuChatId: 'chat_1',
        ownerOpenId: 'ou_owner_1',
        members: [expect.objectContaining({ openId: 'ou_member_1' })],
      }),
    );
    expect(result).toEqual([expect.objectContaining({ openId: 'ou_member_1' })]);
  });
});
