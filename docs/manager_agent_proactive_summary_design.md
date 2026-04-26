# 管理智能体主动总结与决策贯通设计

## 1. 文档信息

- 文档名称：管理智能体主动总结与决策贯通设计
- 文档版本：V1.0
- 文档状态：设计方案
- 编写日期：2026-04-26
- 适用范围：`manager` 智能体、飞书读写贯通、周期总结、项目状态决策
- 关联文档：
  - `docs/construction_plan_v2.md`
  - `docs/pimono_multi_agent_session_plan.md`
  - `docs/sdk_runtime_update_2026-04-26.md`

---

## 2. 设计目标

当前系统已经具备以下能力：

- 飞书群消息接入
- 项目与群绑定
- 群级 `manager` 会话
- PiMono SDK 执行
- 结构化 `AgentOutput`
- 文档 / 多维表 / 群消息写回

但它仍主要是“收到消息后再响应”的被动模式。

本方案的目标是把 `manager` 升级为真正的项目决策智能体，使其不仅能响应群消息，还能：

- 定期总结项目现状，而不是只靠用户追问
- 主动读取群上下文、项目文档、多维表和历史执行记录
- 在受控边界内做“该读什么、该总结什么、该写回哪里”的决策
- 把项目状态沉淀为可复用、可追溯、可继续演进的正式上下文

一句话定义：

```text
manager 不再只是被动回复群消息，而是一个持续观察项目、周期总结现状、按授权执行协同动作的项目管理智能体。
```

---

## 3. 外部参考结论

### 3.1 对 OpenClaw 的参考结论

参考资料：

- OpenClaw Multi-Agent Routing
  - https://docs.openclaw.ai/concepts/multi-agent
- OpenClaw Session Management & Compaction
  - https://docs.openclaw.ai/reference/session-management-compaction
- OpenClaw Session Tools
  - https://docs.openclaw.ai/concepts/session-tool
- OpenClaw Delegate Architecture
  - https://docs.openclaw.ai/concepts/delegate-architecture
- OpenClaw Standing Orders
  - https://docs.openclaw.ai/automation/standing-orders
- OpenClaw Cron
  - https://docs.openclaw.ai/cli/cron

从 OpenClaw 可以抽出 6 个对我们直接有用的结论：

1. 一个 agent 应该是“独立作用域的脑”，必须有独立 workspace、agent state、session store，而不是只靠 prompt 区分。
2. 会话真相源应归平台层统一管理。OpenClaw 明确把 Gateway 作为 session source of truth，而不是让每个工具自己保存上下文。
3. 长期会话和定时任务要并存。交互消息可以继续走主会话，但 cron/scheduled runs 应该有自己的独立 session。
4. standing orders 很关键。智能体要想从“等指令”变成“持续工作”，必须给它稳定授权边界、触发条件、升级规则和禁止事项。
5. 周期任务不能只是“定时再发一次 prompt”，而应该是“执行某个长期项目管理程序”。
6. 跨 session 召回应该走受控、裁剪、脱敏的 recall/view，而不是原始 transcript dump。

对我们最重要的不是复用 OpenClaw 的多 agent 结构，而是借它的边界思想：

- `manager` 作为正式项目 delegate
- 后端作为群 / 项目 / session / 审计的真相源
- 周期总结通过 standing orders + scheduler 驱动

### 3.2 对 Hermes 的参考结论

参考资料：

- Hermes README
  - https://github.com/NousResearch/hermes-agent
- Hermes Persistent Memory
  - https://hermes-agent.nousresearch.com/docs/user-guide/features/memory
- Hermes periodic nudges / feature overview
  - https://hermes-agent.ai/features/persistent-memory
  - https://hermes-agent.nousresearch.com/docs/
- Hermes Scheduled Tasks
  - https://hermes-agent.nousresearch.com/docs/user-guide/features/cron
- Hermes Cron Internals
  - https://hermes-agent.nousresearch.com/docs/developer-guide/cron-internals
