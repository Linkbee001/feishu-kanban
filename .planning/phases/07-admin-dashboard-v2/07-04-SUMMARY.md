---
phase: 07-admin-dashboard-v2
plan: 04
subsystem: frontend, backend
tags: [messages, chat-view, filters, pagination]
dependency_graph:
  requires:
    - 07-03 (Runs page with runId linking)
  provides:
    - Messages page with chat-like message thread view
    - Backend messages API for filtering and pagination
  affects:
    - Sidebar navigation links to Messages page
tech-stack:
  added:
    - date-fns (frontend date formatting)
  patterns:
    - React hooks for data fetching (useMessages)
    - URL query param sync for filter state
    - Chat-like message thread view
key-files:
  created:
    - frontend/src/hooks/useMessages.ts
    - frontend/src/components/messages/MessageBubble.tsx
    - frontend/src/components/messages/MessageThread.tsx
    - frontend/src/components/messages/MessageFilters.tsx
    - frontend/src/components/messages/index.ts
  modified:
    - src/modules/admin/admin.controller.ts (messages endpoints)
    - src/modules/admin/admin.service.ts (listMessages, getMessage)
    - frontend/src/types/dashboard.ts (MessageListItem, MessageType)
    - frontend/src/pages/MessagesPage.tsx (full implementation)
decisions:
  - D-07-04-01: Bot messages derived from AgentRun.outputSummary linked to MessageSource
  - D-07-04-02: Sender names fetched from ProjectMemberProfile table
metrics:
  duration: 25 minutes
  completed_date: 2026-05-08
---

# Phase 07 Plan 04: Messages Page Summary

**One-liner:** Messages page with chat-like message thread view per D-04, displaying user and bot messages with filtering by group, date range, and message type.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Backend Messages API | 2d9bcaf | admin.controller.ts, admin.service.ts |
| 2 | Message Types and useMessages Hook | 3705155 | dashboard.ts, useMessages.ts |
| 3 | MessageBubble Component | b8d1594 | MessageBubble.tsx, index.ts, package.json |
| 4 | MessageThread Component | 2f31912 | MessageThread.tsx |
| 5 | MessageFilters Component | fe4c423 | MessageFilters.tsx |
| 6 | MessagesPage Implementation | 682d98e | MessagesPage.tsx |

## Implementation Details

### Backend API

**Endpoints Added:**
- `GET /api/admin/messages` - List messages with filtering (group, startDate, endDate, type) and pagination
- `GET /api/admin/messages/:id` - Get single message details

**Data Sources:**
- User messages from `MessageSource` table (incoming messages from Feishu)
- Bot messages derived from `AgentRun.outputSummary` linked via `messageSourceId`
- Sender names from `ProjectMemberProfile` table (displayName/groupNickname)

**Key Decision (D-07-04-01):** Bot responses sent to Feishu are not stored in the database. Instead, bot messages in the chat view are derived from `AgentRun.outputSummary` for runs triggered by user messages. This provides a proxy for bot responses without requiring a new storage mechanism.

### Frontend Components

**MessageBubble:**
- User messages: white background, left-aligned, rounded-2xl (16px)
- Bot messages: primary/10 background, right-aligned, rounded-2xl
- Max width 80%, padding 12px 16px
- Avatar icon (User/Bot), sender name, timestamp
- "查看运行日志 →" link for bot messages with agentRunId

**MessageThread:**
- Scrollable container (400px min, 600px max)
- Empty state: "暂无消息记录" with MessageSquare icon
- Load more button for pagination
- Auto-scroll to bottom on initial load

**MessageFilters:**
- Group select dropdown ("所有群" + all groups)
- Start/end date inputs for date range
- Message type toggle buttons (全部/用户消息/机器人消息)

**MessagesPage:**
- Integrates useMessages hook and useGroups for data
- URL query param sync for shareable filter links
- Navigation from Groups page "查看消息" works (pre-selects group)
- handleViewRunLog navigates to `/admin/runs?runId=xxx`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Bot message storage**
- **Found during:** Task 1 (Backend API implementation)
- **Issue:** Plan noted "Bot responses may need separate query or table. Check how bot replies are currently stored." - discovered that bot messages sent to Feishu are not stored in the database.
- **Fix:** Used `AgentRun.outputSummary` linked to `MessageSource` via `messageSourceId` as proxy for bot responses. This provides sufficient information for admin review without requiring new storage infrastructure.
- **Files modified:** admin.service.ts
- **Commit:** 2d9bcaf

**2. [Rule 3 - Missing Dependency] date-fns not installed**
- **Found during:** Task 3 (MessageBubble implementation)
- **Issue:** date-fns was required for timestamp formatting but not installed.
- **Fix:** Installed date-fns via npm install.
- **Files modified:** package.json, package-lock.json
- **Commit:** b8d1594

None - plan executed with auto-fixes applied.

## Verification Results

### Build Verification
- Frontend build: PASSED (5.62s, no type errors)
- Backend build: PASSED (nest build successful)

### Feature Verification
- [x] Backend API returns messages with pagination
- [x] Page displays user messages left, bot messages right
- [x] Message bubbles have correct colors (white vs primary/10)
- [x] Filters work (group, date range, type)
- [x] "查看运行日志" link appears on bot messages with runId
- [x] Empty state shown when no messages
- [x] Load more fetches additional messages
- [x] Navigation from Groups page with group filter works

## Threat Model

| Threat ID | Category | Component | Status |
|-----------|----------|-----------|--------|
| T-07-12 | XSS | Message content | MITIGATED - React escapes HTML by default, rawText displayed as text |
| T-07-13 | Info Disclosure | Message history | ACCEPTED - Admin-only access via AdminAuthGuard |
| T-07-14 | Tampering | Message filters | ACCEPTED - Server-side validation on API |

## Key Files

### Backend
- `src/modules/admin/admin.controller.ts` - Messages endpoints (lines 109-138)
- `src/modules/admin/admin.service.ts` - listMessages, getMessage methods (lines 529-688)

### Frontend
- `frontend/src/pages/MessagesPage.tsx` - Page integration
- `frontend/src/components/messages/MessageBubble.tsx` - Individual message styling
- `frontend/src/components/messages/MessageThread.tsx` - Message list container
- `frontend/src/components/messages/MessageFilters.tsx` - Filter controls
- `frontend/src/hooks/useMessages.ts` - Data fetching hook
- `frontend/src/types/dashboard.ts` - MessageListItem, MessageType types

## Open Items

None - all requirements met.

## Next Steps

Plan 07-04 is complete. The Messages page provides:
- Chat-like message history view for admin review
- Filtering by group, date range, and message type
- Navigation to Runs page for detailed execution logs
- URL-based filter state for shareable links

## Self-Check: PASSED

- All files created: useMessages.ts, MessageBubble.tsx, MessageThread.tsx, MessageFilters.tsx, MessagesPage.tsx, SUMMARY.md
- All commits exist: 2d9bcaf, 3705155, b8d1594, 2f31912, fe4c423, 682d98e
- Frontend build: PASSED
- Backend build: PASSED