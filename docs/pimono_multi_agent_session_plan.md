# PiMono 多智能体会话隔离与集成方案 V2.1

## 1. 文档信息

- 文档名称：PiMono 多智能体会话隔离与集成方案 V2.1
- 文档版本：V2.1
- 文档状态：补充方案
- 编写日期：2026-04-25
- 适用范围：`docs/construction_plan_v2.md` 的会话管理、PiMono 集成、多智能体隔离补充设计
- 关联文档：`docs/construction_plan_v2.md`、`docs/prd_v1.md`、`docs/dev_plan_v1.md`

---

## 2. 背景与问题

`docs/construction_plan_v2.md` 已经明确了正确方向：以 PiMono SDK 为基线、引入群级会话适配层、保留后端作为平台编排层、用 Redis 保障群级串行。

但当前会话管理仍处于过渡态，主要问题有三类：

- 会话状态被拆散在多处，群级上下文、初始化草稿、私聊项目选择没有统一归属。
- PiMono 当前更像“文本执行器”，没有充分使用其 session、rehydrate、memory、tool routing、compaction 等运行时能力。
- 未来如果引入多个项目管理智能体，缺少正式的项目级隔离边界，容易出现历史混用、上下文串扰和权限失控。

当前最核心的矛盾不是“PiMono 能不能多智能体”，而是“我们要不要把多智能体的边界正式建模”。本方案的答案是：要，而且必须由我们自己管理。

---

## 3. 核心结论

### 3.1 关于 PiMono 的能力边界

- PiMono 原生是单个 session 的 agent 运行时，不是完整的多智能体编排平台。
- PiMono 支持多个 session，history 默认按 session 隔离。
- PiMono 支持加载多个 `AGENTS.md`，但它们会被拼接到同一个 agent 上下文里，不会自动变成多个独立 agent。

### 3.2 关于我们系统的正式边界

- 多智能体隔离必须由后端平台层负责，不能只依赖 prompt 约束。
- 项目管理智能体的正式隔离边界应为 `projectId + agentRole`，而不是单纯的 `feishuChatId`。
- PiMono 负责“某个会话内部如何思考和执行”，后端负责“这条消息应该进哪个会话、允许做什么、如何落盘和审计”。

### 3.3 关于当前阶段的默认策略

- 继续坚持“一个项目 = 一个飞书群 = 一个正式项目上下文”。
- V2.1 默认只要求一个正式常驻角色：`manager`。
- `bootstrap` 作为 `manager` 的会话模式，而不是单独常驻角色。
- `doc`、`task`、`risk` 等角色作为后续可扩展独立 session，不进入当前默认开放能力。

---

## 4. 设计目标

本方案需要同时满足以下目标：

- 保证不同项目之间的智能体记忆、运行状态、权限边界完全隔离。
- 最大化利用 PiMono SDK 的 session 能力，而不是长期停留在 CLI 文本桥接模式。
- 让后端继续掌控项目绑定、权限确认、产物沉淀、审计追溯和并发闸门。
- 支持当前单群单项目模式，也为后续多角色智能体扩展留下正式接口。
- 支持多实例部署，不把核心会话状态锁死在单进程内存里。

---

## 5. 总体原则

### 5.1 平台层与运行时分层

后端平台层负责确定性状态和边界控制，PiMono 运行时负责单个 session 内部的推理与执行。

### 5.2 先路由，再推理

任何飞书消息在进入 PiMono 之前，必须先完成：

- 群与项目绑定解析
- 目标 agent role 解析
- 权限与确认规则判断
- 分布式锁获取
- 群级 session registry 定位

### 5.3 正式结果必须结构化

PiMono 不直接写飞书资产。正式文档、任务、文件、总结等结果统一通过结构化输出回到后端，再由后端完成同步、审计和追溯。

### 5.4 默认不共享原始历史

- 不同项目之间默认不共享 transcript。
- 不同 agent role 之间默认不共享原始 transcript。
- 如果未来允许跨角色协作，默认也只传递结构化产物或边界明确的摘要，而不是整段原始历史。

---

## 6. 核心模型

### 6.1 项目 Agent 模型

正式定义：

```text
一个 Project Agent = 一个项目下某个角色的一条独立长期会话
```