- Hermes session storage / state DB
  - https://github.com/NousResearch/hermes-agent/blob/main/hermes_state.py
  - https://hermes-agent.nousresearch.com/docs/developer-guide/session-storage

从 Hermes 可以抽出 7 个对我们直接有用的结论：

1. 长期有效的 agent 不是只靠单次大 prompt，而是要有闭环学习机制。
2. “periodic nudges” 很重要。不是等用户问“进展如何”，而是系统自己把相关记忆和状态重新提到桌面上。
3. session search 和 memory 要区分：
   - memory 适合稳定事实
   - session search 适合回忆历史上下文
4. scheduled task 是一等能力，不是外部脚本外挂。
5. cron run 应该在 fresh session 中执行，这样不会污染交互主会话，也更适合做日报、巡检、状态总结。
6. scheduled run 可以附带 skill，并把结果投递回原始聊天、文件或其他目标。
7. 持久状态要可检索。Hermes 用 SQLite + FTS5 统一管理 session metadata 和历史搜索，这说明“主动总结”前必须先解决状态可读性。

对我们最重要的不是照搬 Hermes 的全部 memory 系统，而是借它的两个核心模式：

- 让智能体具备主动“被唤醒”的能力
- 让主动运行使用 fresh summary session，而不是强行塞进主对话 session

### 3.3 综合判断

OpenClaw 更像“授权边界 + 多 session 路由”的参考。

Hermes 更像“长期记忆 + scheduled wakeup + proactive summary”的参考。

结合两者，对本项目最合适的方向不是“立刻上多 agent 团队”，而是：

```text
继续维持一个正式 manager 角色，
但让它同时拥有：
1. 交互型主会话
2. 周期型 summary / digest 唤醒能力
3. 统一的项目上下文读取能力
4. 明确的 standing orders 与输出授权边界
```

---

## 4. 当前实现与缺口

### 4.1 当前已经具备的基础

当前仓库已经具备以下骨架：

- `group_agent_sessions` 作为群级正式会话注册表
- `manager` 作为当前唯一正式角色
- `AgentRunProcessor -> PiMonoAdapter -> ArtifactSyncProcessor` 的执行链路
- 文档、任务、文件、总结型 `AgentOutput`
- 飞书写回能力：
  - 群消息发送
  - 文档创建与写入
  - 多维表创建与写入
  - Chat Tab 创建

### 4.2 当前最核心的缺口

当前缺口不是“模型不够聪明”，而是“输入面和唤醒机制不完整”。

主要差距有 5 条：

1. 只有被动触发，没有主动触发  
   当前基本只有飞书事件驱动的 run，没有正式的“项目周期总结调度器”。

2. 飞书写回强，飞书读取弱  
   现在已有文档写入和多维表写入，但还缺：
   - 读取项目文档目录
   - 读取文档正文 / 结构
   - 读取多维表记录
   - 读取文档/任务与项目状态的差异

3. `progress_summary` 仍是被动意图，不是主动程序  
   现在的 `progress_summary` 更像“用户问了才总结”，还不是“系统自己定期产出现状摘要”。

4. 缺少正式的 summary artifact / digest snapshot 模型  
   现在可以产出 `summary`，但还没有“项目状态快照”这一类长期沉淀对象。

5. 缺少 standing orders  
   `manager` 还没有正式定义：
   - 何时主动检查项目状态
   - 何时输出日报 / 周报 / 风险摘要
   - 哪些情况只记内部摘要不打扰群
   - 哪些情况必须发群提醒或升级给人

---

## 5. 核心设计

## 5.1 单角色不变，但引入多种唤醒模式

本方案不改变当前“只有一个正式 `manager` 角色”的策略。

但要把 `manager` 的执行分成 4 种 wake mode：

| wake mode | 触发源 | 目标 |
| --- | --- | --- |
| `interactive` | 群消息 / 私聊消息 | 响应用户当前请求 |
| `scheduled_digest` | cron / scheduler | 周期总结现状 |
| `event_digest` | run 完成 / 文档更新 / 表格变化 | 在重大变化后做增量总结 |
| `maintenance` | 压缩 / memory flush / 归档 | 维护会话与状态质量 |

