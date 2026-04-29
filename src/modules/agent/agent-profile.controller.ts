import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { AgentRole } from '@prisma/client';
import { AdminAuthGuard } from '../../common/auth/admin-auth.guard';
import { RoleProfileService } from './role-profile.service';

@UseGuards(AdminAuthGuard)
@Controller()
export class AgentProfileController {
  constructor(private readonly profiles: RoleProfileService) {}

  @Get('api/agent-profiles/:role')
  getRoleProfile(@Param('role') role: AgentRole) {
    return this.profiles.getRoleProfile(role);
  }

  @Patch('api/agent-profiles/:role')
  updateRoleProfile(@Param('role') role: AgentRole, @Body() body: Record<string, unknown>) {
    return this.profiles.updateRoleProfile(role, body as any);
  }

  @Get('api/projects/:projectId/agent-profiles/:role')
  getProjectOverride(@Param('projectId') projectId: string, @Param('role') role: AgentRole) {
    return this.profiles.getProjectOverride(projectId, role);
  }

  @Patch('api/projects/:projectId/agent-profiles/:role')
  updateProjectOverride(
    @Param('projectId') projectId: string,
    @Param('role') role: AgentRole,
    @Body() body: Record<string, unknown>,
  ) {
    return this.profiles.updateProjectOverride(projectId, role, body);
  }
}
