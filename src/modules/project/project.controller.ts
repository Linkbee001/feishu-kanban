import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../../common/auth/admin-auth.guard';
import { ProjectService } from './project.service';

@UseGuards(AdminAuthGuard)
@Controller('api/projects')
export class ProjectController {
  constructor(private readonly projects: ProjectService) {}

  @Post('init-from-chat')
  init(@Body() body: any) {
    return this.projects.initFromChat(body);
  }

  @Get('by-chat/:chatId')
  findByChat(@Param('chatId') chatId: string) {
    return this.projects.findByChat(chatId);
  }

  @Post('by-chat/:chatId/unbind')
  unbindByChat(@Param('chatId') chatId: string) {
    return this.projects.unbindByChat(chatId);
  }

  @Post('by-chat/:chatId/cleanup')
  cleanupByChat(@Param('chatId') chatId: string) {
    return this.projects.cleanupByChat(chatId);
  }

  @Get(':id')
  find(@Param('id') id: string) {
    return this.projects.findById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.projects.update(id, body);
  }

  @Post(':id/archive')
  archive(@Param('id') id: string) {
    return this.projects.archive(id);
  }
}
