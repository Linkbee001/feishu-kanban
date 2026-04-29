# Group Runtime Quick Validation

这套验证分成两层：

1. `Pi Mono + runtime 调度` 的确定性自动化验证
2. `Webhook -> FeishuEventService -> GroupRuntimeService -> Pi Mono runtime` 的真实 smoke 验证

这样做的目的，是先把“框架接入是否正确”单独打绿，再去跑真实模型链路，避免把所有问题都混在一次群消息里排查。

## 1. 快速自动化验证

这一层不依赖真实飞书群，也不依赖人工观察。

执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\verify-pi-mono.ps1
```

它会顺序执行：

```powershell
npm run test:pi-runtime
npm run test:group-runtime
npm run build
```

覆盖点：

- `test/pi-mono.adapter.spec.ts`
  - 验证 session 持久化
  - 验证 repo mirror 优先级
  - 验证 `group_runtime` 模式下的工具动作采集
  - 验证虚拟 `/virtual/AGENTS.md` 注入
- `test/group-runtime.service.spec.ts`
  - 验证 todo 持久化动作
  - 验证 `reply_group`
  - 验证审计 `agent_run` 创建
  - 验证 `request_group_confirmation` 和暂停逻辑
- `test/feishu-event.service.spec.ts`
  - 验证群里只有 `@bot` 消息才进入 runtime
  - 验证非 `@bot` 消息只落 `message_sources`

如果这一层没过，不要先跑真实端到端。

## 2. 真实 smoke 验证

这一层的目标是验证：

- Webhook ingress 没问题
- `FeishuEventService` 路由没问题
- `GroupRuntimeService` 调度没问题
- `Pi Mono` 真实模型回合没问题
- 旧的 Feishu 对接仍然能支撑群回复和确认卡

### 前置条件

请先满足：

1. API 服务启动在 `development`
2. 数据库和 Redis 可用
3. 已配置真实可用的 Pi Mono 模型密钥
4. 最好保留你们原来已经验证过的飞书配置

建议本地 API 用开发态启动：

```powershell
$env:NODE_ENV='development'
npm run start:dev
```

如果你还要观察 artifact 同步，另开一个终端启动 worker：

```powershell
npm run worker:dev
```

### 2.1 CreateTask 场景

这个场景验证：

- webhook 入站
- `@bot` 识别
- todo 创建
- 同一轮中开始执行
- group reply
- 完成 todo
- 产出 summary output
- 创建审计 `agent_run`

执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\verify-group-runtime-e2e.ps1 `
  -BaseUrl http://localhost:3000 `
  -AdminToken $env:ADMIN_JWT_SECRET `
  -ChatId dev_chat_runtime_smoke `
  -OwnerOpenId ou_dev_user `
  -Scenario CreateTask
```

脚本会做这些事：

1. 调 `/health`
2. 调 `/api/dev/seed-project` 造一个绑定群项目
3. 临时给该项目的 `manager` profile 打一个 smoke override
4. 向 `/webhooks/feishu/events` 投递一条带 mention 的群消息
5. 轮询：
   - `/api/dev/monitor?chatId=...`
   - `/api/group-runtime-sessions/:chatId/tasks`
6. 看到 `smoke-create-task` 进入 `completed` 就判定通过
7. 最后把项目级 profile override 恢复

通过标准：

- 出现 `smoke-create-task`
- 状态变成 `completed`
- monitor 里能看到最新 `agent_run`

### 2.2 Confirm 场景

这个场景额外验证：

- todo 进入 `waiting_confirmation`
- 创建确认请求
- 确认后回到同一个 group runtime 续跑
- 完成被阻塞任务

执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\verify-group-runtime-e2e.ps1 `
  -BaseUrl http://localhost:3000 `
  -AdminToken $env:ADMIN_JWT_SECRET `
  -ChatId dev_chat_runtime_smoke `
  -OwnerOpenId ou_dev_user `
  -Scenario Confirm
```

脚本会在检测到 pending confirmation 后，自动调用：

```powershell
POST /internal/confirmations/:id/confirm
```

通过标准：

- 出现 `smoke-confirm-task`
- 中间进入 `waiting_confirmation`
- 自动确认后回到 runtime
- 最终变成 `completed`

## 3. 推荐验收顺序

建议每次改动后都按这个顺序：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\verify-pi-mono.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\verify-group-runtime-e2e.ps1 -Scenario CreateTask
powershell -ExecutionPolicy Bypass -File .\scripts\verify-group-runtime-e2e.ps1 -Scenario Confirm
```

## 4. 排查重点

如果 `verify-pi-mono.ps1` 失败：

- 优先看 `test/pi-mono.adapter.spec.ts`
- 再看 `test/group-runtime.service.spec.ts`

如果自动化验证通过，但真实 smoke 失败：

- 先看 `/api/dev/monitor?chatId=...`
- 再看 `/api/group-runtime-sessions/:chatId`
- 再看 API 日志

重点关注：

- `message_sources.is_bot_mentioned`
- `group_agent_sessions.runtime_session_key`
- `group_runtime_tasks.status`
- `confirmation_requests.status`
- `agent_runs.status`

## 5. 关于 Feishu 集成保证

这套方法里，真实 smoke 仍然走你们现有的：

- `/webhooks/feishu/events`
- `FeishuEventService`
- `FeishuService.sendTextMessage`
- `ConfirmationService`

所以如果你用的是原来那套真实可用的飞书配置，这套 smoke 不只是测 runtime，也是在回归验证飞书接入链没有被这轮改造带坏。
