---
status: testing
phase: 05-admin-ui-redesign
source: [05-01-SUMMARY.md, 05-02-SUMMARY.md, 05-03-SUMMARY.md, 05-04-SUMMARY.md, 05-05-SUMMARY.md, 05-06-SUMMARY.md]
started: 2026-05-08T04:05:00Z
updated: 2026-05-08T04:05:00Z
---

## Current Test

number: 1
name: D-01 Per-row Action Buttons
expected: |
  Robot Instance 表每行末尾有 4 个按钮：创建 Agent Run（绿色）、查看日志（蓝色）、配置项目（灰色）、删除（红色）。按钮可点击，样式正确。
awaiting: user response

## Tests

### 1. D-01 Per-row Action Buttons
expected: Robot Instance 表每行末尾有 4 个按钮：创建 Agent Run、查看日志、配置项目、删除。按钮样式正确（绿色/蓝色/灰色/红色），可点击。
result: [pending]

### 2. D-02 Status Label Colors
expected: Status 列显示彩色标签：idle=灰色, running=绿色+脉冲动画, syncing=橙色, succeeded=绿色, failed=红色。
result: [pending]

### 3. D-03 Confirmation Dialog
expected: 点击删除按钮弹出确认对话框，标题"确认删除"，有取消和确认按钮。点击取消后对话框关闭。
result: [pending]

### 4. D-04 Manual Refresh Button
expected: FilterBar 右侧有刷新按钮（↻图标），点击后表格数据刷新。
result: [pending]

### 5. D-05 Robot Instance Table Columns
expected: 表格显示 5 个列：Chat ID、Session Mode、Project Name、Last Active、Status。
result: [pending]

### 6. D-06 Agent Run Table Columns
expected: 表格显示 4 个列：Run ID、Status、Prompt（超50字符截断+...）、Created At。
result: [pending]

### 7. D-07 Filter Bar
expected: FilterBar 包含搜索框和状态下拉框。输入文字过滤数据，下拉框选择状态后表格只显示该状态的行。
result: [pending]

### 8. D-08 Pagination and Sorting
expected: Agent Run 表底部有分页控件（上一页/下一页）。列标题可点击排序，显示箭头（↑/↓）。
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0

## Gaps

[none yet]