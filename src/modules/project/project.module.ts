import { Module, forwardRef } from '@nestjs/common';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { AgentModule } from '../agent/agent.module';
import { EnvironmentModule } from '../environment/environment.module';
import { FeishuModule } from '../feishu/feishu.module';

@Module({
  imports: [EnvironmentModule, AgentModule, forwardRef(() => FeishuModule)],
  controllers: [ProjectController],
  providers: [ProjectService],
  exports: [ProjectService],
})
export class ProjectModule {}
