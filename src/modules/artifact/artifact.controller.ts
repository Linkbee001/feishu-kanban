import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../../common/auth/admin-auth.guard';
import { ArtifactService } from './artifact.service';

@UseGuards(AdminAuthGuard)
@Controller()
export class ArtifactController {
  constructor(private readonly artifacts: ArtifactService) {}

  @Get('api/projects/:projectId/artifacts')
  list(@Param('projectId') projectId: string) {
    return this.artifacts.list(projectId);
  }

  @Get('api/artifacts/:id')
  find(@Param('id') id: string) {
    return this.artifacts.find(id);
  }

  @Post('api/artifacts/:id/retry-sync')
  retry(@Param('id') id: string) {
    return this.artifacts.retrySync(id);
  }
}
