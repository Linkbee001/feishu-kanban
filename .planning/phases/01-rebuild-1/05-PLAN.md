---
wave: 4
depends_on:
  - 03
files_modified:
  - src/modules/agent/group-agent-session.service.ts
requirements_addressed:
  - D-01
  - D-03
autonomous: true
---

# Plan 05: Simplify GroupAgentSessionService

<objective>
Remove distributed state management methods from GroupAgentSessionService. State changes should now go through SessionStateService.
</objective>

<read_first>
- src/modules/agent/group-agent-session.service.ts — Current implementation with syncGroupRuntimeState, syncRuntimeSessionState
- src/modules/agent/session-state.service.ts — New centralized state management
- .planning/phases/01-rebuild-1/01-CONTEXT.md — State persistence decisions
</read_first>

<acceptance_criteria>
- src/modules/agent/group-agent-session.service.ts modified:
  - `syncGroupRuntimeState` method removed or simplified (state changes handled by SessionStateService)
  - `syncRuntimeSessionState` method simplified to only sync Pi SDK session info (not runtime state)
  - runtimeStateJson updates centralized through SessionStateService
  - SessionStateService injected in constructor
- GroupAgentSessionService still handles:
  - Session creation (getOrCreateSession)
  - Lock management (tryAcquireLock, releaseLock)
  - Pi SDK session sync (piSessionId, sessionStoreRef, memorySummary)
</acceptance_criteria>

<action>
**Step 1: Add SessionStateService import and injection**

```typescript
import { SessionStateService } from './session-state.service';

@Injectable()
export class GroupAgentSessionService {
  constructor(
    // ... existing injections
    private readonly sessionState: SessionStateService,
  ) {}
}
```

**Step 2: Remove `syncGroupRuntimeState` method**

Delete the method (lines 337-358). Runtime state changes now go through SessionStateService.

Replace any calls to `syncGroupRuntimeState` with appropriate SessionStateService calls:
- `syncGroupRuntimeState({ sessionId, runtimeStateJson: ... })` → `sessionState.updateRuntimeStateJson(sessionId, ...)`

**Step 3: Simplify `syncRuntimeSessionState` method**

Keep this method but remove runtime state handling. It should only sync Pi SDK session info:

```typescript
async syncRuntimeSessionState(input: {
  sessionId: string;
  piSessionId?: string | null;
  sessionStoreDriver?: string | null;
  sessionStoreRef?: string | null;
  memorySummary?: string | null;
  lastError?: string | null;
  touchMessageAt?: boolean;
  touchRunAt?: boolean;
}): Promise<void> {
  const data: Record<string, unknown> = {};
  if (input.piSessionId !== undefined) {
    data.piSessionId = input.piSessionId;
  }
  if (input.sessionStoreDriver !== undefined) {
    data.sessionStoreDriver = input.sessionStoreDriver;
  }
  if (input.sessionStoreRef !== undefined) {
    data.sessionStoreRef = input.sessionStoreRef;
  }
  if (input.memorySummary !== undefined) {
    data.memorySummary = input.memorySummary;
  }
  if (input.lastError !== undefined) {
    data.lastError = input.lastError;
  }
  if (input.touchMessageAt) {
    data.lastMessageAt = new Date();
  }
  if (input.touchRunAt) {
    data.lastRunAt = new Date();
  }

  // Note: runtimeStateJson updates handled by SessionStateService
  // Note: currentRuntimeTaskId removed (no longer used)

  return this.prisma.groupAgentSession.update({
    where: { id: input.sessionId },
    data,
  });
}
```

**Step 4: Remove currentRuntimeTaskId handling**

Remove any code that sets `currentRuntimeTaskId`:
- In `syncGroupRuntimeState` (already removed)
- In any other methods that reference `currentRuntimeTaskId`

**Step 5: Update agent.module.ts exports**

Ensure SessionStateService is exported from AgentModule (already done in Plan 02).
</action>

<verification>
1. TypeScript compilation passes:
```bash
npm run build
```

2. Verify syncGroupRuntimeState is removed:
```bash
grep -n "syncGroupRuntimeState" src/modules/agent/group-agent-session.service.ts
```
Expected: No matches

3. Verify SessionStateService is injected:
```bash
grep -n "SessionStateService" src/modules/agent/group-agent-session.service.ts
```
Expected: Import and constructor injection present
</verification>