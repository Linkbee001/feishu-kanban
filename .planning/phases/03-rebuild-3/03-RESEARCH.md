# Phase 03: PiMono Adapter Refactor - Research

**Researched:** 2026-05-05
**Domain:** NestJS service decomposition, dependency injection, adapter refactoring
**Confidence:** HIGH

## Summary

The 2834-line `pi-mono.adapter.ts` file contains 10 public methods and approximately 50 private methods organized into 6 natural responsibility domains. The decomposition proposed in CONTEXT.md is well-aligned with the actual code structure. The primary challenge is managing the shared `SessionRuntimeState` object that serves as a communication conduit between services. NestJS dependency injection patterns support the proposed gradual extraction approach, with each service becoming an `@Injectable` class registered in `agent.module.ts`.

**Primary recommendation:** Follow the proposed gradual extraction order, but introduce a `PiSessionStateService` to manage the shared state object, allowing services to receive state through method parameters rather than holding references.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Split pi-mono.adapter.ts by **responsibility domains** into 5-6 core services
- **D-02:** Use **Pi prefix** for all new services (PiSessionManager, PiExecutor, PiToolRegistry, etc.)
- **D-03:** Keep **PiMonoAdapter as coordinator** — inject services, delegate operations, maintain public API
- **D-04:** All 11 tool handlers remain in **single PiToolRegistry service** for centralized management
- **D-05:** agent.service.ts (460 lines) — **Keep unchanged**
- **D-06:** group-runtime.service.ts (287 lines) — **Keep unchanged**
- **D-07:** group-agent-session.service.ts (541 lines) — **Keep unchanged**
- **D-08:** agent.types.ts (473 lines) — **Keep centralized**, do not split
- **D-09:** **Gradual/incremental decomposition** — extract one service at a time, validate with tests before continuing
- **D-10:** **Rely on existing tests** to validate refactoring correctness
- **D-11:** **Add unit tests** for each new service after extraction

### Claude's Discretion

