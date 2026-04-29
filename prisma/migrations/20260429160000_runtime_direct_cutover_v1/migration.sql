CREATE TYPE "AgentRunType" AS ENUM ('formal_execution', 'runtime_audit', 'bootstrap', 'digest');

CREATE TYPE "RuntimeQueueMode" AS ENUM ('steer', 'followup', 'collect', 'interrupt', 'steer_backlog');

ALTER TABLE "agent_runs"
ADD COLUMN "run_type" "AgentRunType" NOT NULL DEFAULT 'formal_execution';

ALTER TABLE "group_policies"
ADD COLUMN "default_queue_mode" "RuntimeQueueMode" NOT NULL DEFAULT 'collect';

CREATE TABLE "runtime_events" (
  "id" UUID NOT NULL,
  "runtime_session_key" TEXT NOT NULL,
  "group_session_id" UUID,
  "project_id" UUID,
  "environment_id" UUID,
  "sequence" INTEGER NOT NULL,
  "event_type" TEXT NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "runtime_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "runtime_events_runtime_session_key_sequence_key"
ON "runtime_events"("runtime_session_key", "sequence");

CREATE INDEX "runtime_events_group_session_id_created_at_idx"
ON "runtime_events"("group_session_id", "created_at");

CREATE INDEX "runtime_events_project_id_created_at_idx"
ON "runtime_events"("project_id", "created_at");

ALTER TABLE "runtime_events"
ADD CONSTRAINT "runtime_events_group_session_id_fkey"
FOREIGN KEY ("group_session_id") REFERENCES "group_agent_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "runtime_events"
ADD CONSTRAINT "runtime_events_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "runtime_events"
ADD CONSTRAINT "runtime_events_environment_id_fkey"
FOREIGN KEY ("environment_id") REFERENCES "project_environments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
