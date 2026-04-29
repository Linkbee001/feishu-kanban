ALTER TYPE "GroupRuntimeTaskStatus" ADD VALUE IF NOT EXISTS 'blocked';

ALTER TABLE "group_runtime_tasks"
ADD COLUMN "blocked_reason" TEXT,
ADD COLUMN "next_action_hint" TEXT,
ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "trigger_type" TEXT;

CREATE TABLE "group_policies" (
  "id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "feishu_chat_id" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "mention_only" BOOLEAN NOT NULL DEFAULT true,
  "allowed_skills_json" JSONB NOT NULL DEFAULT '[]',
  "default_environment_id" UUID,
  "allow_auto_task_creation" BOOLEAN NOT NULL DEFAULT true,
  "allow_task_board_write" BOOLEAN NOT NULL DEFAULT true,
  "allow_doc_write" BOOLEAN NOT NULL DEFAULT true,
  "high_risk_actions_require_confirmation" BOOLEAN NOT NULL DEFAULT true,
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "group_policies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project_member_profiles" (
  "id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "feishu_chat_id" TEXT NOT NULL,
  "open_id" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "group_nickname" TEXT,
  "project_role" TEXT,
  "responsibility" TEXT,
  "permission_level" TEXT NOT NULL DEFAULT 'member',
  "is_decision_maker" BOOLEAN NOT NULL DEFAULT false,
  "is_task_assignable" BOOLEAN NOT NULL DEFAULT true,
  "metadata_json" JSONB NOT NULL DEFAULT '{}',
  "last_active_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "project_member_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "group_policies_project_id_feishu_chat_id_key" ON "group_policies"("project_id", "feishu_chat_id");
CREATE INDEX "group_policies_feishu_chat_id_idx" ON "group_policies"("feishu_chat_id");
CREATE UNIQUE INDEX "project_member_profiles_project_id_feishu_chat_id_open_id_key" ON "project_member_profiles"("project_id", "feishu_chat_id", "open_id");
CREATE INDEX "project_member_profiles_feishu_chat_id_idx" ON "project_member_profiles"("feishu_chat_id");
CREATE UNIQUE INDEX "group_runtime_tasks_single_running_idx" ON "group_runtime_tasks"("group_session_id") WHERE "status" = 'running';

ALTER TABLE "group_policies"
ADD CONSTRAINT "group_policies_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "group_policies"
ADD CONSTRAINT "group_policies_default_environment_id_fkey"
FOREIGN KEY ("default_environment_id") REFERENCES "project_environments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "project_member_profiles"
ADD CONSTRAINT "project_member_profiles_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
