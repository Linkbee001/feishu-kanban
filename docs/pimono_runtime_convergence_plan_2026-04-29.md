# PiMono Runtime 收敛优化方案

更新时间：2026-04-29

## 1. 目标

当前 `feishu-kanban` 已经实现了一层类似 OpenClaw 的会话调度层，但它过多地落在业务后端里，导致：

- Feishu 接入层、会话调度层、正式执行链混在一起
- `group_runtime_task` 与 `agent_run` 语义分裂
- 后端维护了一个偏重的 `runLoop`
- Pi SDK 原生的 `session / turn / steer / abort / transcript / event` 能力没有被充分发挥
- 项目上下文被后端主动拼进 prompt，而不是由 Pi session 按需获取

本方案的目标不是“把所有逻辑都扔给 PiMono”，而是把系统收敛成更清晰的三层：

1. **Feishu Gateway 层**
   - 接消息、幂等、鉴权、项目/环境定位、`message_source` 落库、外部副作用执行
2. **PiMono Runtime Orchestrator 层**
   - 基于 Pi SDK 管理 session turn、active run、并发消息、队列策略、等待确认、状态桥接
3. **Artifact / Audit / Projection 层**
   - 持久化输出、飞书文档/表格同步、审计日志、管理台可观测性

核心方向：

- **后端不再维护业务型 runLoop**
- **PiMonoAdapter 升级为运行时编排层**
- **`group_runtime_task` 从“调度真相源”降级为“可选持久化镜像”**
- **`agent_run` 回归“正式执行/审计记录”，不再混充群运行主状态**
- **上下文默认工具化，prompt 只保留最小脚手架**

## 2. 现状诊断

### 2.1 当前 PiMonoAdapter 的真实角色

`src/modules/agent/pi-mono.adapter.ts` 已经具备这些 Pi SDK 级能力：

- `createAgentSession(...)`
- `session.prompt(...)`
- `session.abort()`
- `SessionManager` 持久化 session file
- 自定义工具注入：`emit_outputs`、`emit_decision`、`todo_*`、`reply_group`、`request_group_confirmation`

但它目前主要被当成：

- 同步 turn 执行器
- 自定义工具容器
- session 文件持久化桥

而不是一个真正的 runtime orchestrator。

### 2.2 当前 group runtime 的问题

`src/modules/agent/group-runtime.service.ts` 中的 `runLoop()` 当前承担了：

- 仓库刷新
- session 读取
- todo 队列读取
- 项目上下文组装
- 调 PiMono 一轮
- 执行动作
- 决定是否继续下一轮
- 等待人工确认时暂停

这说明“会话内调度”还留在业务服务层，而不是贴近 Pi SDK。

### 2.3 当前数据语义分裂

系统中存在两套主状态：

1. `group_runtime_task`
   - 表达群运行态待办
   - 当前更接近真实运行状态
2. `agent_run`
   - 表达正式 run / 审计 run
   - 但 group runtime 又额外补写了一条审计 run

问题是 `createAuditRun(...)` 目前会写死：

- `intent = requirement_analysis`
- `skillName = null`

导致：

- 待办页看到的是 `code_analysis`
- 运行日志看到的是 `requirement_analysis`

这会让管理台误导使用者。

### 2.4 当前并发消息策略过于粗糙

`handleMentionMessage(...)` 会在新消息进入时直接取消同会话的所有旧 `queued` task。

这是一种“最新请求覆盖旧请求”的强策略，适合轻量聊天机器人，但不适合项目型 manager agent。

### 2.5 当前上下文注入方式背离 Pi SDK 自主决策思路

当前系统在进入 PiMono 之前，会由后端先主动收集大块项目上下文，再整体拼进 prompt：

- `ProjectRuntimeContextService.assemble(...)`
  - 主动读取最近聊天记录、最近 run、最近 artifact、最近 runtime task
  - 主动扫描飞书文档目录、文档摘要、文档快照
  - 主动读取多维表格快照
- `PiMonoAdapter.buildPrompt(...)`
  - 将 `projectContextBundle` 整包 JSON 拼进 prompt
  - 将 runtime todo 队列 JSON 拼进 prompt
  - 将 role profile 编译结果再次拼进 prompt
  - 将 repo 元信息直接写入 prompt 文本

