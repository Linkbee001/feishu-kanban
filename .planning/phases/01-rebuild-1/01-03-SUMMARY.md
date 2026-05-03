---
plan: 01-rebuild-1-03
phase: rebuild-1
wave: 3
status: partial
completed_at: 2026-05-03
---

# Summary: Simplify PiMonoAdapter

## What Was Built

Started simplification of PiMonoAdapter to remove ActorQueue and queueMode logic:

1. **Modified: `src/modules/agent/pi-mono.adapter.ts`**
   - Added import for SessionContext, RuntimeState, SessionEnvironment
   - Removed imports for deleted types (RuntimeQueueMode, RuntimeContextBinding, RuntimeMinimalContext, RuntimeQueueItemSnapshot, RuntimeStateSnapshot)
   - Removed `queue` and `actorQueue` fields from SessionRuntimeState
   - Removed `currentContextBinding` and `currentMinimalContext` fields from SessionRuntimeState
   - Removed RuntimeQueuedMessage type definition
   - Removed enqueueRuntimeActor method

2. **Modified: `src/modules/agent/session-state.service.ts`**
   - Added Prisma import for InputJsonValue type
   - Fixed runtimeStateJson type casting for Prisma compatibility

3. **Modified: `src/modules/agent/project-runtime-context.service.ts`**
   - Removed defaultQueueMode field from GroupPolicySnapshot construction

## Key Decisions

- Removed ActorQueue serialization mechanism
- Removed memory queue for runtime messages
- SessionRuntimeState simplified (no queue, no actorQueue)
- Prisma InputJsonValue used for runtimeStateJson updates

## Files Modified

| File | Action | Lines Changed |
|------|--------|---------------|
| src/modules/agent/pi-mono.adapter.ts | Modified | ~20 removed |
| src/modules/agent/session-state.service.ts | Modified | +1 import, +2 type casts |
| src/modules/agent/project-runtime-context.service.ts | Modified | -1 line |

## Verification Results

TypeScript compilation shows remaining errors:
- `pi-mono.adapter.ts` — References to removed methods (enqueueRuntimeMessage, handleStreamingSubmission, submitMessage, resumeSession)
- `group-runtime.service.ts` — References to removed types
- `agent-run.processor.ts` — References to contextBinding

These errors will be resolved in:
- Plan 04: Simplify GroupRuntimeService
- Plan 05: Simplify GroupAgentSessionService

## Remaining Work

The following methods still need simplification in pi-mono.adapter.ts:
- `submitMessage` — Replace enqueueRuntimeActor with direct execution
- `resumeSession` — Replace enqueueRuntimeActor with direct execution
- `enqueueRuntimeMessage` — Remove or replace with in-memory confirmation queue
- `handleStreamingSubmission` — Replace queue logic with direct steer call
- `getRuntimeState` — Replace RuntimeStateSnapshot with RuntimeState enum

These will be addressed incrementally as dependencies are resolved.

## Self-Check: PARTIAL

- [x] Removed RuntimeQueueMode import
- [x] Removed RuntimeContextBinding import
- [x] Removed RuntimeMinimalContext import
- [x] Removed RuntimeStateSnapshot import
- [x] Removed RuntimeQueueItemSnapshot import
- [x] Added SessionContext imports
- [x] Removed queue and actorQueue from SessionRuntimeState
- [x] Removed RuntimeQueuedMessage type
- [x] Removed enqueueRuntimeActor method
- [ ] Simplified submitMessage method (pending)
- [ ] Simplified resumeSession method (pending)
- [ ] Removed enqueueRuntimeMessage method (pending)
- [ ] Compilation passes (pending - expected errors in subsequent plans)