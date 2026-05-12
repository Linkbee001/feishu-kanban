# Phase 08: Admin Dashboard Redesign - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Phase:** 08-admin-dashboard-redesign
**Date:** 2026-05-11 (updated 2026-05-13)
**Areas discussed (original):** 迁移策略, UI 组件策略, 布局架构, 样式系统, 数据表格, 页面范围, 主题支持
**Areas discussed (update):** 消息展示布局, 会话分组方式, 筛选与交互

---

## 原始讨论 (2026-05-11)

### Area 1: 迁移策略

| Option | Description | Selected |
|--------|-------------|----------|
| 完全重写 | 一次性替换整个 frontend 目录 | ✓ |
| 页面级渐进迁移 | 按页面逐个迁移 | |
| 组件级渐进迁移 | 先重构布局，再逐步替换组件 | |

**User's choice:** 完全重写

### Area 2: UI 组件策略

| Option | Description | Selected |
|--------|-------------|----------|
| 完整引入 shadcn/ui | 使用 shadcn CLI 安装完整组件库 | ✓ |
| 核心组件 + 自定义业务 | 基础组件使用 shadcn/ui，业务组件保留 | |
| 仅布局组件 | 只引入布局相关组件 | |

**User's choice:** 完整引入 shadcn/ui

### Area 3: 布局架构

| Option | Description | Selected |
|--------|-------------|----------|
| 完全采用 shadcn-admin 布局 | 可折叠侧边栏、顶部 Header、Breadcrumb | ✓ |
| 混合布局 | 保持可展开/收起，简化 Header | |
| 保留现有布局结构 | 只替换样式和组件 | |

**User's choice:** 完全采用 shadcn-admin 布局

### Area 4: 样式系统

| Option | Description | Selected |
|--------|-------------|----------|
| 迁移到标准 Tailwind | 删除手动 CSS 工具类 | ✓ |
| 保留色彩系统 | 保留自定义色彩，迁移工具类 | |
| 保留现有样式 | 最小改动 | |

**User's choice:** 迁移到标准 Tailwind

### Area 5: 数据表格

| Option | Description | Selected |
|--------|-------------|----------|
| 使用 shadcn-admin DataTable | 基于 TanStack Table 的标准封装 | ✓ |
| 保留现有 DataTable | 调整样式即可 | |
| 使用基础 Table 组件 | 不封装 TanStack Table | |

**User's choice:** 使用 shadcn-admin DataTable

### Area 6: 页面范围

| Option | Description | Selected |
|--------|-------------|----------|
| 全部页面重构 | Dashboard、群管理、消息记录、运行日志、系统设置 | ✓ |
| 核心页面试点 | 仅 Dashboard 和群管理 | |
| 仅布局重构 | 页面内容保持现有 | |

**User's choice:** 全部页面重构

### Area 7: 主题支持

| Option | Description | Selected |
|--------|-------------|----------|
| 完整 Light/Dark 主题 | 完全实现切换 | |
| 仅 Light 模式 | 保持简洁 | ✓ |
| 自定义 Light 主题 | 使用绿色调 | |

**User's choice:** 仅 Light 模式

---

## 消息页面优化讨论 (2026-05-13)

### 消息展示布局

| Option | Description | Selected |
|--------|-------------|----------|
| 全屏滚动列表 | 去掉固定高度，消息占满页面剩余空间，自然滚动浏览 | |
| 聊天气泡（改进版） | 保留气泡样式但去掉高度限制，自适应内容高度 | |
| 表格行模式 | 类似 DataTable 行模式，每行一条消息，适合快速扫读 | ✓ |

**User's choice:** 表格行模式

| Option | Description | Selected |
|--------|-------------|----------|
| 5列标准布局 | 时间、发送者、类型、消息内容、群组 | ✓ |
| 6列（含Agent Run） | 时间、发送者、类型、消息内容、群组、关联 Agent Run | |
| 3列精简布局 | 时间、发送者、消息内容 | |

**User's choice:** 5列标准布局