这带来 4 个问题：

1. **后端预判过多**
   - 系统先替 agent 判断“哪些上下文重要”，而不是由 Pi session 自主决定何时取资料
2. **prompt 过重**
   - 大量 JSON、摘要、快照被重复注入，增加 token 成本和注意力污染
3. **工具名义存在但实际被绕开**
   - 虽然已有 `read_project_doc`、`search_project_docs`、`read_project_bitable` 等工具
   - 但大部分材料已经在 prompt 里，模型没有动力按需查询
4. **与 Pi SDK 能力模型不一致**
   - Pi 更适合“最小脚手架 + session 内按需工具调用”
   - 当前做法更像传统后端 orchestration 强灌上下文

结论：

> 当前不仅调度层过重，上下文装配层也过重。  
> 如果这部分不一起收敛，就算把 runLoop 下沉到 PiMono runtime，系统仍然会停留在“后端主导推理输入”的旧模式。

## 3. OpenClaw 借鉴结论

根据 `openclaw/docs/concepts/turn-management.md`：

### 3.1 Pi SDK 原生能力

Pi 原生提供：

- `createAgentSession()`
- `session.prompt()`
- `session.steer()`
- `session.abort()`
- `session.isStreaming`
- `session.isCompacting`
- `session.messages`
- `SessionManager`

这说明 Pi 原生已经足够承载：

- per-session turn 执行
- 运行中消息注入
- 中断
- transcript 持久化

### 3.2 OpenClaw 自建扩展层

OpenClaw 在 Pi 之上额外实现：

- active run registry
- queue policy
- followup queue
- collect / interrupt / steer-backlog
- waiters
- event bridge
- session actor queue

因此正确的结论不是“Pi 官方已经全包”，而是：

**Pi 提供 runtime primitives；应用层需要补一层轻量 orchestration。**

### 3.3 对本项目的启发

本项目不应该继续把 orchestration 放在 Feishu 业务服务里，而应该：

- 收敛到 `PiMonoAdapter` 或新建 `PiMonoRuntimeService`
- 借鉴 OpenClaw 的做法，围绕 Pi session 建一层轻量 runtime orchestration
- 同时把“主动拼 prompt 的上下文装配层”一起收进去，改造成按需工具化

## 4. 目标架构

### 4.1 收敛后的三层分工

#### A. Feishu Gateway / Backend Platform

保留在后端：

- 飞书 websocket / webhook 接入
- 幂等去重
- 群策略判断
- `message_source` 落库
- 项目、环境、成员、权限定位
- confirmation 卡片收发
- artifact 同步到飞书
- 管理台查询

后端不再做：

- 会话内多轮 `runLoop`
- queued task supersede 策略
- waiting_confirmation 的主状态机
- “下一轮怎么跑”的调度决策
- 默认大块项目上下文注入

#### B. PiMono Runtime Orchestrator

新增或收敛到 PiMono runtime 层：

- `submitMessage(sessionKey, envelope)`
- active run registry
- session actor queue
- queue mode 策略
- steer / followup / collect / interrupt
- turn 生命周期状态
- waiting confirmation 状态
- session event bridge
- runtime snapshot
- 按需上下文获取策略
- 工具化上下文检索与缓存

#### C. Persistence / Audit / Projection

由后端根据 runtime 事件做投影：

- `message_source`
- `agent_run`
- `artifact`
- `confirmation_request`
- `runtime_session_projection`
- 可选 `runtime_task_projection`
- `runtime_context_access_log`

这里的思想是：

- **运行时真相在 Pi runtime**
- **数据库主要存投影和审计**

### 4.2 上下文获取原则：最小 prompt，默认工具化

#### A. Prompt 只保留最小脚手架

允许保留在 prompt 中的内容：

- 当前 `runtimeSessionKey`
- `requestKind / wakeMode`
- 项目与环境标识
- repo 是否 ready、repo head 等极少量运行态元信息
- 输出 schema
- 用户最新消息
- 必要的安全/行为约束

不再默认拼入：

- 最近聊天记录大包
- 最近 run / artifact 列表
- 文档目录与文档摘要全集
- 多维表格完整快照
- runtime todo 队列 JSON 全量
- role profile 文本的重复展开
- `projectContextBundle` 整包 JSON

