import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import Redis from 'ioredis';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { PiMonoAdapter } from './pi-mono.adapter';
import { AGENT_RUN_QUEUE, ARTIFACT_SYNC_QUEUE } from '../../queues/queue.constants';
import { ConfigService } from '@nestjs/config';
import { GroupAgentSessionService } from './group-agent-session.service';
import { GROUP_AGENT_SESSION_REDIS } from './agent.constants';
import { ProjectRuntimeContextService } from './project-runtime-context.service';

@Module({
  imports: [BullModule.registerQueue({ name: AGENT_RUN_QUEUE }, { name: ARTIFACT_SYNC_QUEUE })],
  controllers: [AgentController],
  providers: [
    AgentService,
    PiMonoAdapter,
    ProjectRuntimeContextService,
    GroupAgentSessionService,
    {
      provide: GROUP_AGENT_SESSION_REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => new Redis(config.getOrThrow<string>('REDIS_URL')),
    },
  ],
  exports: [AgentService, PiMonoAdapter, ProjectRuntimeContextService, GroupAgentSessionService],
})
export class AgentModule {}
