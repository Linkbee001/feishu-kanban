import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../../common/auth/admin-auth.guard';
import { AgentService } from './agent.service';

@UseGuards(AdminAuthGuard)
@Controller('api/agent-runs')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post()
  create(
    @Body()
    body: {
      projectId: string;
      environmentId: string;
      messageSourceId?: string;
      prompt: string;
      intent?: string;
      skillName?: string | null;
    },
  ) {
    return this.agentService.createRun(body);
  }

  @Get(':id')
  find(@Param('id') id: string) {
    return this.agentService.findRun(id);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.agentService.cancelRun(id);
  }

  @Post(':id/retry-sync')
  retrySync(@Param('id') id: string) {
    return this.agentService.retrySync(id);
  }
}
