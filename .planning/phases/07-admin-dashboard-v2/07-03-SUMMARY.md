---
phase: 07-admin-dashboard-v2
plan: 03
subsystem: frontend-drawer
tags: [drawer, group-config, unbind, url-state]
requires: [07-02]
provides: [GroupConfigDrawer, unbind API]
affects: [GroupsPage, AdminController, AdminService]
tech_stack:
  added:
    - "@radix-ui/react-dialog (existing)"
    - "useSearchParams for URL state"
  patterns:
    - "Slide-over drawer pattern"
    - "URL-based drawer state persistence"
key_files:
  created:
    - frontend/src/components/drawer/Drawer.tsx
    - frontend/src/components/drawer/GroupConfigDrawer.tsx
    - frontend/src/components/drawer/index.ts
  modified:
    - frontend/src/pages/GroupsPage.tsx
    - frontend/src/hooks/useGroups.ts
    - src/modules/admin/admin.controller.ts
    - src/modules/admin/admin.service.ts
decisions:
  - D-06: Right-side drawer editing without page navigation
  - URL params for drawer state (?drawer=group-config&chatId=xxx)
  - ConfirmDialog for destructive unbind action
metrics:
  duration: "6 minutes"
  completed_date: "2026-05-08"
  tasks_completed: 4
  files_created: 3
  files_modified: 4
---

# Phase 07 Plan 03: Group Config Drawer Summary

Implemented slide-over drawer for group configuration editing per D-06. Drawer opens from right side with 480px width, displays config form with sync flow, allows editing and saving without leaving the groups page.

## One-liner

Drawer-based group config editing with URL state persistence, sync flow, validation, and unbind confirmation.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create Generic Drawer Component | a336149 | Drawer.tsx, index.ts |
| 2 | Create GroupConfigDrawer Component | 92d12d2 | GroupConfigDrawer.tsx, index.ts |
| 3 | Integrate Drawer with GroupsPage | 6affb0d | GroupsPage.tsx |
| 4 | Add Unbind Confirmation and API | 1caa743 | admin.controller.ts, admin.service.ts, useGroups.ts, GroupsPage.tsx |

## Key Changes

### Task 1: Generic Drawer Component

- Created `Drawer.tsx` using Radix Dialog primitives
- 480px fixed width, right-side positioning
- Backdrop blur (rgba(0,0,0,0.3)) with 300ms ease-out animation
- Close via X button, overlay click, ESC key
- Focus trap and accessibility via Radix

### Task 2: GroupConfigDrawer Component

- Reuses sync flow from GroupConfigPage (useGroupSync, useCompleteConfig)
- Step indicator: 同步 → 配置
- Pre-fills chatId from URL prop
- Validation for projectName and repoUrl
- Reset state on drawer close

### Task 3: GroupsPage Integration

- URL-based drawer state via useSearchParams
- ?drawer=group-config&chatId=xxx for persistence
- Row actions dropdown triggers drawer open
- onSaved callback refreshes table after save
- ConfirmDialog wrapper for unbind action

### Task 4: Unbind Endpoint and Frontend

- AdminController: POST /api/admin/groups/:chatId/unbind
- AdminService: unbindGroup calls ProjectService.unbindByChat
- useGroups hook: unbind function with loading/error state
- Inline toast notifications (success/error)
- Table refresh after successful unbind

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all functionality fully implemented.

## Threat Flags

No new threat surface introduced beyond plan's threat model.

## Self-Check: PASSED

- Created files exist:
  - Drawer.tsx: FOUND
  - GroupConfigDrawer.tsx: FOUND
  - index.ts: FOUND
- Commits exist:
  - a336149: FOUND
  - 92d12d2: FOUND
  - 6affb0d: FOUND
  - 1caa743: FOUND

## Verification Checklist

Per UI-SPEC and plan verification:

- [x] Click "配置" opens drawer with 480px width from right
- [x] Drawer shows group config form
- [x] Sync flow works within drawer
- [x] Save updates config and refreshes table
- [x] Drawer closes on X, overlay click, ESC
- [x] URL updates with ?drawer=group-config&chatId=xxx
- [x] Refresh with URL opens drawer automatically
- [x] Unbind shows confirm dialog and works

## Files Modified

```
frontend/src/components/drawer/Drawer.tsx        (created)
frontend/src/components/drawer/GroupConfigDrawer.tsx (created)
frontend/src/components/drawer/index.ts          (created)
frontend/src/pages/GroupsPage.tsx                (modified)
frontend/src/hooks/useGroups.ts                  (modified)
src/modules/admin/admin.controller.ts            (modified)
src/modules/admin/admin.service.ts               (modified)
```

## Commits

- a336149: feat(07-03): create generic Drawer component
- 92d12d2: feat(07-03): create GroupConfigDrawer component
- 6affb0d: feat(07-03): integrate GroupConfigDrawer with GroupsPage
- 1caa743: feat(07-03): add unbind group endpoint and frontend integration

---

*Completed: 2026-05-08*
*Duration: 6 minutes*