- Exact method distribution between services (estimates provided, actual distribution may vary based on code analysis)
- Internal service interfaces and dependency injection patterns
- Test coverage targets per service
- File naming conventions within agent module (follow existing NestJS patterns)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-01 | Decompose pi-mono.adapter.ts into focused services | Code structure analysis validates 6-service decomposition |
| REQ-02 | Maintain PiMonoAdapter as coordinator/facade | NestJS DI patterns support coordinator pattern via constructor injection |
| REQ-03 | Add unit tests for new services | Existing test file (919 lines) provides patterns; Jest + NestJS testing utilities available |
| REQ-04 | Preserve existing public API stability | Public methods identified: 10 entry points, all delegating to private implementation |
| REQ-05 | Register new services in agent.module.ts | NestJS module pattern documented; providers array registration required |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Session lifecycle | API / Backend | — | PiMonoAdapter operates within NestJS backend, managing Pi SDK sessions |
| Tool execution | API / Backend | — | Custom tools execute within agent session, returning structured results |
| Prompt assembly | API / Backend | — | Prompt construction is backend logic, no frontend involvement |
| Event recording | API / Backend | Database | Events persisted via Prisma, but coordination in backend service |
| Output processing | API / Backend | — | Output normalization is pure backend logic |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| NestJS | 11.x | DI framework | [VERIFIED: package.json] Existing project dependency |
| @nestjs/common | 11.x | @Injectable decorator | [VERIFIED: package.json] Required for service registration |
| Jest | 29.x | Testing framework | [VERIFIED: package.json] Existing test infrastructure |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @nestjs/testing | 11.x | NestJS test utilities | [VERIFIED: package.json] For creating test modules with DI |
| Prisma Client | 5.x | Database access | [VERIFIED: package.json] Shared by multiple services |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Gradual extraction | Big-bang rewrite | Gradual approach validates each step with tests; rewrite risks missing edge cases |
| Shared state object | State per service | Shared state maintains existing behavior; per-service state requires state synchronization logic |

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                    PiMonoAdapter (Coordinator)                 │
├──────────────────────────────────────────────────────────────┤
│  Public API Methods                                            │
│  ├── executeRun()                                              │
│  ├── runManagerDecision()                                      │
│  ├── runPrompt()                                               │
│  ├── runGroupRuntimeTurn()                                     │
│  ├── steer()                                                   │
│  ├── followUp()                                                │
│  ├── cancelRun()                                               │
│  ├── rehydrateSession()                                        │
│  ├── closeSession()                                            │
│  └── getRuntimeState()                                         │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼ (delegates via constructor injection)
┌──────────────────────────────────────────────────────────────┐
│                     Extracted Services                         │
├─────────────┬─────────────┬─────────────┬─────────────────────┤
│ PiSession   │ PiExecutor   │ PiTool      │ PiEventRecorder     │
│ Manager     │              │ Registry    │                     │
├─────────────┼─────────────┼─────────────┼─────────────────────┤
│ PiPrompt    │ PiOutput     │ PiSession   │                     │
│ Builder     │ Processor    │ StateService│                     │
└─────────────┴─────────────┴─────────────┴─────────────────────┤
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                    Shared Dependencies                         │
├─────────────┬─────────────┬─────────────┬─────────────────────┤
│ Prisma      │ Feishu      │ Redis       │ ConfigService       │
│ Service     │ Service     │             │                     │
└─────────────┴─────────────┴─────────────┴─────────────────────┤
```

### Recommended Project Structure
```
src/modules/agent/
├── pi-mono.adapter.ts          # Coordinator (reduced to ~150 lines)
├── pi-session-manager.service.ts    # Session lifecycle
├── pi-executor.service.ts           # Execution core
├── pi-tool-registry.service.ts      # Tool definitions
├── pi-output-processor.service.ts   # Output handling
├── pi-event-recorder.service.ts     # Event recording
├── pi-prompt-builder.service.ts     # Prompt assembly
├── pi-session-state.service.ts      # Shared state management (NEW)
├── agent.module.ts                  # Module registration
├── agent.types.ts                   # Type definitions (unchanged)
└── session-context.types.ts         # SessionContext interface
```

### Pattern 1: Service Decomposition with State Injection

**What:** Services receive shared state through method parameters rather than holding internal references.

**When to use:** When multiple services operate on the same state object (`SessionRuntimeState`).

**Example:**
```typescript
// Source: [CITED: docs.nestjs.com/fundamentals/custom-providers]
@Injectable()
export class PiSessionManager {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async ensureSession(input: EnsureSessionInput): Promise<SessionRuntimeState> {
    // Create or retrieve session state
    return state;
  }

  async closeSession(state: SessionRuntimeState): Promise<void> {
    state.session.dispose();
    // Cleanup logic
  }
}

@Injectable()
export class PiExecutor {
  constructor(
    private readonly sessionManager: PiSessionManager,
    private readonly promptBuilder: PiPromptBuilder,
  ) {}

  async executePrompt(state: SessionRuntimeState, input: ExecuteInput): Promise<Result> {
    const prompt = this.promptBuilder.buildPrompt(input.payload);
    await state.session.prompt(prompt);
    // Execution logic
  }
}
```

### Pattern 2: Coordinator/Facade Pattern

**What:** PiMonoAdapter injects all services and delegates public API calls.

**When to use:** When maintaining backward compatibility with existing API.

**Example:**
```typescript
// Source: [CITED: docs.nestjs.com/modules]
@Injectable()
export class PiMonoAdapter {
  constructor(
    private readonly sessionManager: PiSessionManager,
    private readonly executor: PiExecutor,
    private readonly toolRegistry: PiToolRegistry,
    private readonly outputProcessor: PiOutputProcessor,
    private readonly eventRecorder: PiEventRecorder,
    private readonly promptBuilder: PiPromptBuilder,
    private readonly sessionState: PiSessionStateService,
  ) {}

