import { Module } from '@nestjs/common';
import { AgentModule } from '../agent/agent.module';
import { FeishuModule } from '../feishu/feishu.module';
import { ProjectModule } from '../project/project.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [AgentModule, ProjectModule, FeishuModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