这样做的好处是：

- 不需要立刻上多 agent
- 可以把主动总结纳入正式运行时
- 不污染主会话的对话节奏
- 易于控制“什么时候发群，什么时候只内部沉淀”

## 5.2 保留主会话，新增 fresh digest session

参考 Hermes cron 的 fresh session 设计，本方案建议：

- 群消息继续进入正式 `manager` 主 session
- 周期总结不要直接继续使用当前交互 transcript
- 每次 digest run 启动一个 fresh summary session
- 该 session 不继承整段原始历史，而是注入整理后的项目上下文包

原因：

- 周期总结的任务目标和普通群对话不同
- 长期主会话适合连续协作，不适合每小时混入巡检总结
- fresh session 更容易控 token、控权限、控噪音
- digest 更适合读取“结构化现状”而不是重放全文消息

### 推荐策略

- `interactive`：使用当前 `group_agent_sessions.runtime_session_key`
- `scheduled_digest` / `event_digest`：使用独立 session key，例如：

```text
chat:{feishuChatId}:manager:digest:{scope}
```

其中 `scope` 可取：

- `daily`
- `weekly`
- `run_completion`
- `risk_watch`
- `stale_project`

这类 digest session 可以保留短期历史，但不与主交互会话混写。

## 5.3 引入 standing orders

参考 OpenClaw，本项目应给 `manager` 一份正式 standing orders。

建议写入 manager 的系统级上下文中，至少包含以下程序：

### Program A：项目现状巡检

- 目标：识别项目当前整体状态、阻塞、风险、待决策事项
- 触发：
  - 每日固定时间
  - 关键 run 完成后
  - 长时间无人更新时
- 输出：
  - 内部 `ProjectDigest`
  - 必要时群摘要
  - 必要时更新项目状态文档

### Program B：任务表健康检查

- 目标：检查多维表是否存在长期未更新、状态冲突、责任人缺失、截止时间异常
- 触发：每天 / 工作日
- 输出：
  - 风险摘要
  - 建议动作清单
  - 是否需要发群提醒

### Program C：文档沉淀检查

- 目标：检查最近讨论是否已形成正式文档，是否存在“群里说过但没沉淀”
- 触发：
  - 文档类 run 后
  - 连续多次需求讨论后
- 输出：
  - 待沉淀项清单
  - 需要补文档的建议

### Program D：周报 / 里程碑摘要

- 目标：对项目阶段成果、风险和下一步做正式汇总
- 触发：每周固定时间 / 手动触发
- 输出：
  - 飞书文档
  - 群摘要
  - 可选表格记录

## 5.4 manager 的正式输入面

要让 `manager` 真正具备“总结现状”的能力，必须先把输入面做完整。

建议 manager 每次决策前读取一个统一的 `ProjectContextBundle`：

```ts
type ProjectContextBundle = {
  project: {
    id: string;
    name: string;
    feishuChatId: string;
    docFolderToken?: string | null;
    bitableAppToken?: string | null;
    bitableTableId?: string | null;
    defaultEnvironmentId?: string | null;
  };
  environment: {
    id: string;
    name: string;
    repoUrl?: string | null;
    repoBranch?: string | null;
    projectPath?: string | null;
    modelName?: string | null;
    skillSet?: unknown;
  };
  session: {
    runtimeSessionKey: string;
    memorySummary?: string | null;
    sessionMode: 'bootstrap' | 'active' | 'disabled';
    status: 'idle' | 'busy' | 'error' | 'disabled';
  };
  recentMessages: Array<{
    id: string;
    senderOpenId: string;
    rawText: string;
    receivedAt: string;
  }>;
  recentRuns: Array<{
    id: string;
    intent: string;
    status: string;
    outputSummary?: string | null;
    finishedAt?: string | null;
  }>;
  recentArtifacts: Array<{
    id: string;
    type: string;
    title: string;
    status: string;
    createdAt: string;
    feishuUrl?: string | null;
  }>;
  docSnapshots: Array<{
    docToken: string;
    title: string;
    summary?: string | null;
    updatedAt?: string | null;
  }>;
  bitableSnapshot: {
    totalTasks: number;
    openTasks: number;
    blockedTasks: number;
    overdueTasks: number;
    unassignedTasks: number;
    recentRows: Array<Record<string, unknown>>;
  } | null;
};
```