  async executeRun(runId: string, payload: PiMonoCreateRunRequest): Promise<PiMonoExecutionResult> {
    const state = await this.sessionManager.ensureSession(payload);
    return this.executor.executePrompt(state, { runId, payload });
  }
}
```

### Anti-Patterns to Avoid

- **Circular dependencies between services:** Do not create A -> B -> A injection chains. Use `forwardRef()` only as last resort.
- **State mutation across services:** Each service should only modify specific fields of `SessionRuntimeState` it owns.
- **Private methods in coordinator:** After extraction, PiMonoAdapter should only contain delegation logic, not private implementation.

## Code Structure Analysis

### Method Count per Category

| Category | Methods | Lines (Est.) | Target Service |
|----------|---------|--------------|----------------|
| **Public Entry Points** | 10 | ~150 | PiMonoAdapter (coordinator) |
| **Session Lifecycle** | 6 | ~200 | PiSessionManager |
| **Execution Core** | 4 | ~250 | PiExecutor |
| **Tool Definitions** | 11 | ~400 | PiToolRegistry |
| **Output Processing** | 8 | ~200 | PiOutputProcessor |
| **Event Recording** | 5 | ~200 | PiEventRecorder |
| **Prompt Building** | 10 | ~250 | PiPromptBuilder |
| **Runtime Task Management** | 7 | ~150 | PiExecutor (internal) |
| **Utility/Config** | 8 | ~100 | Various services |

### Method Mapping Validation

| Service (CONTEXT.md) | Proposed Methods | Actual Methods Found | Validation |
|---------------------|------------------|---------------------|------------|
| **PiSessionManager** | ensureSession, closeSession, rehydrateSession, createSessionManager, loadSdk | ensureSession (1018-1157), closeSession (353-361), rehydrateSession (335-346), createSessionManager (2661-2679), loadSdk (2717-2720) | **VALID** - All methods exist |
| **PiExecutor** | executePrompt, executeDecisionPrompt, executeGroupRuntimePrompt, cancelRun | executePrompt (702-809), executeDecisionPrompt (811-897), executeGroupRuntimePrompt (899-1016), cancelRun (317-333) | **VALID** - All methods exist |
| **PiToolRegistry** | 11 createXxxTool methods | createEmitOutputsTool (1159-1220), createEmitDecisionTool (1223-1266), createListProjectFolderTool (1268-1290), createReadProjectDocTool (1292-1317), createSearchProjectDocsTool (1319-1344), createReadProjectBitableTool (1346-1371), createListRecentProjectArtifactsTool (1373-1418), createTodoListTool (1420-1437), createTodoWriteTool (1439-1486), createReplyGroupTool (1488-1519), createRequestGroupConfirmationTool (1521-1559) | **VALID** - All 11 tools exist |
| **PiOutputProcessor** | normalizeOutputs, normalizeTodoWriteAction, normalizeConfirmationAction, applyOutputDeliveryDefaults | normalizeOutputs (1600-1611), applyOutputDeliveryDefaults (1613-1658), isAgentOutput (1660-1695), normalizeDecision (1697-1699), normalizeTodoWriteAction (1701-1722), normalizeRuntimeConfirmationAction (1724-1742), isManagerInteractiveDecision (1744-1791) | **VALID** - All methods exist |
| **PiEventRecorder** | recordRuntimeEvent, syncRuntimeSessionProjection, createRuntimeConfirmation | recordRuntimeEvent (2421-2456), projectRuntimeEvent (2458-2464), syncRuntimeSessionProjection (2466-2514), clearRuntimeProcessingReaction (2516-2537), createRuntimeConfirmation (2539-2578), buildRuntimeConfirmationCard (2580-2624) | **VALID** - All methods exist |
| **PiPromptBuilder** | buildPrompt, buildExecutionBiasLines, buildToolingLines, buildRuntimePolicyLines | buildPrompt (1793-1899), buildExecutionBiasLines (1902-1933), buildToolingLines (1935-1946), buildRuntimePolicyLines (1949-1983), describeRepoCapabilityState (1985-1996), describeRecentDocs (1998-2006), describeTaskBoardSummary (2008-2014), describeRecentArtifacts (2016-2022) | **VALID** - All methods exist |

### Dependency Graph (Internal)

```
ensureSession ──────► createSessionManager, loadSdk
                   ──────► createEmitOutputsTool, createEmitDecisionTool, ... (11 tools)
                   ──────► resolveModel, resolveCwd

