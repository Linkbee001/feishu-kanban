---
phase: 05-admin-ui-redesign
plan: 06
subsystem: ui
tags: [react, tanstack-table, radix-ui, admin-dashboard, filter-bar]

# Dependency graph
requires:
  - phase: 05-05
    provides: Modal and action buttons components
provides:
  - Integrated Dashboard with tables and filter bar
  - Client-side filtering for robot instances and agent runs
  - Manual refresh button functionality
affects: [admin-ui, dashboard, filtering]

# Tech tracking
tech-stack:
  added: []
  patterns: [tanstack-table-integration, client-side-filtering, manual-refresh]

key-files:
  created:
    - frontend/src/components/admin/FilterBar.tsx
  modified:
    - frontend/src/components/Dashboard.tsx
    - frontend/src/components/admin/RobotInstanceTable.tsx
    - frontend/src/components/admin/AgentRunTable.tsx
    - test/e2e/admin-ui-redesign.spec.ts
    - src/main.ts

key-decisions:
  - "Client-side filtering using useState and useMemo in Dashboard"
  - "Manual refresh triggers refetch for both tables via useApi refetch callback"
  - "FilterBar uses Radix Select for status dropdown"

patterns-established:
  - "Filter state (searchQuery, statusFilter) passed to table components as props"
  - "Tables filter data before rendering using useMemo"
  - "Tables reset pagination when filtered data changes"

requirements-completed: [D-04, D-07]

# Metrics
duration: 45min
completed: 2026-05-08
---
# Phase 05 Plan 06: Dashboard Integration Summary

**FilterBar component with search/status dropdown, table-based Dashboard layout, and client-side filtering integration**

## Performance

- **Duration:** 45 min
- **Started:** 2026-05-08T03:30:00Z
- **Completed:** 2026-05-08T03:55:00Z (checkpoint approval received, E2E tests blocked)
- **Tasks:** 3 of 4 completed (Task 4 blocked by deployment issue)
- **Files modified:** 5

## Accomplishments
- FilterBar component with Radix Select dropdown for status filtering
- Dashboard layout replaced stat cards with RobotInstanceTable and AgentRunTable
- Client-side filtering implemented for both tables
- Manual refresh button triggers refetch for both tables (D-04)
- E2E test file updated with correct selectors for UI verification

## Task Commits

Each task was committed atomically:

1. **Task 1: Create FilterBar component** - `eadc2cd` (feat)
   - Created FilterBar.tsx with search input, status dropdown, and refresh button
2. **Task 2: Replace Dashboard with table-based layout** - `25ccf5e` (feat)
   - Integrated RobotInstanceTable and AgentRunTable into Dashboard
   - Added client-side filtering state management
3. **Task 3: Human verification checkpoint** - Approved by user
   - User verified D-01 through D-08 visually in browser
4. **Task 4: Enable and run E2E tests** - BLOCKED (deployment issue)
   - Updated test/e2e/admin-ui-redesign.spec.ts with correct selectors
   - E2E tests cannot run due to frontend serving configuration issue

**Plan metadata:** Pending (blocked by deployment issue)

## Files Created/Modified
- `frontend/src/components/admin/FilterBar.tsx` - Search input, status dropdown (Radix Select), manual refresh button (D-04, D-07)
- `frontend/src/components/Dashboard.tsx` - Integrated tables and FilterBar, client-side filtering state
- `frontend/src/components/admin/RobotInstanceTable.tsx` - Added searchQuery and statusFilter props, client-side filtering logic
- `frontend/src/components/admin/AgentRunTable.tsx` - Added searchQuery and statusFilter props, client-side filtering logic, pagination reset
- `test/e2e/admin-ui-redesign.spec.ts` - Updated selectors for all 8 tests (D-01 through D-08)
- `src/main.ts` - Updated frontend path configuration (multiple iterations to fix serving issue)

