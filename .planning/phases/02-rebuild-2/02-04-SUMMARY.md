---
phase: 02-rebuild-2
plan: 04
status: complete
completed: 2026-05-04
commit: aa9225b
---

# Summary: Remove Conversational Bootstrap

## Objective
Remove conversational bootstrap logic from FeishuEventService and add fixed response for uninitialized groups.

## Tasks Completed

| Task | Description | Status |
|------|-------------|--------|
| Task 1 | Replace handleUninitializedGroup with fixed response | ✓ Complete |
| Task 2 | Remove conversational bootstrap helper methods | ✓ Complete |

## Key Changes

### FeishuEventService (src/modules/feishu/feishu-event.service.ts)

**Removed (~260 lines):**
- `handleUninitializedGroup()` method (entire Pi SDK bootstrap flow)
- `collectProjectInitInfo()` - Pi SDK conversational extraction
- `syncSdkSessionState()` - Pi SDK session sync
- `buildProjectInitPrompt()` - Bootstrap prompt builder
- `parseProjectInitOutputs()` - Bootstrap output parser
- `fallbackProjectInitInfo()` - Regex fallback extraction
- `extractProjectDraftFromText()` - Regex extraction helpers
- `mergeProjectDraft()` - Draft state merging
- `composeInitReply()` - Bootstrap reply composition
- `ProjectInitDraft` type definition
- `ProjectInitAssistantResponse` type definition

**Added:**
- `handlePendingConfigGroup()` - Fixed response pattern:
  - Creates session with `pending_config` mode
  - Returns fixed message: "本群未完成项目配置，请先在后台完成初始化。配置地址：/api/group-config/{chatId}"
  - Handles legacy `bootstrap` mode gracefully with migration notice
- `GroupSessionMode` import from Prisma

## Behavior Change

**Before:**
- Uninitialized group @mention triggers Pi SDK conversational flow
- Pi SDK collects project name, description, repo, branch, model
- Multiple conversation rounds before initialization
- Creates 7 skeleton documents

**After:**
- Uninitialized group @mention returns fixed message immediately
- No Pi SDK calls for uninitialized groups
- User must call `/api/group-config/:chatId/complete` endpoint
- Single PROJECT-CONFIG.md replaces 7 skeleton docs

## Verification

```bash
npx tsc --noEmit  # ✓ Source compiles
```

## Deviations
None. All tasks executed as planned.

## Next Wave
Wave 5 (Plan 02-05) will simplify initFromChat by removing createWorkspaceSkeleton method.