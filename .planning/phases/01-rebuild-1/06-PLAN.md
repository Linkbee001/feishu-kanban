---
wave: 5
depends_on:
  - 04
  - 05
files_modified:
  - src/modules/agent/group-runtime-task.service.ts
  - src/modules/agent/agent.module.ts
  - prisma/schema.prisma
requirements_addressed:
  - D-03
autonomous: true
---

# Plan 06: Remove GroupRuntimeTask Infrastructure

<objective>
Remove the GroupRuntimeTask table and service entirely. Task state is now represented by RuntimeState enum, and task metadata is stored in RuntimeEvent.payload.
</objective>

<read_first>
- src/modules/agent/group-runtime-task.service.ts — Service to be removed
- prisma/schema.prisma — GroupRuntimeTask model definition (lines 368-404)
- .planning/phases/01-rebuild-1/01-CONTEXT.md — GroupRuntimeTask removal decision
</read_first>

<acceptance_criteria>
- src/modules/agent/group-runtime-task.service.ts deleted entirely
- src/modules/agent/agent.module.ts modified:
  - GroupRuntimeTaskService removed from providers and exports
  - No imports referencing GroupRuntimeTaskService
- prisma/schema.prisma modified:
  - `GroupRuntimeTask` model removed entirely
  - `GroupRuntimeTaskStatus` enum removed
  - References to GroupRuntimeTask from other models updated:
    - GroupAgentSession.currentRuntimeTaskId field removed
    - GroupAgentSession.currentRuntimeTask relation removed
    - GroupAgentSession.runtimeTasks relation removed
    - ConfirmationRequest.groupRuntimeTaskId field removed (or kept as optional legacy)
    - AgentRun.runtimeTask relation removed
    - Artifact.runtimeTask relation removed
- All files that imported GroupRuntimeTaskService updated to remove imports
- TypeScript compilation passes with no errors
</acceptance_criteria>

<action>
**Step 1: Delete GroupRuntimeTaskService**

```bash
rm src/modules/agent/group-runtime-task.service.ts
```

**Step 2: Remove from agent.module.ts**

Remove import and provider:
```typescript
// Remove this import
import { GroupRuntimeTaskService } from './group-runtime-task.service';

// Remove from providers array
providers: [
  // ... remove GroupRuntimeTaskService
],
```

**Step 3: Update prisma/schema.prisma**

Remove the GroupRuntimeTask model (lines 368-404):

```prisma
// DELETE entire model:
model GroupRuntimeTask {
  id                    String                 @id @default(uuid()) @db.Uuid
  // ... all fields
  @@map("group_runtime_tasks")
}
```

Remove the GroupRuntimeTaskStatus enum:

```prisma
// DELETE enum:
enum GroupRuntimeTaskStatus {
  queued
  running
  blocked
  waiting_confirmation
  completed
  failed
  canceled
}
```

Update GroupAgentSession model:

```prisma
model GroupAgentSession {
  // ... existing fields
  
  // REMOVE these fields:
  currentRuntimeTaskId String?           @unique @map("current_runtime_task_id") @db.Uuid  // DELETE
  currentRuntimeTask  GroupRuntimeTask?  @relation("CurrentRuntimeTask", ...)              // DELETE
  runtimeTasks        GroupRuntimeTask[]                                                   // DELETE
  
  // Keep all other fields
}
```

Update ConfirmationRequest model (if it references GroupRuntimeTask):

```prisma
model ConfirmationRequest {
  // ... existing fields
  
  // Option A: Remove field entirely
  // groupRuntimeTaskId String? @map("group_runtime_task_id") @db.Uuid  // DELETE
  
  // Option B: Keep as nullable legacy field (safer for existing data)
  // groupRuntimeTaskId String? @map("group_runtime_task_id") @db.Uuid  // Keep but remove relation
}
```

Update AgentRun and Artifact models to remove runtimeTask relations.

**Step 4: Update all files importing GroupRuntimeTaskService**

Search for and remove imports:
```bash
grep -r "GroupRuntimeTaskService" src/ --include="*.ts"
```

For each file found, remove:
- Import statement for GroupRuntimeTaskService
- Constructor injection of GroupRuntimeTaskService
- Any method calls to runtimeTasks service

**Step 5: Update GroupAgentSessionService**

Remove runtimeTasks array handling:
- In `getOrCreateSession`, remove any runtimeTasks initialization
- Remove any methods that list or manage runtime tasks

**Step 6: Update GroupRuntimeService**

Already handled in Plan 04, but verify:
- No references to GroupRuntimeTaskService
- No calls to `this.runtimeTasks.*`
</action>

<verification>
1. TypeScript compilation passes:
```bash
npm run build
```

2. Verify GroupRuntimeTaskService is removed:
```bash
test -f src/modules/agent/group-runtime-task.service.ts && echo "FAIL: file still exists" || echo "PASS: file removed"
```

3. Verify no imports remain:
```bash
grep -r "GroupRuntimeTaskService\|GroupRuntimeTask" src/ --include="*.ts" || echo "PASS: no references"
```
</verification>