其中最重要的一点是：

```text
manager 周期总结时读的不是“飞书群消息原文”本身，
而是后端组装过的项目状态包。
```

这样才能稳定、可控、可演进。

## 5.5 manager 的正式决策对象

建议让 `manager` 不直接从上下文跳到最终产物，而是先产出一个正式决策对象。

```ts
type ManagerDecision = {
  wakeMode: 'interactive' | 'scheduled_digest' | 'event_digest' | 'maintenance';
  intent:
    | 'project_init'
    | 'document_generate'
    | 'task_breakdown'
    | 'code_analysis'
    | 'progress_summary'
    | 'weekly_report'
    | 'risk_review'
    | 'stale_project_review'
    | 'requirement_analysis';
  contextPlan: {
    needRecentMessages: boolean;
    needRecentRuns: boolean;
    needRecentArtifacts: boolean;
    needDocSnapshots: boolean;
    needBitableSnapshot: boolean;
    needRepoRead: boolean;
  };
  skillPlan: string[];
  targetOutputs: Array<'summary' | 'document' | 'task' | 'file' | 'log'>;
  targetChannels: Array<'group_message' | 'feishu_doc' | 'bitable' | 'internal_digest'>;
  needConfirmation: boolean;
  shouldNotifyGroup: boolean;
  confidence: 'low' | 'medium' | 'high';
  reason: string;
};
```

这样设计有 3 个好处：

1. 可以把“是否发群”变成显式决策
2. 可以把“是否需要读文档 / 表格”变成显式决策
3. 可以把“是否只是内部沉淀，不打扰用户”变成显式决策

---

## 6. 主动总结机制设计

## 6.1 总结触发器

建议引入两类触发器：

### 时间触发

- 每天工作日上午 10:00：项目现状简报
- 每天下午 18:00：未完成任务与风险提醒
- 每周五 17:00：周报草案

### 事件触发

- 有关键 `agent_run` 成功后
- 新文档同步成功后
- 新任务写入表格后
- 多维表长时间无更新但群讨论活跃
- 连续 N 次群消息讨论需求但没有形成正式 artifact
- 项目连续 X 小时 / X 天没有推进记录

## 6.2 digest 类型

建议定义 5 类 digest：

| digest type | 目的 | 默认输出 |
| --- | --- | --- |
| `daily_status` | 每日项目现状 | 群摘要 + 内部快照 |
| `risk_watch` | 风险巡检 | 内部快照，必要时发群 |
| `run_completion` | 关键执行后总结 | 群摘要 + 文档增量 |
| `weekly_report` | 周报与阶段总结 | 文档 + 群摘要 |
| `stale_project` | 长时间未推进提醒 | 群提醒或内部记录 |

## 6.3 digest 输出原则

不是每次 digest 都要打扰群。

建议分三级输出：

### Level 1：内部快照

只写入后端，不发群。

适用于：

- 项目状态变化很小
- 只是例行巡检
- 仅用于形成更好的长期上下文

### Level 2：群摘要

发一段短摘要到群里。

适用于：

- 新出现明确阻塞
- 有多项待确认事项
- 有值得同步的阶段进展

### Level 3：正式沉淀

更新文档 / 多维表，并在群里发链接或摘要。

适用于：

- 周报
- 阶段总结
- 风险清单
- 待办列表重整

## 6.4 去重与静默策略

为避免“机器人太吵”，必须加静默规则：

