import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { FeishuController } from './feishu.controller';
import { FeishuService } from './feishu.service';
import { FeishuEventService } from './feishu-event.service';
import { FeishuWsService } from './feishu-ws.service';
import { FeishuProjectReader } from './feishu-project-reader.service';
import { FEISHU_EVENT_QUEUE } from '../../queues/queue.constants';
import { AgentModule } from '../agent/agent.module';
import { ConversationModule } from '../conversation/conversation.module';
import { EnvironmentModule } from '../environment/environment.module';
import { ConfirmationModule } from '../confirmation/confirmation.module';
import { ProjectModule } from '../project/project.module';
import { RepoModule } from '../repo/repo.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: FEISHU_EVENT_QUEUE }),
    forwardRef(() => AgentModule),
    ConversationModule,
    EnvironmentModule,
    forwardRef(() => ConfirmationModule),
    forwardRef(() => ProjectModule),
    RepoModule,
  ],
  controllers: [FeishuController],
  providers: [FeishuService, FeishuProjectReader, FeishuEventService, FeishuWsService],
  exports: [FeishuService, FeishuProjectReader, FeishuEventService, FeishuWsService],
})
export class FeishuModule {}
