import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PROJECT_DIGEST_QUEUE } from '../../queues/queue.constants';

@Injectable()
export class ProjectDigestBootstrap implements OnModuleInit {
  private readonly logger = new Logger(ProjectDigestBootstrap.name);

  constructor(@InjectQueue(PROJECT_DIGEST_QUEUE) private readonly digestQueue: Queue) {}

  async onModuleInit() {
    await this.digestQueue.upsertJobScheduler(
      'project-digest-scan',
      { every: 60_000 },
      {
        name: 'scan',
        data: {},
      },
    );
    this.logger.log('Project digest scan scheduler upserted');
  }
}