- 同类 digest 在短时间内不得重复发送
- 若摘要 hash 与上次一致，则只更新内部快照，不发群
- 非工作时间只允许内部沉淀，默认不发群
- 只有风险等级提升、阻塞升级、任务状态显著变化时才主动提醒

建议最少增加以下字段：

- `last_digest_at`
- `last_digest_hash`
- `last_digest_type`
- `quiet_hours_policy`

可挂在 `group_agent_sessions` 或独立 digest policy 表中。

---

## 7. 飞书读写贯通设计

## 7.1 当前现状

当前 `FeishuService` 已有较完整的写能力：

- 发群消息
- 创建文档
- 写文档内容
- 创建 bitable
- 写 bitable record
- 创建 / 删除 chat tabs

但还缺正式读能力。

## 7.2 必须补齐的读取能力

建议新增 `FeishuProjectReader`，至少支持：

### 文档侧

- 列出项目文档目录下的文档
- 读取某篇文档的元信息
- 读取文档正文 / block 内容
- 抽取文档标题、更新时间、摘要

### 多维表侧

- 列出表结构
- 读取记录列表
- 按状态、负责人、截止时间过滤
- 汇总 blocked / overdue / unassigned 数量

### 群侧

- 读取最近机器人发送的摘要消息引用
- 读取当前 chat tabs 绑定
- 读取群最新消息窗口的后端快照

## 7.3 推荐的数据流

```text
Feishu Reader
  -> 原始文档 / 原始表格记录
  -> Feishu Snapshot Normalizer
  -> ProjectContextBundle
  -> manager digest / decision run
  -> AgentOutput[]
  -> Feishu Writer / Artifact Sync
```

这条链路成立后，飞书不再只是输出终点，也成为正式输入源。

---

## 8. 数据模型建议

## 8.1 新增 `project_digests`

建议新增一张正式表，沉淀周期总结结果。

```text
project_digests
```

建议字段：

| 字段 | 说明 |
| --- | --- |
| `id` | 主键 |
| `project_id` | 项目主键 |
| `group_session_id` | 所属群 session |
| `digest_type` | `daily_status` / `risk_watch` / `weekly_report` / `run_completion` / `stale_project` |
| `trigger_type` | `scheduled` / `event` / `manual` |
| `trigger_ref` | 触发引用，如 runId / cronId |
| `title` | 摘要标题 |
| `summary_markdown` | 主摘要正文 |
| `highlights_json` | 亮点 |
| `risks_json` | 风险 |
| `blockers_json` | 阻塞 |
| `next_actions_json` | 下一步 |
| `should_notify_group` | 是否发群 |
| `should_write_doc` | 是否写文档 |
| `should_write_bitable` | 是否写表 |
| `digest_hash` | 用于去重 |
| `feishu_doc_token` | 若写成文档则记录 token |
| `feishu_message_id` | 若发群则记录 message id |
| `created_at` | 创建时间 |

## 8.2 新增 `project_context_snapshots`

如果后续希望增强 summary 的稳定性，建议增加一层中间快照：

```text
project_context_snapshots
```

其作用不是面向用户，而是给 manager 提供可复用、低成本、可 diff 的项目状态切片。

建议保存：

- 任务统计
- 最近文档摘要
- 最近 run 摘要
- 最近 artifact 摘要
- 群活跃度
- 当前阻塞列表

## 8.3 `group_agent_sessions` 增强字段

建议增加：

- `last_digest_at`
- `last_digest_type`
- `last_digest_hash`
- `last_digest_run_id`
- `summary_policy_json`

这样可以把“主动总结策略”直接挂在项目主会话上。

---

## 9. 队列与运行时设计

## 9.1 新增队列

建议新增：

- `PROJECT_DIGEST_QUEUE`
- `PROJECT_CONTEXT_REFRESH_QUEUE`

用途：

- `PROJECT_DIGEST_QUEUE`
  - 负责 daily / weekly / risk / stale summary 生成
- `PROJECT_CONTEXT_REFRESH_QUEUE`
  - 负责异步刷新 doc / bitable snapshot

