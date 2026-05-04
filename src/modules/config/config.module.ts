import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { FeishuModule } from '../feishu/feishu.module';
import { AgentModule } from '../agent/agent.module';
import { ProjectModule } from '../project/project.module';
import { GroupConfigService } from './group-config.service';
import { MarkdownProjectConfigParser } from './project-config.parser';
import { GroupConfigController } from './group-config.controller';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => FeishuModule),
    forwardRef(() => AgentModule),
    forwardRef(() => ProjectModule),
  ],
  controllers: [GroupConfigController],
  providers: [GroupConfigService, MarkdownProjectConfigParser],
  exports: [GroupConfigService, MarkdownProjectConfigParser],
})
export class ConfigModule {}