# Phase 03: Rebuild-3 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-06
**Phase:** 03-rebuild-3
**Areas discussed:** Decomposition Strategy, Tool Handlers, Naming, Scope, Type Organization, Migration, Testing

---

## Decomposition Strategy (pi-mono.adapter.ts)

| Option | Description | Selected |
|--------|-------------|----------|
| 职责拆分 | 按职责域拆分：SessionLifecycleService, ToolHandlersService, OutputProcessor, ContextBuilder 等 | ✓ |
| 功能域拆分 | 按功能域拆分：RuntimeExecution, ConfirmationFlow, ContextManagement | |
| 提取辅助服务 | 保持单一 PiMonoAdapter 类，将内部方法提取为独立服务类 | |
| 其他 | 其他拆分方式或保持现状 | |

**User's choice:** 职责拆分 (Recommended)
**Notes:** Split by responsibility domains into focused services

---

## Refactor Scope

| Option | Description | Selected |
|--------|-------------|----------|
| 仅 pi-mono | 只重构 pi-mono.adapter.ts，确保彻底解决最大的问题 | |
| pi-mono + agent.types | 同时重构 pi-mono.adapter.ts 和 agent.types.ts | |
| 整个 agent 模块 | 重构 agent 模块下所有大文件 | ✓ |
| 其他 | 其他范围选择 | |

**User's choice:** 整个 agent 模块 (Recommended)
**Notes:** While pi-mono.adapter.ts is primary target, other large files in agent module were reviewed. Decision: keep others unchanged (agent.service.ts, group-runtime.service.ts, group-agent-session.service.ts at acceptable sizes)

---

## Type Organization (agent.types.ts)

| Option | Description | Selected |
|--------|-------------|----------|
| 保持集中 | 保持集中式类型定义，便于跨模块引用 | ✓ |
| 按模块拆分 | 按模块拆分类型：session.types.ts, task.types.ts, output.types.ts 等 | |
| 后续再定 | 先处理 pi-mono adapter 拆分，类型组织作为后续优化 | |

**User's choice:** 保持集中 (Recommended)
**Notes:** Keep agent.types.ts centralized for easier cross-module reference

---

## Split Granularity

| Option | Description | Selected |
|--------|-------------|----------|
| 核心服务 (5-6个) | 拆分为 5-6 个核心服务：SessionManager, Executor, ToolRegistry, OutputProcessor, EventRecorder | ✓ |
| 精细服务 (10-12个) | 拆分为 10-12 个精细服务，每个职责域一个服务 | |
| 其他 | 其他拆分粒度方案 | |

**User's choice:** 核心服务 (5-6个) (Recommended)
**Notes:** 6 core services: PiSessionManager, PiExecutor, PiToolRegistry, PiOutputProcessor, PiEventRecorder, PiPromptBuilder

---

## Tool Handlers Organization

| Option | Description | Selected |
|--------|-------------|----------|
| 集中 ToolRegistry | 所有 11 个 Tool Handlers 放在一个 ToolRegistry 服务中 | ✓ |
| 按类型分组 | 按类型拆分：FeishuTools, OutputTools, TaskTools, ConfirmationTools | |
| 每工具一个服务 | 每个工具独立服务：EmitOutputsTool, ReplyGroupTool 等 | |

**User's choice:** 集中 ToolRegistry (Recommended)
**Notes:** All 11 tool definitions in single PiToolRegistry service (~400 lines)

---

## Naming Style

| Option | Description | Selected |
|--------|-------------|----------|
| Pi 前缀 | 沿用 Pi 前缀：PiSessionManager, PiExecutor, PiToolRegistry | ✓ |
| Agent 前缀 | 使用 Agent 前缀：AgentSessionManager, AgentExecutor, AgentToolRegistry | |
| Runtime 前缀 | 使用 Runtime 前缀：RuntimeSessionManager, RuntimeExecutor, RuntimeToolRegistry | |

**User's choice:** Pi 前缀 (Recommended)
**Notes:** Consistent with existing PiMonoAdapter naming

---

## Adapter Role After Refactor

| Option | Description | Selected |
|--------|-------------|----------|
| 协调器模式 | PiMonoAdapter 变为协调器：依赖注入各服务，暴露公共接口 | ✓ |
| 完全删除 Adapter | 删除 PiMonoAdapter，各服务直接暴露接口 | |
| 其他 | 其他方案 | |

**User's choice:** 协调器模式 (Recommended)
**Notes:** PiMonoAdapter becomes thin coordinator, injecting and delegating to services. Public API remains stable.

---

## Other Agent Module Files

### agent.service.ts (460 lines)

| Option | Description | Selected |
|--------|-------------|----------|
| 保持现状 | 文件行数适中，职责清晰 | ✓ |
| 提取流程服务 | AgentService 作为 Facade，提取 RuntimeFlowService | |
| 其他 | 其他方案 | |

**User's choice:** 保持现状 (Recommended)

### group-runtime.service.ts (287 lines)

| Option | Description | Selected |
|--------|-------------|----------|
| 保持现状 | 文件较小，职责已聚焦 | ✓ |
| 提取确认流程 | 将 confirmation 相关逻辑提取到独立服务 | |
| 其他 | 其他方案 | |

**User's choice:** 保持现状 (Recommended)

### group-agent-session.service.ts (541 lines)

| Option | Description | Selected |
|--------|-------------|----------|
| 保持现状 | 文件大小适中，会话管理逻辑集中 | ✓ |
| 提取锁服务 | 提取 SessionLockService 处理 Redis 锁逻辑 | |
| 其他 | 其他方案 | |

**User's choice:** 保持现状 (Recommended)

---

## Migration Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| 渐进式拆分 | 按服务逐步拆分，先 SessionManager，验证后继续 | ✓ |
| 一次性重构 | 一次性拆分所有服务，统一重构 | |
| 其他 | 其他迁移策略 | |

**User's choice:** 渐进式拆分 (Recommended)
**Notes:** Extract one service at a time, validate with tests. Order: PiSessionManager → PiExecutor → PiPromptBuilder → PiOutputProcessor → PiEventRecorder → PiToolRegistry

---

## Testing Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| 现有测试 + 新增单元测试 | 依赖现有测试验证重构正确性，为新增模块补充单元测试 | ✓ |
| 全面单元测试 | 重构后为新模块编写完整的单元测试 | |
| 集成测试优先 | 编写集成测试验证整个 Agent 流程的端到端行为 | |

**User's choice:** 现有测试 + 新增单元测试 (Recommended)
**Notes:** Existing tests validate correctness, new unit tests for extracted services

---

## Claude's Discretion

- Exact method distribution between services (estimates provided, actual distribution may vary)
- Internal service interfaces and dependency injection patterns
- Test coverage targets per service
- File naming within agent module

## Deferred Ideas

None — discussion stayed within phase scope.

---

*Phase: 03-rebuild-3*
*Discussion completed: 2026-05-06*