#### B. 上下文默认通过 tool/skill 按需获取

Pi session 应通过工具自主决定是否需要查：

- 最近聊天记录
- 最近运行记录
- 最近产物
- runtime task / queue 状态
- 群策略
- 成员角色画像
- 飞书文档目录
- 指定文档全文/摘要
- 多维表格快照
- repo 文件内容

#### C. 允许轻量缓存，但不预先灌 prompt

上下文工具可以有 runtime 内缓存，例如：

- 文档目录扫描结果
- bitable 快照
- 最近 artifact 列表

但缓存结果应留在 runtime/tool 层消费，而不是提前序列化进 prompt。

## 5. 推荐的新运行模型

### 5.1 不再保留业务层 runLoop

当前：

- Feishu 收到消息
- 进入 `GroupRuntimeService.runLoop()`
- 后端循环调用 `piMono.runGroupRuntimeTurn(...)`

改为：

- Feishu 收到消息
- 后端构造 `SessionMessageEnvelope`
- 调 `PiMonoRuntime.submitMessage(...)`
- PiMono runtime 自己决定：
  - 立即开 turn
  - steer 到当前 turn
  - followup 排队
  - collect 合并
  - interrupt 中断重跑

### 5.2 用 turn queue 取代 `group_runtime_task` 主调度地位

`group_runtime_task` 建议从主调度数据降级为以下二选一：

#### 方案 A：仅保留为投影

- Pi runtime 内部维护真实队列
- 后端只把 runtime event 投影成 task 列表，供管理台查看

适合：

- 你希望最大化利用 PiMono runtime
- 接受数据库不再是“真实调度源”

#### 方案 B：保留持久化 runtime todo，但不由业务层推进

- Pi runtime 通过工具或事件读写 todo projection
- 后端只做 persistence bridge

适合：

- 你仍想保留较强的审计与可恢复能力
- 但不希望由 `GroupRuntimeService` 亲自调度

推荐优先选 **方案 B** 作为过渡态，最终再判断是否进一步收缩到 A。

### 5.3 统一消息并发策略

建议引入配置化 queue mode，参考 OpenClaw：

- `steer`
- `followup`
- `collect`
- `interrupt`
- `steer_backlog`

推荐默认值：

- 群聊 manager 默认：`collect`
- 私聊/高实时运维场景：`steer`
- 明确高优先级系统事件：`interrupt`

不再保留当前“新消息一来就取消所有 queued task”的默认行为。

### 5.4 waiting confirmation 进入 Pi runtime 状态

当前：

- 后端创建 confirmation request
- 释放 blocked task
- 再重新进 `runLoop`

改为：

- Pi runtime 发出 `confirmation_requested` 事件
- 后端创建 confirmation card 与记录
- session 状态切到 `waiting_confirmation`
- 用户确认后，后端调用 `resumeSession(sessionKey, confirmationEvent)`
- Pi runtime 继续 turn

这样 confirmation 不再是业务层拼接恢复，而是 runtime 原生状态推进。

### 5.5 上下文从“预装配 bundle”迁移到“按需工具调用”

推荐的新消息处理模型中，不再以 `projectContextBundle` 作为默认主输入，而改成：

1. 后端只提供最小运行脚手架
2. Pi session 根据 turn 目标自主决定是否：
   - 读取飞书文档目录
   - 搜索项目文档
   - 读取指定文档
   - 读取 bitable 快照
   - 查看最近 artifact
   - 查看最近消息/最近运行
3. runtime 对这些工具结果做本 session 内缓存
4. 只有在管理台投影、审计或恢复需要时，后端再持久化必要摘要

这样才能真正体现：

- 后端负责接入与资源桥接
- Pi runtime 负责“何时需要什么上下文”的决策

## 6. 新接口设计

建议将 `PiMonoAdapter` 升级为 `PiMonoRuntimeService`，至少对外暴露：

### 6.1 消息提交

