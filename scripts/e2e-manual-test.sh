#!/bin/bash
# E2E Manual Test Runner for feishu-kanban
# Usage: ./scripts/e2e-manual-test.sh

set -e

echo "========================================"
echo "  E2E Manual Test Runner"
echo "========================================"

# 检查环境变量
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL not set"
  exit 1
fi
if [ -z "$REDIS_URL" ]; then
  echo "ERROR: REDIS_URL not set"
  exit 1
fi
if [ -z "$PUBLIC_BASE_URL" ]; then
  echo "ERROR: PUBLIC_BASE_URL not set"
  exit 1
fi
if [ -z "$ADMIN_JWT_SECRET" ]; then
  echo "ERROR: ADMIN_JWT_SECRET not set"
  exit 1
fi

# 测试参数
CHAT_ID="${TEST_CHAT_ID:-}"
USER_OPEN_ID="${TEST_USER_OPEN_ID:-}"
PROJECT_ID="${TEST_PROJECT_ID:-}"

if [ -z "$CHAT_ID" ]; then
  echo "ERROR: TEST_CHAT_ID not set. Please provide the Feishu test group chat ID."
  exit 1
fi

# 生成 JWT Token
JWT=$(node -e "console.log(require('jsonwebtoken').sign({role:'admin'}, process.env.ADMIN_JWT_SECRET))")

echo ""
echo "Configuration:"
echo "  Database: $DATABASE_URL"
echo "  Redis: $REDIS_URL"
echo "  Base URL: $PUBLIC_BASE_URL"
echo "  Chat ID: $CHAT_ID"
echo "  JWT Token: ${JWT:0:20}..."
echo ""

# ============================================
# Test 1: Infrastructure Check
# ============================================
echo "=== Test 1: Infrastructure Check ==="
echo "Checking PostgreSQL..."
psql "$DATABASE_URL" -c "SELECT 1" > /dev/null && echo "  PostgreSQL: OK" || echo "  PostgreSQL: FAILED"

echo "Checking Redis..."
redis-cli -u "$REDIS_URL" ping > /dev/null && echo "  Redis: OK" || echo "  Redis: FAILED"
echo ""

# ============================================
# Test 2: Check Config Status
# ============================================
echo "=== Test 2: Check Config Status ==="
CONFIG_STATUS=$(curl -s -H "Authorization: Bearer $JWT" \
  "$PUBLIC_BASE_URL/api/group-config/$CHAT_ID")

echo "$CONFIG_STATUS" | jq '.' 2>/dev/null || echo "$CONFIG_STATUS"

SESSION_MODE=$(echo "$CONFIG_STATUS" | jq -r '.sessionMode' 2>/dev/null || echo "unknown")
echo "  Session Mode: $SESSION_MODE"
echo ""

# ============================================
# Test 3: Complete Configuration (if pending)
# ============================================
if [ "$SESSION_MODE" = "pending_config" ]; then
  echo "=== Test 3: Complete Configuration ==="

  if [ -z "$USER_OPEN_ID" ]; then
    echo "ERROR: TEST_USER_OPEN_ID not set for configuration completion"
    exit 1
  fi

  CONFIG_MD='# PROJECT-CONFIG

## Project
name: E2E Test Project
description: Automated test project for E2E testing

## Environment
modelName: kimi-k2.5
repoUrl: (optional - leave empty if no repo)
'

  COMPLETE_RESULT=$(curl -s -X POST -H "Authorization: Bearer $JWT" \
    -H "Content-Type: application/json" \
    -d "{\"ownerOpenId\":\"$USER_OPEN_ID\",\"configMarkdown\":\"$CONFIG_MD\"}" \
    "$PUBLIC_BASE_URL/api/group-config/$CHAT_ID/complete")

  echo "$COMPLETE_RESULT" | jq '.' 2>/dev/null || echo "$COMPLETE_RESULT"

  # 验证项目创建
  PROJECT_ID=$(echo "$COMPLETE_RESULT" | jq -r '.project.id' 2>/dev/null || echo "")
  if [ -n "$PROJECT_ID" ]; then
    echo "  Project ID: $PROJECT_ID"
    echo "  Verifying database..."
    psql "$DATABASE_URL" -c "SELECT id, name, status FROM projects WHERE feishuChatId = '$CHAT_ID'"
  fi
  echo ""
fi

