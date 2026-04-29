import { RepoSyncStatus } from '@prisma/client';

export interface RepoWorkspacePaths {
  workspaceRoot: string;
  repoRoot: string;
  manifestPath: string;
}

export interface RepoSyncManifest {
  projectId: string;
  environmentId: string;
  repoUrl?: string | null;
  repoBranch?: string | null;
  repoRoot: string;
  status: RepoSyncStatus;
  syncedAt?: string | null;
  headRef?: string | null;
  error?: string | null;
}

export interface EnsureRepoFreshInput {
  projectId: string;
  environmentId: string;
  repoUrl?: string | null;
  repoBranch?: string | null;
  repoCredentialRef?: string | null;
  force?: boolean;
}

export interface EnsureRepoFreshResult {
  repoRoot: string;
  headRef?: string | null;
  synced: boolean;
  status: RepoSyncStatus;
  error?: string | null;
}

export interface RepoSyncJobPayload {
  projectId: string;
  environmentId: string;
  force?: boolean;
}