## 9.2 调度器

建议新增 `ProjectDigestScheduler`：

- 由 worker 常驻启动
- 每分钟 tick 一次
- 负责：
  - 找出到期的 digest policy
  - 检查 quiet hours
  - 判断项目是否需要新一轮 digest
  - 入队 digest job

这层职责类似 Hermes scheduler，但真相源仍在我们自己的数据库里，而不是本地 JSON 文件。

## 9.3 运行时隔离

digest run 建议满足以下限制：

- 默认只读项目上下文
- 不允许直接修改仓库
- 不允许自动做高风险外部写入
- 允许输出：
  - `summary`
  - `document`
  - `task`

但最终是否真正写飞书，仍由后端 sink policy 决定。

---

## 10. 提示词与决策约束建议

## 10.1 主交互 prompt 不变，但增加 standing orders

主 `manager` prompt 应新增一层稳定约束：

- 你负责持续维护项目状态，而不是只回答眼前问题
- 你需要识别哪些讨论值得沉淀为正式项目结论
- 你需要优先复用已有文档、任务和历史摘要
- 你不能臆造项目状态；若证据不足，只能提出待确认项

## 10.2 digest prompt 单独设计

周期总结 prompt 不应复用普通群聊 prompt。

建议独立成 `digest` 模式，核心要求：

1. 基于 `ProjectContextBundle` 判断当前项目状态
2. 先输出 `ManagerDecision`
3. 再输出结构化 `AgentOutput[]`
4. 若变化不显著，可只输出内部 summary，不建议发群
5. 若信息冲突，要明确列出“待确认事实”

## 10.3 digest 输出模板建议

建议最少覆盖：

- 当前项目阶段
- 最近完成事项
- 当前阻塞与风险
- 任务表异常
- 文档沉淀缺口
- 建议的下一步动作
- 是否建议发群同步

---

## 11. 分阶段实施建议

## Phase 1：先把主动总结跑通，但只做内部沉淀

目标：

- 新增 digest queue 和 scheduler
- 新增 `project_digests`
- 先只读取：
  - recent messages
  - recent runs
  - recent artifacts
  - `memory_summary`
- 生成内部 digest，不发群

价值：

- 先验证 manager 是否能稳定总结项目状态
- 不会打扰真实群聊

## Phase 2：补齐飞书读取，形成真正的项目状态包

目标：

- 新增 Feishu 文档读取
- 新增 Bitable 记录读取
- 生成 `ProjectContextBundle`
- digest 支持文档沉淀缺口、任务健康检查

价值：

- manager 开始真正“读项目”，不只是“读聊天”

## Phase 3：开放周期推送

目标：

- daily / weekly / risk digest 正式发群
- 同步写入项目文档
- 对重复 digest 做 hash 去重
- 支持 quiet hours 和通知等级

价值：

- manager 从被动助手升级为持续工作的项目代理

## Phase 4：再考虑内部 sub-skill / subagent 编排

到这一步，再考虑：

- `risk_review`
- `task_health_check`
- `doc_gap_review`
- `weekly_report`

是否拆成内部 skill plan，甚至未来拆成独立角色。

在此之前，不建议过早做多 agent 拆分。

---

## 12. 最终结论

参考 OpenClaw 和 Hermes 后，本项目最合适的方向不是立刻引入多个常驻 agent，而是：

```text
保留一个正式 manager，
但让它拥有：
1. 主交互会话
2. standing orders
3. scheduled / event-driven digest 唤醒
4. 统一的项目状态读取能力
5. 群 / 文档 / 多维表的受控回写能力
```

这意味着系统将从：

```text
群消息 -> 智能体响应 -> 写回飞书
```

升级为：

```text
群消息 / 周期调度 / 项目状态变化
  -> 项目上下文组装
  -> manager 决策
  -> skill / summary 执行
  -> 群 / 文档 / 多维表沉淀
  -> 反过来成为下一轮决策上下文
```

这才是真正的“项目协同决策智能体”。
