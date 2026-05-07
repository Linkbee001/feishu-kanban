---
wave: 1
depends_on: []
files_modified:
  - src/modules/agent/session-context.types.ts
  - src/modules/agent/agent.types.ts
requirements_addressed:
  - D-01
  - D-04
autonomous: true
---

# Plan 01: Define New Type System

<objective>
Create the foundational type definitions for SessionContext and RuntimeState enum that will replace the existing overlapping state variables and context interfaces.
</objective>

<read_first>
- src/modules/agent/agent.types.ts — Current type definitions including RuntimeQueueMode, RuntimeEventType, ProjectContextBundle, RuntimeMinimalContext, RuntimeContextBinding, RuntimeStateSnapshot
- .planning/phases/01-rebuild-1/01-CONTEXT.md — Decision specifications for SessionContext interface and RuntimeState enum
</read_first>

<acceptance_criteria>
- src/modules/agent/session-context.types.ts exists and contains:
  - `RuntimeState` type with exactly three values: 'idle' | 'running' | 'waiting_confirmation'
  - `SessionContext` interface with all fields specified in CONTEXT.md (projectId, feishuChatId, sessionId, environment, groupPolicy, runtimeState, waitingReason, confirmationRequestId)
  - `SessionEnvironment` interface (repoPath, modelName, skillSet)
  - `GroupPolicySnapshot` interface (mentionOnly, allowDocWrite, allowTaskBoardWrite)
- src/modules/agent/agent.types.ts modified:
  - RuntimeEventType reduced to exactly 4 types: 'message_submitted' | 'turn_completed' | 'confirmation_requested' | 'session_state_changed'
  - RuntimeQueueMode type removed entirely
  - RuntimeMinimalContext interface removed
  - RuntimeContextBinding interface removed
  - RuntimeStateSnapshot interface removed (replaced by RuntimeState)
</acceptance_criteria>

<action>
**Step 1: Create new file `src/modules/agent/session-context.types.ts`**

Add the following type definitions:

```typescript
/**
 * Three-state enum for session runtime state.
 * Replaces four overlapping state variables (activeExecution, currentTurn, waitingReason, session.isStreaming).
 */
export type RuntimeState = 'idle' | 'running' | 'waiting_confirmation';

/**
 * Session environment configuration for PiMono adapter.
 */
export interface SessionEnvironment {
  repoPath?: string;
  modelName: string;
  skillSet?: unknown;
}

/**
 * Group policy snapshot for permission checks before high-risk actions.
 */
export interface SessionGroupPolicy {
  mentionOnly: boolean;
  allowDocWrite: boolean;
  allowTaskBoardWrite: boolean;
}

/**
 * Single unified context object replacing multiple overlapping interfaces:
 * - RuntimeContextBinding (projectId/feishuChatId)
 * - RuntimeMinimalContext (environment/groupPolicy)
 * - PiMonoCreateRunRequest (split into SessionContext + execution params)
 * - ProjectContextBundle full (replaced by minimal SessionContext)
 */
export interface SessionContext {
  // Identity (for SDK calls + Feishu reply)
  projectId: string;
  feishuChatId: string;
  sessionId: string;

  // Execution config (for PiMono)
  environment: SessionEnvironment;

  // Business rules (for permission checks)
  groupPolicy: SessionGroupPolicy;

  // Runtime state (three-state enum)
  runtimeState: RuntimeState;
  waitingReason?: string;
  confirmationRequestId?: string;
}
```

**Step 2: Modify `src/modules/agent/agent.types.ts`**

Remove the following types:
- Line 34: `RuntimeQueueMode = 'steer' | 'followup' | 'collect' | 'interrupt' | 'steer_backlog'` — DELETE entire line
- Lines 36-50: `RuntimeEventType` enum — REPLACE with:

```typescript
export type RuntimeEventType =
  | 'message_submitted'     // Message entered system
  | 'turn_completed'        // Execution finished
  | 'confirmation_requested' // High-risk action pending
  | 'session_state_changed'; // State machine transition
```

- Lines 274-283: `RuntimeMinimalContext` interface — DELETE entirely
- Lines 285-290: `RuntimeContextBinding` interface — DELETE entirely
- Lines 299-322: `RuntimeStateSnapshot` interface — DELETE entirely

Keep all other types unchanged for now (they will be addressed in later plans).
</action>

<verification>
Run TypeScript compilation to verify no breaking changes from type removals (expect errors in files that import removed types — these will be fixed in subsequent plans):
```bash
npm run build 2>&1 | head -50
```
Expected: Compilation errors in pi-mono.adapter.ts and group-runtime.service.ts referencing removed types.
</verification>