```ts
submitMessage(input: {
  runtimeSessionKey: string;
  envelope: {
    messageSourceId: string;
    sourceType: "group" | "dm" | "system";
    senderOpenId?: string | null;
    feishuChatId?: string | null;
    feishuMessageId?: string | null;
    traceId?: string | null;
    rawText: string;
    metadata?: Record<string, unknown>;
  };
  queueMode?: "steer" | "followup" | "collect" | "interrupt" | "steer_backlog";
  environment: PiMonoCreateRunRequest["environment"];
  project: PiMonoCreateRunRequest["project"];
  roleProfile?: CompiledRoleProfile;
  minimalContext?: {
    sessionMemorySummary?: string | null;
    repoReady?: boolean;
    repoHeadRef?: string | null;
  };
}): Promise<{
  accepted: boolean;
  action: "run_now" | "steered" | "queued" | "dropped" | "interrupted";
  runtimeSessionKey: string;
  activeTurnId?: string;
}>;
```

### 6.2 会话恢复

```ts
resumeSession(input: {
  runtimeSessionKey: string;
  event: {
    type: "confirmation_resolved" | "system_followup";
    payload: Record<string, unknown>;
    text?: string;
  };
}): Promise<{ accepted: boolean }>;
```

### 6.3 状态查询

```ts
getRuntimeState(runtimeSessionKey: string): {
  runtimeSessionKey: string;
  piSessionId?: string;
  status:
    | "idle"
    | "running"
    | "queued"
    | "waiting_confirmation"
    | "compacting"
    | "aborting"
    | "failed";
  currentTurn?: {
    turnId: string;
    mode: "decision" | "outputs" | "group_runtime";
    messageSourceId?: string;
    startedAt: string;
  };
  queue: Array<{
    queueItemId: string;
    messageSourceId?: string;
    mode: "steer" | "followup" | "collect" | "interrupt" | "steer_backlog";
    summary: string;
    enqueuedAt: string;
  }>;
  waitingReason?: string;
  isStreaming: boolean;
  isCompacting: boolean;
  memorySummary?: string;
}
```

### 6.4 事件拉取/订阅

```ts
pullRuntimeEvents(input: {
  runtimeSessionKey: string;
  afterSequence?: number;
}): Array<{
  sequence: number;
  at: string;
  type:
    | "turn_started"
    | "turn_completed"
    | "turn_failed"
    | "message_steered"
    | "message_queued"
    | "queue_drained"
    | "tool_started"
    | "tool_finished"
    | "reply_emitted"
    | "outputs_emitted"
    | "confirmation_requested"
    | "session_waiting"
    | "session_resumed";
  payload: Record<string, unknown>;
}>;
```

### 6.5 上下文工具接口

建议将原本 bundle 中的大部分字段改造成运行时工具：

```ts
getRecentMessages(input: { projectId: string; limit?: number }): Promise<RecentMessage[]>
getRecentRuns(input: { projectId: string; limit?: number }): Promise<RecentRun[]>
getRecentArtifacts(input: { projectId: string; limit?: number }): Promise<RecentArtifact[]>
getRuntimeTasks(input: { sessionId: string }): Promise<RuntimeTaskSnapshot[]>
getGroupPolicy(input: { projectId: string; feishuChatId: string }): Promise<GroupPolicySnapshot | null>
listMemberProfiles(input: { projectId: string; feishuChatId: string }): Promise<ProjectMemberProfileSnapshot[]>
listProjectFolder(input: { docFolderToken: string }): Promise<FolderSnapshot>
readProjectDoc(input: { token: string; title?: string }): Promise<ProjectDocSnapshot>
searchProjectDocs(input: { docFolderToken: string; query: string }): Promise<ProjectDocSearchResult[]>
readProjectBitable(input: { appToken: string; tableId: string }): Promise<BitableSnapshot>
```

这些工具应当：

- 由 Pi runtime 按需调用
- 在本 session 内缓存
- 通过事件或投影记录“被读取过什么”，而不是把所有内容默认塞进 prompt

## 7. 关键实现调整

### 7.1 PiMonoAdapter 内部新增 runtime registry

参考 OpenClaw：

- `ACTIVE_EMBEDDED_RUNS`
- `waitForEmbeddedPiRunEnd()`
- `queueEmbeddedPiMessage()`

本项目可实现：