executePrompt ──────► ensureSession
                 ──────► buildPrompt
                 ──────► normalizeOutputs
                 ──────► buildSessionSnapshot

executeGroupRuntimePrompt ──────► ensureSession
                           ──────► buildPrompt
                           ──────► ensureGroupRuntimeReplyAction
                           ──────► normalizeOutputs

runRuntimeTurn ──────► executeGroupRuntimePrompt
                 ──────► recordRuntimeEvent
                 ──────► applyRuntimeTurnResult
                 ──────► transitionRuntimeTask

buildPrompt ──────► buildExecutionBiasLines
             ──────► buildToolingLines
             ──────► buildRuntimePolicyLines
             ──────► describeRepoCapabilityState
             ──────► describeRecentDocs
             ──────► describeTaskBoardSummary
             ──────► describeRecentArtifacts
```

### Shared State Analysis

The `SessionRuntimeState` type (lines 50-78) is the critical shared state:

```typescript
type SessionRuntimeState = {
  runtimeSessionKey: string;
  cwd: string;
  session: AgentSession;          // SDK session object
  sessionManager: SessionManager;  // SDK session manager
  sessionStoreRef?: string;
  lastAssistantText?: string;
  activeExecution?: ActiveExecutionState;
  currentProjectContextBundle?: ProjectContextBundle;
  currentRoleProfile?: CompiledRoleProfile;
  runtimeTaskSnapshots: GroupRuntimeTaskSnapshot[];
  pendingRuntimeTaskEvents: Array<{ type: RuntimeEventType; payload: Record<string, unknown> }>;
  currentTurn?: RuntimeTurnState;
  waitingReason?: string;
  waitingTaskId?: string;
  eventSequence: number;
  recentEvents: RuntimeEvent[];
  toolCache: Map<string, unknown>;
  confirmationQueue?: RuntimeSubmitMessageInput['envelope'][];
  turnQueue?: RuntimeSubmitMessageInput['envelope'][];
  currentContext?: SimplifiedContextBinding;
};
```

**Fields modified by multiple services:**

| Field | Primary Owner | Secondary Accessors |
|-------|---------------|---------------------|
| `session` | PiSessionManager | PiExecutor (uses for prompt) |
| `activeExecution` | PiExecutor | PiOutputProcessor (reads outputs) |
| `runtimeTaskSnapshots` | PiExecutor | PiEventRecorder (reads for events) |
| `recentEvents` | PiEventRecorder | PiExecutor (hydrates) |
| `toolCache` | PiToolRegistry | All tools (read/write) |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Service registration | Manual provider config | NestJS `@Injectable` + providers array | [CITED: docs.nestjs.com/modules] Built-in DI handles lifecycle |
| State sharing | Global singleton | Method parameter passing | Avoids hidden coupling, makes dependencies explicit |
| Test mocking | Complex mock setup | `@nestjs/testing` TestModule | [CITED: docs.nestjs.com/testing] Standard testing utilities |

## Common Pitfalls

### Pitfall 1: State Mutation Confusion

**What goes wrong:** Multiple services modify the same state fields without clear ownership.

**Why it happens:** `SessionRuntimeState` is a shared mutable object passed between services.

**How to avoid:** Define field ownership in each service's documentation; services should only read fields they don't own.

**Warning signs:** Services modifying `activeExecution` or `toolCache` unexpectedly.

### Pitfall 2: Circular Dependency

**What goes wrong:** PiExecutor needs PiPromptBuilder, PiPromptBuilder needs PiExecutor for context.

**Why it happens:** Prompt building depends on execution mode, execution needs prompt.

**How to avoid:** Pass execution mode as parameter to `buildPrompt`, not inject PiExecutor.

**Warning signs:** `forwardRef()` appearing in constructor injection.

### Pitfall 3: Test Coverage Gaps

**What goes wrong:** Tests pass for adapter but fail for individual service behaviors.

**Why it happens:** Existing tests cover integration paths, not isolated service logic.

**How to avoid:** Add unit tests for each service immediately after extraction (D-11).

**Warning signs:** Service methods with no direct test coverage in `pi-mono.adapter.spec.ts`.

### Pitfall 4: Session State Loss

**What goes wrong:** Session disposed prematurely during service handoff.

**Why it happens:** `closeSession` called by wrong service or at wrong time.

**How to avoid:** Only PiSessionManager should call `session.dispose()`.

**Warning signs:** Session errors after service extraction.

## Code Examples

### Service Registration Pattern
```typescript
// Source: [CITED: docs.nestjs.com/modules]
// agent.module.ts
@Module({
  imports: [
    BullModule.registerQueue({ name: AGENT_RUN_QUEUE }, { name: ARTIFACT_SYNC_QUEUE }),
    RepoModule,
    forwardRef(() => FeishuModule),
    forwardRef(() => ConfirmationModule),
  ],
  controllers: [AgentController, GroupRuntimeController],
  providers: [
    AgentService,
    PiMonoAdapter,
    // NEW SERVICES (register here)
    PiSessionManager,
    PiExecutor,
    PiToolRegistry,
    PiOutputProcessor,
    PiEventRecorder,
    PiPromptBuilder,
    PiSessionStateService,
    ProjectRuntimeContextService,
    GroupAgentSessionService,
    GroupRuntimeService,
    RoleProfileService,
    SessionStateService,
    {
      provide: GROUP_AGENT_SESSION_REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => new Redis(config.getOrThrow<string>('REDIS_URL')),
    },
  ],
  exports: [
    AgentService,
    PiMonoAdapter,
    // NEW SERVICES (export for other modules)
    PiSessionManager,
    PiExecutor,
    PiToolRegistry,
    PiOutputProcessor,
    PiEventRecorder,
    PiPromptBuilder,
    PiSessionStateService,
    ProjectRuntimeContextService,
    GroupAgentSessionService,
    GroupRuntimeService,
    RoleProfileService,
    SessionStateService,
  ],
})
export class AgentModule {}
```

### Service Extraction Pattern
```typescript
// Source: [VERIFIED: src/modules/agent/pi-mono.adapter.ts lines 1793-1899]
// pi-prompt-builder.service.ts
@Injectable()
export class PiPromptBuilder {
  constructor(
    private readonly config: ConfigService,
  ) {}

