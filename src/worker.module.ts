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
import {
  AGENT_RUN_QUEUE,
  ARTIFACT_SYNC_QUEUE,
  CLEANUP_QUEUE,
  FEISHU_EVENT_QUEUE,
} from './queues/queue.constants';

@Module({
  imports: [
    AppModule,
    BullModule.registerQueue(
      { name: FEISHU_EVENT_QUEUE },
      { name: AGENT_RUN_QUEUE },
      { name: ARTIFACT_SYNC_QUEUE },
      { name: CLEANUP_QUEUE },
    ),
    FeishuModule,
    AgentModule,
    ArtifactModule,
    ConversationModule,
  ],
  providers: [
    FeishuEventProcessor,
    FeishuWsBootstrap,
    AgentRunProcessor,
    ArtifactSyncProcessor,
    CleanupProcessor,
  ],
})
export class WorkerModule {}
