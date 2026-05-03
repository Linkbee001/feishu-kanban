---
phase: rebuild-1
plan: 06
subsystem: agent
tags:
  - refactor
  - database
  - deprecated-table
dependencies:
  requires:
    - rebuild-1-04
    - rebuild-1-05
  provides:
    - removed-group-runtime-task-infrastructure
  affects:
    - agent.module
    - admin.service
    - dev.service
    - confirmation.service
    - artifact.service
    - project-runtime-context.service
    - pi-mono.adapter
tech-stack:
  added: []
  patterns:
    - state-managed-by-runtime-state-enum
    - task-tracking-in-memory-only
key-files:
  created: []
  modified:
    - prisma/schema.prisma
    - src/modules/agent/agent.module.ts
    - src/modules/agent/agent.types.ts
    - src/modules/agent/group-runtime.service.ts
    - src/modules/agent/pi-mono.adapter.ts
    - src/modules/agent/project-runtime-context.service.ts
    - src/modules/admin/admin.service.ts
    - src/modules/artifact/artifact.service.ts
    - src/modules/confirmation/confirmation.service.ts
    - src/modules/dev/dev.service.ts
  deleted:
    - src/modules/agent/group-runtime-task.service.ts
decisions:
  - retained-in-memory-task-tracking
metrics:
  duration: 15 minutes
  completed-date: 2026-05-03
---

# Phase rebuild-1 Plan 06: Remove GroupRuntimeTask Infrastructure Summary

**One-liner:** Removed GroupRuntimeTask DB table, service, and all relations - task state now managed by RuntimeState enum, in-memory tracking retained for PiMonoAdapter execution.

## Objective

Remove the GroupRuntimeTask table and service entirely. Task state is now represented by RuntimeState enum, and task metadata is stored in RuntimeEvent.payload.

## Changes Made

### Database Schema (prisma/schema.prisma)

- Removed `GroupRuntimeTask` model entirely (37 lines)
- Removed `GroupRuntimeTaskStatus` enum (8 values)
- Removed `runtimeTasks` relation from `Project` model
- Removed `runtimeTasks` relation from `ProjectEnvironment` model
- Removed `groupRuntimeTasks` relation from `MessageSource` model
- Removed `groupRuntimeTaskId` field and `groupRuntimeTask` relation from `AgentRun` model
- Removed `groupRuntimeTaskId` field and `groupRuntimeTask` relation from `Artifact` model
- Removed `groupRuntimeTaskId` field and `groupRuntimeTask` relation from `ConfirmationRequest` model
- Removed `currentRuntimeTaskId` field, `currentRuntimeTask` relation, and `runtimeTasks` relation from `GroupAgentSession` model

### Service Deletion

- **Deleted**: `src/modules/agent/group-runtime-task.service.ts` (279 lines)
  - Removed DB query methods: `listForSession`, `hasRunnableTask`, `applyAction`
  - Removed task transition methods: `createTask`, `updateTask`, `transitionTask`
  - Removed confirmation attachment methods: `attachConfirmation`, `releaseBlockedTask`

### Module Updates

- **agent.module.ts**: Removed `GroupRuntimeTaskService` from imports, providers, and exports

### Service Updates

- **admin.service.ts**:
  - Removed `collectTaskCounts` method that queried `groupRuntimeTask` table
  - Updated `listRobotInstances` and `getRobotInstance` to return empty task counts
  - Retained `emptyCounts` and `summarizeTasks` functions for in-memory task summarization

- **dev.service.ts**:
  - Removed `runtimeTasks` DB query
  - Removed `runtimeTasks` and `waitingRuntimeTasks` from counts
  - Removed `runtimeTasks` from return object

- **confirmation.service.ts**:
  - Removed `groupRuntimeTaskId` from create input type
  - Removed `groupRuntimeTaskId` handling from `confirm` method
  - Removed `groupRuntimeTaskId` handling from `reject` method

- **artifact.service.ts**:
  - Removed `groupRuntimeTaskId` from artifact creation data

