---
status: testing
phase: 06-group-config
source: [
  "frontend/src/components/GroupConfigPage.tsx",
  "frontend/src/components/Sidebar.tsx",
  "frontend/src/components/Layout.tsx",
  "frontend/src/hooks/useGroupConfig.ts"
]
started: "2026-05-08T18:30:00Z"
updated: "2026-05-08T18:30:00Z"
---

## Current Test

number: 1
name: D-01 Sidebar Navigation
expected: |
  Sidebar shows two navigation items: "机器人实例" and "群配置"
  Clicking "群配置" navigates to /admin/group-config
  Clicking "机器人实例" returns to /admin
awaiting: user response

## Tests

### 1. D-01 Sidebar Navigation
expected: Sidebar shows 机器人实例 and 群配置 items; clicking navigates to correct pages
result: [pending]

### 2. D-02 Form Structure
expected: Form has 3 numbered sections (Chat ID, Group Info auto-fill, Project Config); minimal fields
result: [pending]

### 3. D-03 Group Info Sync
expected: Enter chatId, click sync, see group name/member count/owner displayed; project name pre-filled
result: issue
reported: "填入群ID，点击同步，Uncaught TypeError: Cannot read properties of undefined (reading 'slice')"
severity: major

### 4. D-04 Validation & Errors
expected: Frontend validation (required fields, URL format); backend errors displayed clearly; loading states
result: [pending]

### 5. D-05 Success Flow
expected: After submit, see "配置完成" message; "返回 Dashboard" button works; navigation updates
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps

[none yet]