- `sessions: Map<runtimeSessionKey, SessionRuntimeState>`
- `activeTurnsBySession: Map<runtimeSessionKey, ActiveTurn>`
- `queuedMessagesBySession: Map<runtimeSessionKey, RuntimeQueue>`
- `sessionWaitersBySession: Map<runtimeSessionKey, WaiterSet>`
- `runtimeEventsBySession: RingBuffer<RuntimeEvent>`

### 7.2 引入 session actor queue

每个 session 只允许一个操作流在推进：

- submit message
- resume confirmation
- abort
- rehydrate

防止现在业务层锁和 session 状态分散在多处。

### 7.3 利用 Pi 原生 `session.steer()`

在以下条件下允许 steer：

- 当前有 active turn
- `session.isStreaming === true`
- `session.isCompacting === false`
- queue mode 支持 steer

否则退化为 followup queue。

### 7.4 利用 Pi 原生 `session.abort()`

在 interrupt 模式下：

- 标记当前 turn `aborting`
- 调 `session.abort()`
- 等待 turn 结束
- 立即启动下一 turn

不要再让业务层自己“busy 就拒绝”作为唯一策略。

### 7.5 订阅 Pi session 事件

当前 `PiMonoAdapter` 主要用 prompt 返回值和自定义 tool 回传结构化结果。

下一步应加入 session 事件桥，至少投影：

- `turn_start`
- `turn_end`
- `message_start`
- `message_update`
- `message_end`
- `tool_execution_start`
- `tool_execution_end`
- `compaction_start`
- `compaction_end`

作用：

- 提供管理台实时状态
- 让 `waiting / streaming / compacting` 可见
- 让 `agent_run` / runtime projection 不再依靠猜测

### 7.6 将 `todo_*` 工具从“数据库驱动”改为“runtime 投影驱动”

当前 `todo_write` 只是把动作塞回 `activeExecution.actions`，再由 `GroupRuntimeService.applyTurnResult()` 落数据库。

建议改为：

- `todo_write` 先更新 runtime 内部队列状态
- 同时记一条 runtime event
- 后端投影器异步写库

这样：

- 真正的调度状态不再依赖业务服务推进
- DB 写失败不会让 session 内状态机失真

### 7.7 拆除 `projectContextBundle` 默认 prompt 注入

当前需要明确拆分两类能力：

#### 保留

- repo readiness 元信息
- session memory summary
- request kind / output schema / user latest message
- 极少量必须先验的环境约束

#### 拆出 prompt

- `recentMessages`
- `recentRuns`
- `recentArtifacts`
- `runtimeTasksSummary.recent`
- `workspaceDocsSummary`
- `folderEntries`
- `docSnapshots`
- `bitableSnapshot`
- `memberProfiles`
- `groupPolicy`
- `projectContextBundle` 全量 JSON

实现策略：

1. `ProjectRuntimeContextService.assemble(...)` 不再返回一个默认要拼进 prompt 的巨型 bundle
2. 它拆成若干按需 reader / tool provider
3. `PiMonoAdapter.buildPrompt(...)` 去掉：
   - `Project context bundle (JSON)`
   - `Persisted runtime todo queue (JSON)` 的默认展开
   - `Compiled AGENTS.md (virtual)` 的重复 prompt 拼接
4. role profile 只通过虚拟 `AGENTS.md` 注入，不再重复写入 prompt 文本
5. runtime todo 队列改由 `todo_list()` 查询，而不是默认拼成 JSON

## 8. 数据模型调整

### 8.1 `agent_run` 语义收口

`agent_run` 只保留两类用途：

1. 正式执行 run
2. 审计型 artifact sync run

并增加：

- `run_type`
  - `formal_execution`
  - `runtime_audit`
  - `bootstrap`
  - `digest`

对于 runtime audit：

- 不再写死 `intent = requirement_analysis`
- 必须继承当前 turn/task 的真实 `intent`
- 尽量保留 `skillName`

### 8.2 新增 `runtime_session_projection`

用于管理台快速查询：

- 当前 session status
- active turn
- waiting reason
- queue length
- current message source
- current intent
- last event at

### 8.3 新增 `runtime_event`

用于调试和审计：

- session key
- sequence
- event type
- payload json
- created at

