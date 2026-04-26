# Manager LLM 交互改造与旧结构清理计划

更新时间：2026-04-26

## 背景

当前代码的执行底座已经完成以下能力：

- 群级 session
- Redis 串行锁
- BullMQ run / sync 队列
- PiMono SDK session / rehydrate / emit_outputs
- Artifact 统一回写飞书

真正落后的部分，是“消息理解与调度”仍由后端规则控制。旧链路表现为：

- `FeishuEventService.handle(...)` 先调用 `IntentMapperService.detect(...)`
- `requiresConfirmation(intent)` 决定是否发确认卡片
- `AgentService` 创建 `agent_run` 时写入规则 `intent` 和 `skillName`
- `PiMonoAdapter.buildPrompt(...)` 把 `Recommended skill` 和 `/skill:...` 注入 prompt
- `ConfirmationService` 只保存 `{ prompt, intent }` 这种过弱恢复信息

本次改造目标是直接清除旧语义路由结构，让已初始化项目群的交互主链收口到：

1. 后端只负责事件、会话、锁、审计、确认、产物同步
2. manager 直接做 LLM 级理解、追问、确认判断和执行决策
3. PiMono 只承载 Claude Agent SDK 风格的 session 与 skill discovery 能力
4. 旧的规则级 intent / skill / confirmation 结构从主链移除，不再长期并存

## 当前代码基线

以当前代码为准，相关链路如下：

- 群消息主入口：`src/modules/feishu/feishu-event.service.ts`
- 执行调度：`src/modules/agent/agent.service.ts`
- 群级 session 与锁：`src/modules/agent/group-agent-session.service.ts`
- PiMono SDK 运行时：`src/modules/agent/pi-mono.adapter.ts`
- run worker：`src/queues/processors/agent-run.processor.ts`
- artifact sync worker：`src/queues/processors/artifact-sync.processor.ts`
- 确认卡片恢复：`src/modules/confirmation/confirmation.service.ts`

当前真实运行形态已经是 PiMono SDK 直连，不是旧文档里描述的 CLI fallback。

## 改造目标

### 1. 已初始化群消息先进入 manager 决策

已初始化项目群消息不再先做规则 `intent` 分类，而是统一进入 manager 决策调用。  
manager 的结构化决策只允许三种结果：

- `ask_followup`
- `request_confirmation`
- `execute`

后端只根据这个结构化结果做状态机动作。

### 2. 正式执行继续走现有 run / queue / artifact 链路

正式执行链保持：

- `AgentService`
- `AGENT_RUN_QUEUE`
- `AgentRunProcessor`
- `PiMonoAdapter.executeRun(...)`
- `ARTIFACT_SYNC_QUEUE`
- `ArtifactSyncProcessor`

但 `intent`、`skillName`、执行 prompt 不再由规则层生成，而是来源于 manager 决策。

### 3. 确认卡片由 manager 决定是否触发

确认机制保留，但确认触发权从旧规则逻辑迁移给 manager。  
确认恢复时不再重新调用规则 intent 识别，而是直接使用保存下来的 execution payload。

## 实施结果要求

### Manager 决策类型

新增：

- `ManagerInteractiveDecision`
- `ManagerConfirmationPayload`
- `InteractiveGroupSubmitResult`
- `ManagerInteractiveDecisionSchema`
- 通用 `AGENT_OUTPUT_SCHEMA`

### PiMono runtime

新增：

- `PiMonoAdapter.runManagerDecision(...)`
- `emit_decision` custom tool

保留：

- `emit_outputs` custom tool
- session rehydrate / timeout / cancel

移除：

- 后端注入的 `Recommended skill`
- 后端注入的 `/skill:...`
- 基于后端 skill 映射的 prompt 强提示

### 主链职责收口

#### `FeishuEventService`

- 保留事件去重、项目定位、session 获取、message source 落库
- 调用 manager 决策
- 把决策翻译成追问 / 确认 / 正式执行的外部行为

#### `AgentService`

- 承担 manager 决策提交
- 将 `execute` 决策转换为正式 run
- 保留锁、run 创建、状态迁移和入队

#### `ConfirmationService`

- 保存完整 manager 恢复 payload
- 卡片确认后直接恢复 execution prompt

## 旧结构清理要求

以下结构应从主链移除：

- `IntentMapperService.detect(...)`
- `IntentMapperService.skillFor(...)`
- `IntentMapperService.requiresConfirmation(...)`
- `AssistantIntent`
- `skillByIntent`
- `FeishuEventService` 中基于规则 intent 的分支
- `AgentService.createRun / submitGroupMessage` 中的二次规则 detect
- `AgentRunProcessor` 对旧 `outputSchema()` 的依赖
- `PiMonoAdapter.buildPrompt(...)` 中后端拼接的 `/skill:...`
- `ConfirmationService` 中只保存 `{ prompt, intent }` 的确认 payload

允许暂时保留但不扩散的内容：

- bootstrap fallback
- digest 侧已有的 `ManagerDecision` metadata

## 测试要求

必须覆盖：

- 模糊群消息时只回追问，不创建 run
- 明确产出请求时创建 run 并同步 artifact
- 高风险动作时发确认卡片，确认后恢复执行
- 群 busy 时维持当前串行拒绝语义
- manager 决策 schema 非法时不得误建 run
- manager 决策超时/取消时不得污染 session / run 状态
- 确认恢复执行时不再依赖规则 detect
- `agent_run.skillName` 为空时执行链正常
- `pi-skills` discovery 正常，不依赖 `/skill:` 注入
- digest 链路不受影响

## 当前实施落点

本轮改造优先完成：

1. 已初始化群消息主链切到 manager 决策
2. 旧 intent / skill / confirmation 主链依赖清理
3. 确认 payload 升级
4. PiMono prompt 去掉后端强制 skill 注入

bootstrap 仍保留现有 LLM + fallback 形态，后续再统一到同一 manager 交互风格。
