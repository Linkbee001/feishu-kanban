import { Module, forwardRef } from '@nestjs/common';
import { ConfirmationController } from './confirmation.controller';
import { ConfirmationService } from './confirmation.service';
import { FeishuModule } from '../feishu/feishu.module';
import { AgentModule } from '../agent/agent.module';
import { EnvironmentModule } from '../environment/environment.module';

@Module({
  imports: [forwardRef(() => FeishuModule), forwardRef(() => AgentModule), EnvironmentModule],
  controllers: [ConfirmationController],
  providers: [ConfirmationService],
  exports: [ConfirmationService],
})
export class ConfirmationModule {}