  buildPrompt(payload: PiMonoCreateRunRequest): string {
    const requestKind = payload.requestKind ?? 'formal_execution';
    const decisionMode = requestKind === 'interactive_decision';
    const groupRuntimeMode = requestKind === 'group_runtime';
    const repoCapabilityState = this.describeRepoCapabilityState(payload);
    
    return [
      ...this.buildPromptGuidance(requestKind, groupRuntimeMode),
      '',
      '## Execution Bias',
      ...this.buildExecutionBiasLines(requestKind),
      '',
      '## Tooling',
      ...this.buildToolingLines(payload, groupRuntimeMode),
      '',
      '## Runtime Policy',
      ...this.buildRuntimePolicyLines(payload, requestKind, repoCapabilityState),
      '',
      '## Runtime Context',
      ...this.buildRuntimeContextLines(payload, groupRuntimeMode),
      '',
      ...(payload.roleProfile ? ['Compiled AGENTS.md (virtual):', payload.roleProfile.compiledContextFile, ''] : []),
      'User request:',
      payload.prompt,
    ].join('\n');
  }

  private buildExecutionBiasLines(requestKind: PiMonoCreateRunRequest['requestKind']): string[] {
    // Extracted from lines 1902-1933
  }

  private buildToolingLines(payload: PiMonoCreateRunRequest, groupRuntimeMode: boolean): string[] {
    // Extracted from lines 1935-1946
  }