- **project-runtime-context.service.ts**:
  - Removed `getRuntimeTasks` method
  - Removed `recentTasks` from assemble method
  - Removed `runtimeTasksSummary` from returned `ProjectContextBundle`

- **pi-mono.adapter.ts**:
  - Removed DB query for `groupRuntimeTask` in `hydrateRuntimeState`
  - Removed `groupRuntimeTaskId` from confirmation creation
  - Removed `groupRuntimeTaskId` from agentRun creation

- **group-runtime.service.ts**:
  - Removed `taskId` from confirmation payload in `resumeFromConfirmation`

### Type Updates

- **agent.types.ts**:
  - Removed `runtimeTasksSummary` field from `ProjectContextBundle` interface
  - Retained `GroupRuntimeTaskStatus` type and `GroupRuntimeTaskSnapshot` interface for in-memory runtime task tracking

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Extended scope beyond plan**

- **Found during:** Grep search for remaining references
- **Issue**: Plan listed files to modify but grep revealed additional files referencing the DB table: admin.service.ts, dev.service.ts, artifact.service.ts, confirmation.service.ts
- **Fix**: Extended scope to update all files referencing `groupRuntimeTask` or `GroupRuntimeTask` DB table
- **Files modified**: admin.service.ts, dev.service.ts, artifact.service.ts, confirmation.service.ts
- **Commit**: 8da5381

**2. [Rule 3 - Blocking Issue] Missing references in pi-mono.adapter.ts**

- **Found during:** Grep search
- **Issue**: pi-mono.adapter.ts had DB query for `groupRuntimeTask` for state hydration and `groupRuntimeTaskId` in confirmation/agentRun creation
- **Fix**: Removed DB query and field references, retained in-memory task tracking via `runtimeTaskSnapshots`
- **Files modified**: pi-mono.adapter.ts
- **Commit**: 8da5381

## Verification

- TypeScript compilation passed (npm run build)
- No remaining references to `GroupRuntimeTask` DB table in schema
- No remaining references to `GroupRuntimeTaskService` in source code
- In-memory `GroupRuntimeTaskSnapshot` type retained for PiMonoAdapter execution state management

## Key Decisions

### Retained in-memory task tracking

The `GroupRuntimeTaskSnapshot` interface and `GroupRuntimeTaskStatus` type are retained in `agent.types.ts` because they are used by `pi-mono.adapter.ts` for in-memory runtime task tracking during execution. This is distinct from the DB persistence layer that was removed.

The in-memory `runtimeTaskSnapshots` array in `SessionRuntimeState` is used to track tasks created via the `todo_write` tool during runtime execution. This state is ephemeral and not persisted to the database.

## Files Summary

| File | Change | Lines Changed |
|------|--------|---------------|
| prisma/schema.prisma | Removed model and relations | -60 |
| src/modules/agent/group-runtime-task.service.ts | Deleted entirely | -279 |
| src/modules/agent/agent.module.ts | Removed provider/export | -3 |
| src/modules/agent/agent.types.ts | Removed runtimeTasksSummary | -10 |
| src/modules/agent/group-runtime.service.ts | Removed taskId from payload | -1 |
| src/modules/agent/pi-mono.adapter.ts | Removed DB query and field refs | -44 |
| src/modules/agent/project-runtime-context.service.ts | Removed getRuntimeTasks | -64 |
| src/modules/admin/admin.service.ts | Removed task queries | -39 |
| src/modules/artifact/artifact.service.ts | Removed field | -1 |
| src/modules/confirmation/confirmation.service.ts | Removed task handling | -17 |
| src/modules/dev/dev.service.ts | Removed task queries | -9 |

**Total**: 11 files changed, 5 insertions(+), 522 deletions(-)

## Self-Check: PASSED

- Verified group-runtime-task.service.ts deleted
- Verified no GroupRuntimeTaskService references in source
- Verified no GroupRuntimeTask references in schema
- Build passes successfully
- Commit hash: 8da5381