当前默认角色：

- `manager`：唯一必选角色，负责群内主交互、项目推进、文档/任务生成、风险总结和初始化引导。

后续可选角色：

- `doc`
- `task`
- `risk`
- `dev`

### 6.2 Bootstrap 模式

`bootstrap` 不作为独立常驻 agent role，而是 `manager` 会话上的一种模式：

- `bootstrap`：项目未初始化，智能体只负责收集项目信息和推动初始化完成。
- `active`：项目已初始化，智能体进入正式项目协同模式。

这样可以避免在初期就引入不必要的多角色复杂度，同时保留后续独立 bootstrap session 的扩展余地。

### 6.3 关键标识

- `project_id`：正式项目主键。
- `feishu_chat_id`：飞书群主键。
- `agent_role`：项目智能体角色。
- `agent_scope_key`：逻辑智能体作用域键，建议格式为 `project:{projectId}:{agentRole}`。
- `runtime_session_key`：PiMono 运行时会话键，建议格式为 `chat:{feishuChatId}:{agentRole}`。

说明：

- `agent_scope_key` 用于表达“这是哪个项目的哪个智能体”。
- `runtime_session_key` 用于表达“这个智能体当前在哪个群会话里运行”。
- 当前一项目一群时，两者基本一一对应，但语义上必须分开，方便未来扩展线程绑定和多会话策略。

### 6.4 正式隔离规则

- 不同 `project_id` 的任何 agent 不共享 session history。
- 不同 `agent_role` 的任何 session 不共享 session history。
- 私聊不复用群聊 `manager` session。
- 当前阶段不支持多个群共享同一正式项目会话。
- 当前阶段不支持不同项目之间的跨会话自动记忆召回。

---

## 7. 职责边界

### 7.1 后端平台层负责

- 飞书事件验签、解密、去重和消息标准化。
- `feishuChatId -> projectId` 绑定解析。
- 项目环境选择与显式切换。
- 群级会话注册表维护。
- Redis 分布式锁和群级串行控制。
- 权限、确认卡、幂等、审计。
- `agent_runs`、`message_sources`、`artifacts` 等追溯链路。
- 飞书文档、多维表格、文件等资产写入。
- 对结构化输出做合法性校验和落库。

### 7.2 PiMono 运行时负责

- 单个 project agent session 的多轮上下文保持。
- 会话内任务理解、技能选择和回复组织。
- 会话级 memory、summary、compaction、rehydrate。
- 角色级 prompt、workspace bootstrap、skill routing。
- 结构化工具结果或结构化输出生成。

### 7.3 明确不下沉给 PiMono 的能力

- 飞书正式资产写入权限。
- 群级并发控制。
- 项目绑定规则。
- 审计与幂等。
- 跨项目路由。
- 高风险动作的最终授权。

---

## 8. 目标架构

```text
飞书消息
  |
  v
Feishu Event Gateway
  |
  v
Project / Chat Binding Resolver
  |
  v
Group Session Registry + Redis Lock
  |
  v
GroupAgentSessionAdapter
  |
  v
PiMono SDK AgentSession
  |
  v
Structured Outputs / Structured Tools
  |
  v
Artifact Sync + Audit
  |
  v
飞书文档 / 多维表格 / 文件 / 群消息
```

如果未来引入多个角色，会在 `GroupAgentSessionAdapter` 和 `PiMono SDK AgentSession` 之间增加“角色调度”层，但对飞书接入和产物沉淀层保持不变。

---

## 9. 数据模型设计

### 9.1 `group_agent_sessions`

`group_agent_sessions` 作为正式长期会话注册表，是本方案的核心持久化对象。

建议字段如下：

| 字段 | 说明 |
| --- | --- |
| `id` | 主键 |
| `project_id` | 项目主键 |
| `feishu_chat_id` | 飞书群主键 |
| `agent_role` | 智能体角色，当前默认为 `manager` |
| `agent_scope_key` | 项目级逻辑作用域键 |
| `runtime_session_key` | PiMono 运行时会话键 |
| `session_mode` | `bootstrap` / `active` / `disabled` |
| `status` | `idle` / `busy` / `error` / `disabled` |
| `active_environment_id` | 当前生效环境 |
| `pi_session_id` | PiMono session id |
| `session_store_driver` | 会话存储驱动，如 `local_file` / `shared_store` |
| `session_store_ref` | 会话存储定位信息，如文件路径或远端 key |
| `current_agent_run_id` | 当前运行中的执行记录 |
| `memory_summary` | 会话压缩摘要 |
| `last_message_at` | 最近消息时间 |
| `last_run_at` | 最近执行时间 |
| `last_error` | 最近错误信息 |
| `created_at` | 创建时间 |
| `updated_at` | 更新时间 |

