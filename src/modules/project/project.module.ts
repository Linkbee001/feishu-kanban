import { Module, forwardRef } from '@nestjs/common';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { AgentModule } from '../agent/agent.module';
import { EnvironmentModule } from '../environment/environment.module';
import { FeishuModule } from '../feishu/feishu.module';
import { RepoModule } from '../repo/repo.module';
import { ConfigModule } from '../config/config.module';
import { GroupPolicyService } from './group-policy.service';
import { ProjectMemberProfileService } from './project-member-profile.service';

@Module({
  imports: [EnvironmentModule, AgentModule, RepoModule, forwardRef(() => FeishuModule), forwardRef(() => ConfigModule)],
  controllers: [ProjectController],
  providers: [ProjectService, GroupPolicyService, ProjectMemberProfileService],
  exports: [ProjectService, GroupPolicyService, ProjectMemberProfileService],
})
export class ProjectModule {}
