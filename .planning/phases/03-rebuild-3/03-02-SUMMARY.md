---
phase: 03-rebuild-3
plan: 02
type: execute
wave: 1
depends_on: [03-01]
tags:
  - refactoring
  - service-decomposition
  - prompt-building
  - pure-functions
  - tdd
requirements:
  - REQ-01
  - REQ-03
  - REQ-05
metrics:
  duration_minutes: 15
  tasks_completed: 2
  files_created: 2
  files_modified: 1
  tests_added: 26
completed_at: 2026-05-06T12:30:00Z
key-files:
  created:
    - src/modules/agent/pi-prompt-builder.service.ts
    - test/pi-prompt-builder.service.spec.ts
  modified:
    - src/modules/agent/agent.module.ts
---

# Phase 03 Plan 02: PiPromptBuilder Extraction Summary

## One-liner

Extracted PiPromptBuilder as a pure function service for prompt assembly, following TDD approach with 26 unit tests verifying prompt content matches existing behavior.

## Objective Achieved

Established pure function extraction pattern before tackling stateful services. PiPromptBuilder has clear input/output contracts with no dependencies beyond ConfigService. All prompt building methods extracted from pi-mono.adapter.ts (lines 1793-2022) and verified to produce identical prompt content.

## Key Decisions

1. **TDD approach for pure function extraction** - Followed RED/GREEN cycle: wrote failing tests first (RED), then implemented methods to pass (GREEN), ensuring behavioral correctness from the start.

2. **Pure function service pattern** - PiPromptBuilder is stateless, taking PiMonoCreateRunRequest input and returning prompt string output. ConfigService dependency injected for future configuration needs but not currently used in prompt building.

3. **Direct method extraction** - Copied implementation directly from pi-mono.adapter.ts without modification to ensure exact behavior preservation. Helper methods kept private as they are internal to prompt assembly.

## Implementation Details

### Task 1: PiPromptBuilder Service (TDD)

Created `src/modules/agent/pi-prompt-builder.service.ts`:

**RED Phase:**
- Created test file with 26 failing tests covering all prompt building scenarios
- Tests for buildPrompt method across all request kinds (formal_execution, interactive_decision, group_runtime)
- Tests for each helper method with expected output verification

**GREEN Phase:**
- Implemented buildPrompt(payload: PiMonoCreateRunRequest): string (lines 1793-1899 of adapter)
- Implemented buildExecutionBiasLines(requestKind): string[] (lines 1902-1933)
- Implemented buildToolingLines(payload, groupRuntimeMode): string[] (lines 1935-1946)
- Implemented buildRuntimePolicyLines(payload, requestKind, repoCapabilityState): string[] (lines 1949-1983)
- Implemented describeRepoCapabilityState(payload): string (lines 1985-1996)
- Implemented describeRecentDocs(payload): string (lines 1998-2006)
- Implemented describeTaskBoardSummary(payload): string (lines 2008-2014)
- Implemented describeRecentArtifacts(payload): string (lines 2016-2022)

**Test Coverage:** 26 tests in `test/pi-prompt-builder.service.spec.ts`

### Task 2: Module Registration

Updated `src/modules/agent/agent.module.ts`:
- Added PiPromptBuilder import
- Added PiPromptBuilder to providers array
- Added PiPromptBuilder to exports array
- Verified registration with grep (3 occurrences: import + providers + exports)

## Deviations from Plan

None - plan executed exactly as written. Prompt output matches existing pi-mono.adapter behavior precisely.

## Pre-existing Issues (Out of Scope)

**pi-mono.adapter.spec.ts failures** (from Plan 01):
- 3 tests fail: "captures group runtime actions", "salvages captured runtime actions", "starts a runtime turn"
- These failures existed BEFORE this plan's changes
- Not caused by PiPromptBuilder extraction
- Deferred for future fix

## Files Created

| File | Purpose | Lines |
|------|---------|-------|
| `src/modules/agent/pi-prompt-builder.service.ts` | Pure function service for prompt assembly | ~330 |
| `test/pi-prompt-builder.service.spec.ts` | Unit tests for PiPromptBuilder | ~280 |

## Files Modified

| File | Change |
|------|--------|
| `src/modules/agent/agent.module.ts` | Added PiPromptBuilder to providers and exports |

## Commit History

| Commit | Message |
|--------|---------|
| `952c47d` | feat(03-02): create PiPromptBuilder service for prompt assembly |
| `5d17842` | feat(03-02): register PiPromptBuilder in agent.module.ts |

## Test Results

```
Test Suites: 1 passed (pi-prompt-builder.service)
Tests:       26 passed
Total duration: ~10 seconds
```

## Success Criteria Verification

- [x] pi-prompt-builder.service.ts exists with buildPrompt method
- [x] buildPrompt output matches existing pi-mono.adapter prompt content
- [x] Unit tests for PiPromptBuilder pass (26 tests)
- [x] PiPromptBuilder registered in agent.module.ts providers and exports
- [x] TypeScript build succeeds
- [x] Existing pi-mono.adapter.spec.ts tests have 3 pre-existing failures (documented in Plan 01, not caused by this extraction)

## Next Steps

This plan establishes the pure function extraction pattern for subsequent extractions:
- Plan 03: PiOutputProcessor (pure functions for output processing)
- Plan 04: PiExecutor (depends on PiSessionManager, PiPromptBuilder, PiOutputProcessor)
- Plan 05: PiEventRecorder (database operations)
- Plan 06: PiToolRegistry (largest extraction, depends on most services)

## Threat Surface

No new security-relevant surface introduced beyond existing prompt assembly patterns documented in threat_model. Payload input is trusted from internal services, no user PII in prompts.

## Self-Check: PASSED

- All 2 created files verified on disk
- All 2 commits verified in git history (952c47d, 5d17842)
- Test suite passes: pi-prompt-builder.service (26 tests)
- Module registration verified: PiPromptBuilder appears 3 times in agent.module.ts

---
*Plan: 03-02*
*Phase: rebuild-3*
*Completed: 2026-05-06*