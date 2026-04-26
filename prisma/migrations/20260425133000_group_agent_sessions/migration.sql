CREATE TYPE "AgentRole" AS ENUM ('manager');
CREATE TYPE "GroupSessionMode" AS ENUM ('bootstrap', 'active', 'disabled');
CREATE TYPE "GroupSessionStatus" AS ENUM ('idle', 'busy', 'error', 'disabled');

CREATE TABLE "group_agent_sessions" (
    "id" UUID NOT NULL,
    "project_id" UUID,
    "feishu_chat_id" TEXT NOT NULL,
    "agent_role" "AgentRole" NOT NULL DEFAULT 'manager',
    "agent_scope_key" TEXT NOT NULL,
    "runtime_session_key" TEXT NOT NULL,
    "session_mode" "GroupSessionMode" NOT NULL DEFAULT 'bootstrap',
    "status" "GroupSessionStatus" NOT NULL DEFAULT 'idle',
    "active_environment_id" UUID,
    "pi_session_id" TEXT,
    "session_store_driver" TEXT,
    "session_store_ref" TEXT,
    "current_agent_run_id" UUID,
    "active_lock_token" TEXT,
    "memory_summary" TEXT,
    "session_state" JSONB NOT NULL DEFAULT '{}',
    "last_message_at" TIMESTAMP(3),
    "last_run_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_agent_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "group_agent_sessions_current_agent_run_id_key" ON "group_agent_sessions"("current_agent_run_id");
CREATE UNIQUE INDEX "group_agent_sessions_project_id_agent_role_key" ON "group_agent_sessions"("project_id", "agent_role");
CREATE UNIQUE INDEX "group_agent_sessions_feishu_chat_id_agent_role_key" ON "group_agent_sessions"("feishu_chat_id", "agent_role");
CREATE INDEX "group_agent_sessions_status_feishu_chat_id_idx" ON "group_agent_sessions"("status", "feishu_chat_id");

ALTER TABLE "group_agent_sessions" ADD CONSTRAINT "group_agent_sessions_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "group_agent_sessions" ADD CONSTRAINT "group_agent_sessions_active_environment_id_fkey"
FOREIGN KEY ("active_environment_id") REFERENCES "project_environments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "group_agent_sessions" ADD CONSTRAINT "group_agent_sessions_current_agent_run_id_fkey"
FOREIGN KEY ("current_agent_run_id") REFERENCES "agent_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