建议约束：

- `UNIQUE(project_id, agent_role)`
- `UNIQUE(feishu_chat_id, agent_role)`

这两个约束建立在当前“一项目一群”的正式基线上。

### 9.2 保留的既有对象

以下对象继续保留，不做职责重叠替换：

- `projects`
- `project_environments`
- `message_sources`
- `agent_runs`
- `artifacts`
- `confirmation_requests`
- `conversation_contexts`
- `feishu_event_dedup`

### 9.3 `conversation_contexts` 的收缩

`conversation_contexts` 不再承担群级正式会话状态，只保留以下用途：

- 私聊场景下的临时项目选择
- 私聊场景下的临时环境选择
- 短 TTL 的会话辅助状态

群级长期 session 状态统一迁移到 `group_agent_sessions`。

### 9.4 可选的后续扩展表

如果未来支持线程级持续会话、子代理绑定或 ACP 式持久通道，可以增加：

- `conversation_agent_bindings`

当前阶段不强制引入，避免超前设计。

---

## 10. 会话生命周期

### 10.1 创建

触发时机：

- 新群首次被识别为项目群并进入初始化流程。
- 已绑定项目群首次接入 `manager` 会话。

动作：

- 创建 `group_agent_sessions` 记录。
- 设置 `session_mode = bootstrap` 或 `active`。
- 初始化 `runtime_session_key`。
- 初始化 PiMono session。

### 10.2 运行

运行时行为：

- 同群消息必须通过统一闸门串行进入。
- PiMono 负责保持该 session 的上下文。
- 后端记录本次 `agent_run`、消息来源和结构化产物。

### 10.3 重建

触发时机：

- 服务重启
- worker 漂移
- PiMono session 进程丢失

动作：

- 根据 `group_agent_sessions` 找回 `runtime_session_key` 和 `pi_session_id`。
- 通过 PiMono SDK 的 rehydrate 能力恢复运行时状态。
- 如恢复失败，则以 `memory_summary + artifact context` 执行降级重建。

### 10.4 关闭或禁用

场景：

- 项目归档
- 群解绑
- 管理员禁用
- 高风险错误后进入人工处理

动作：

- 更新 `session_mode` 或 `status`
- 必要时释放远端 session 资源
- 保留审计信息，不删除追溯链路

---

## 11. 并发与忙碌控制

### 11.1 外部入口规则

用户从飞书发来的消息继续采用 V2 的正式规则：

- 同一 `feishuChatId` 同时只允许一个外部消息进入智能体。
- 未获得锁时直接返回忙碌提示。
- 默认不静默排队。
- 不同群可以并行执行。

### 11.2 锁粒度

V2.1 默认锁粒度仍为：

```text
lockKey = feishuChatId
```

原因：

- 群是当前用户认知中的唯一正式工作空间。
- 即使未来出现多个内部角色，也不应允许多个外部请求同时改写同一个群上下文。
- 这样能最大限度减少“同一群多窗口并发发问”带来的上下文错乱。

### 11.3 内部角色执行规则

如果未来引入 `doc`、`task`、`risk` 等独立角色：

- 外部入口仍按 `feishuChatId` 串行。
- 内部角色 session 按各自 `runtime_session_key` 串行。
- 是否允许内部角色并行，由 manager 明确调度，不对用户直接暴露。

### 11.4 忙碌提示语义

忙碌提示只用于保护会话一致性，不视为失败。

统一语义：

- 当前群正在处理上一条任务。
- 新消息不会进入当前上下文。
- 用户稍后可重试。

---

## 12. PiMono 集成方案

### 12.1 正式基线

正式目标态采用 PiMono SDK，而不是长期依赖 `pi --mode rpc --no-session` 子进程桥接。

