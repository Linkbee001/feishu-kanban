# Phase 07 Discussion Log: Admin Dashboard V2

**Phase:** 07-admin-dashboard-v2  
**Date:** 2026-05-08  
**Duration:** 1 session

---

## Discussion Summary

重构管理后台，基于 shadcn-admin 模板实现完整的群管理、消息记录、运行日志等功能。

---

## Areas Discussed

### Area 1: Navigation Structure

**Options Presented:**
- A. Sidebar multi-level menu (Dashboard style)
- B. Top tab navigation (Workspace style)
- C. Hybrid with breadcrumbs

**User Selection:** A

**Rationale:** shadcn-admin template uses this pattern; suitable for backend systems with multiple modules.

---

### Area 2: Page Organization

**Options Presented:**
- A. Independent route pages
- B. Dashboard aggregation + detail drawers
- C. Hybrid mode

**User Selection:** A

**Rationale:** Direct URL access, state preserved on refresh, suitable for deep functionality.

**Route Design:**
- `/admin/dashboard` — Overview
- `/admin/groups` — Group list
- `/admin/groups/:chatId` — Group details
- `/admin/messages` — Message history
- `/admin/runs` — Execution logs
- `/admin/settings` — System settings

---

### Area 3: Group List Display

**Options Presented:**
- A. Table view (Data Table)
- B. Card grid view
- C. Hybrid mode
- D. Grouped list

**User Selection:** A

**Rationale:** Suitable for larger numbers of groups, supports sorting/filtering/pagination.

---

### Area 4: Session/Message Management

**Options Presented:**
- A. Real-time monitoring (WebSocket)
- B. Historical message records
- C. Both
- D. Timeline stream

**User Selection:** B (historical message records)

**Clarification:** Focus on messages received by bot and bot responses, not session state monitoring.

---

### Area 5: Execution Logs

**Options Presented:**
- A. Task list (table)
- B. Log stream (Terminal style)
- C. Combined

**User Selection:** B

**Rationale:** Terminal-style output suitable for debugging and viewing execution steps.

---

### Area 6: Configuration Editing

**Options Presented:**
- A. Standalone configuration page
- B. Right-side drawer editing
- C. Inline editing
- D. Hybrid mode

**User Selection:** B

**Rationale:** Quick editing without leaving context, background remains group list.

---

## Decisions Captured

| ID | Decision | Rationale |
|----|----------|-----------|
| D-01 | Sidebar multi-level menu | Standard dashboard pattern |
| D-02 | Independent route pages | URL direct access, refresh persists state |
| D-03 | Table view for groups | Supports filtering, sorting, pagination |
| D-04 | Historical message records | Focus on bot messages and responses |
| D-05 | Terminal-style execution logs | CI/CD style output for debugging |
| D-06 | Right-side drawer editing | Quick edit without context switch |

---

## Deferred Ideas

1. **Real-time monitoring dashboard** — WebSocket active sessions
2. **Message search** — Full-text search
3. **Batch operations** — Bulk bind/unbind groups
4. **Permission management** — Different admin roles
5. **Notification center** — System alerts

---

## Technical Notes

### Reference Template
- shadcn-admin: https://www.shadcn.io/template/satnaing-shadcn-admin

### Reusable Components
- GroupConfigPage configuration form
- useGroupConfig hooks
- FilterBar styles
- ConfirmDialog

### New APIs Needed
- Messages API (list/query)
- Runs API (execution logs)
- Enhanced Groups API (bind/unbind operations)
