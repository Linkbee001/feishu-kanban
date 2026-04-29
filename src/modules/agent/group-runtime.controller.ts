import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../../common/auth/admin-auth.guard';
import { GroupRuntimeService } from './group-runtime.service';

@UseGuards(AdminAuthGuard)
@Controller('api/group-runtime-sessions')
export class GroupRuntimeController {
  constructor(private readonly runtime: GroupRuntimeService) {}

  @Get(':chatId')
  getSession(@Param('chatId') chatId: string) {
    return this.runtime.getSessionSnapshot(chatId);
  }

  @Get(':chatId/tasks')
  async getTasks(@Param('chatId') chatId: string) {
    const snapshot = await this.runtime.getSessionSnapshot(chatId);
    return snapshot?.tasks ?? [];
  }
}
