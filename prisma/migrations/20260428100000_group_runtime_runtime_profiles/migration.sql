CREATE TYPE "GroupRuntimeTaskStatus" AS ENUM (
  'queued',
  'running',
  'waiting_confirmation',
  'completed',
  'failed',
  'canceled'
);

ALTER TABLE "message_sources"
ADD COLUMN "raw_content_json" JSONB,
ADD COLUMN "mentions_json" JSONB,
ADD COLUMN "is_bot_mentioned" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "agent_runs"
ADD COLUMN "group_runtime_task_id" UUID;

ALTER TABLE "artifacts"
ADD COLUMN "group_runtime_task_id" UUID;

ALTER TABLE "confirmation_requests"
ADD COLUMN "group_runtime_task_id" UUID;

ALTER TABLE "group_agent_sessions"
ADD COLUMN "current_runtime_task_id" UUID,
ADD COLUMN "runtime_state_json" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "last_runtime_turn_at" TIMESTAMP(3);

CREATE TABLE "group_runtime_tasks" (
  "id" UUID NOT NULL,
  "group_session_id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "environment_id" UUID NOT NULL,
  "message_source_id" UUID,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "intent" TEXT NOT NULL,
  "skill_hint" TEXT,
  "output_mode" TEXT,
  "order_index" INTEGER NOT NULL DEFAULT 0,
  "status" "GroupRuntimeTaskStatus" NOT NULL DEFAULT 'queued',
  "task_payload_json" JSONB NOT NULL DEFAULT '{}',
  "result_summary" TEXT,
  "last_error" TEXT,
  "started_at" TIMESTAMP(3),
  "finished_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "group_runtime_tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agent_role_profiles" (
  "agent_role" "AgentRole" NOT NULL,
  "agents_md" TEXT NOT NULL DEFAULT '',
  "soul_md" TEXT NOT NULL DEFAULT '',
  "user_md_template" TEXT NOT NULL DEFAULT '',
  "standing_orders_md" TEXT NOT NULL DEFAULT '',
  "skills_json" JSONB NOT NULL DEFAULT '[]',
  "prompt_prelude_md" TEXT NOT NULL DEFAULT '',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "agent_role_profiles_pkey" PRIMARY KEY ("agent_role")
);

CREATE TABLE "project_agent_profile_overrides" (
  "id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "agent_role" "AgentRole" NOT NULL,
  "override_json" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "project_agent_profile_overrides_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "group_agent_sessions_current_runtime_task_id_key" ON "group_agent_sessions"("current_runtime_task_id");
CREATE INDEX "group_runtime_tasks_group_session_id_order_index_created_at_idx" ON "group_runtime_tasks"("group_session_id", "order_index", "created_at");
CREATE INDEX "group_runtime_tasks_project_id_status_idx" ON "group_runtime_tasks"("project_id", "status");
CREATE UNIQUE INDEX "project_agent_profile_overrides_project_id_agent_role_key" ON "project_agent_profile_overrides"("project_id", "agent_role");
CREATE INDEX "project_agent_profile_overrides_agent_role_idx" ON "project_agent_profile_overrides"("agent_role");

ALTER TABLE "agent_runs"
ADD CONSTRAINT "agent_runs_group_runtime_task_id_fkey"
FOREIGN KEY ("group_runtime_task_id") REFERENCES "group_runtime_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "artifacts"
ADD CONSTRAINT "artifacts_group_runtime_task_id_fkey"
FOREIGN KEY ("group_runtime_task_id") REFERENCES "group_runtime_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "confirmation_requests"
ADD CONSTRAINT "confirmation_requests_group_runtime_task_id_fkey"
FOREIGN KEY ("group_runtime_task_id") REFERENCES "group_runtime_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "group_agent_sessions"
ADD CONSTRAINT "group_agent_sessions_current_runtime_task_id_fkey"
FOREIGN KEY ("current_runtime_task_id") REFERENCES "group_runtime_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "group_runtime_tasks"
ADD CONSTRAINT "group_runtime_tasks_group_session_id_fkey"
FOREIGN KEY ("group_session_id") REFERENCES "group_agent_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "group_runtime_tasks"
ADD CONSTRAINT "group_runtime_tasks_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "group_runtime_tasks"
ADD CONSTRAINT "group_runtime_tasks_environment_id_fkey"
FOREIGN KEY ("environment_id") REFERENCES "project_environments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "group_runtime_tasks"
ADD CONSTRAINT "group_runtime_tasks_message_source_id_fkey"
FOREIGN KEY ("message_source_id") REFERENCES "message_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "project_agent_profile_overrides"
ADD CONSTRAINT "project_agent_profile_overrides_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_agent_profile_overrides"
ADD CONSTRAINT "project_agent_profile_overrides_agent_role_fkey"
FOREIGN KEY ("agent_role") REFERENCES "agent_role_profiles"("agent_role") ON DELETE CASCADE ON UPDATE CASCADE;