### 8.4 新增 `runtime_context_access_log`

用于记录 session 在运行中实际读取了哪些上下文资源：

- session key
- turn id
- tool name
- resource type
- resource key
- cache hit / miss
- created at

作用：

- 帮助诊断“为什么 agent 读了这些资料”
- 评估哪些预加载上下文其实根本没被用到
- 支持后续做智能缓存与成本优化

### 8.5 `group_runtime_task` 的过渡策略

短期保留，但增加字段：

- `projectionSource`
  - `runtime_event_projection`
  - `legacy_group_runtime`

中期逐步迁移：

- 老代码不再直接依赖其作为调度源
- 管理台展示改读 projection

## 9. 分阶段实施

### 阶段 1：减重，不改总体入口

目标：

- 保留当前 Feishu 入口
- 保留当前 PiMonoAdapter
- 先削减最重的业务层调度逻辑

动作：

1. 修复 `createAuditRun(...)` 的 `intent/skillName` 继承问题
2. 给 `agent_run` 增加 `run_type`
3. 给管理台同时展示 `intent + skillName + run_type`
4. 把 `queued task` 自动取消改成可配置策略
5. 在 `PiMonoAdapter` 内加入 active turn registry 和 runtime state snapshot
6. 停止将 `projectContextBundle` 全量拼入 prompt，先收缩到最小 prompt 脚手架
7. 将最近消息 / 最近运行 / 最近产物 / 文档 / bitable 改造为按需上下文工具

收益：

- 先消除日志误导
- 先让 runtime 可观测
- 先压缩 prompt 注入体积
- 不大改业务流程

### 阶段 2：把 runLoop 迁进 PiMono runtime

目标：

- `GroupRuntimeService.runLoop()` 退化成消息提交入口

动作：

1. 新增 `submitMessage(...)`
2. 新增 session actor queue
3. 新增 followup queue / steer / interrupt 策略
4. `GroupRuntimeService.handleMentionMessage()` 不再自己 while loop
5. confirmation 改为 `resumeSession(...)`
6. 用 context tool provider 取代 `ProjectRuntimeContextService.assemble(...)` 的 bundle 模式

收益：

- 后端不再手搓多轮循环
- 会话逻辑贴近 Pi SDK
- 上下文读取回到 Pi runtime 自主决策

### 阶段 3：事件驱动投影

目标：

- 去掉“同步 `applyTurnResult` 驱动数据库”的模式

动作：

1. Pi session 事件桥接
2. runtime event 持久化
3. task / session / log 改为事件投影
4. 管理台改读 projection 表
5. 上下文读取也记录为 context access event / log

收益：

- 运行态与持久化解耦
- 更适合恢复、回放、诊断
- 可以量化 agent 实际使用了哪些上下文

### 阶段 4：正式收口旧链路

动作：

1. `handleInteractiveGroupMessage()` 与 `group runtime` 合并语义
2. 非必要时不再单独保留老式 manager-decision + formal-run 双轨
3. 将 manager decision 也并入统一 runtime turn pipeline

## 10. 推荐的最终收口形态

### 10.1 群消息主链

- Feishu message
- `message_source` 落库
- 后端构建 envelope
- `PiMonoRuntime.submitMessage(...)`
- runtime 根据 queue mode：
  - steer / followup / collect / interrupt
- Pi session 执行 turn
- Pi session 按需调用上下文工具读取文档、表格、消息、运行记录
- runtime event 流回后端
- 后端投影到 session / task / log / artifact

### 10.2 管理台主视图

管理台应主要围绕：

- 当前 session 状态
- 当前 active turn
- 当前 waiting reason
- 消息队列
- 最近 runtime events
- 最近 artifact
- 最近上下文访问记录

而不是主要围绕 `agent_run` 列表。

### 10.3 最终边界

#### 后端负责

- 接入
- 幂等
- 授权
- 外部资源
- 投影
- 审计

#### PiMono Runtime 负责

- session
- turn
- queue
- steer
- interrupt
- resume
- waiting state
- runtime status
- context retrieval decision
- context tool caching

## 11. 新增待办

### 11.1 Queue Mode 动态判定

当前 `queueMode` 主要来自 `group_policies.default_queue_mode`，普通飞书需求消息不会显式携带调度策略。
这意味着：

