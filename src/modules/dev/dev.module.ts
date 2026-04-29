import { Module } from '@nestjs/common';
import { AgentModule } from '../agent/agent.module';
import { DevController } from './dev.controller';
import { DevService } from './dev.service';
import { FeishuModule } from '../feishu/feishu.module';
import { RepoModule } from '../repo/repo.module';

@Module({
  imports: [FeishuModule, AgentModule, RepoModule],
  controllers: [DevController],
  providers: [DevService],
})
export class DevModule {}
