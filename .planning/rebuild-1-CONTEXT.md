---
name: rebuild-1-context
description: Group runtime refactor decisions - state, queue, persistence, context simplification
type: context
phase: rebuild-1
last_updated: 2026-05-02
---

# Rebuild Phase 1: Group Runtime Refactor

## Objective

Simplify the group runtime message scheduling mechanism by leveraging Pi SDK's built-in capabilities rather than maintaining redundant custom implementations.

**Core principle**: Let Pi SDK decide how to schedule and execute tasks within a group session.

## Decision Summary

### Area 1: State Management

**Problem**: Four overlapping state variables (activeExecution, currentTurn, waitingReason, session.isStreaming) with unclear semantics.

**Decision**: Three-state enum

```typescript
type RuntimeState = 'idle' | 'running' | 'waiting_confirmation';
```

**Rationale**:
- Single source of truth for session state
- Clear semantics: idle (no task), running (executing), waiting_confirmation (awaiting user action)
- SDK's `isStreaming` used as runtime check, not persisted state

**State persistence (runtimeStateJson)**:
- Include sessionId (for monitoring/debugging)
- Business fields: projectId, feishuChatId, waitingReason, confirmationRequestId, runtimeProfile
- Write timing: key node writes (state change, confirmation request, turn completion)
- State change management: centralized in GroupAgentSessionService

**Recovery strategy**:
- SDK-first: `SessionManager.continueRecent()` recovers conversation history from .jsonl
- On restart: clean DB state, rebuild from SDK + minimal business fields
- Edge case: abandon incomplete tasks after cleanup (no manual resume)

### Area 2: Queue Mechanism

**Problem**: Dual queue (memory ActorQueue + BullMQ) + 5 queueMode variants with unclear semantics.

**Decision**: Full SDK queue

```typescript
// Message handling
piMonoAdapter.steer(sessionId, message, environment);  // Append to existing turn
piMonoAdapter.followUp(sessionId, event, environment); // Resume after interruption
```

**Rationale**:
- SDK's steer/followUp handle message merging automatically
- Remove ActorQueue and memory queue for running state
- Remove queueMode enum (steer, followup, interrupt, collect, steer_backlog)

**Waiting_confirmation handling**:
- Keep memory queue for messages arriving during confirmation wait
- Not persisted (acceptable trade-off: lost on restart)
- After confirmation resolved: process queued messages via steer

**Interrupt removal**:
- No explicit interrupt mode
- User confirmation is the only interruption mechanism
- Simplified message flow: submit → steer → execute → confirm (if needed) → followUp

### Area 3: Persistence Strategy

**Problem**: Dual storage (runtimeTaskSnapshots in GroupAgentSession + GroupRuntimeTask table), 16 RuntimeEvent types.

**Decision**: Simplify events, remove GroupRuntimeTask

**RuntimeEvent simplified to 4 types**:
```typescript
type RuntimeEventType = 
  | 'message_submitted'     // Message entered system
  | 'turn_completed'        // Execution finished
  | 'confirmation_requested' // High-risk action pending
  | 'session_state_changed'; // State machine transition
```

**Rationale**:
- Removed: message_queued, message_collected, message_steered, message_interrupted, turn_started, turn_failed, todo_changed, reply_emitted, outputs_emitted, session_waiting, session_resumed
- 4 types sufficient for monitoring and debugging
- Business events (reply, outputs) handled separately

**GroupRuntimeTask removal**:
- Remove GroupRuntimeTask table entirely
- Execution tracking via RuntimeEvent.sequence + messageSourceId
- Task state (queued/running/completed) replaced by RuntimeState enum
- Task metadata (intent, skillHint) stored in RuntimeEvent.payload

**runtimeStateJson fields**:
```json
{
  "sessionId": "pi-session-id",
  "projectId": "...",
  "feishuChatId": "...",
  "waitingReason": "confirmation",
  "confirmationRequestId": "...",
  "runtimeProfile": { ... }
}
```

**Rationale**: sessionId for debugging, business fields for recovery. SDK handles session/execution state via .jsonl.

### Area 4: Context Objects

**Problem**: Multiple overlapping context interfaces (ProjectContextBundle, RuntimeContextBinding, RuntimeMinimalContext, PiMonoCreateRunRequest) with nested passing.

**Decision**: Single SessionContext

