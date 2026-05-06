# Phase 03: Rebuild-3 - PiMono Adapter Refactor

**Gathered:** 2026-05-06
**Status:** Ready for planning

## Phase Boundary

Refactor the 2834-line `pi-mono.adapter.ts` into 5-6 focused services with clear responsibilities. Improve code maintainability, testability, and readability without changing external API behavior. Focus solely on the agent module architecture, leaving other modules untouched.

**In scope:**
- Decompose pi-mono.adapter.ts into focused services
- Maintain PiMonoAdapter as coordinator/facade
- Add unit tests for new services
- Preserve existing public API stability

**Out of scope:**
- Changes to agent.service.ts, group-runtime.service.ts, group-agent-session.service.ts
- Splitting agent.types.ts (keep centralized)
- Changes to other modules (feishu, project, etc.)
- Performance optimizations or behavior changes

## Implementation Decisions

### Decomposition Strategy

- **D-01:** Split pi-mono.adapter.ts by **responsibility domains** into 5-6 core services
- **D-02:** Use **Pi prefix** for all new services (PiSessionManager, PiExecutor, PiToolRegistry, etc.)
- **D-03:** Keep **PiMonoAdapter as coordinator** — inject services, delegate operations, maintain public API

### Service Decomposition

| Service | Responsibility | Core Methods (est. lines) |
|---------|----------------|---------------------------|
| **PiSessionManager** | Session lifecycle | ensureSession, closeSession, rehydrateSession, createSessionManager, loadSdk (~150 lines) |
| **PiExecutor** | Execution core | executePrompt, executeDecisionPrompt, executeGroupRuntimePrompt, cancelRun (~200 lines) |
| **PiToolRegistry** | Tool definitions | 11 createXxxTool methods (emit_outputs, todo_write, reply_group, etc.) (~400 lines) |
| **PiOutputProcessor** | Output handling | normalizeOutputs, normalizeTodoWriteAction, normalizeConfirmationAction, applyOutputDeliveryDefaults (~200 lines) |
| **PiEventRecorder** | Event recording | recordRuntimeEvent, syncRuntimeSessionProjection, createRuntimeConfirmation (~200 lines) |
| **PiPromptBuilder** | Prompt assembly | buildPrompt, buildExecutionBiasLines, buildToolingLines, buildRuntimePolicyLines (~200 lines) |

### Tool Handlers Organization

- **D-04:** All 11 tool handlers remain in **single PiToolRegistry service** for centralized management
- Tools included: emit_outputs, emit_decision, list_project_folder, read_project_doc, search_project_docs, read_project_bitable, list_recent_project_artifacts, todo_list, todo_write, reply_group, request_group_confirmation

### Other Agent Module Files

- **D-05:** agent.service.ts (460 lines) — **Keep unchanged**
- **D-06:** group-runtime.service.ts (287 lines) — **Keep unchanged**
- **D-07:** group-agent-session.service.ts (541 lines) — **Keep unchanged**
- **D-08:** agent.types.ts (473 lines) — **Keep centralized**, do not split

### Migration Strategy

- **D-09:** **Gradual/incremental decomposition** — extract one service at a time, validate with tests before continuing
- Order: PiSessionManager → PiExecutor → PiPromptBuilder → PiOutputProcessor → PiEventRecorder → PiToolRegistry
- Each step: create service, move methods, update PiMonoAdapter to delegate, run tests

**Note:** Order adjusted to: PiSessionManager → PiPromptBuilder/PiOutputProcessor (pure) → PiExecutor → PiEventRecorder → PiToolRegistry. Pure functions (PiPromptBuilder, PiOutputProcessor) have no dependencies and can be extracted independently in Wave 1, parallel to foundation services. This was approved by user during planning review.

### Testing Strategy

- **D-10:** **Rely on existing tests** to validate refactoring correctness
- **D-11:** **Add unit tests** for each new service after extraction
- Focus on behavioral equivalence — outputs and state changes must match current behavior

### Claude's Discretion

- Exact method distribution between services (estimates provided, actual distribution may vary based on code analysis)
- Internal service interfaces and dependency injection patterns
- Test coverage targets per service
- File naming conventions within agent module (follow existing NestJS patterns)

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture & Patterns
- `.planning/codebase/ARCHITECTURE.md` — Agent subsystem architecture, module organization
- `.planning/codebase/CONVENTIONS.md` — NestJS patterns, file organization

### Prior Phase Context
- `.planning/phases/01-rebuild-1/01-CONTEXT.md` — SessionContext, RuntimeState, steer/followUp patterns
- `.planning/phases/02-rebuild-2/01-CONTEXT.md` — Configuration management simplification

### Source Files (Key)
- `src/modules/agent/pi-mono.adapter.ts` — Primary refactor target (2834 lines)
- `src/modules/agent/agent.module.ts` — Module registration, dependency injection setup
- `src/modules/agent/agent.types.ts` — Type definitions (reference, do not split)
- `src/modules/agent/session-context.types.ts` — SessionContext interface

## Existing Code Insights

### Reusable Assets
- `SessionContext` (from rebuild-1): Unified context interface, use in new services
- `RuntimeState` enum: 'idle' | 'running' | 'waiting_confirmation'
- NestJS dependency injection: Use @Injectable decorator for new services
- Existing test patterns in `test/pi-mono.adapter.spec.ts`

### Established Patterns
- Service decomposition pattern: Each service is a single @Injectable class
- Coordinator pattern: PiMonoAdapter injects services, delegates operations
- Tool registration pattern: Custom tools array passed to AgentSession

### Integration Points
- `agent.module.ts`: Register new services as providers
- `agent.service.ts`, `group-runtime.service.ts`: Call PiMonoAdapter methods (unchanged)
- `group-agent-session.service.ts`: Uses PiMonoAdapter for session operations

## Specific Ideas

- Services should be private to agent module (not exported)
- PiMonoAdapter public API remains: executeRun, runManagerDecision, runPrompt, runGroupRuntimeTurn, steer, followUp, getRuntimeState, etc.
- Internal methods (private) move to respective services

## Deferred Ideas

None — discussion stayed within phase scope.

---
*Phase: 03-rebuild-3*
*Context gathered: 2026-05-06*