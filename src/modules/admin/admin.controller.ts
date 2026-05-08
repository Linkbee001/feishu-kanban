import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
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

  @Delete('api/admin/robot-instances/:chatId')
  deleteRobotInstance(@Param('chatId') chatId: string) {
    return this.admin.deleteRobotInstance(chatId);
  }

  @Post('api/admin/robot-instances/:chatId/reset-config')
  @HttpCode(200)
  resetConfig(@Param('chatId') chatId: string) {
    return this.admin.resetRobotInstanceConfig(chatId);
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
  getLogs(
    @Param('chatId') chatId: string,
    @Query('since') since?: string,
    @Query('limit') limit?: string,
    @Query('eventType') eventType?: string,
  ) {
    const options = {
      since: since ? parseInt(since, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      eventType,
    };
    return this.admin.getLogs(chatId, options);
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

  @Get('api/admin/groups')
  listGroups(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.admin.listGroups({
      status,
      search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 25,
    });
  }

  @Post('api/admin/groups/:chatId/unbind')
  @HttpCode(200)
  unbindGroup(@Param('chatId') chatId: string) {
    return this.admin.unbindGroup(chatId);
  }
}
