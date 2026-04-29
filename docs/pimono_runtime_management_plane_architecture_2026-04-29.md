# PiMono Runtime Management Plane Architecture

更新日期：2026-04-29

## 目标

这张图说明当前 `feishu-kanban` 是如何追踪 Pi SDK 执行任务的，重点回答三个问题：

- 正式执行任务由谁创建、谁推进、谁落日志
- 群聊运行时任务由谁编排、谁持有真实状态、谁做投影
- 管理平面最终读取哪些数据源来展示运行状态

## 总览

```mermaid
flowchart LR
    subgraph Ingress[Feishu Gateway / Backend Platform]
        FE[Feishu Event Service]
        MS[(message_sources)]
        RS[Repo Sync Service]
        CS[Confirmation Service]
    end

    subgraph Runtime[PiMono Runtime Orchestrator]
        GRS[GroupRuntimeService]
        PMA[PiMonoAdapter]
        SESS[(in-memory session runtime state)]
    end

    subgraph Formal[Formal Run Pipeline]
        AS[AgentService]
        ARQ[[BullMQ AGENT_RUN_QUEUE]]
        ARP[AgentRunProcessor]
    end

    subgraph Persistence[Persistence / Projection]
        GAS[(group_agent_sessions)]
        GRT[(group_runtime_tasks)]
        ARE[(agent_runs)]
        RTE[(runtime_events)]
        ART[(artifacts)]
        CFR[(confirmation_requests)]
    end

    subgraph Admin[Management Plane]
        ADM[AdminService]
        UI[Admin Console / Runtime View]
    end

    FE --> MS
    FE --> GRS
    FE --> AS
    GRS --> RS
    GRS --> PMA
    AS --> ARE
    AS --> ARQ
    ARQ --> ARP
    ARP --> PMA
    PMA <--> SESS
    PMA --> RTE
    PMA --> GRT
    PMA --> ARE
    PMA --> CFR
    ARE --> ART
    GRS --> GAS
    ARP --> GAS
    ADM --> GAS
    ADM --> GRT
    ADM --> ARE
    ADM --> RTE
    ADM --> ART
    ADM --> CFR
    ADM --> UI
```

## 两条主链路

### 1. 正式执行链路

```mermaid
sequenceDiagram
    participant Caller as API / Service Caller
    participant AgentService as AgentService
    participant AgentRuns as agent_runs
    participant Queue as BullMQ AGENT_RUN_QUEUE
    participant Processor as AgentRunProcessor
    participant Pi as PiMonoAdapter
    participant Session as group_agent_sessions
    participant ArtifactQ as BullMQ ARTIFACT_SYNC_QUEUE
    participant Artifacts as artifacts

    Caller->>AgentService: createRun(projectId, environmentId, prompt, ...)
    AgentService->>AgentRuns: create run_type=formal_execution, status=queued
    AgentService->>Queue: enqueue job(agentRunId)
    Queue->>Processor: process(agentRunId)
    Processor->>AgentRuns: transition queued -> running
    Processor->>Session: rehydrate / sync runtime session if present
    Processor->>Pi: executeRun(runId, minimalContext, contextBinding, prompt)
    Pi-->>Processor: outputs / outputSummary / session snapshot
    Processor->>Session: sync piSessionId, sessionStoreRef, memorySummary
    Processor->>AgentRuns: transition running -> syncing/succeeded/failed/timeout
    Processor->>ArtifactQ: enqueue sync-run
    ArtifactQ->>Artifacts: project output artifacts
```

正式执行的追踪主对象是：

- `agent_runs`
- `BullMQ AGENT_RUN_QUEUE`
- `group_agent_sessions` 中的会话恢复与摘要同步

也就是说，管理平面看正式任务时，本质上看的是“业务 run 状态机”，不是直接看 Pi SDK 内部 job 列表。

### 2. 群聊运行时链路