```typescript
interface SessionContext {
  // Identity (for SDK calls + Feishu reply)
  projectId: string;
  feishuChatId: string;
  sessionId: string;
  
  // Execution config (for PiMono)
  environment: {
    repoPath?: string;
    modelName: string;
    skillSet?: unknown;
  };
  
  // Business rules (for permission checks)
  groupPolicy: {
    mentionOnly: boolean;
    allowDocWrite: boolean;
    allowTaskBoardWrite: boolean;
  };
  
  // Runtime state (three-state enum)
  runtimeState: RuntimeState;
  waitingReason?: string;
  confirmationRequestId?: string;
}
```

**Removed interfaces**:
- RuntimeContextBinding (replaced by projectId/feishuChatId directly)
- RuntimeMinimalContext (replaced by SessionContext.environment and groupPolicy)
- PiMonoCreateRunRequest (split into SessionContext + execution parameters)
- ProjectContextBundle full (replaced by minimal SessionContext)

**On-demand loading**:
- Feishu resource snapshots (docs, bitable) loaded inside skills when needed
- Not pre-populated in SessionContext

**Call simplification**:
```typescript
// Submit message
piMonoAdapter.steer(context.sessionId, message, context.environment);

// Resume execution
piMonoAdapter.followUp(context.sessionId, resumeEvent, context.environment);

// Query state
const isStreaming = piMonoAdapter.isStreaming(context.sessionId);
```

## Data Model Changes

### GroupAgentSession

**Before**: runtimeStateJson with 20+ fields including execution state

**After**: runtimeStateJson with minimal fields:
- sessionId (for SDK recovery)
- projectId, feishuChatId (for routing)
- waitingReason, confirmationRequestId (for confirmation flow)
- runtimeProfile (for model selection)

### RuntimeEvent

**Before**: 16 event types with fine-grained tracking

**After**: 4 event types for monitoring:
- message_submitted
- turn_completed
- confirmation_requested
- session_state_changed

### GroupRuntimeTask

**Before**: Dedicated table for task tracking

**After**: Removed. Task state replaced by RuntimeState enum. Task metadata in RuntimeEvent.payload.

### SessionRuntimeState

**Before**: Complex interface with 20+ fields

**After**: Removed. SessionContext handles identity + config + state.

## Architecture Simplification

### Before

```
Feishu WebSocket → BullMQ → FeishuEventService
                          ↓
                    GroupRuntimeService
                          ↓
                    ActorQueue (memory) + GroupRuntimeTask (DB)
                          ↓
                    PiMonoAdapter (queueMode: steer/followup/interrupt/collect/steer_backlog)
                          ↓
                    Pi SDK Session
```

### After

```
Feishu WebSocket → BullMQ → FeishuEventService (fire-and-forget)
                          ↓
                    GroupRuntimeService
                          ↓
                    SessionContext (identity + config + state)
                          ↓
                    PiMonoAdapter.steer() / followUp()
                          ↓
                    Pi SDK Session (handles queue internally)
```

## Implementation Notes

1. **SDK Session Recovery**: Use `SessionManager.continueRecent()` on restart
2. **State Cleanup**: On restart, clear DB runtimeStateJson, rebuild from SDK .jsonl
3. **Confirmation Flow**: Memory queue for waiting period, process after resolved
4. **Permission Checks**: Use SessionContext.groupPolicy before high-risk actions
5. **On-demand Loading**: Skills call FeishuReader for resource snapshots

## Open Questions

1. **skillSet format**: How does PiMono expect skill configuration? Need to verify SDK interface.
2. **Memory queue limit**: Should memory queue during confirmation have a size limit?
3. **Confirmation timeout**: How long to wait before auto-rejecting confirmation requests?

## Files to Modify

### Remove
- `src/modules/agent/group-runtime-task.service.ts` (GroupRuntimeTask logic)
- GroupRuntimeTask table in `prisma/schema.prisma`

### Simplify
- `src/modules/agent/pi-mono.adapter.ts` (remove queueMode, ActorQueue)
- `src/modules/agent/group-runtime.service.ts` (use steer/followUp directly)
- `src/modules/agent/agent.types.ts` (remove complex interfaces)
- `src/modules/agent/group-agent-session.service.ts` (simplify state management)

### Add
- `src/modules/agent/session-context.types.ts` (SessionContext interface)
- `src/modules/agent/session-state.service.ts` (centralized state management)