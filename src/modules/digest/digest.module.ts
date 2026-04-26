import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AgentModule } from '../agent/agent.module';
import { FeishuModule } from '../feishu/feishu.module';
import { ARTIFACT_SYNC_QUEUE, PROJECT_DIGEST_QUEUE } from '../../queues/queue.constants';
import { ProjectContextAssembler } from './project-context-assembler.service';
import { ProjectDigestBootstrap } from './project-digest.bootstrap';
import { ProjectDigestService } from './project-digest.service';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: PROJECT_DIGEST_QUEUE },
      { name: ARTIFACT_SYNC_QUEUE },
    ),
    AgentModule,
    FeishuModule,
  ],
  providers: [ProjectContextAssembler, ProjectDigestService, ProjectDigestBootstrap],
  exports: [ProjectContextAssembler, ProjectDigestService],
})
export class DigestModule {}
