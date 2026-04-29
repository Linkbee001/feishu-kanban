import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { REPO_SYNC_QUEUE } from '../../queues/queue.constants';
import { RepoWorkspaceService } from './repo-workspace.service';
import { RepoCredentialResolver } from './repo-credential-resolver.service';
import { RepoSyncService } from './repo-sync.service';
import { RepoSyncQueueService } from './repo-sync-queue.service';

@Module({
  imports: [BullModule.registerQueue({ name: REPO_SYNC_QUEUE })],
  providers: [RepoWorkspaceService, RepoCredentialResolver, RepoSyncService, RepoSyncQueueService],
  exports: [RepoWorkspaceService, RepoCredentialResolver, RepoSyncService, RepoSyncQueueService],
})
export class RepoModule {}
