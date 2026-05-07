---
wave: 3
depends_on:
  - 02
files_modified:
  - src/modules/agent/pi-mono.adapter.ts
  - src/modules/agent/agent.types.ts
requirements_addressed:
  - D-02
autonomous: true
---

# Plan 03: Simplify PiMonoAdapter

<objective>
Remove ActorQueue and queueMode logic from PiMonoAdapter. Replace with direct steer/followUp SDK calls that handle message merging automatically.
</objective>

<read_first>
- src/modules/agent/pi-mono.adapter.ts — Current implementation with ActorQueue, RuntimeQueueMode, enqueueRuntimeActor, enqueueRuntimeMessage
- src/modules/agent/session-context.types.ts — New RuntimeState and SessionContext types
- src/modules/agent/session-state.service.ts — New centralized state management
- .planning/phases/01-rebuild-1/01-CONTEXT.md — Queue mechanism decisions (steer/followUp, remove ActorQueue)
</read_first>

<acceptance_criteria>
- src/modules/agent/pi-mono.adapter.ts modified:
  - `SessionRuntimeState` internal type no longer has `queue` field
  - `SessionRuntimeState` no longer has `actorQueue` field
  - `RuntimeQueuedMessage` type removed
  - `enqueueRuntimeActor` method removed or simplified to just execute callback without queue
  - `enqueueRuntimeMessage` method removed
  - `handleStreamingSubmission` method replaced with direct `session.steer()` call
  - `submitMessage` method signature changed to accept `SessionContext` instead of `RuntimeSubmitMessageInput`
  - No references to `RuntimeQueueMode` anywhere in the file
- PiMonoAdapter uses:
  - `session.steer(message, environment)` for appending to existing turn
  - `session.followUp(event, environment)` for resuming after interruption/confirmation
</acceptance_criteria>

<action>
**Step 1: Remove ActorQueue infrastructure from `pi-mono.adapter.ts`**

Delete or modify the following:

1. **Lines 60-95 (`SessionRuntimeState` type):** Remove fields:
   - `queue: RuntimeQueuedMessage[]` — DELETE
   - `actorQueue: Promise<unknown>` — DELETE

2. **Lines 70-76 (`RuntimeQueuedMessage` type):** DELETE entire type definition

3. **Method `enqueueRuntimeActor`:** DELETE entire method (was used to serialize actor operations)

4. **Method `enqueueRuntimeMessage`:** DELETE entire method (was used to queue messages during waiting state)

5. **Method `handleStreamingSubmission`:** REPLACE with direct steer call:
```typescript
// Before: complex queue logic
// After: direct SDK call
await state.session.steer(messageText, state.environment);
```

**Step 2: Simplify `submitMessage` method**

Replace the current complex submission logic with:

```typescript
async submitMessage(context: SessionContext, envelope: MessageEnvelope): Promise<{ accepted: boolean; action: string }> {
  const state = await this.ensureSession(context);

  // Check if session is streaming (runtime check, not persisted state)
  const isStreaming = state.session.isStreaming;

  if (context.runtimeState === 'waiting_confirmation') {
    // Queue in memory during confirmation wait (not persisted)
    this.confirmationQueue.add(context.sessionId, envelope);
    return { accepted: true, action: 'queued_waiting' };
  }

  if (isStreaming) {
    // Append to existing turn using SDK steer
    await state.session.steer(envelope.rawText, context.environment);
    return { accepted: true, action: 'steered' };
  }

  // Start new turn
  await state.session.steer(envelope.rawText, context.environment);
  return { accepted: true, action: 'run_now' };
}
```

**Step 3: Simplify `resumeSession` method**

Replace queue logic with direct followUp:

```typescript
async resumeSession(context: SessionContext, event: ResumeEvent): Promise<{ accepted: boolean }> {
  const state = await this.ensureSession(context);
  
  // Clear waiting state
  context.runtimeState = 'idle';
  
  // Resume using SDK followUp
  await state.session.followUp(event, context.environment);
  
  // Process any queued messages from confirmation wait
  const queued = this.confirmationQueue.get(context.sessionId);
  if (queued.length > 0) {
    for (const msg of queued) {
      await state.session.steer(msg.rawText, context.environment);
    }
    this.confirmationQueue.clear(context.sessionId);
  }
  
  return { accepted: true };
}
```

**Step 4: Add in-memory confirmation queue (non-persisted)**

Add a simple in-memory queue for messages arriving during confirmation:

```typescript
// At class level (non-persisted, lost on restart - acceptable trade-off)
private readonly confirmationQueue = new Map<string, MessageEnvelope[]>();
```

**Step 5: Remove all imports referencing deleted types**

Remove imports for:
- `RuntimeQueueMode`
- `RuntimeQueuedMessage`
- `RuntimeQueueItemSnapshot`
- `RuntimeSubmitMessageInput` (replace with SessionContext)
- `RuntimeResumeInput` (replace with SessionContext + event)
</action>

<verification>
1. TypeScript compilation passes (expect some errors from GroupRuntimeService that will be fixed in Plan 04):
```bash
npm run build
```

2. Verify no references to removed types:
```bash
grep -n "RuntimeQueueMode\|enqueueRuntimeActor\|enqueueRuntimeMessage" src/modules/agent/pi-mono.adapter.ts
```
Expected: No matches found
</verification>