| Option | Description | Selected |
|--------|-------------|----------|
| 截断+展开 | 内容列固定宽度，超长文本截断显示，点击行展开查看完整内容 | ✓ |
| 自动换行 | 内容列不限制宽度，长文本自动换行显示 | |
| 固定3行 | 固定显示前2-3行，超出部分截断 | |

**User's choice:** 截断+展开

| Option | Description | Selected |
|--------|-------------|----------|
| 标准分页 | 使用 shadcn DataTable 标准分页，与群管理页面一致 | ✓ |
| Load More | 保持当前的 Load More 按钮 | |

**User's choice:** 标准分页

| Option | Description | Selected |
|--------|-------------|----------|
| 仅表格视图 | 不需要详情面板，表格行展开即可查看完整内容 | ✓ |
| 左右分栏（表+详情） | 左侧表格行列表，右侧点击后显示消息详情 | |

**User's choice:** 仅表格视图

### 会话分组方式

| Option | Description | Selected |
|--------|-------------|----------|
| 不分组，靠筛选 | 默认不分组，纯表格按时间排序，用户可通过群组筛选器查看特定群 | |
| 按群组折叠分组 | 消息按群组归类，每个群组是一个可折叠的区块 | ✓ |
| DataTable 分组行 | 用 DataTable 的分组功能，按群组/日期分组显示 | |

**User's choice:** 按群组折叠分组

| Option | Description | Selected |
|--------|-------------|----------|
| 按最近活动排序 | 每个群组块按最近消息时间排序，最近活动的群在最上面 | ✓ |
| 按群名排序 | 按群名称字母/拼音顺序排列 | |
| 用户拖拽排序 | 允许用户自定义群的显示顺序 | |

**User's choice:** 按最近活动排序

| Option | Description | Selected |
|--------|-------------|----------|
| 全部展开 | 所有群组默认展开，用户可手动折叠 | ✓ |
| 仅最新展开 | 只展开最近活动的群组，其余折叠 | |
| 全部折叠 | 全部折叠，用户点击展开 | |

**User's choice:** 全部展开

### 筛选与交互

| Option | Description | Selected |
|--------|-------------|----------|
| 动态群组列表 | 从后端 API 动态获取群组列表，替代当前硬编码 Group 1/2 | ✓ |
| 保持现状 | 保持硬编码，等后端有 API 再说 | |

**User's choice:** 动态群组列表

| Option | Description | Selected |
|--------|-------------|----------|
| 服务端搜索 | 搜索词传给后端 API，减轻前端压力 | ✓ |
| 保持客户端搜索 | 继续在前端过滤，简单但仅能搜索已加载的消息 | |

**User's choice:** 服务端搜索

| Option | Description | Selected |
|--------|-------------|----------|
| shadcn DateRangePicker | 使用 shadcn 的日历弹窗组件 | ✓ |
| 保持原生 input | 保持当前原生 `<Input type='date'>` | |

**User's choice:** shadcn DateRangePicker

| Option | Description | Selected |
|--------|-------------|----------|
| 展开详情 | 点击消息行可展开查看完整内容，不跳转页面 | ✓ |
| 跳转 Agent Run | 如果消息关联了 agentRunId，点击可跳转到运行日志 | |
| 两者都要 | 展开查看完整内容 + 关联 Agent Run 时显示跳转链接 | |

**User's choice:** 展开详情

---

## Claude's Discretion

- 消息表格行的样式细节（行高、间距、类型图标选择等）
- 群组折叠组件的具体实现方式（Accordion / Collapsible）
- 分页的默认每页条数

## Deferred Ideas

1. **Dark 模式支持** — 可作为后续增强
2. **全局搜索（Command + K）** — 未确定
3. **移动端响应式深度优化** — 可后续进行
4. **RTL 支持** — 当前不需要
5. **国际化（i18n）** — 可作为后续需求
6. **消息关联 Agent Run 跳转** — agentRunId 已存在但未在本次优化中实现跳转

---

*Discussion completed: 2026-05-11, updated: 2026-05-13*
