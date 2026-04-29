import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RepoSyncService } from '../../modules/repo/repo-sync.service';
import { RepoSyncJobPayload } from '../../modules/repo/repo.types';
import { REPO_SYNC_QUEUE } from '../queue.constants';

@Processor(REPO_SYNC_QUEUE)
export class RepoSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(RepoSyncProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly repoSync: RepoSyncService,
  ) {
    super();
  }

  async process(job: Job<RepoSyncJobPayload>) {
    const environment = await this.prisma.projectEnvironment.findUnique({
      where: { id: job.data.environmentId },
    });
    if (!environment) {
      return;
    }

    try {
      await this.repoSync.ensureRepoFresh({
        projectId: job.data.projectId,
        environmentId: job.data.environmentId,
        repoUrl: environment.repoUrl,
        repoBranch: environment.repoBranch,
        repoCredentialRef: environment.repoCredentialRef,
        force: job.data.force,
      });
    } catch (error) {
      this.logger.warn(
        `Repo sync job failed for ${job.data.environmentId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
