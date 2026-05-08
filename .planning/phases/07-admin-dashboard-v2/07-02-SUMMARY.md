---
phase: 07
plan: 02
wave: 2
status: complete
completed_at: 2026-05-08T23:45:00Z
---

# 07-02: Groups Data Table — SUMMARY

## What Was Built

Complete Groups Data Table with backend API, frontend components, filtering, sorting, and pagination.

### Backend Changes

| File | Change |
|------|--------|
| `src/modules/admin/admin.controller.ts` | Added `GET /api/admin/groups` endpoint with query params |
| `src/modules/admin/admin.service.ts` | Added `listGroups()` with pagination, status filter, search |

### Frontend Components Created

| File | Purpose |
|------|---------|
| `types/dashboard.ts` | GroupListItem, GroupsResponse, GroupsQueryParams types |
| `hooks/useGroups.ts` | Data fetching hook with pagination support |
| `components/data-table/DataTable.tsx` | Generic TanStack Table wrapper |
| `components/data-table/Pagination.tsx` | Pagination controls with page numbers |
| `components/data-table/index.ts` | Barrel exports |
| `components/admin/StatusBadge.tsx` | Status badge with correct colors per UI-SPEC |
| `components/admin/index.ts` | Updated barrel exports |

### Page Updated

| File | Change |
|------|--------|
| `pages/GroupsPage.tsx` | Full implementation with DataTable, FilterBar, Pagination, RowActions |

## Key Features

### DataTable
- TanStack Table v8 with sorting
- Generic wrapper supporting any data type
- Loading, error, and empty states
- Hover row highlighting
- Sort indicators (↑/↓)

### GroupsPage
- Page header with "配置新群" button
- FilterBar with:
  - Search input (name/chatId)
  - Status dropdown (全部/已绑定/待配置/已解绑)
  - Refresh button
- DataTable with 6 columns per UI-SPEC:
  - 群名称 (flex)
  - Chat ID (200px)
  - 成员数 (100px)
  - 状态 (120px) - renders StatusBadge
  - 创建时间 (160px)
  - 操作 (120px) - RowActions dropdown
- Pagination with page numbers and size selector

### RowActions Dropdown
- 配置 → Opens drawer (stub for Wave 3)
- 查看消息 → Navigate to `/admin/messages?group=xxx`
- 解绑 → Confirm dialog (stub for Wave 3)

### StatusBadge Colors (per UI-SPEC)
- 已绑定: bg-primary/10, text-primary
- 待配置: bg-warning/10, text-warning  
- 已解绑: bg-gray-100, text-muted

### Backend API
```
GET /api/admin/groups
  ?status=bound|pending_config|unbound
  &search=<text>
  &page=<number>
  &limit=<number>

Response: {
  items: GroupListItem[],
  total: number,
  page: number,
  limit: number
}
```

## Build Verification

✅ TypeScript compilation passes
✅ Vite build succeeds
✅ No console errors

## Next Wave

Wave 3 will implement the Group Config Drawer for editing group configuration.

