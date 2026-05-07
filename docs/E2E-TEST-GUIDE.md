# E2E 测试指南

本文档提供 feishu-kanban 真实环境端到端测试的完整指南。

## 快速开始

### 1. 环境准备

确保以下环境变量已配置：

```bash
# 基础设施
DATABASE_URL="postgresql://..."
REDIS_URL="redis://..."

# 飞书配置
FEISHU_APP_ID="cli_xxx"
FEISHU_APP_SECRET="xxx"
FEISHU_BOT_OPEN_ID="ou_xxx"
PUBLIC_BASE_URL="https://your-domain.com"

# Pi SDK
PI_MONO_PROVIDER="bailian"
PI_MONO_MODEL="kimi-k2.5"
DASHSCOPE_API_KEY="sk_xxx"

# Admin JWT
ADMIN_JWT_SECRET="your-secret"
```

### 2. 生成 JWT Token

```bash
node scripts/jwt-helper.js generate
```

### 3. 运行测试脚本

```bash
# Linux/macOS
chmod +x scripts/e2e-manual-test.sh
./scripts/e2e-manual-test.sh

# 或设置环境变量后运行
export TEST_CHAT_ID="oc_xxx"
export TEST_USER_OPEN_ID="ou_xxx"
./scripts/e2e-manual-test.sh
```

## 测试场景

### 场景 1: 配置流程 (pending_config → active)

**目标**: 验证新群初始化和配置完成流程

**手动测试步骤**:
1. 将机器人添加到新的飞书群
2. 验证欢迎消息
3. @机器人发送消息，验证配置提示
4. 通过 Admin API 完成配置

**API 调用**:
```bash
# 获取配置状态
curl -H "Authorization: Bearer $JWT" \
  $PUBLIC_BASE_URL/api/group-config/$CHAT_ID

# 完成配置
curl -X POST -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"ownerOpenId":"ou_xxx","configMarkdown":"# PROJECT-CONFIG\n..."}' \
  $PUBLIC_BASE_URL/api/group-config/$CHAT_ID/complete
```

**数据库验证**:
```sql
SELECT sessionMode FROM group_agent_sessions WHERE feishuChatId = 'oc_xxx';
SELECT status FROM projects WHERE feishuChatId = 'oc_xxx';
```

### 场景 2: 消息处理流程

**目标**: 验证飞书消息 → Pi SDK 执行 → 回复

**手动测试步骤**:
1. 在已配置的群中发送: `@机器人 帮我分析项目`
2. 等待机器人回复
3. 验证回复内容与 Pi SDK 执行一致

**监控命令**:
```bash
# 查看队列状态
redis-cli -u $REDIS_URL llen "bull:feishu-event:waiting"

# 查看 worker 日志
grep -E "(FeishuEventService|GroupRuntimeService|PiMonoAdapter)" logs/worker.log | tail -20
```

**数据库验证**:
```sql
SELECT * FROM message_sources WHERE feishuChatId = 'oc_xxx' ORDER BY createdAt DESC LIMIT 1;
SELECT runtimeStateJson FROM group_agent_sessions WHERE feishuChatId = 'oc_xxx';
```

### 场景 3: Agent Run 流程

**目标**: 验证 Agent 运行创建、执行、文档同步

**API 调用**:
```bash
# 创建运行
curl -X POST -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"projectId":"xxx","environmentId":"xxx","prompt":"生成项目摘要"}' \
  $PUBLIC_BASE_URL/api/agent-runs

# 取消运行
curl -X POST -H "Authorization: Bearer $JWT" \
  $PUBLIC_BASE_URL/api/agent-runs/$RUN_ID/cancel
```

**状态监控**:
```sql
SELECT status, progress, outputSummary FROM agent_runs WHERE id = 'xxx';
SELECT type, title, status, feishuUrl FROM artifacts WHERE agentRunId = 'xxx';
```

### 场景 4: Admin API

**目标**: 验证管理 API 功能

**API 调用**:
```bash
# 查看机器人实例列表
curl -H "Authorization: Bearer $JWT" \
  $PUBLIC_BASE_URL/api/admin/robot-instances

# 获取运行时状态
curl -H "Authorization: Bearer $JWT" \
  $PUBLIC_BASE_URL/api/admin/robot-instances/$CHAT_ID/runtime

# 更新群策略
curl -X PATCH -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"mentionOnly":false,"allowDocWrite":true}' \
  $PUBLIC_BASE_URL/api/admin/robot-instances/$CHAT_ID/policy
```

## 清理测试数据

测试完成后清理数据：

```bash
# 使用模板（替换占位符）
psql $DATABASE_URL -f scripts/e2e-cleanup-template.sql

# 或使用变量
psql $DATABASE_URL -v chat_id='oc_xxx' -f scripts/e2e-cleanup.sql
```

## 故障排查

### 常见问题

| 问题 | 诊断 | 解决方案 |
|------|------|----------|
| Pi SDK 超时 | 检查 API 可用性 | 增加 timeout |
| 飞书签名失败 | 检查 encrypt key | 重新配置 |
| 队列不处理 | 检查 Redis/Worker | 重启 worker |
| 配置失败 500 | 检查飞书权限 | 验证 app 权限 |

### 日志检查

```bash
# Worker 错误日志
grep -E "(ERROR|WARN)" logs/worker.log | tail -50

# Pi SDK 日志
grep "PI-MONO" logs/worker.log | tail -20

# 飞书事件日志
grep "FeishuEventService" logs/worker.log | tail -20
```

## 测试检查清单

- [ ] 环境变量配置完整
- [ ] PostgreSQL 连接正常
- [ ] Redis 连接正常
- [ ] 飞书机器人可发送/接收消息
- [ ] Pi SDK 测试运行成功
- [ ] JWT Token 生成成功
- [ ] 配置流程测试通过
- [ ] 消息处理测试通过
- [ ] Agent Run 测试通过
- [ ] Admin API 测试通过
- [ ] 测试数据清理完成

---

_Created: 2026-05-06_