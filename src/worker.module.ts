import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AppModule } from './app.module';
import { AgentModule } from './modules/agent/agent.module';
import { ArtifactModule } from './modules/artifact/artifact.module';
import { ConversationModule } from './modules/conversation/conversation.module';
import { FeishuModule } from './modules/feishu/feishu.module';
import { FeishuWsBootstrap } from './modules/feishu/feishu-ws.bootstrap';
import { FeishuEventProcessor } from './queues/processors/feishu-event.processor';
import { AgentRunProcessor } from './queues/processors/agent-run.processor';
import { ArtifactSyncProcessor } from './queues/processors/artifact-sync.processor';
import { CleanupProcessor } from './queues/processors/cleanup.processor';
import { ProjectDigestProcessor } from './queues/processors/project-digest.processor';
import { RepoSyncProcessor } from './queues/processors/repo-sync.processor';
import {
  AGENT_RUN_QUEUE,
  ARTIFACT_SYNC_QUEUE,
  CLEANUP_QUEUE,
  FEISHU_EVENT_QUEUE,
  PROJECT_DIGEST_QUEUE,
  REPO_SYNC_QUEUE,
} from './queues/queue.constants';
import { DigestModule } from './modules/digest/digest.module';
import { RepoModule } from './modules/repo/repo.module';

@Module({
  imports: [
    AppModule,
    BullModule.registerQueue(
      { name: FEISHU_EVENT_QUEUE },
      { name: AGENT_RUN_QUEUE },
      { name: ARTIFACT_SYNC_QUEUE },
      { name: CLEANUP_QUEUE },
      { name: PROJECT_DIGEST_QUEUE },
      { name: REPO_SYNC_QUEUE },
    ),
    FeishuModule,
    AgentModule,
    ArtifactModule,
    ConversationModule,
    DigestModule,
    RepoModule,
  ],
  providers: [
    FeishuEventProcessor,
    FeishuWsBootstrap,
    AgentRunProcessor,
    ArtifactSyncProcessor,
    CleanupProcessor,
    ProjectDigestProcessor,
    RepoSyncProcessor,
  ],
})
export class WorkerModule {}
