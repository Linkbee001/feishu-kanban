# Phase 08: Admin Dashboard Redesign - Discussion Log

**Phase:** 08-admin-dashboard-redesign  
**Date:** 2026-05-11  
**Status:** Context gathered

---

## Discussion Summary

本次讨论围绕基于 shadcn-admin 模板完全重构管理后台的关键决策展开。

---

## Decisions Captured

### Area 1: 迁移策略

**Question:** 采用哪种迁移策略？

**Options Presented:**
1. 完全重写 — 一次性替换整个 frontend 目录
2. 页面级渐进迁移 — 按页面逐个迁移
3. 组件级渐进迁移 — 先重构布局，再逐步替换组件

**User Selection:** 完全重写

**Rationale:** 确保代码干净，架构一致，避免遗留问题。

---

### Area 2: UI 组件策略

**Question:** 如何引入 shadcn/ui 组件？

**Options Presented:**
1. 完整引入 shadcn/ui — 使用 shadcn CLI 安装完整组件库
2. 核心组件 + 自定义业务 — 基础组件使用 shadcn/ui，业务组件保留
3. 仅布局组件 — 只引入布局相关组件

**User Selection:** 完整引入 shadcn/ui

**Rationale:** 所有 UI 元素使用标准组件，业务组件基于 shadcn 重新实现。

---

### Area 3: 布局架构

**Question:** 采用哪种布局架构？

**Options Presented:**
1. 完全采用 shadcn-admin 布局 — 可折叠侧边栏、顶部 Header、Breadcrumb
2. 混合布局 — 保持可展开/收起，简化 Header
3. 保留现有布局结构 — 只替换样式和组件

**User Selection:** 完全采用 shadcn-admin 布局

**Rationale:** 保持与模板一致，获得完整的布局体验。

---

### Area 4: 样式系统

**Question:** 如何处理样式系统？

**Options Presented:**
1. 迁移到标准 Tailwind — 删除手动 CSS 工具类
2. 保留色彩系统 — 保留自定义色彩，迁移工具类
3. 保留现有样式 — 最小改动

**User Selection:** 迁移到标准 Tailwind

**Rationale:** 删除 200+ 行手动 CSS 工具类，使用标准 Tailwind。

---

### Area 5: 数据表格

**Question:** 数据表格采用哪种方案？

**Options Presented:**
1. 使用 shadcn-admin DataTable — 基于 TanStack Table 的标准封装
2. 保留现有 DataTable — 调整样式即可
3. 使用基础 Table 组件 — 不封装 TanStack Table

**User Selection:** 使用 shadcn-admin DataTable

**Rationale:** 采用标准封装模式，功能完整。

---

### Area 6: 页面范围

**Question:** 哪些页面需要重构？

**Options Presented:**
1. 全部页面重构 — Dashboard、群管理、消息记录、运行日志、系统设置
2. 核心页面试点 — 仅 Dashboard 和群管理
3. 仅布局重构 — 页面内容保持现有

**User Selection:** 全部页面重构

**Rationale:** 统一重构所有页面，获得一致的用户体验。

---

### Area 7: 主题支持

**Question:** 如何处理主题支持？

**Options Presented:**
1. 完整 Light/Dark 主题 — 完全实现切换
2. 仅 Light 模式 — 保持简洁
3. 自定义 Light 主题 — 使用绿色调

**User Selection:** 仅 Light 模式

**Rationale:** 保持简洁，专注功能，不实现 Dark 模式。

---

## Deferred Ideas

讨论中识别但未纳入本次 phase 的功能：

1. **Dark 模式支持** — 可作为后续增强
2. **全局搜索（Command + K）** — 未在本次讨论中确定
3. **移动端响应式深度优化** — 可后续进行
4. **RTL 支持** — 当前不需要
5. **国际化（i18n）** — 可作为后续需求

---

## Next Steps

1. **Research:** 深入研究 shadcn-admin 模板结构和组件使用
2. **Planning:** 创建详细的实施计划（PLAN.md）
3. **Execution:** 按 wave 执行重构

---

*Discussion completed: 2026-05-11*
