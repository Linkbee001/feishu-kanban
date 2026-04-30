import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../../common/auth/admin-auth.guard';
import { EnvironmentService } from './environment.service';

@UseGuards(AdminAuthGuard)
@Controller()
export class EnvironmentController {
  constructor(private readonly environments: EnvironmentService) {}

  @Post('api/projects/:projectId/environments')
  create(@Param('projectId') projectId: string, @Body() body: any) {
    return this.environments.create(projectId, body);
  }

  @Get('api/projects/:projectId/environments')
  list(@Param('projectId') projectId: string) {
    return this.environments.list(projectId);
  }

  @Get('api/environments/:id')
  find(@Param('id') id: string) {
    return this.environments.find(id);
  }

  @Patch('api/environments/:id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.environments.update(id, body);
  }

  @Post('api/environments/:id/repo-sync')
  triggerRepoSync(@Param('id') id: string, @Body('force') force?: boolean) {
    return this.environments.triggerRepoSync(id, force ?? true);
  }

  @Post('api/environments/:id/set-default')
  setDefault(@Param('id') id: string, @Body('projectId') projectId: string) {
    return this.environments.setDefault(projectId, id);
  }
}