- 第一条进入空闲 session 的消息基本总是直接 `run_now`
- `steer`、`interrupt`、`followup` 等能力只会在运行中收到后续消息时生效
- 如果后台长期默认 `collect`，很多更细的调度能力实际上很难被触发

后续需要补一层“入口侧 queueMode 轻量判定”，让系统可以根据用户追加消息的语义动态选择调度策略，而不是只依赖群默认值。

建议纳入实现的规则包括：

- “补充一点”“再加一个约束”这类追加说明优先走 `collect` 或 `steer`
- “等等，先别做那个”“先停一下”这类撤销或改向语义优先走 `interrupt`
- “继续”“按刚才那个往下做”这类恢复推进语义优先走 `followup`
- 无明显调度信号时继续回退到 `group_policies.default_queue_mode`

目标不是把调度权完全交给用户手动指定，而是让飞书入口能根据消息意图做更符合直觉的 runtime 提交策略选择。

### 11.2 Repo 配置改为 Environment 静态能力

当前群聊 runtime 和 formal run 在执行前仍会主动尝试刷新 repo，这会把“环境准备”混进“消息调度 / 运行启动”。

后续需要把 repo 能力收敛成 environment 的静态配置状态，而不是每次对话都重新探测：

- 初始化时如果提供 repo，则创建或同步该 environment 的 workspace
- 初始化时如果未提供 repo，则明确标记为“无 repo 模式”
- runtime 只读取 environment 当前 repo 状态，不再在每条消息入口主动刷新
- repo 后续允许通过管理面补配置并异步初始化，但这一能力可以放到后续阶段实现

建议采用的状态语义：

- `repo_unconfigured`
- `repo_initializing`
- `repo_ready`
- `repo_error`

运行时行为应与状态直接对齐：

- `repo_unconfigured`：Pi 按无代码仓上下文工作，不主动检查 repo
- `repo_ready`：Pi 直接使用 workspace 中的 repo / git 工具
- `repo_error`：Pi 可见错误状态，但不在普通消息入口自动重试

目标是把 repo 从“每轮会话的动态前置条件”收敛成“environment 的长期能力声明”。

### 11.3 后台管理看板对齐新管理模式

当前后台服务层已经能返回 `runtimeState`、`runtimeEvents`、`recentRunType`、`defaultQueueMode` 等新数据，
但正式管理看板仍主要停留在“实例 + 待办 + 最近 run / artifact”的旧展示模型，尚未完整体现 runtime-first 的管理方式。

后续需要补齐的看板改造包括：

- 在实例总览和基础信息中展示 `recentRunType`、`defaultQueueMode`
- 在运行时页面展示 `runtimeState.status`、`currentTurn`、`waitingReason`、队列长度
- 在日志页增加 `runtimeEvents` 时间线，而不只展示 messages / runs / artifacts / confirmations
- 让运行时页明确区分“session 真状态”和“group_runtime_tasks 投影”
- 增加 repo / workspace 状态展示，至少覆盖“未配置 / 就绪 / 错误”、最近同步错误、关联 environment

目标是让后台真正围绕：

- session runtime snapshot
- runtime event log
- task projection
- repo / workspace capability state

来组织观测与排障，而不是继续以旧式 run 列表为中心。

## 12. 最终判断

这次收敛不应该继续沿着“把 group runtime 再补得更复杂”去做。

正确方向是：

- **承认你们已经实现了一层类似 OpenClaw 的调度层**
- **但把它从业务服务层收敛成 PiMono runtime orchestration 层**
- **尽量用 Pi SDK 的原生 `session / steer / abort / persistence / events` 能力**
- **数据库只做投影和审计，不再做会话主状态机**
- **把上下文获取从“后端主动拼 prompt”收敛成“Pi runtime 按需调用 tool/skill”**

一句话总结：

> 不是去掉调度层，而是把调度层从“后端业务编排”收敛成“贴近 Pi SDK 的轻量 runtime 编排层”。  
> 同时把上下文获取从“后端主动拼 prompt”收敛成“Pi runtime 按需调用 tool/skill”。  
> 这才是真正发挥 PiMono SDK 能力的方式。
