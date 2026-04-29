import { Body, Controller, Get, Param, Patch, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { AdminAuthGuard } from '../../common/auth/admin-auth.guard';
import { renderAdminConsolePage } from './admin-console.page';
import { AdminService } from './admin.service';

@UseGuards(AdminAuthGuard)
@Controller()
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('admin/console')
  console(@Res() res: Response) {
    res.type('html').send(renderAdminConsolePage());
  }

  @Get('api/admin/robot-instances')
  listRobotInstances() {
    return this.admin.listRobotInstances();
  }

  @Get('api/admin/robot-instances/:chatId')
  getRobotInstance(@Param('chatId') chatId: string) {
    return this.admin.getRobotInstance(chatId);
  }

  @Get('api/admin/robot-instances/:chatId/runtime')
  getRuntime(@Param('chatId') chatId: string) {
    return this.admin.getRuntime(chatId);
  }

  @Get('api/admin/robot-instances/:chatId/tasks')
  getTasks(@Param('chatId') chatId: string) {
    return this.admin.getTasks(chatId);
  }

  @Get('api/admin/robot-instances/:chatId/logs')
  getLogs(@Param('chatId') chatId: string) {
    return this.admin.getLogs(chatId);
  }

  @Get('api/admin/robot-instances/:chatId/members')
  getMembers(@Param('chatId') chatId: string) {
    return this.admin.getMembers(chatId);
  }

  @Post('api/admin/robot-instances/:chatId/members/sync')
  syncMembers(@Param('chatId') chatId: string) {
    return this.admin.syncMembers(chatId);
  }

  @Patch('api/admin/robot-instances/:chatId/members/:profileId')
  updateMember(@Param('chatId') chatId: string, @Param('profileId') profileId: string, @Body() body: any) {
    return this.admin.updateMember(chatId, profileId, body);
  }

  @Get('api/admin/robot-instances/:chatId/policy')
  getPolicy(@Param('chatId') chatId: string) {
    return this.admin.getPolicy(chatId);
  }

  @Patch('api/admin/robot-instances/:chatId/policy')
  updatePolicy(@Param('chatId') chatId: string, @Body() body: any) {
    return this.admin.updatePolicy(chatId, body);
  }
}
