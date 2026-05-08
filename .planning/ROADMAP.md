# Project Roadmap

**Project:** feishu-kanban
**Status:** Complete — Phase 07 Admin Dashboard V2 (2026-05-09)
**Last Updated:** 2026-05-09

---

## Milestones

- ✅ **v1.0.0 — Rebuild** — Phases rebuild-1, rebuild-2 (shipped 2026-05-04) — [Archive](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1.0 — Architecture Refactor** — Phase rebuild-3 (complete 2026-05-06)
- ✅ **v1.2.0 — E2E Verification + Admin Dashboard** — Phase 04-e2e-verification (complete 2026-05-06)
- ✅ **v1.3.0 — Admin UI Redesign** — Phase 05-admin-ui-redesign (complete 2026-05-08)
- ✅ **v1.4.0 — Group Config UI** — Phase 06-group-config (complete 2026-05-08)
- ✅ **v1.5.0 — Admin Dashboard V2** — Phase 07-admin-dashboard-v2 (complete 2026-05-09)

---

## Current Phase

### Phase 07: Admin Dashboard V2 - Complete Admin Interface with Multi-level Navigation

**Goal:** 重构管理后台，基于 shadcn-admin 模板，实现群管理、会话监控、消息记录、运行日志等功能的完整管理界面。

**Requirements:** [D-01, D-02, D-03, D-04, D-05, D-06]

**Context:** [.planning/phases/07-admin-dashboard-v2/07-CONTEXT.md](phases/07-admin-dashboard-v2/07-CONTEXT.md)

**Status:** Complete ✓ (2026-05-09)

**Progress:**
- [x] Context gathered
- [x] Research complete
- [x] Planning complete
- [x] Execution (6 plans, 4 waves)
- [x] Build verified

**Plans:** 6/6 plans complete

**Wave Structure:**
- Wave 1: 07-01 (Sidebar + Routes + Page Stubs) ✓
- Wave 2: 07-02 (Groups Data Table) ✓
- Wave 3: 07-03 (Drawer for Group Config) ✓
- Wave 4: 07-04 (Messages Page) + 07-05 (Runs Page) — parallel ✓
- Wave 6: 07-06 (Dashboard + Settings + Polish) ✓

**Key Features Built:**
- Multi-level sidebar navigation with Groups submenu
- Groups page with TanStack Table + Drawer config editing
- Messages page with chat-style thread + filters
- Runs page with Terminal-style log viewer + auto-scroll
- Dashboard with stats cards + activity feed + quick actions
- Settings page with form persistence
- Mobile responsive layout with hamburger menu
- EmptyState component for consistent UX

---

## Completed Phases

### Phase 05: Admin UI Redesign - Replace unusable dashboard with table-based management interface ✓

**Goal:** Working table-based Admin Dashboard UI for managing Feishu robot instances and agent runs with per-row action buttons, colored status labels, confirmation dialogs, manual refresh, filter bar, and pagination.

**Requirements:** [D-01, D-02, D-03, D-04, D-05, D-06, D-07, D-08]

**Context:** [.planning/phases/05-admin-ui-redesign/05-CONTEXT.md](phases/05-admin-ui-redesign/05-CONTEXT.md)

**Status:** Complete ✓ (2026-05-08)

**Progress:**
- [x] Context gathered
- [x] Research complete
- [x] Planning complete
- [x] Execution
- [x] Verification
- [x] UAT (checkpoint approved)

**Plans:** 6/6 plans complete

Plans:
- [x] 05-01-PLAN.md — Wave 0: E2E test infrastructure (admin-ui-redesign.spec.ts, frontend-test.fixture.ts)
- [x] 05-02-PLAN.md — Wave 0: Dependencies installation (TanStack Table, Radix UI, Lucide-react)
- [x] 05-03-PLAN.md — Wave 1: Robot Instance table component (D-02, D-05, D-08)
- [x] 05-04-PLAN.md — Wave 1: Agent Run table component with pagination (D-06, D-08)
- [x] 05-05-PLAN.md — Wave 2: Modal components + action buttons (D-01, D-03)
- [x] 05-06-PLAN.md — Wave 3: Dashboard integration + test execution (D-04, D-07)

### Phase 04: E2E Verification - 端到端验证确保系统功能正常运行 ✓

**Goal:** E2E verification of v1.0.0 and v1.1.0 functionality + Admin Dashboard Web UI development with embedded deployment

**Requirements:** [D-01, D-02, D-03, D-04, D-05, D-06, D-07, D-08, D-09, D-10, D-11, D-12, D-13, D-14]

**Context:** [.planning/phases/04-e2e-verification/04-CONTEXT.md](phases/04-e2e-verification/04-CONTEXT.md)

**Status:** Complete ✓ (2026-05-06)

**Progress:**
- [x] Context gathered
- [x] Research complete
- [x] Planning complete
- [x] Verification passed
- [x] Execution
- [x] UAT

**Plans:** 8 plans in 4 waves

Plans:
- [x] 04-01-PLAN.md — Wave 0: E2E test infrastructure ✓
- [x] 04-02-PLAN.md — Wave 0: Frontend project setup ✓
- [x] 04-03-PLAN.md — Wave 1: E2E tests for Admin API & Config Flow ✓
- [x] 04-04-PLAN.md — Wave 1: E2E tests for Message Flow & Agent Run ✓
- [x] 04-05-PLAN.md — Wave 1: Backend endpoints for Quick Delete, Reset Config, Log Viewing ✓
- [x] 04-06-PLAN.md — Wave 2: Admin Dashboard Layout & Components ✓
- [x] 04-07-PLAN.md — Wave 2: Feature components - InstanceDetail, LogViewer, RuntimeMonitor ✓
- [x] 04-08-PLAN.md — Wave 3: Frontend build integration with NestJS ✓

### rebuild-3 — PiMono Adapter Refactor ✓

**Goal:** Refactor the 2834-line pi-mono.adapter.ts into 6 focused services with clear responsibilities, maintaining PiMonoAdapter as coordinator.

**Requirements:** [REQ-01, REQ-02, REQ-03, REQ-04, REQ-05]

**Context:** [.planning/phases/03-rebuild-3/03-CONTEXT.md](phases/03-rebuild-3/03-CONTEXT.md)

**Status:** Complete ✓ (2026-05-06)

**Progress:**
- [x] Context gathered
- [x] Research complete
- [x] Planning complete
- [x] Execution
- [x] Verification

**Plans:** 6 plans executed

Plans:
- [x] 03-01-PLAN.md — Wave 0: Test fixtures, PiSessionStateService, PiSessionManager ✓
- [x] 03-02-PLAN.md — Wave 1: PiPromptBuilder (pure functions) ✓
- [x] 03-03-PLAN.md — Wave 1: PiOutputProcessor (pure functions) ✓
- [x] 03-04-PLAN.md — Wave 2: PiExecutor + coordinator delegation ✓
- [x] 03-05-PLAN.md — Wave 3: PiEventRecorder ✓
- [x] 03-06-PLAN.md — Wave 4: PiToolRegistry + final integration ✓

---

## Upcoming Phases

*No upcoming phases planned. All requirements implemented.*
