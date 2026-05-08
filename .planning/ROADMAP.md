# Project Roadmap

**Project:** feishu-kanban
**Status:** Complete — Phase 05 Admin UI Redesign (2026-05-08)
**Last Updated:** 2026-05-08

---

## Milestones

- ✅ **v1.0.0 — Rebuild** — Phases rebuild-1, rebuild-2 (shipped 2026-05-04) — [Archive](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1.0 — Architecture Refactor** — Phase rebuild-3 (complete 2026-05-06)
- ✅ **v1.2.0 — E2E Verification + Admin Dashboard** — Phase 04-e2e-verification (complete 2026-05-06)
- ✅ **v1.3.0 — Admin UI Redesign** — Phase 05-admin-ui-redesign (complete 2026-05-08)

---

## Current Phase

### Phase 05: Admin UI Redesign - Replace unusable dashboard with table-based management interface

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

---

## Completed Phases

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

### Phase 06: Group Config UI - Admin Dashboard 群配置界面

**Goal:** 在 Admin Dashboard 中添加群项目配置界面，让未配置的群可以通过 Web UI 完成初始化，替代现有的 API 端点方式。

**Requirements:** [D-01, D-02, D-03, D-04, D-05]

**Context:** [.planning/phases/06-group-config/06-CONTEXT.md](phases/06-group-config/06-CONTEXT.md)

**Status:** Planned ✓ (2026-05-08)

**Progress:**
- [x] Context gathered
- [x] Research (skipped - requirements clear)
- [x] Planning complete
- [ ] Execution
- [ ] Verification
- [ ] UAT

**Plans:** 4 plans in 4 waves

**Wave Structure:**
- Wave 0: 06-00 (Sidebar Navigation) — no dependencies
- Wave 1: 06-01 (Group Config Page) — depends on Wave 0
- Wave 2: 06-02 (Validation & Error Handling) — depends on Wave 1
- Wave 3: 06-03 (Integration & Polish) — depends on Wave 2

**Key Design:**
- **简化表单（per 用户要求）：** 仅 2 个必填字段（chatId, project.name）
- **自动同步：** 群名称、成员列表通过飞书 API 自动填充，无需用户填写
- **提交后初始化：** 调用 `/api/group-config/:chatId/complete` 完成项目创建
