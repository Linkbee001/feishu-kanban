---
plan: 01-rebuild-1-01
phase: rebuild-1
wave: 1
status: complete
completed_at: 2026-05-03
---

# Summary: Define New Type System

## What Was Built

Created foundational type definitions for the simplified group runtime architecture:

1. **New file: `src/modules/agent/session-context.types.ts`**
   - `RuntimeState` — Three-state enum (`idle` | `running` | `waiting_confirmation`)
   - `SessionEnvironment` — Execution config for PiMono adapter
   - `SessionGroupPolicy` — Permission checks for high-risk actions
   - `SessionContext` — Unified context object replacing multiple overlapping interfaces

2. **Modified: `src/modules/agent/agent.types.ts`**
   - `RuntimeEventType` reduced from 14 to 4 types:
     - `message_submitted`, `turn_completed`, `confirmation_requested`, `session_state_changed`
   - Removed `RuntimeQueueMode` type (5 queue modes)
   - Removed `RuntimeMinimalContext` interface
   - Removed `RuntimeContextBinding` interface
   - Removed `RuntimeStateSnapshot` interface
   - Removed `RuntimeQueueItemSnapshot` interface
   - Updated `GroupPolicySnapshot` to remove `defaultQueueMode`
   - Updated `RuntimeSubmitMessageInput`, `RuntimeResumeInput`, `PiMonoCreateRunRequest` to remove removed type references

## Key Decisions

- Single source of truth for session state via `RuntimeState` enum
- SDK's `isStreaming` used as runtime check, not persisted state
- Four event types sufficient for monitoring and debugging
- Business events (reply, outputs) handled separately from runtime events

## Files Modified

| File | Action | Lines Changed |
|------|--------|---------------|
| src/modules/agent/session-context.types.ts | Created | +50 |
| src/modules/agent/agent.types.ts | Modified | ~100 removed, ~4 added |

## Verification Results

TypeScript compilation shows expected errors in:
- `pi-mono.adapter.ts` — References `RuntimeQueueMode`, `RuntimeContextBinding`, `RuntimeMinimalContext`
- `group-runtime.service.ts` — References `RuntimeQueueMode`, `RuntimeStateSnapshot`

These errors will be resolved in:
- Plan 02: Create SessionStateService
- Plan 03: Simplify PiMonoAdapter
- Plan 04: Simplify GroupRuntimeService

## Next Steps

Wave 2 is ready to execute:
- Plan 02: Create Session State Service — Centralized state management with valid transition enforcement

## Self-Check: PASSED

- [x] New file created with all required types
- [x] RuntimeEventType reduced to exactly 4 types
- [x] RuntimeQueueMode removed
- [x] RuntimeMinimalContext removed
- [x] RuntimeContextBinding removed
- [x] RuntimeStateSnapshot removed
- [x] Expected compilation errors present (will be fixed in subsequent plans)