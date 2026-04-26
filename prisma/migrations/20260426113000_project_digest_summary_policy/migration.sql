ALTER TABLE "group_agent_sessions"
ADD COLUMN "summary_policy_json" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "last_digest_at" TIMESTAMP(3),
ADD COLUMN "last_digest_type" TEXT,
ADD COLUMN "last_digest_hash" TEXT,
ADD COLUMN "last_digest_run_id" UUID;