# ============================================
# Test 4: Message Flow (Manual)
# ============================================
echo "=== Test 4: Message Flow Test ==="
echo ""
echo "请执行以下操作:"
echo "1. 在飞书测试群发送: @机器人 测试消息"
echo "2. 等待机器人回复"
echo "3. 检查回复内容是否正确"
echo ""
read -p "完成后按 Enter 继续..."

echo ""
echo "Checking message source records..."
psql "$DATABASE_URL" -c "SELECT id, createdAt, content, isBotMentioned FROM message_sources WHERE feishuChatId = '$CHAT_ID' ORDER BY createdAt DESC LIMIT 3"
echo ""

echo "Checking runtime state..."
psql "$DATABASE_URL" -c "SELECT sessionMode, runtimeState FROM group_agent_sessions WHERE feishuChatId = '$CHAT_ID'"
echo ""

# ============================================
# Test 5: Agent Run (if project exists)
# ============================================
if [ -n "$PROJECT_ID" ]; then
  echo "=== Test 5: Create Agent Run ==="

  # 获取环境 ID
  ENV_ID=$(psql "$DATABASE_URL" -t -c "SELECT id FROM project_environments WHERE projectId = '$PROJECT_ID' LIMIT 1" | tr -d ' ')

  if [ -z "$ENV_ID" ]; then
    echo "No environment found, creating default..."
    ENV_RESULT=$(curl -s -X POST -H "Authorization: Bearer $JWT" \
      -H "Content-Type: application/json" \
      -d "{\"projectId\":\"$PROJECT_ID\",\"name\":\"default\",\"modelName\":\"kimi-k2.5\"}" \
      "$PUBLIC_BASE_URL/api/environments")
    ENV_ID=$(echo "$ENV_RESULT" | jq -r '.id' 2>/dev/null || echo "")
  fi

  echo "Using Environment ID: $ENV_ID"

  RUN_RESULT=$(curl -s -X POST -H "Authorization: Bearer $JWT" \
    -H "Content-Type: application/json" \
    -d "{\"projectId\":\"$PROJECT_ID\",\"environmentId\":\"$ENV_ID\",\"prompt\":\"E2E Test: 请回复确认收到此测试消息\",\"intent\":\"E2E Test\"}" \
    "$PUBLIC_BASE_URL/api/agent-runs")

  RUN_ID=$(echo "$RUN_RESULT" | jq -r '.id' 2>/dev/null || echo "")
  echo "Created Run ID: $RUN_ID"

  if [ -n "$RUN_ID" ]; then
    echo ""
    echo "=== Test 6: Monitor Run Status ==="
    echo "Polling status for 60 seconds..."

    for i in {1..12}; do
      STATUS=$(psql "$DATABASE_URL" -t -c "SELECT status FROM agent_runs WHERE id = '$RUN_ID'" | tr -d ' ')
      echo "  [$i/12] Status: $STATUS"

      if [ "$STATUS" = "succeeded" ] || [ "$STATUS" = "failed" ] || [ "$STATUS" = "canceled" ]; then
        break
      fi

      sleep 5
    done

    echo ""
    echo "Final run details:"
    psql "$DATABASE_URL" -c "SELECT id, status, progress, outputSummary, createdAt FROM agent_runs WHERE id = '$RUN_ID'"

    echo ""
    echo "Artifacts created:"
    psql "$DATABASE_URL" -c "SELECT type, title, status, feishuUrl FROM artifacts WHERE agentRunId = '$RUN_ID'"
  fi
  echo ""
fi

# ============================================
# Test 7: Admin API - List Robot Instances
# ============================================
echo "=== Test 7: Admin API - List Robot Instances ==="
curl -s -H "Authorization: Bearer $JWT" \
  "$PUBLIC_BASE_URL/api/admin/robot-instances" | jq '.[:3]' 2>/dev/null
echo ""

# ============================================
# Test 8: Admin API - Get Runtime State
# ============================================
echo "=== Test 8: Admin API - Get Runtime State ==="
curl -s -H "Authorization: Bearer $JWT" \
  "$PUBLIC_BASE_URL/api/admin/robot-instances/$CHAT_ID/runtime" | jq '.' 2>/dev/null || echo "Not available"
echo ""

# ============================================
# Test Summary
# ============================================
echo "========================================"
echo "  E2E Tests Complete"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. 验证飞书文档是否创建成功"
echo "2. 检查 worker 日志是否有异常"
echo "3. 运行清理脚本: psql $DATABASE_URL -f scripts/e2e-cleanup.sql"
echo ""
echo "Cleanup SQL template (replace placeholders):"
cat scripts/e2e-cleanup-template.sql
echo ""