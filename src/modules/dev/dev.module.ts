import { Module } from '@nestjs/common';
import { AgentModule } from '../agent/agent.module';
import { DevController } from './dev.controller';
import { DevService } from './dev.service';
import { FeishuModule } from '../feishu/feishu.module';

@Module({
  imports: [FeishuModule, AgentModule],
  controllers: [DevController],
  providers: [DevService],
})
export class DevModule {}
