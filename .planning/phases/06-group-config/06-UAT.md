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
updated: "2026-05-08T20:30:00Z"
---

## Current Test

number: 4
name: D-04 Validation & Errors
expected: |
  Frontend validation (required fields, URL format); backend errors displayed clearly; loading states
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
result: pass

### 4. D-04 Validation & Errors
expected: Frontend validation (required fields, URL format); backend errors displayed clearly; loading states
result: [pending]

### 5. D-05 Success Flow
expected: After submit, see "配置完成" message; "返回 Dashboard" button works; navigation updates
result: pass
note: "Fixed config markdown format mismatch between frontend and parser"

## Summary

total: 5
passed: 2
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps

[none yet]