```mermaid
sequenceDiagram
    participant Feishu as Feishu Event Service
    participant RuntimeSvc as GroupRuntimeService
    participant SessionRow as group_agent_sessions
    participant Pi as PiMonoAdapter
    participant Memory as In-memory Runtime State
    participant Events as runtime_events
    participant Tasks as group_runtime_tasks
    participant Runs as agent_runs
    participant Confirm as confirmation_requests

    Feishu->>RuntimeSvc: handleMentionMessage(...)
    RuntimeSvc->>SessionRow: getOrCreateSession(...)
    RuntimeSvc->>Pi: submitMessage(runtimeSessionKey, envelope, queueMode, minimalContext)
    Pi->>Memory: mutate queue / currentTurn / waiting state
    Pi->>Events: append message_submitted / turn_started / ...
    Pi->>Tasks: upsert task projection from todo_changed
    Pi->>Confirm: create confirmation request if blocked
    Pi->>Runs: create runtime_audit run for emitted outputs
    RuntimeSvc->>SessionRow: sync runtimeStateJson / currentRuntimeTaskId / memorySummary

    Note over Pi,Memory: authoritative runtime state lives in memory per session
    Note over Events,Tasks: database stores event log and projections, not the live scheduler
```

群聊运行时的追踪主对象是：

- `PiMonoAdapter` 的 session 内存态
- `runtime_events`
- `group_agent_sessions.runtime_state_json`
- `group_runtime_tasks` 投影
- 必要时生成的 `agent_runs(run_type=runtime_audit)`

也就是说，管理平面看群聊运行时，不是靠 `group_runtime_tasks` 驱动调度，而是靠“运行时内存态 + 持久化事件日志 + 任务投影”。

## 管理平面读取模型

```mermaid
flowchart TD
    A[AdminService.listRobotInstances] --> B[group_agent_sessions]
    A --> C[group_runtime_tasks]
    A --> D[agent_runs]
    A --> E[artifacts]
    A --> F[group_policies]

    G[AdminService.getRuntime] --> H[GroupRuntimeService.getSessionSnapshot]
    H --> I[PiMonoAdapter.getRuntimeState]
    H --> J[PiMonoAdapter.pullRuntimeEvents]
    H --> K[group_runtime_tasks]
    H --> L[group_agent_sessions]

    M[AdminService.getLogs] --> N[message_sources]
    M --> O[agent_runs]
    M --> P[artifacts]
    M --> Q[confirmation_requests]
    M --> R[runtime_events]
```

当前管理平面实际展示的数据来源：

- 机器人实例列表：
  - `group_agent_sessions`
  - `group_runtime_tasks`
  - `agent_runs`
  - `artifacts`
  - `group_policies`
- 运行时详情：
  - `PiMonoAdapter.getRuntimeState(...)`
  - `PiMonoAdapter.pullRuntimeEvents(...)`
  - `group_runtime_tasks`
  - `group_agent_sessions`
- 日志页：
  - `message_sources`
  - `agent_runs`
  - `artifacts`
  - `confirmation_requests`
  - `runtime_events`

## 状态归属

建议用下面这张表理解“谁是真状态，谁是镜像”：

| 维度 | 真状态归属 | 管理平面主要读取 | 备注 |
| --- | --- | --- | --- |
| 正式执行 run | `agent_runs` + BullMQ job 生命周期 | `agent_runs` | Pi SDK 只是执行引擎 |
| 群聊 turn/queue/waiting | `PiMonoAdapter` session 内存态 | `runtime_state_json` + `runtime_events` | 数据库不是 live scheduler |
| runtime todo 列表 | `PiMonoAdapter` 内存态，经 `todo_changed` 投影 | `group_runtime_tasks` | 现在是 projection-only |
| 输出审计 | `agent_runs(run_type=runtime_audit)` | `agent_runs` / `artifacts` | 用于后台查看和审计 |
| 人工确认 | `confirmation_requests` + session waiting state | `confirmation_requests` + `runtime_events` | 阻塞与恢复都走 runtime |

## 一句话结论

当前管理平面追踪 Pi SDK 执行任务的方案是：

1. 正式执行任务使用 `agent_runs + BullMQ` 作为业务控制面。
2. 群聊运行时使用 `PiMonoAdapter` 的 per-session 内存态作为调度真相源。
3. `runtime_events`、`group_agent_sessions.runtime_state_json`、`group_runtime_tasks`、`runtime_audit agent_runs` 共同构成可观测与审计层。
4. 后台页面读取的是这些“业务侧状态与投影”，不是 Pi SDK 原生任务面板。
