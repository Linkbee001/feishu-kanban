# Phase 08: Admin Dashboard Redesign - Context

**Gathered:** 2026-05-11 (updated 2026-05-13)
**Status:** Ready for planning (Messages page optimization)

---

## Phase Boundary

基于 shadcn-admin 模板完全重构管理后台，解决现有交互混乱和 bug 问题，建立清晰的管理逻辑和现代化界面。

核心重构范围：
- 整体布局架构（侧边栏、Header、Breadcrumb）
- 全部管理页面（Dashboard、群管理、消息记录、运行日志、系统设置）
- UI 组件系统（迁移到标准 shadcn/ui）
- 样式系统（迁移到标准 Tailwind CSS）

**本次更新重点：** 消息记录页面布局优化

---

## Implementation Decisions

### 原始决策（Phase 08 首次讨论）

- **D-01:** 完全重写 — 一次性替换整个 frontend 目录，从 shadcn-admin 模板重新开始
- **D-02:** 完整引入 shadcn/ui — 使用 shadcn CLI 安装完整组件库
- **D-03:** 完全采用 shadcn-admin 布局 — 可折叠侧边栏、顶部 Header、Breadcrumb 导航
- **D-04:** 迁移到标准 Tailwind — 删除手动 CSS 工具类，使用标准 Tailwind CSS 类名
- **D-05:** 使用 shadcn-admin DataTable — 基于 TanStack Table 的标准封装
- **D-06:** 全部页面重构 — Dashboard、群管理、消息记录、运行日志、系统设置
- **D-07:** 仅 Light 模式 — 不实现 Dark 模式切换

### 消息页面布局优化决策（2026-05-13 更新）

#### 消息展示布局

- **D-08:** 消息采用表格行模式展示 — 类似 DataTable，每行一条消息，适合管理员快速扫读，替代当前的聊天气泡列表
- **D-09:** 5列标准布局 — 时间、发送者、类型、消息内容、群组
- **D-10:** 长文本截断+展开 — 内容列固定宽度，超长文本截断显示，点击行展开查看完整内容
- **D-11:** 标准分页 — 使用 shadcn DataTable 标准分页组件，与群管理页面一致，替代当前 ScrollArea 底部的 Load More 按钮
- **D-12:** 仅表格视图 — 不需要左右分栏或详情面板，表格行展开即可查看完整内容

#### 会话分组方式

- **D-13:** 按群组折叠分组 — 消息按群组归类，每个群组是一个可折叠的区块
- **D-14:** 群组按最近活动排序 — 最近有消息的群在最上面
- **D-15:** 默认全部展开 — 所有群组默认展开，用户可手动折叠

#### 筛选与交互

- **D-16:** 动态群组列表 — 从后端 API 动态获取群组列表，替代当前硬编码的 Group 1/2
- **D-17:** 服务端搜索 — 搜索词传给后端 API，替代当前客户端搜索
- **D-18:** shadcn DateRangePicker — 使用 shadcn 日历弹窗组件替代当前原生 `<Input type="date">`
- **D-19:** 点击行展开详情 — 点击消息行展开查看完整内容，不跳转页面

### Claude's Discretion

- 消息表格行的样式细节（行高、间距、类型图标选择等）
- 群组折叠组件的具体实现方式（Accordion / Collapsible）
- 分页的默认每页条数

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

### 需要修改的组件
- `frontend/src/features/messages/page.tsx` — 消息页面主组件（需重写布局逻辑）
- `frontend/src/features/messages/components/message-filters.tsx` — 筛选栏（需更新群组筛选和日期组件）
- `frontend/src/features/messages/components/message-list.tsx` — 消息列表（需替换为分组表格）
- `frontend/src/features/messages/components/message-bubble.tsx` — 气泡组件（保留用于行展开详情时展示）

### 可复用的资产
- `frontend/src/features/groups/components/data-table.tsx` — Groups 页面的 DataTable 组件（可参考分组表格模式）
- `frontend/src/hooks/useMessages.ts` — 消息数据 hook（需扩展支持搜索参数）
- `frontend/src/hooks/useGroups.ts` — 群组数据 hook（用于动态群组筛选列表）
- `frontend/src/types/dashboard.ts` — MessageListItem 类型（保持不变）

### 需要的后端改动
- `GET /api/admin/messages` — 需支持 `search` 查询参数（服务端搜索）
- 群组列表 API — 消息筛选需要动态群组数据

### Established Patterns
- shadcn DataTable + TanStack Table — 已在 Groups 页面建立
- Collapsible/Accordion — shadcn/ui 已安装
- DateRangePicker — 需确认是否已安装，否则需要 `npx shadcn@latest add date-picker`

---

## Specific Ideas

### 来自用户输入
- "不要管原有的样式" — 彻底重构，不拘泥于现有实现
- "重新梳理设计后台的管理逻辑和界面" — 重新设计，不仅仅是样式更新
- 基于 shadcn-admin 模板，而非从零开始
- 消息页面要改为表格模式，更好扫读

### 关键问题识别
1. 当前消息页面用气泡列表+固定高度 ScrollArea，局促且不适合管理场景
2. 群组筛选器硬编码，无法反映真实群组数据
3. 搜索仅客户端，无法搜索未加载的消息
4. 没有按群组聚合消息，管理视角不清晰

---

## Deferred Ideas

以下功能记录为未来可能的增强：

1. **Dark 模式支持** — 当前仅实现 Light 模式
2. **全局搜索（Command + K）** — shadcn-admin 支持，但未确定
3. **移动端响应式优化** — 当前保持基本响应式
4. **RTL 支持** — 当前项目不需要
5. **国际化（i18n）** — 当前界面为中文
6. **消息关联 Agent Run 跳转** — agentRunId 已存在但未在本次优化中实现跳转，可作为后续增强

---

*Phase: 08-Admin Dashboard Redesign*
*Context gathered: 2026-05-11, updated 2026-05-13*
