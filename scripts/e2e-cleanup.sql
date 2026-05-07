-- Quick E2E Cleanup Script
-- Usage: psql $DATABASE_URL -v chat_id='<your_chat_id>' -f scripts/e2e-cleanup.sql

-- Variables:
--   chat_id: The Feishu chat ID to cleanup (e.g., 'oc_xxxx')

BEGIN;

-- Delete runtime events
DELETE FROM runtime_events
WHERE runtimeSessionKey LIKE 'chat:' || :'chat_id' || '%';

-- Delete artifacts from test runs
DELETE FROM artifacts
WHERE agentRunId IN (
  SELECT id FROM agent_runs
  WHERE intent LIKE '%E2E Test%'
);

-- Delete test runs
DELETE FROM agent_runs
WHERE intent LIKE '%E2E Test%';

-- Delete confirmation requests
DELETE FROM confirmation_requests
WHERE messageSourceId IN (
  SELECT id FROM message_sources
  WHERE feishuChatId = :'chat_id'
);

-- Delete message sources
DELETE FROM message_sources
WHERE feishuChatId = :'chat_id';

-- Delete group policy
DELETE FROM group_policies
WHERE feishuChatId = :'chat_id';

-- Delete group agent session
DELETE FROM group_agent_sessions
WHERE feishuChatId = :'chat_id';

-- Delete project environments
DELETE FROM project_environments
WHERE projectId IN (
  SELECT id FROM projects
  WHERE feishuChatId = :'chat_id'
);

-- Delete project members
DELETE FROM project_member_profiles
WHERE projectId IN (
  SELECT id FROM projects
  WHERE feishuChatId = :'chat_id'
);

-- Delete project
DELETE FROM projects
WHERE feishuChatId = :'chat_id';

-- Cleanup dedup records
DELETE FROM feishu_event_dedup
WHERE eventId LIKE 'test_%'
   OR traceId LIKE 'tr_test_%';

COMMIT;

-- Verification
SELECT 'Cleanup complete. Remaining records:' as message;
SELECT 'group_agent_sessions' as table_name, COUNT(*) as count
FROM group_agent_sessions
WHERE feishuChatId = :'chat_id';
SELECT 'projects' as table_name, COUNT(*) as count
FROM projects
WHERE feishuChatId = :'chat_id';