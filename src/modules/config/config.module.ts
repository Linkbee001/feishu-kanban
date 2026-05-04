import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { FeishuModule } from '../feishu/feishu.module';
import { AgentModule } from '../agent/agent.module';
import { ProjectModule } from '../project/project.module';
import { GroupConfigService } from './group-config.service';
import { MarkdownProjectConfigParser } from './project-config.parser';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => FeishuModule),
    forwardRef(() => AgentModule),
    forwardRef(() => ProjectModule),
  ],
  providers: [GroupConfigService, MarkdownProjectConfigParser],
  exports: [GroupConfigService, MarkdownProjectConfigParser],
})
export class ConfigModule {}