  private buildRuntimePolicyLines(payload: PiMonoCreateRunRequest, requestKind: PiMonoCreateRunRequest['requestKind'], repoCapabilityState: string): string[] {
    // Extracted from lines 1949-1983
  }

  private describeRepoCapabilityState(payload: PiMonoCreateRunRequest): string {
    // Extracted from lines 1985-1996
  }
}
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.x |
| Config file | jest.config.js (project root) |
| Quick run command | `npm test -- --testPathPattern=pi-mono` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-01 | Decompose pi-mono.adapter.ts | integration | `npm test -- --testPathPattern=pi-mono` | YES - Existing tests validate behavior |
| REQ-02 | Maintain coordinator pattern | unit | `npm test -- pi-session-manager.service.spec.ts` (Wave 0) | NO - Need new test files |
| REQ-03 | Add unit tests for new services | unit | `npm test -- --testPathPattern='pi-.*\.service\.spec'` | NO - Wave 0 gap |
| REQ-04 | Preserve public API | integration | `npm test -- --testPathPattern=group-runtime` | YES - Existing tests cover API paths |
| REQ-05 | Register services in module | compile-time | `npm run build` | YES - TypeScript validates registration |

### Sampling Rate
- **Per task commit:** `npm test -- --testPathPattern=pi-mono --maxWorkers=1`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `test/pi-session-manager.service.spec.ts` — covers REQ-01 session lifecycle
- [ ] `test/pi-executor.service.spec.ts` — covers REQ-01 execution core
- [ ] `test/pi-tool-registry.service.spec.ts` — covers REQ-01 tool definitions
- [ ] `test/pi-output-processor.service.spec.ts` — covers REQ-01 output handling
- [ ] `test/pi-event-recorder.service.spec.ts` — covers REQ-01 event recording
- [ ] `test/pi-prompt-builder.service.spec.ts` — covers REQ-01 prompt assembly
- [ ] `test/conftest.ts` — shared test fixtures for Pi services

## Risk Assessment

### Methods Spanning Multiple Services

| Method | Primary Service | Secondary Service | Risk Level | Resolution |
|--------|-----------------|-------------------|------------|------------|
| `ensureSession` | PiSessionManager | PiToolRegistry (creates tools) | MEDIUM | Pass tools array from PiToolRegistry |
| `buildPrompt` | PiPromptBuilder | PiOutputProcessor (describes outputs) | LOW | describeXxx methods are pure, no side effects |
| `runRuntimeTurn` | PiExecutor | PiEventRecorder (records events) | LOW | Pass events as return value, let coordinator call recorder |

### Tight Coupling Concerns

| Coupling | Services Involved | Nature | Mitigation |
|----------|-------------------|--------|------------|
| `SessionRuntimeState` | All | Shared mutable state | Introduce `PiSessionStateService` to manage state creation/cleanup |
| `customTools` array | PiSessionManager, PiToolRegistry | Tool registration | PiToolRegistry provides `createAllTools(state)` method |
| `PrismaService` | PiSessionManager, PiEventRecorder, PiToolRegistry | Database access | Standard DI, no conflict |
| `FeishuService` | PiEventRecorder, PiToolRegistry | External API | Standard DI, no conflict |