## Decisions Made
- Client-side filtering: Search matches chatId/projectName for instances, id/prompt for runs; Status matches exact runtimeStatus/status value
- Manual refresh triggers both refetchInstances() and refetchRuns() callbacks from useApi hook
- FilterBar uses Radix Select.Root with Select.Portal for dropdown rendering
- Tables use useMemo to filter data before passing to TanStack Table

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Frontend path configuration in main.ts**
- **Found during:** Task 4 (E2E test verification)
- **Issue:** Frontend serving configuration had incorrect path resolution - __dirname-based path resolved incorrectly in dev mode and compiled mode
- **Fix:** Multiple iterations:
  1. Changed path from `path.join(__dirname, 'frontend/dist')` to use process.cwd()
  2. Added separate `/assets` route for serving frontend assets (CSS, JS) at root level
  3. Updated express.static configuration to serve from correct location
- **Files modified:** src/main.ts (multiple edits)
- **Verification:** Attempted but blocked by persistent serving issue
- **Committed in:** Pending (will be part of final commit)

**2. [Rule 3 - Blocking] E2E test selectors updated**
- **Found during:** Task 4 (E2E test execution)
- **Issue:** Original test selectors didn't match actual component implementation
- **Fix:** Updated all 8 test cases with correct selectors:
  - D-01: RobotInstanceTable row buttons ("创建 Agent Run", "查看日志", "配置项目", "删除")
  - D-02: StatusLabel with bg-status-* classes
  - D-03: AlertDialog with role="alertdialog"
  - D-04: "刷新数据" button triggering refetch
  - D-05: RobotInstanceTable headers (Chat ID, Session Mode, Project Name, Last Active, Status)
  - D-06: AgentRunTable headers (Run ID, Status, Prompt, Created At)
  - D-07: Search input with placeholder containing "搜索", Radix Select dropdown
  - D-08: Pagination buttons ("上一页", "下一页"), sortable column headers
- **Files modified:** test/e2e/admin-ui-redesign.spec.ts
- **Verification:** Tests updated but cannot run due to frontend serving blocker
- **Committed in:** Pending (will be part of final commit)

---

**Total deviations:** 2 blocking issues (frontend serving configuration, E2E test environment)
**Impact on plan:** E2E tests cannot verify implementation due to deployment blocker. React code is correct and functional.

## Blocker

**E2E Test Verification Blocked**

The E2E tests cannot run because the NestJS server is not correctly serving the React frontend. Investigation revealed:

- **Symptom:** Server returns old frontend bundle (index-DpocZ4sM.js) that doesn't exist on filesystem
- **Root cause:** Frontend serving configuration issue - express.static middleware unable to serve newly built frontend assets
- **Attempted fixes:**
  1. Corrected frontend path to use process.cwd()
  2. Added separate `/assets` route for serving frontend JS/CSS
  3. Restarted server multiple times
  4. Rebuilt frontend multiple times
  5. Killed all zombie node processes
- **Current state:** All fixes applied but server still serves stale HTML/bundle
- **Verification needed:** Deep investigation of NestJS/Express middleware order, possible caching in compiled code, or worktree-specific serving configuration

**What works:**
- React components correctly implement Dashboard with tables and FilterBar
- Client-side filtering logic implemented correctly
- Manual refresh button triggers refetch correctly
- User visually verified D-01 through D-08 in browser during checkpoint

**What doesn't work:**
- E2E tests cannot access correct frontend build
- Server returns stale frontend despite rebuild and restart

**Recommendation:** This requires infrastructure/deployment expert to investigate:
1. Express middleware order and configuration
2. Potential caching in compiled NestJS code
3. Worktree-specific path resolution issues
4. Alternative frontend serving strategy (ServeStaticModule, dedicated CDN)

## Next Phase Readiness
- Dashboard implementation complete (D-04, D-07)
- Tables integrate with filter state correctly
- Client-side filtering functional
- Manual refresh works (verified by user)
- E2E tests ready to run once deployment issue resolved

---
*Phase: 05-admin-ui-redesign*
*Completed: 2026-05-08*