### 12.2 保留的兼容层

继续保留 `PiMonoAdapter` 这一抽象层，但内部实现逐步替换为：

- 新的 `GroupAgentSessionAdapter`
- 基于 PiMono SDK 的 `AgentSession`

CLI 运行方式只作为迁移期 fallback，不再作为长期基线设计。

### 12.3 需要真正使用起来的 PiMono 能力

- session memory
- rehydrate
- compaction
- follow-up
- steer
- role-specific workspace bootstrap
- skill/tool routing
- structured tool output

### 12.4 结构化输出要求

正式结果不再依赖“从 assistant 文本里解析 JSON”。

应优先采用以下方式之一：

- PiMono 的结构化输出能力
- 自定义 tool / extension 返回结构化结果
- 严格受约束的输出 schema

正式接受类型继续与 V2 保持一致：

```ts
type AgentOutputType = 'document' | 'task' | 'file' | 'log' | 'summary';
```

### 12.5 自定义会话状态

建议在 PiMono session state 中保存轻量运行时状态，例如：

- 当前 `session_mode`
- 最近一次环境标识
- bootstrap 已收集字段
- 最近一次系统总结版本

但正式业务状态仍以数据库为准，PiMono session state 只作为运行时辅助缓存。

---

## 13. 多智能体扩展模型

### 13.1 默认阶段

V2.1 默认只启用：

- `manager`

其原因：

- 先把项目级隔离建稳。
- 先把群级串行、SDK session 和结构化输出建稳。
- 避免在现阶段引入多角色调度复杂度。

### 13.2 扩展阶段

当需要更细粒度协同时，可引入独立 role session：

| 角色 | 职责 | 默认共享方式 |
| --- | --- | --- |
| `manager` | 群主交互、总体调度 | 拥有正式主上下文 |
| `doc` | 文档生成与整理 | 只接收摘要或结构化输入 |
| `task` | 任务拆解与板卡生成 | 只接收摘要或结构化输入 |
| `risk` | 风险识别与周报总结 | 只接收摘要或结构化输入 |
| `dev` | 环境分析、代码建议 | 绑定具体环境上下文 |

### 13.3 跨角色数据传递规则

- 默认传递结构化产物，不传原始 transcript。
- 必须传摘要时，由 manager 生成边界受控摘要。
- 不允许角色之间自由读取其他角色的全部历史。

### 13.4 跨项目协作规则

- 默认禁止跨项目角色调用。
- 如果未来需要跨项目协作，必须经过显式 allowlist 和审计。

---

## 14. 消息路由流程

### 14.1 已初始化项目群

1. 飞书事件进入后端。
2. 完成验签、解密、去重和消息标准化。
3. 根据 `feishuChatId` 定位 `projectId`。
4. 解析目标角色，默认 `manager`。
5. 获取 `feishuChatId` 的 Redis 锁。
6. 读取或创建 `group_agent_sessions`。
7. 必要时 rehydrate PiMono session。
8. 提交标准化消息给 `GroupAgentSessionAdapter`。
9. 接收结构化输出。
10. 后端完成文档、任务、文件、消息同步。
11. 记录 `agent_runs`、`message_sources`、`artifacts`。
12. 释放锁。

### 14.2 未初始化项目群

1. 飞书事件进入后端。
2. 发现该群尚未绑定项目。
3. 创建 `manager` 会话并设置 `session_mode = bootstrap`。
4. 智能体进入初始化引导模式，收集项目基础信息。
5. 初始化完成后创建项目、默认环境、文档目录、任务表。
6. 更新 `group_agent_sessions.session_mode = active`。
7. 后续消息进入正式项目上下文。

---

## 15. 生产部署要求

### 15.1 开发环境

开发环境可暂时使用本地 session 文件，方便快速验证 SDK 集成。

### 15.2 生产环境

生产环境不能把正式 session 持久化完全依赖本地 worker 文件系统。

正式要求：

- 多实例共享 session 存储，或
- 基于 PiMono SDK 实现自定义 `SessionManager`

否则会出现以下问题：

- session 无法跨实例 rehydrate
- worker 漂移后历史丢失
- 本地文件 session 与数据库 registry 不一致

### 15.3 审计与可观测性

必须具备以下可观测能力：

