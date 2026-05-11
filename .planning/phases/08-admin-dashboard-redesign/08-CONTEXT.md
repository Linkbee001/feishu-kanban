# Phase 08: Admin Dashboard Redesign - Context

**Phase:** 08-admin-dashboard-redesign  
**Date:** 2026-05-11  
**Status:** Context gathered, ready for research

---

## Domain

### Phase Boundary

基于 shadcn-admin 模板完全重构管理后台，解决现有交互混乱和 bug 问题，建立清晰的管理逻辑和现代化界面。

核心重构范围：
- 整体布局架构（侧边栏、Header、Breadcrumb）
- 全部管理页面（Dashboard、群管理、消息记录、运行日志、系统设置）
- UI 组件系统（迁移到标准 shadcn/ui）
- 样式系统（迁移到标准 Tailwind CSS）

---

## Decisions

### D-01: 迁移策略
**Decision:** 完全重写

- 一次性替换整个 frontend 目录
- 从 shadcn-admin 模板重新开始
- 确保代码架构一致，避免遗留问题

### D-02: UI 组件策略
**Decision:** 完整引入 shadcn/ui

- 使用 shadcn CLI 安装完整组件库
- 所有 UI 元素使用标准 shadcn 组件
- 自定义业务组件（Terminal、Message 气泡等）基于 shadcn 组件重新实现

### D-03: 布局架构
**Decision:** 完全采用 shadcn-admin 布局

- 可折叠侧边栏（图标/文字模式切换）
- 顶部 Header（搜索、主题切换、用户菜单）
- Breadcrumb 导航
- 标准页面容器和间距

### D-04: 样式系统
**Decision:** 迁移到标准 Tailwind

- 删除现有的手动 CSS 工具类
- 使用标准 Tailwind CSS 类名
- 采用 shadcn 的 CSS 变量系统定义主题色彩

### D-05: 数据表格
**Decision:** 使用 shadcn-admin DataTable

- 采用 shadcn-admin 的 DataTable 组件封装
- 基于 TanStack Table，但使用标准封装模式
- 替换现有的 DataTable 实现

### D-06: 页面范围
**Decision:** 全部页面重构

- Dashboard、群管理、消息记录、运行日志、系统设置全部重构
- 保持功能但使用 shadcn-admin 组件和布局重新实现
- 路由结构保持兼容

### D-07: 主题支持
**Decision:** 仅 Light 模式

- 使用 shadcn-admin 的 Light 模式样式
- 不实现 Dark 模式切换
- 保持简洁，专注功能

---

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 设计参考
- https://github.com/satnaing/shadcn-admin — shadcn-admin 模板源码
- https://www.shadcn.io/template/satnaing-shadcn-admin — 模板介绍页面

### 现有实现参考
- `.planning/phases/07-admin-dashboard-v2/07-CONTEXT.md` — Phase 07 上下文（了解现有功能）
- `.planning/phases/07-admin-dashboard-v2/07-UI-SPEC.md` — Phase 07 UI 设计规范

### 后端 API
- `src/modules/admin/admin.controller.ts` — Admin API
- `src/modules/config/group-config.controller.ts` — 群配置 API

### 数据模型
- `prisma/schema.prisma` — GroupAgentSession, Project, Message 等模型

---

## Existing Code Insights

### 需要替换的组件
- `frontend/src/components/layout/Layout.tsx` — 现有布局（需完全替换）
- `frontend/src/components/layout/Sidebar.tsx` — 现有侧边栏（需完全替换）
- `frontend/src/components/data-table/DataTable.tsx` — 现有表格（需替换为 shadcn 封装）
- `frontend/src/index.css` — 手动 CSS 工具类（需删除）

### 需要重构的页面
- `frontend/src/pages/DashboardPage.tsx` — Dashboard 统计页面
- `frontend/src/pages/GroupsPage.tsx` — 群管理页面
- `frontend/src/pages/MessagesPage.tsx` — 消息记录页面
- `frontend/src/pages/RunsPage.tsx` — 运行日志页面
- `frontend/src/pages/SettingsPage.tsx` — 系统设置页面

### 可保留的业务逻辑
- API hooks（`useGroups`, `useApi` 等）— 业务逻辑保持不变
- 类型定义（`types/dashboard.ts` 等）— 数据结构不变
- 后端 API 调用 — 接口保持不变

### 技术栈
- React 19 + TypeScript 5.9
- TailwindCSS 4.x
- React Router v7
- TanStack Table 8.x
- Radix UI 组件（shadcn/ui 底层）

---

## Specific Ideas

### 来自用户输入
- "不要管原有的样式" — 彻底重构，不拘泥于现有实现
- "重新梳理设计后台的管理逻辑和界面" — 重新设计，不仅仅是样式更新
- 基于 shadcn-admin 模板，而非从零开始

### 关键问题识别
1. 现有 index.css 包含 200+ 行手动定义的工具类，不是标准 Tailwind 用法
2. 现有布局组件需要完全替换
3. 业务组件需要基于 shadcn/ui 重新实现

---

## Deferred Ideas

以下功能记录为未来可能的增强：

1. **Dark 模式支持** — 当前仅实现 Light 模式，Dark 模式可作为后续增强
2. **全局搜索（Command + K）** — shadcn-admin 支持，但未在本次讨论中确定
3. **移动端响应式优化** — 当前保持基本响应式，深度优化可后续进行
4. **RTL 支持** — 当前项目不需要从右到左语言支持
5. **国际化（i18n）** — 当前界面为中文，国际化可作为后续需求

---

## Acceptance Criteria

- [ ] 基于 shadcn-admin 模板建立新的前端项目结构
- [ ] 完整引入 shadcn/ui 组件库
- [ ] 实现标准 Tailwind CSS 样式系统
- [ ] 重构所有管理页面（Dashboard、群管理、消息记录、运行日志、设置）
- [ ] 采用 shadcn-admin 的布局组件（Sidebar、Header、Breadcrumb）
- [ ] 数据表格使用 shadcn-admin 的 DataTable 封装
- [ ] 保持与现有后端 API 的兼容性
- [ ] 构建成功，无 TypeScript 错误

---

*Phase: 08-Admin Dashboard Redesign*  
*Context gathered: 2026-05-11*
