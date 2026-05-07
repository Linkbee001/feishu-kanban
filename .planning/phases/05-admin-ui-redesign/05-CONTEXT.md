# Phase 05: Admin UI Redesign - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning

<domain>
## Phase Boundary

**Deliverable:** A usable Admin Dashboard UI for managing Feishu robot instances and agent runs.

**Scope anchor:** Replace the current unusable dashboard with a table-based management interface that supports core operations: view robot instances, create/monitor agent runs, and refresh runtime state.

**Current problem:** Dashboard at http://localhost:3000/admin displays only static text without any interactive UI, buttons, or data tables — completely unusable per user feedback.

</domain>

<decisions>
## Implementation Decisions

### Interaction Flow & Operations
- **D-01:** Each row displays action buttons on the right side — common table management pattern (similar to GitHub Issues)
  - Buttons per row: 创建 Agent Run, 查看日志, 配置项目
- **D-02:** Status displayed as colored labels with text (not simple icons or progress animations)
  - Color mapping: queued=灰色, running=蓝色(可带动画), syncing=橙色, succeeded=绿色, failed=红色
- **D-03:** Dangerous operations (delete Project, cancel Agent Run) require Modal confirmation popup
  - Prevents accidental destructive actions
- **D-04:** Manual refresh button in header (not auto WebSocket push or polling)
  - User explicitly chose manual control over real-time updates
  - Refresh button visible in page header area

### Data Display & Refresh
- **D-05:** Robot Instance table columns (multi-select):
  - Chat ID (飞书群 ID for identification)
  - Session Mode (bootstrap/pending_config/active — shows state)
  - Project Name (bound project name — main content managed)
  - Last Active (last activity timestamp — judge if robot still running)
- **D-06:** Agent Run table columns (multi-select):
  - Run ID (unique identifier for detail view/operations)
  - Status (colored label: queued/running/syncing/succeeded/failed)
  - Prompt (trigger content — shows user intent)
  - Created At (creation time for sorting/tracking)
- **D-07:** Top filter bar for search and filtering
  - Search box + status dropdown filter in header area
  - Layout: clear, visible, easy to use
- **D-08:** Traditional pagination with column header sorting
  - Pagination controls at bottom
  - Click column headers to sort (not infinite scroll)

### Claude's Discretion
None — user made explicit choices for all discussed areas.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Architecture
- `src/main.ts` — NestJS static file serving configuration for /admin route
- `frontend/src/index.css` — TailwindCSS custom color definitions (primary, warning, danger, panel, ink, muted)
- `test/e2e/setup/e2e-test.module.ts` — E2E testing mock setup pattern

### API Endpoints (Verified Working)
- `/api/admin/robot-instances` — Returns robot instance data
- `/api/admin/robot-instances/:chatId/logs` — Returns message logs
- `/api/admin/robot-instances/:chatId/runtime` — Returns runtime state
- `/api/agent-runs` — POST creates agent run (requires projectId + environmentId)
- `/api/agent-runs/:id` — GET retrieves agent run status

No external specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **TailwindCSS color system:** Already defined in `frontend/src/index.css`
  - `.bg-primary`, `.text-primary`, `.border-primary` utility classes
  - Colors: primary=#1d6b57 (green), warning=#aa5a22 (orange), danger=#9a2f2f (red), panel=#f5efe6 (cream), ink=#17212a (dark), muted=#6b7780 (gray)
  - Status label colors can reuse these or add semantic variants (e.g., `.bg-status-running`)
- **NestJS static serving:** `src/main.ts` already configured `/admin` route for SPA
  - `app.use('/admin', express.static(frontendPath))`
  - SPA fallback configured for `/admin/*` routes
- **E2E mock pattern:** `test/e2e/setup/e2e-test.module.ts` shows how to mock FeishuService

### Established Patterns
- **Backend:** NestJS + Prisma + PostgreSQL (already stable from prior phases)
- **Frontend:** React 19 + TailwindCSS 4 embedded in NestJS build
- **Testing:** Jest E2E tests with Supertest (pattern in `test/e2e/*.e2e-spec.ts`)

### Integration Points
- **Frontend fetches data from:** `/api/admin/*` endpoints (already working, verified in E2E tests)
- **Frontend embeds in:** NestJS static assets at `/admin` route
- **Build process:** Frontend compiled to `src/frontend/dist`, served by NestJS

</code_context>

<specifics>
## Specific Ideas

- **Table-based layout** (not cards or timeline) — matches user's expectation for management dashboard
- **Manual refresh** preferred — user explicitly rejected auto-push, wants control over when data updates
- **Per-row action buttons** — immediate access to operations without navigation overhead
- **Colored status labels with text** — must include text label, not just color dots

</specifics>

<deferred>
## Deferred Ideas

User rejected additional discussion on:
- **Error handling & notification** — "简化处理就好" (keep it simple)
- **Page navigation structure** — deferred to implementation phase
- **Responsive design** — deferred, desktop-first assumed

None of these were folded into scope — user wants minimal complexity for this phase.

</deferred>

---

*Phase: 05-admin-ui-redesign*
*Context gathered: 2026-05-07*