### Migration Order Validation

**Proposed order:** PiSessionManager → PiExecutor → PiPromptBuilder → PiOutputProcessor → PiEventRecorder → PiToolRegistry

**Analysis:**

| Step | Service | Dependencies | Risk | Order Assessment |
|------|---------|--------------|------|-------------------|
| 1 | PiSessionManager | ConfigService, Prisma, SDK | LOW | **CORRECT** - Foundation for all others |
| 2 | PiExecutor | PiSessionManager, PiPromptBuilder | MEDIUM | **CORRECT** - Core execution after session |
| 3 | PiPromptBuilder | ConfigService | LOW | **CORRECT** - Pure functions, no state |
| 4 | PiOutputProcessor | None | LOW | **CORRECT** - Pure functions, easiest extraction |
| 5 | PiEventRecorder | Prisma, FeishuService | LOW | **CORRECT** - Database operations only |
| 6 | PiToolRegistry | Prisma, FeishuProjectReader | MEDIUM | **CORRECT** - Largest, most complex, extract last |

**Recommendation:** The proposed order is optimal. Extract pure function services (PiPromptBuilder, PiOutputProcessor) early for quick wins, then stateful services.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `SessionRuntimeState` can be passed as method parameter | Architecture Patterns | Services would need state synchronization logic |
| A2 | PiToolRegistry can create all tools via single `createAllTools(state)` method | Risk Assessment | ensureSession would need direct PiToolRegistry injection |
| A3 | Existing tests adequately validate integration behavior | Validation Architecture | Behavior changes might pass tests but fail in production |

**Note:** Claims A1-A3 are based on code analysis, not external verification. Planner should confirm with user before execution.

## Open Questions (RESOLVED)

1. **Should `PiSessionStateService` be introduced?**
   - **Resolution:** YES - PiSessionStateService introduced in Plan 01 Task 2. It manages SessionRuntimeState creation, hydration, and cleanup, providing clear ownership and reducing parameter passing complexity.

2. **What test coverage targets per service?**
   - **Resolution:** 80% coverage for pure function services (PiPromptBuilder, PiOutputProcessor), 60% for stateful services (PiSessionManager, PiExecutor, PiEventRecorder, PiToolRegistry). Targets implemented in test tasks for each service.

3. **Should PiToolRegistry inject other services?**
   - **Resolution:** YES - PiToolRegistry injects PrismaService, FeishuProjectReader, PiOutputProcessor, ConfigService (Plan 06 Task 1). Tools receive state parameter, dependencies are resolved via constructor injection.

## Sources

### Primary (HIGH confidence)
- [VERIFIED: src/modules/agent/pi-mono.adapter.ts] - Full code analysis, 2834 lines, method signatures verified
- [VERIFIED: src/modules/agent/agent.module.ts] - Module registration pattern confirmed
- [VERIFIED: test/pi-mono.adapter.spec.ts] - Existing test patterns, 919 lines
- [CITED: docs.nestjs.com/modules] - NestJS module and provider registration patterns
- [CITED: docs.nestjs.com/fundamentals/custom-providers] - Dependency injection patterns

### Secondary (MEDIUM confidence)
- [CITED: docs.nestjs.com/testing] - NestJS testing utilities documentation
- [VERIFIED: .planning/codebase/ARCHITECTURE.md] - Project architecture patterns
- [VERIFIED: .planning/codebase/CONVENTIONS.md] - NestJS conventions in project

### Tertiary (LOW confidence)
- [WebSearch: NestJS service decomposition] - Community patterns for service refactoring

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - NestJS patterns verified from existing code
- Architecture: HIGH - Code structure analyzed directly, decomposition validated
- Pitfalls: MEDIUM - Based on code analysis and NestJS documentation, not execution testing

**Research date:** 2026-05-05
**Valid until:** 30 days - NestJS patterns stable, code structure current