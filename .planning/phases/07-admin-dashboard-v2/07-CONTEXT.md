# Phase 07: Admin Dashboard V2

**Phase:** 07-admin-dashboard-v2  
**Date:** 2026-05-08  
**Status:** Context gathered, ready for research

---

## Domain

重构管理后台，基于 shadcn-admin 模板，实现群管理、会话监控、消息记录、运行日志等功能的完整管理界面。

核心功能模块：
- 群绑定/解绑（群列表管理）
- 会话管理（机器人会话状态）
- 消息记录（机器人收到的消息及响应）
- 运行记录（AI 执行任务的日志流）
- 群配置修改（PROJECT-CONFIG 编辑）

---

## Decisions

### D-01: 导航结构
**Decision:** 侧边栏多级菜单（Dashboard 风格）

- 左侧固定侧边栏，支持展开/收起
- 一级菜单项：Dashboard、群管理、消息记录、运行日志、系统设置
- 二级菜单：群管理 → 群列表 / 待配置群

### D-02: 页面组织
**Decision:** 每个功能独立路由页面

路由设计：
- `/admin/dashboard` — 概览统计
- `/admin/groups` — 群列表（表格视图，支持绑定/解绑）
- `/admin/groups/:chatId` — 群详情（抽屉打开时显示）
- `/admin/messages` — 消息记录（机器人收到的消息及响应）
- `/admin/runs` — 运行日志（Terminal 风格日志流）
- `/admin/settings` — 系统设置

### D-03: 群列表展示
**Decision:** 表格视图（Data Table）

表格列：群名称、Chat ID、成员数、状态（已绑定/待配置/已解绑）、创建时间、操作（配置/解绑/查看）
- 支持排序、筛选、分页
- 使用 shadcn/ui Data Table 组件

### D-04: 消息记录
**Decision:** 历史消息记录（机器人收到的消息及响应）

- 展示机器人接收到的用户消息
- 展示机器人的响应消息
- 支持按群筛选、按时间范围查询
- 消息对话形式展示（类似聊天界面）

### D-05: 运行记录
**Decision:** 日志流（Terminal 风格）

- 类似 CI/CD 日志输出的终端风格
- 实时滚动显示 AI 执行过程
- 显示工具调用链（read_file → edit_file → bash）
- 支持按群、按任务筛选

### D-06: 配置编辑
**Decision:** 右侧抽屉编辑（Slide-over）

- 在群列表点击"配置"，右侧滑出抽屉
- 表单在抽屉中展示，背景保持群列表
- 保存后抽屉关闭，列表自动刷新
- 适合快速修改，不离开当前上下文

---

## Deferred Ideas

以下功能记录为未来可能的增强：

1. **实时监控仪表板** — WebSocket 实时显示活跃会话
2. **消息搜索** — 全文搜索消息内容
3. **批量操作** — 批量绑定/解绑群
4. **权限管理** — 不同管理员角色
5. **通知中心** — 系统告警和通知

---

## Canonical Refs

### 设计参考
- https://www.shadcn.io/template/satnaing-shadcn-admin — shadcn-admin 模板

### 后端 API
- `src/modules/config/group-config.controller.ts` — 群配置 API
- `src/modules/config/group-config.service.ts` — 群配置服务

### 前端现有组件
- `frontend/src/components/GroupConfigPage.tsx` — 群配置页面（可复用配置表单）
- `frontend/src/components/Sidebar.tsx` — 当前侧边栏（需重构为多级菜单）
- `frontend/src/hooks/useGroupConfig.ts` — 群配置 hooks

### 数据模型
- `prisma/schema.prisma` — GroupAgentSession, Project, Message 等模型

---

## Codebase Context

### Reusable Assets
- `GroupConfigPage` 组件中的配置表单逻辑
- `useGroupConfig` hook 中的 API 调用模式
- `FilterBar` 组件样式（表格筛选）
- `ConfirmDialog` 组件（确认弹窗）

### Established Patterns
- React + React Router 前端架构
- REST API 与后端通信
- Tailwind CSS + shadcn/ui 组件库

### Integration Points
- 扩展 Dashboard 路由配置
- 重构 Sidebar 为多级菜单
- 复用 GroupConfigService API
- 新增 Messages 和 Runs API 接口

---

## Acceptance Criteria

- [ ] 侧边栏多级菜单导航正常工作
- [ ] 群列表页面展示所有群（表格视图）
- [ ] 点击群可打开右侧抽屉编辑配置
- [ ] 消息记录页面展示机器人消息历史
- [ ] 运行日志页面展示 Terminal 风格日志
- [ ] 所有功能支持刷新后不丢状态（独立路由）
