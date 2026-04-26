import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from './common/prisma/prisma.module';
import { TraceMiddleware } from './common/trace/trace.middleware';
import { envValidationSchema } from './config/env.validation';
import { HealthModule } from './modules/health/health.module';
import { ProjectModule } from './modules/project/project.module';
import { EnvironmentModule } from './modules/environment/environment.module';
import { FeishuModule } from './modules/feishu/feishu.module';
import { AgentModule } from './modules/agent/agent.module';
import { ArtifactModule } from './modules/artifact/artifact.module';
import { ConfirmationModule } from './modules/confirmation/confirmation.module';
import { ConversationModule } from './modules/conversation/conversation.module';
import { DevModule } from './modules/dev/dev.module';
import {
  AGENT_RUN_QUEUE,
  ARTIFACT_SYNC_QUEUE,
  CLEANUP_QUEUE,
  FEISHU_EVENT_QUEUE,
  NOTIFICATION_QUEUE,
  PROJECT_DIGEST_QUEUE,
} from './queues/queue.constants';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema: envValidationSchema }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ connection: { url: config.get<string>('REDIS_URL') } }),
    }),
    BullModule.registerQueue(
      { name: FEISHU_EVENT_QUEUE },
      { name: AGENT_RUN_QUEUE },
      { name: ARTIFACT_SYNC_QUEUE },
      { name: NOTIFICATION_QUEUE },
      { name: CLEANUP_QUEUE },
      { name: PROJECT_DIGEST_QUEUE },
    ),
    PrismaModule,
    HealthModule,
    ProjectModule,
    EnvironmentModule,
    FeishuModule,
    AgentModule,
    ArtifactModule,
    ConfirmationModule,
    ConversationModule,
    DevModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TraceMiddleware).forRoutes('*');
  }
}
