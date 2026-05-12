import { BadRequestException, Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../../common/auth/admin-auth.guard';
import { GroupConfigService } from './group-config.service';

@UseGuards(AdminAuthGuard)
@Controller('api/group-config')
export class GroupConfigController {
  constructor(private readonly groupConfig: GroupConfigService) {}

  /**
   * Get current configuration status for a chat.
   * Returns session mode, project binding status.
   */
  @Get(':chatId')
  async getStatus(@Param('chatId') chatId: string) {
    return this.groupConfig.getConfigStatus(chatId);
  }

  /**
   * Get full config data for drawer UI.
   * Returns different data based on session mode (pending_config, active, bootstrap).
   */
  @Get(':chatId/full')
  async getFullConfig(@Param('chatId') chatId: string) {
    return this.groupConfig.getFullConfig(chatId);
  }

  /**
   * Manually sync group info and create pending_config session.
   * Per D-05: Manual trigger endpoint.
   */
  @Post(':chatId/sync')
  async syncGroupInfo(@Param('chatId') chatId: string) {
    return this.groupConfig.syncGroupInfo({ feishuChatId: chatId });
  }

  /**
   * Complete configuration by creating PROJECT-CONFIG.md and initializing project.
   * Per D-03: Backend completion endpoint.
   */
  @Post(':chatId/complete')
  async completeConfig(
    @Param('chatId') chatId: string,
    @Body() body: { ownerOpenId: string; configMarkdown: string },
  ) {
    if (!body.ownerOpenId?.trim()) {
      throw new BadRequestException('ownerOpenId is required');
    }
    if (!body.configMarkdown?.trim()) {
      throw new BadRequestException('configMarkdown is required');
    }

    return this.groupConfig.completeConfig({
      feishuChatId: chatId,
      ownerOpenId: body.ownerOpenId.trim(),
      configMarkdown: body.configMarkdown.trim(),
    });
  }

  /**
   * Update config for active groups.
   * Updates project name, description, customPrompt, policy, and environment settings.
   */
  @Patch(':chatId')
  async updateConfig(@Param('chatId') chatId: string, @Body() body: any) {
    return this.groupConfig.updateActiveConfig(chatId, body);
  }
}