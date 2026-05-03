---
plan: 01-rebuild-1-04
phase: rebuild-1
wave: 4
status: completed
completed_at: 2026-05-03
---

# Summary: Simplify GroupRuntimeService

## What Was Built

Simplified GroupRuntimeService to use steer/followUp methods instead of complex submitMessage/resumeSession calls with RuntimeSubmitMessageInput/RuntimeResumeInput.

### 1. pi-mono.adapter.ts

- **Added steer() method** - Simplified message submission with minimal parameters
- **Added followUp() method** - Simplified session resumption after confirmations
- Both methods accept optional roleProfile parameter
- Both methods look up project/environment from database using projectId/environmentId
- Methods use minimal default role profile if not provided

### 2. group-runtime.service.ts

- **Removed imports** for GroupRuntimeTaskService, ProjectRuntimeContextService
- **Added imports** for SessionStateService, RoleProfileService (re-added)
- **Removed runtimeTasks dependency** from constructor
- **Refactored handleMentionMessage**:
  - Uses steer() instead of submitMessage()
  - Compiles roleProfile and passes to steer
  - Uses SessionStateService for state transitions
  - Removed complex RuntimeSubmitMessageInput construction
- **Refactored resumeFromConfirmation**:
  - Uses followUp() instead of resumeSession()
  - Compiles roleProfile and passes to followUp
  - Uses SessionStateService.clearWaiting() for state transition
  - Removed complex RuntimeResumeInput construction
- **Updated getSessionSnapshot**:
  - Returns empty tasks array (GroupRuntimeTask deprecated)
  - Returns null profile (moved to session context)

## Key Decisions

1. **steer/followUp methods in PiMonoAdapter** - Centralized lookup of project/environment, reducing complexity in GroupRuntimeService
2. **Optional roleProfile parameter** - Allows flexibility; uses minimal default if not provided
3. **SessionStateService for state transitions** - Centralized state management instead of runtimeTasks
4. **Backward compatibility** - getSessionSnapshot returns empty tasks/null profile to avoid breaking consumers

## Files Modified

| File | Action | Lines Changed |
|------|--------|---------------|
| src/modules/agent/pi-mono.adapter.ts | Added steer/followUp | ~150 lines added |
| src/modules/agent/group-runtime.service.ts | Simplified | ~268 lines removed |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] steer/followUp methods not available**
- **Found during:** Task implementation
- **Issue:** Plan expected steer/followUp methods on PiMonoAdapter, but they didn't exist
- **Fix:** Added steer() and followUp() methods to PiMonoAdapter that accept minimal parameters and look up rest from database
- **Files modified:** pi-mono.adapter.ts
- **Commit:** 1ed029b

**2. [Rule 3 - Blocking] CompiledRoleProfile mismatch**
- **Found during:** TypeScript compilation
- **Issue:** Helper compileRoleProfile returned wrong type structure
- **Fix:** Made roleProfile an optional parameter in steer/followUp, let GroupRuntimeService compile it using RoleProfileService
- **Files modified:** pi-mono.adapter.ts, group-runtime.service.ts
- **Commit:** 1ed029b

**3. [Rule 3 - Blocking] getSessionSnapshot consumers**
- **Found during:** TypeScript compilation
- **Issue:** admin.service.ts and group-runtime.controller.ts expected tasks/profile from getSessionSnapshot
- **Fix:** Return empty tasks array and null profile for backward compatibility
- **Files modified:** group-runtime.service.ts
- **Commit:** 1ed029b

## Verification Results

TypeScript compilation passes with 0 errors:
```
$ npm run build
(Bash completed with no output)
```

No references to removed code:
```
$ grep -n "resolveQueueMode|RuntimeQueueMode|runtimeTasks|GroupRuntimeTaskService" src/modules/agent/group-runtime.service.ts
(No matches)
```

## Remaining Work

Plan 04 is complete. The following plans will address:
- Plan 05: Simplify GroupAgentSessionService
- Plan 06: Update event handlers
- Plan 07: Final verification

## Self-Check: COMPLETED

- [x] Removed GroupRuntimeTaskService import
- [x] Removed runtimeTasks usage
- [x] Added steer/followUp methods to PiMonoAdapter
- [x] Refactored handleMentionMessage to use steer
- [x] Refactored resumeFromConfirmation to use followUp
- [x] Added SessionStateService injection
- [x] Compilation passes
- [x] No references to removed code