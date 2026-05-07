---
plan: 01-rebuild-1-03
phase: rebuild-1
wave: 3
status: completed
completed_at: 2026-05-03
---

# Summary: Simplify PiMonoAdapter

## What Was Built

Completed simplification of PiMonoAdapter to remove ActorQueue and queueMode logic:

### 1. pi-mono.adapter.ts

- **Removed imports** for deleted types (RuntimeQueueMode, RuntimeQueuedMessage)
- **Added SessionContext imports** (SessionContext, RuntimeState, SessionEnvironment)
- **Added SimplifiedContextBinding type alias** replacing RuntimeContextBinding
- **Updated SessionRuntimeState** - removed queue, actorQueue, currentContextBinding, currentMinimalContext
- **Removed methods**: enqueueRuntimeMessage, summarizeEnvelopes, buildQueuedPrompt, startNextQueuedTurn
- **Simplified handleStreamingSubmission** - direct steer call, no queueMode logic
- **Simplified runRuntimeTurn** - direct execution, no queue drain
- **Simplified applyRuntimeTurnResult** - removed deleted event type calls (todo_changed, reply_emitted, outputs_emitted, session_waiting)
- **Fixed syncRuntimeSessionProjection** - use sessionId instead of piSessionId, use lastAssistantText for memorySummary
- **Fixed buildGroupRuntimePrompt** - use projectContextBundle instead of minimalContext
- **Fixed describeTaskBoardSummary** - use correct BitableSnapshot properties
- **Fixed contextBinding references** - use state.currentContext (SimplifiedContextBinding)

### 2. group-runtime.service.ts

- **Removed imports** for RuntimeQueueMode, RuntimeStateSnapshot
- **Added RuntimeState import** from session-context.types
- **Removed resolveQueueMode method** entirely
- **Removed contextBinding** from submitMessage and resumeSession calls
- **Removed minimalContext** from submitMessage and resumeSession calls
- **Added projectContextBundle** construction using runtimeContext.assemble()
- **Fixed readRuntimeSnapshot** to return RuntimeState instead of RuntimeStateSnapshot
- **Fixed getRuntimeState usage** - returns RuntimeState enum now

### 3. agent-run.processor.ts

- **Removed contextBinding** from PiMonoCreateRunRequest
- **Removed minimalContext** from PiMonoCreateRunRequest

### 4. project-runtime-context.service.ts

- **Removed defaultQueueMode** from GroupPolicySnapshot construction (already done in previous iteration)

### 5. session-state.service.ts

- **Added Prisma InputJsonValue import** and type casting (already done in previous iteration)

### 6. test/pi-mono.adapter.spec.ts

- **Removed minimalContext** from PiMonoCreateRunRequest test case
- **Added projectContextBundle** to test case
- **Removed contextBinding** from RuntimeSubmitMessageInput test cases
- **Added allowAutoTaskCreation** to GroupPolicySnapshot

## Key Decisions

- Removed ActorQueue serialization mechanism entirely
- Removed memory queue for runtime messages (state.queue)
- SessionRuntimeState simplified with only confirmationQueue and turnQueue (memory queues)
- Direct steer calls during streaming sessions (no interrupt/collect modes)
- Prisma InputJsonValue used for runtimeStateJson updates
- projectContextBundle replaces minimalContext for runtime context
- state.currentContext (SimplifiedContextBinding) replaces RuntimeContextBinding

## Files Modified

| File | Action | Lines Changed |
|------|--------|---------------|
| src/modules/agent/pi-mono.adapter.ts | Modified | ~200 lines removed/simplified |
| src/modules/agent/group-runtime.service.ts | Modified | ~80 lines removed/simplified |
| src/queues/processors/agent-run.processor.ts | Modified | ~12 lines removed |
| test/pi-mono.adapter.spec.ts | Modified | ~30 lines modified |

## Verification Results

TypeScript compilation passes with 0 errors:
```
$ npx tsc --noEmit
(Bash completed with no output)
```

## Remaining Work

Plan 03 is complete. The following plans will address:
- Plan 04: Simplify GroupRuntimeService (already partially done)
- Plan 05: Simplify GroupAgentSessionService
- Plan 06: Update event handlers
- Plan 07: Final verification

## Self-Check: COMPLETED

- [x] Removed RuntimeQueueMode import
- [x] Removed RuntimeQueuedMessage type
- [x] Added SessionContext imports
- [x] Removed queue and actorQueue from SessionRuntimeState
- [x] Removed enqueueRuntimeMessage method
- [x] Removed summarizeEnvelopes method
- [x] Removed buildQueuedPrompt method
- [x] Removed startNextQueuedTurn method
- [x] Simplified handleStreamingSubmission method
- [x] Simplified runRuntimeTurn method
- [x] Removed deleted event type usages
- [x] Fixed all contextBinding/minimalContext references
- [x] Fixed group-runtime.service.ts
- [x] Fixed agent-run.processor.ts
- [x] Fixed test files
- [x] Compilation passes