import { DEFAULT_MANAGER_SKILLS } from '../src/modules/agent/role-profile.service';
import { GroupPolicyService } from '../src/modules/project/group-policy.service';

describe('GroupPolicyService', () => {
  it('uses the fixed manager skill list when creating the default group policy', async () => {
    const prisma = {
      groupPolicy: {
        upsert: jest.fn().mockResolvedValue(undefined),
      },
    };
    const service = new GroupPolicyService(prisma as any);

    await service.ensureDefaultPolicy({
      projectId: 'project_1',
      feishuChatId: 'chat_1',
      defaultEnvironmentId: 'env_1',
    });

    expect(prisma.groupPolicy.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          allowedSkillsJson: [...DEFAULT_MANAGER_SKILLS],
        }),
        update: expect.objectContaining({
          allowedSkillsJson: [...DEFAULT_MANAGER_SKILLS],
        }),
      }),
    );
  });
});
