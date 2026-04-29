CREATE TYPE "RepoSyncStatus" AS ENUM ('uninitialized', 'syncing', 'ready', 'error');

ALTER TABLE "project_environments"
ADD COLUMN "repo_credential_ref" TEXT,
ADD COLUMN "repo_mirror_path" TEXT,
ADD COLUMN "repo_sync_status" "RepoSyncStatus" NOT NULL DEFAULT 'uninitialized',
ADD COLUMN "repo_sync_error" TEXT,
ADD COLUMN "last_repo_sync_at" TIMESTAMP(3),
ADD COLUMN "repo_head_ref" TEXT;
