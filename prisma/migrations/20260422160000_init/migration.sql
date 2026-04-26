-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('initializing', 'active', 'paused', 'completed', 'closed');
CREATE TYPE "EnvironmentType" AS ENUM ('default', 'temporary', 'module');
CREATE TYPE "EnvironmentStatus" AS ENUM ('creating', 'active', 'disabled', 'error');
CREATE TYPE "RepoAccessMode" AS ENUM ('readonly', 'write_protected');
CREATE TYPE "SourceType" AS ENUM ('group', 'private');
CREATE TYPE "AgentRunStatus" AS ENUM ('queued', 'running', 'syncing', 'succeeded', 'failed', 'canceled', 'timeout');
CREATE TYPE "ArtifactType" AS ENUM ('document', 'task', 'file', 'execution_log', 'summary');
CREATE TYPE "ArtifactStatus" AS ENUM ('pending', 'synced', 'failed', 'skipped');
CREATE TYPE "ConfirmationStatus" AS ENUM ('pending', 'confirmed', 'rejected', 'expired');

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "owner_open_id" TEXT NOT NULL,
    "feishu_chat_id" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'initializing',
    "doc_folder_token" TEXT,
    "bitable_app_token" TEXT,
    "bitable_table_id" TEXT,
    "default_environment_id" UUID,
    "default_skill_set" JSONB NOT NULL DEFAULT '{}',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project_environments" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "EnvironmentType" NOT NULL DEFAULT 'default',
    "pi_mono_env_id" TEXT,
    "repo_url" TEXT,
    "repo_branch" TEXT,
    "repo_access_mode" "RepoAccessMode" NOT NULL DEFAULT 'readonly',
    "project_path" TEXT,
    "model_endpoint" TEXT,
    "model_name" TEXT,
    "skill_set" JSONB NOT NULL DEFAULT '{}',
    "output_dir" TEXT,
    "log_uri" TEXT,
    "status" "EnvironmentStatus" NOT NULL DEFAULT 'creating',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_active_at" TIMESTAMP(3),
    CONSTRAINT "project_environments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "message_sources" (
    "id" UUID NOT NULL,
    "project_id" UUID,
    "environment_id" UUID,
    "source_type" "SourceType" NOT NULL,
    "feishu_event_id" TEXT NOT NULL,
    "feishu_chat_id" TEXT NOT NULL,
    "feishu_message_id" TEXT NOT NULL,
    "sender_open_id" TEXT NOT NULL,
    "raw_text" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trace_id" TEXT NOT NULL,
    CONSTRAINT "message_sources_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agent_runs" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "environment_id" UUID NOT NULL,
    "message_source_id" UUID,
    "pi_mono_run_id" TEXT,
    "intent" TEXT NOT NULL,
    "skill_name" TEXT,
    "prompt" TEXT NOT NULL,
    "status" "AgentRunStatus" NOT NULL DEFAULT 'queued',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "output_summary" TEXT,
    "error_code" TEXT,
    "error_message" TEXT,
    "raw_outputs" JSONB,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "artifacts" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "environment_id" UUID,
    "agent_run_id" UUID,
    "message_source_id" UUID,
    "type" "ArtifactType" NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ArtifactStatus" NOT NULL DEFAULT 'pending',
    "feishu_url" TEXT,
    "feishu_token" TEXT,
    "bitable_record_id" TEXT,
    "file_key" TEXT,
    "content_hash" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "artifacts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "confirmation_requests" (
    "id" UUID NOT NULL,
    "project_id" UUID,
    "environment_id" UUID,
    "message_source_id" UUID NOT NULL,
    "action_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "ConfirmationStatus" NOT NULL DEFAULT 'pending',
    "card_message_id" TEXT,
    "confirmed_by" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "decided_at" TIMESTAMP(3),
    CONSTRAINT "confirmation_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "conversation_contexts" (
    "id" UUID NOT NULL,
    "source_type" "SourceType" NOT NULL,
    "feishu_chat_id" TEXT NOT NULL,
    "user_open_id" TEXT,
    "project_id" UUID,
    "environment_id" UUID,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "conversation_contexts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "feishu_event_dedup" (
    "event_id" TEXT NOT NULL,
    "message_id" TEXT,
    "handled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trace_id" TEXT NOT NULL,
    CONSTRAINT "feishu_event_dedup_pkey" PRIMARY KEY ("event_id")
);

CREATE UNIQUE INDEX "projects_feishu_chat_id_key" ON "projects"("feishu_chat_id");
CREATE INDEX "project_environments_project_id_idx" ON "project_environments"("project_id");
CREATE INDEX "message_sources_feishu_event_id_idx" ON "message_sources"("feishu_event_id");
CREATE UNIQUE INDEX "message_sources_feishu_message_id_sender_open_id_key" ON "message_sources"("feishu_message_id", "sender_open_id");
CREATE INDEX "agent_runs_status_idx" ON "agent_runs"("status");
CREATE INDEX "agent_runs_pi_mono_run_id_idx" ON "agent_runs"("pi_mono_run_id");
CREATE INDEX "artifacts_status_idx" ON "artifacts"("status");
CREATE UNIQUE INDEX "artifacts_project_id_type_content_hash_key" ON "artifacts"("project_id", "type", "content_hash");
CREATE INDEX "confirmation_requests_status_expires_at_idx" ON "confirmation_requests"("status", "expires_at");
CREATE INDEX "conversation_contexts_expires_at_idx" ON "conversation_contexts"("expires_at");
CREATE UNIQUE INDEX "conversation_contexts_source_type_feishu_chat_id_user_open__key" ON "conversation_contexts"("source_type", "feishu_chat_id", "user_open_id");

ALTER TABLE "project_environments" ADD CONSTRAINT "project_environments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "message_sources" ADD CONSTRAINT "message_sources_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "message_sources" ADD CONSTRAINT "message_sources_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "project_environments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "project_environments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_message_source_id_fkey" FOREIGN KEY ("message_source_id") REFERENCES "message_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "project_environments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_agent_run_id_fkey" FOREIGN KEY ("agent_run_id") REFERENCES "agent_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_message_source_id_fkey" FOREIGN KEY ("message_source_id") REFERENCES "message_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "confirmation_requests" ADD CONSTRAINT "confirmation_requests_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "confirmation_requests" ADD CONSTRAINT "confirmation_requests_environment_id_fkey" FOREIGN KEY ("environment_id") REFERENCES "project_environments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "confirmation_requests" ADD CONSTRAINT "confirmation_requests_message_source_id_fkey" FOREIGN KEY ("message_source_id") REFERENCES "message_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
