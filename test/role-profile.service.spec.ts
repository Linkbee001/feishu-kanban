import { AgentRole } from '@prisma/client';
import { DEFAULT_MANAGER_SKILLS, RoleProfileService } from '../src/modules/agent/role-profile.service';

describe('RoleProfileService', () => {
  it('compiles a fixed manager profile from code constants', async () => {
    const service = new RoleProfileService();

    const profile = await service.compile({
      projectName: 'Payments',
      feishuChatId: 'chat_1',
      senderOpenId: 'ou_123',
      agentRole: AgentRole.manager,
    });

    expect(profile.agentRole).toBe(AgentRole.manager);
    expect(profile.skills).toEqual([...DEFAULT_MANAGER_SKILLS]);
    expect(profile.compiledContextFile).toContain('group project administrator');
    expect(profile.compiledContextFile).toContain('Formal knowledge belongs in Feishu docs');
    expect(profile.compiledContextFile).toContain('Project: Payments');
  });
});
