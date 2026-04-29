import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { REPO_SYNC_QUEUE } from '../../queues/queue.constants';

@Injectable()
export class RepoSyncQueueService {
  constructor(@InjectQueue(REPO_SYNC_QUEUE) private readonly queue: Queue) {}

  async enqueueSync(projectId: string, environmentId: string, force = false) {
    await this.queue.add(
      force ? 'sync-repo-force' : 'sync-repo',
      { projectId, environmentId, force },
      { jobId: `${environmentId}:${force ? 'force' : 'light'}` },
    );
  }
}
