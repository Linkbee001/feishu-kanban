-- E2E Cleanup SQL Template
-- Replace placeholders with actual values before running

-- ============================================
-- Cleanup Test Data
-- ============================================

-- Step 1: Delete runtime events for test session
-- REPLACE 'oc_xxx' with your test chat_id
DELETE FROM runtime_events
WHERE runtimeSessionKey LIKE 'chat:oc_%';

-- Step 2: Delete artifacts from E2E test runs
DELETE FROM artifacts
WHERE agentRunId IN (
  SELECT id FROM agent_runs
  WHERE intent LIKE '%E2E Test%'
);

-- Step 3: Delete E2E test agent runs
DELETE FROM agent_runs
WHERE intent LIKE '%E2E Test%';

-- Step 4: Delete message sources for test chat
-- REPLACE 'oc_xxx' with your test chat_id
DELETE FROM message_sources
WHERE feishuChatId = 'oc_xxx';

-- Step 5: Delete confirmation requests for test messages
DELETE FROM confirmation_requests
WHERE messageSourceId IN (
  SELECT id FROM message_sources
  WHERE feishuChatId = 'oc_xxx'
);

-- Step 6: Delete group agent session for test chat
-- REPLACE 'oc_xxx' with your test chat_id
DELETE FROM group_agent_sessions
WHERE feishuChatId = 'oc_xxx';

-- Step 7: Delete group policies for test chat
-- REPLACE 'oc_xxx' with your test chat_id
DELETE FROM group_policies
WHERE feishuChatId = 'oc_xxx';

-- Step 8: Delete project environments for test project
-- REPLACE 'oc_xxx' with your test chat_id OR use project_id
DELETE FROM project_environments
WHERE projectId IN (
  SELECT id FROM projects
  WHERE feishuChatId = 'oc_xxx'
);

-- Step 9: Delete project members for test project
DELETE FROM project_member_profiles
WHERE projectId IN (
  SELECT id FROM projects
  WHERE feishuChatId = 'oc_xxx'
);

-- Step 10: Delete test project
-- REPLACE 'oc_xxx' with your test chat_id
DELETE FROM projects
WHERE feishuChatId = 'oc_xxx';

-- Step 11: Cleanup event dedup records
DELETE FROM feishu_event_dedup
WHERE eventId LIKE 'test_%'
   OR traceId LIKE 'tr_test_%';

-- ============================================
-- Verification Queries (run after cleanup)
-- ============================================

-- Check no test data remains
SELECT 'runtime_events' as table_name, COUNT(*) as remaining
FROM runtime_events
WHERE runtimeSessionKey LIKE 'chat:oc_%';

SELECT 'agent_runs' as table_name, COUNT(*) as remaining
FROM agent_runs
WHERE intent LIKE '%E2E Test%';

SELECT 'projects' as table_name, COUNT(*) as remaining
FROM projects
WHERE feishuChatId = 'oc_xxx';

SELECT 'group_agent_sessions' as table_name, COUNT(*) as remaining
FROM group_agent_sessions
WHERE feishuChatId = 'oc_xxx';