- 一个群当前绑定到哪个 `projectId` 和 `agent_role`
- 当前 `group_agent_sessions` 的 `status` 和 `session_mode`
- 当前 run 是否正在运行
- 最近一次结构化输出是什么
- 最近一次 session 恢复是否成功

---

## 16. 对 OpenClaw 的参考结论

OpenClaw 是一个非常有价值的参考样本，但参考的是“边界设计”，不是直接复用其实现细节。

### 16.1 值得借鉴的点

- 把 `agentId` 做成一等隔离边界。
- 入站消息先通过 `bindings` 路由，再进入目标 agent 的 session。
- 每个 agent 有独立的 `workspace`、`agentDir`、`sessions`。
- session key 自带 agent 命名空间。
- 每个 agent 可以独立配置 model、skills、tools、sandbox。
- 跨 agent 协作需要显式 allowlist，而不是默认共享。

### 16.2 不应直接照搬的点

- OpenClaw 某些线程绑定实现依赖进程内 `Map` 或 `globalThis`，适合单 gateway 进程，不适合作为我们多实例后端的正式会话注册方式。
- 我们必须把正式绑定关系、session registry 和忙碌状态放到数据库与 Redis，而不是只放内存。

### 16.3 参考意义

OpenClaw 说明了一件事：PiMono 本身不是多智能体隔离平台，但完全可以作为多智能体系统的运行内核。真正的隔离，是由应用层自己建模和路由出来的。

---

## 17. 迁移路线

### 阶段 1：先建立正式会话注册表

- 新增 `group_agent_sessions`
- 明确群级 `manager` 会话
- 把初始化状态从临时内存迁到正式 session 对象

### 阶段 2：先把并发边界做实

- 用 Redis 替代进程内群级忙碌判断
- 保持“同群串行、跨群并行、不默认排队”

### 阶段 3：把 PiMono 切到 SDK 基线

- 保留 `PiMonoAdapter` 抽象
- 内部改成 `GroupAgentSessionAdapter + AgentSession`
- 停止默认 `--no-session`

### 阶段 4：把结构化输出做实

- 不再解析 assistant 文本 JSON
- 改为 schema 或 custom tool 返回结构化结果
- 保持后端产物同步接口不变

### 阶段 5：弱化后端意图映射

- `IntentMapper` 从主决策器降为兜底机制
- 让 `manager` agent 自主决定是否调用文档、任务、总结等内部能力

### 阶段 6：视需求引入独立 role session

- `doc`
- `task`
- `risk`
- `dev`

---

## 18. 验收标准

- 两个不同项目群的会话历史不会互相污染。
- 同一个项目群重启后可以正确 rehydrate 到原 session。
- 同群并发消息时，只有一条进入正式上下文，其他消息收到忙碌提示。
- 结构化结果仍能完整沉淀为飞书文档、任务、文件和摘要。
- 私聊不会自动复用任意群聊会话。
- 新增 role session 后，不同 role 的 transcript 默认不共享。

---

## 19. 默认决策清单

- 默认正式角色只有 `manager`。
- `bootstrap` 是会话模式，不是独立常驻角色。
- 正式隔离边界是 `projectId + agentRole`。
- 外部消息锁粒度仍为 `feishuChatId`。
- 正式会话注册表采用 `group_agent_sessions`。
- 生产环境不依赖本地 session 文件作为唯一持久化来源。
- 跨角色和跨项目默认不共享原始 history。
- PiMono 只负责 session 内智能行为，后端负责平台级确定性状态。

---

## 20. 外部参考

- OpenClaw Multi-Agent Routing：
  `https://github.com/openclaw/openclaw/blob/main/docs/concepts/multi-agent.md`
- OpenClaw Agent / Session Configuration：
  `https://github.com/openclaw/openclaw/blob/main/docs/gateway/config-agents.md`
- OpenClaw Delegate Architecture：
  `https://github.com/openclaw/openclaw/blob/main/docs/concepts/delegate-architecture.md`
- OpenClaw Session Paths：
  `https://github.com/openclaw/openclaw/blob/main/src/config/sessions/paths.ts`
- OpenClaw Session Key：
  `https://github.com/openclaw/openclaw/blob/main/src/routing/session-key.ts`

