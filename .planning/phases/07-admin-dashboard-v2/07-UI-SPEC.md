---
phase: 07
slug: admin-dashboard-v2
status: draft
shadcn_initialized: false
preset: none
created: 2026-05-08
---

# Phase 07 — Admin Dashboard V2 UI Design Contract

> Visual and interaction contract for the admin dashboard V2. Based on shadcn-admin template patterns.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn/ui (Tailwind CSS + Radix UI) |
| Preset | none (manual setup) |
| Component library | Radix UI |
| Icon library | Lucide React |
| Font | "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif |

### Existing Theme Tokens (from `tailwind.config.ts`)

```typescript
colors: {
  primary: '#1d6b57',    // Green - main accent
  warning: '#aa5a22',    // Orange - warnings
  danger: '#9a2f2f',     // Red - errors/destructive
  panel: '#f5efe6',      // Warm beige - panels/cards
  ink: '#17212a',        // Dark text
  muted: '#6b7780',      // Secondary text
}
```

---

## Spacing Scale

Declared values (multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, inline padding |
| sm | 8px | Compact element spacing |
| md | 16px | Default element spacing |
| lg | 24px | Section padding |
| xl | 32px | Layout gaps |
| 2xl | 48px | Major section breaks |
| 3xl | 64px | Page-level spacing |

Exceptions:
- Sidebar width: 280px (fixed)
- Drawer width: 480px (right slide-over)
- Terminal line height: 20px (code readability)

---

## Typography

| Role | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| Display | 28px | 700 | 1.2 | Page titles (Dashboard, Settings) |
| Heading | 20px | 600 | 1.3 | Section headers, Drawer titles |
| Body | 14px | 400/600 | 1.5 | Regular text, Table content, Form fields |
| Label | 12px | 500 | 1.4 | Form labels, Status badges, Metadata |

**Font Families:**
- **Primary:** "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif
- **Mono:** ui-monospace, SFMono-Regular, "Cascadia Mono", "Segoe UI Mono", Menlo, Monaco, Consolas, monospace (for Terminal logs)

**Usage Notes:**
- Subheadings use Body size (14px) with weight 600
- Code/Terminal text uses Body size (14px) with Mono font family
- Maximum 4 font sizes for visual consistency

---

## Color Contract

### 60/30/10 Rule Application

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | #f5efe6 (panel) | Background, surfaces |
| Secondary (30%) | #ffffff | Cards, content areas |
| Accent (10%) | #1d6b57 (primary) | Primary buttons, active nav, links |
| Destructive | #9a2f2f (danger) | Delete, unbind, error states |
| Warning | #aa5a22 | Status warnings, alerts |

### Semantic Colors

| State | Background | Text | Border |
|-------|------------|------|--------|
| Active/Selected | rgba(29,107,87,0.1) | #1d6b57 | rgba(29,107,87,0.3) |
| Hover | #f9fafb | - | - |
| Disabled | - | rgba(0,0,0,0.38) | - |
| Success | rgba(29,107,87,0.1) | #1d6b57 | - |
| Error | rgba(154,47,47,0.1) | #9a2f2f | - |
| Warning | rgba(170,90,34,0.1) | #aa5a22 | - |

Accent reserved for:
- Primary CTA buttons ("完成配置", "保存")
- Active navigation items
- Links and interactive text
- Status indicators (bound, active)

---

## Layout System

### Overall Structure (Dashboard Layout)

```
┌─────────────────────────────────────────────────────────────┐
│ Sidebar (280px) │ Main Content Area                        │
│                 │ (flex: 1)                                │
│ ┌─────────────┐ │                                          │
│ │ Logo        │ │ ┌──────────────────────────────────────┐ │
│ ├─────────────┤ │ │ Header (breadcrumb + actions)        │ │
│ │ Dashboard   │ │ ├──────────────────────────────────────┤ │
│ │ Groups ▼    │ │ │                                        │ │
│ │   · List    │ │ │ Page Content                           │ │
│ │   · Pending │ │ │                                        │ │
│ │ Messages    │ │ │                                        │ │
│ │ Runs        │ │ │                                        │ │
│ │ Settings    │ │ │                                        │ │
│ └─────────────┘ │ └──────────────────────────────────────┘ │
│                 │                                          │
└─────────────────────────────────────────────────────────────┘
                                  │
                                  │ (drawer open)
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│                     │ Drawer (480px)                         │
│                     │ ┌──────────────────────────────────────┐ │
│                     │ │ Header (title + close)               │ │
│                     │ ├──────────────────────────────────────┤ │
│                     │ │                                      │ │
│                     │ │ Config Form                          │ │
│                     │ │                                      │ │
│                     │ └──────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Sidebar Structure

**Width:** 280px fixed
**Background:** #ffffff with subtle border
**Items:**

| Item | Icon | Submenu |
|------|------|---------|
| Dashboard | LayoutDashboard | - |
| Groups | Users | List, Pending Config |
| Messages | MessageSquare | - |
| Runs | Terminal | - |
| Settings | Settings | - |

**Active State:**
- Background: rgba(29,107,87,0.1)
- Text: #1d6b57
- Font: medium weight
- Border-radius: 12px (rounded-xl)
- Left indicator: 4px primary border

---

## Component Specifications

### 1. Data Table (Groups Page)

**Purpose:** Display group list with filtering, sorting, pagination

**Structure:**
```
┌──────────────────────────────────────────────────────────────┐
│ Toolbar (filter + search + actions)                          │
├──────────────────────────────────────────────────────────────┤
│ Table Header                                                 │
│ ┌─────────┬─────────┬───────┬────────┬───────────┬──────────┐ │
│ │群名称   │Chat ID  │成员数 │状态    │创建时间   │操作      │ │
│ └─────────┴─────────┴───────┴────────┴───────────┴──────────┘ │
├──────────────────────────────────────────────────────────────┤
│ Table Row                                                    │
│ ┌─────────┬─────────┬───────┬────────┬───────────┬──────────┐ │
│ │{name}   │{id}     │{count}│{badge} │{date}     │[配置][▼] │ │
│ └─────────┴─────────┴───────┴────────┴───────────┴──────────┘ │
└──────────────────────────────────────────────────────────────┘
│ Pagination                                                   │
└──────────────────────────────────────────────────────────────┘
```

**Columns:**
| Column | Width | Sortable | Filterable |
|--------|-------|----------|------------|
| 群名称 | flex | Yes | Yes (text) |
| Chat ID | 200px | No | Yes (text) |
| 成员数 | 100px | Yes | Yes (range) |
| 状态 | 120px | Yes | Yes (select) |
| 创建时间 | 160px | Yes | Yes (date) |
| 操作 | 120px | No | No |

**Status Badges:**
| Status | Color | Text |
|--------|-------|------|
| 已绑定 | bg-primary/10 | text-primary |
| 待配置 | bg-warning/10 | text-warning |
| 已解绑 | bg-gray-100 | text-muted |

**Row Actions Dropdown:**
- 配置 → Opens drawer
- 查看消息 → Navigates to messages (filtered)
- 解绑 → Confirm dialog → Unbind

### 2. Drawer (Slide-over Panel)

**Purpose:** Group config editing without context switch

**Specs:**
- Width: 480px
- Position: Right edge, slides from right
- Overlay: rgba(0,0,0,0.3) backdrop
- Animation: 300ms ease-out
- Close: X button, overlay click, ESC key

**Structure:**
```
┌──────────────────────────────────────────────────┐
│ [X] 群配置编辑                        │
├──────────────────────────────────────────────────┤
│                                                  │
│ ┌─────────────────────────────────────────────┐ │
│ │ Step Indicator                              │ │
│ │ ●───○───○                                   │ │
│ │ 同步    配置                                 │ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│ [Chat ID Input + Sync Button]                    │
│                                                  │
│ ──────────────────────────────────────────────── │
│                                                  │
│ [Form Fields]                                    │
│ • 项目名称 *                                     │
│ • 代码仓库                                       │
│ • 分支                                           │
│ • 模型选择                                       │
│ • Mention 触发                                   │
│                                                  │
│ ──────────────────────────────────────────────── │
│                                                  │
│ [Cancel]              [Save Changes]             │
│                                                  │
└──────────────────────────────────────────────────┘
```

### 3. Terminal Component (Runs Page)

**Purpose:** Display execution logs in CI/CD style

**Specs:**
- Background: #0d1117 (GitHub dark)
- Text: #c9d1d9 (light gray)
- Font: 13px monospace
- Line height: 20px
- Padding: 16px

**Log Line Format:**
```
[2025-01-08 14:32:45] [INFO] Starting task for group oc_xxx...
[2025-01-08 14:32:46] [EXEC] read_file: /path/to/file
[2025-01-08 14:32:47] [SUCCESS] File read completed
```

**Color Coding:**
| Level | Color | Usage |
|-------|-------|-------|
| INFO | #58a6ff (blue) | General information |
| EXEC | #d2a8ff (purple) | Tool execution |
| SUCCESS | #238636 (green) | Success state |
| WARN | #d29922 (yellow) | Warning |
| ERROR | #f85149 (red) | Error state |

**Toolbar:**
- Auto-scroll toggle
- Clear logs button
- Filter by group select
- Search/filter input

### 4. Message Thread (Messages Page)

**Purpose:** Display conversation between user and bot

**Structure:**
```
┌──────────────────────────────────────────────────────────────┐
│ Filter Bar (Group select + Date range + Search)               │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 👤 User Name                    2025-01-08 14:30      │ │
│ │ @机器人 请帮我更新一下今天的任务                           │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│                              ┌────────────────────────────┐ │
│                              │ 🤖 机器人                  │ │
│                              │ 正在为您处理...            │ │
│                              │                            │ │
│                              │ [View Run Log →]           │ │
│                              └────────────────────────────┘ │
│                                                              │
│ [Load More...]                                               │
└──────────────────────────────────────────────────────────────┘
```

**Message Bubbles:**
- User: White background, left-aligned
- Bot: Primary/10 background, right-aligned
- Max width: 80%
- Padding: 12px 16px
- Border-radius: 16px (user left), 16px (bot right)

---

## Page Designs

### Page 1: Dashboard Overview

**Route:** `/admin/dashboard`

**Layout:**
```
┌──────────────────────────────────────────────────────────────┐
│ Dashboard                                                    │
│ 系统概览与统计信息                                            │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐          │
│ │ 总群数       │ │ 活跃会话     │ │ 今日消息     │          │
│ │ 156          │ │ 42           │ │ 1,234        │          │
│ └──────────────┘ └──────────────┘ └──────────────┘          │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ 最近活动                                                │ │
│ │ ────────────────────────────────────────────────────── │ │
│ │ [图标] 群 "Project A" 配置更新        10分钟前         │ │
│ │ [图标] 任务执行成功                    32分钟前         │ │
│ │ [图标] 新群绑定                        2小时前          │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ 快速操作                                                │ │
│ │ [配置新群] [查看消息] [查看运行日志]                    │ │
│ └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

**Stats Cards:**
- Icon + Title + Large number
- Subtitle with trend indicator
- Hover: subtle shadow

### Page 2: Groups List

**Route:** `/admin/groups`

**Layout:** See Data Table specification above

**Key Interactions:**
- Click row → Open drawer with group config
- Click "配置" → Open drawer
- Click "查看消息" → Navigate to messages with group filter
- Click "解绑" → Confirm dialog

### Page 3: Group Config Drawer

**Route:** `/admin/groups/:chatId` (drawer opens)

**States:**
1. **Initial:** Show chatId input + sync button
2. **Synced:** Show group info + config form
3. **Editing:** Form fields enabled
4. **Saving:** Loading state on save button
5. **Saved:** Success toast, close drawer, refresh list

### Page 4: Messages

**Route:** `/admin/messages`

**Layout:** See Message Thread specification

**Filters:**
- Group select (dropdown)
- Date range picker
- Message type toggle (All / User / Bot)
- Search input (search content)

### Page 5: Runs (Terminal)

**Route:** `/admin/runs`

**Layout:** See Terminal specification

**Features:**
- Real-time auto-scroll
- Pause on scroll up
- Filter by group
- Search in logs
- Download logs button

### Page 6: Settings

**Route:** `/admin/settings`

**Layout:**
```
┌──────────────────────────────────────────────────────────────┐
│ Settings                                                     │
│ 系统配置                                                    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ 通用设置                                                │ │
│ │ ────────────────────────────────────────────────────── │ │
│ │ [输入] 默认模型                                          │ │
│ │ [开关] 自动同步群信息                                    │ │
│ │ [输入] 消息保留天数                                      │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ 通知设置                                                │ │
│ │ ────────────────────────────────────────────────────── │ │
│ │ [开关] 启用邮件通知                                      │ │
│ │ [输入] 通知邮箱                                          │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                              │
│                              [保存设置]                      │
└──────────────────────────────────────────────────────────────┘
```

---

## Interaction Patterns

### Navigation

**Sidebar Navigation:**
- Single-click to navigate
- Active state persists on refresh
- Submenu expands on hover/click
- Collapsible on mobile (hamburger menu)

**Breadcrumbs:**
- Location: Below header
- Pattern: Dashboard / Groups / Group Name
- Click to navigate back

### Data Table Interactions

**Sorting:**
- Click column header to sort
- Arrow icon indicates direction (asc/desc)
- Third click removes sort

**Filtering:**
- Filter bar above table
- Text input for text columns
- Dropdown for status columns
- Date picker for date columns

**Pagination:**
- Page numbers + Prev/Next
- Items per page selector (10/25/50/100)
- Current page highlighted

**Row Selection:**
- Checkbox on each row
- Header checkbox selects all visible
- Bulk actions appear on selection

### Drawer Interactions

**Open:**
- Click "配置" button in table
- Slide in from right with overlay
- Background content dims

**Close:**
- Click X button
- Click overlay
- Press ESC
- Navigate away

**Unsaved Changes:**
- Warn if form dirty
- Confirm before close
- "Discard changes?" dialog

### Terminal Interactions

**Auto-scroll:**
- Default: ON
- Scroll up to pause
- Toggle button to resume

**Log Levels:**
- Filter buttons: All / Info / Exec / Success / Warn / Error
- Multiple can be selected

**Search:**
- Highlight matching text
- Filter to show only matches
- Clear search to restore

---

## Responsive Behavior

### Breakpoints

| Breakpoint | Width | Layout Changes |
|------------|-------|----------------|
| Desktop | > 1280px | Full layout |
| Laptop | 1024-1280px | Drawer becomes 400px |
| Tablet | 768-1024px | Collapsible sidebar |
| Mobile | < 768px | Stack layout, drawer full-screen |

### Mobile Adaptations

**Sidebar:**
- Collapses to hamburger menu
- Full-screen overlay when open
- Swipe to close

**Data Table:**
- Horizontal scroll
- Sticky first column (group name)
- Row actions become swipe gestures

**Drawer:**
- Full-screen modal
- Slide from bottom
- Swipe down to close

**Terminal:**
- Maintains monospace font
- Horizontal scroll for long lines
- Toolbar stacks vertically

---

## Copywriting Contract

### Primary CTAs

| Action | Label | Context |
|--------|-------|---------|
| Config group | 配置 | Table row actions |
| Save config | 保存配置 | Drawer form |
| Sync group | 同步群信息 | Initial drawer state |
| Unbind group | 解绑 | Confirm dialog |
| Refresh | 刷新 | Toolbar buttons |
| View messages | 查看消息 | Row actions |
| View logs | 查看日志 | Message thread |

### Empty States

| Page | Heading | Body |
|------|---------|------|
| Groups | 暂无群数据 | 点击「配置新群」添加第一个群 |
| Messages | 暂无消息记录 | 选择群聊查看消息历史 |
| Runs | 暂无运行日志 | 等待任务执行后查看日志 |
| Dashboard | 欢迎使用 | 系统运行正常，暂无统计数据 |

### Error States

| Scenario | Message |
|----------|---------|
| Load failed | 加载失败，请刷新重试 |
| Sync failed | 同步群信息失败，请检查 Chat ID |
| Save failed | 保存配置失败，请重试 |
| Validation | 请填写必填项 |
| Network | 网络连接异常，请检查网络 |

### Destructive Actions

| Action | Confirmation |
|--------|--------------|
| 解绑群 | 确定要解绑群"{name}"吗？解绑后机器人将不再响应此群消息。 |
| 删除配置 | 确定要删除此配置吗？此操作不可撤销。 |

### Toast Messages

| Action | Success | Error |
|--------|---------|-------|
| Save config | 配置已保存 | 保存失败 |
| Unbind | 群已解绑 | 解绑失败 |
| Sync | 群信息已同步 | 同步失败 |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | Data Table, Drawer, Dialog, Select, Tabs | not required |
| none (third-party) | - | - |

**Components to install via shadcn:**
- `table` - Data Table base
- `dialog` - Confirm dialogs
- `drawer` - Side panel (from @v4)
- `select` - Dropdowns
- `tabs` - Settings sections
- `badge` - Status indicators
- `button` - All buttons
- `input` - Form inputs
- `label` - Form labels
- `separator` - Dividers
- `scroll-area` - Scrollable regions
- `skeleton` - Loading states
- `toast` - Notifications
- `tooltip` - Help text
- `dropdown-menu` - Row actions
- `checkbox` - Row selection
- `calendar` - Date filtering

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending

---

## Appendix: Design Decisions Reference

| ID | Decision | Source |
|----|------------|--------|
| D-01 | Sidebar multi-level menu | CONTEXT.md |
| D-02 | Independent route pages | CONTEXT.md |
| D-03 | Data Table for groups | CONTEXT.md |
| D-04 | Message thread view | CONTEXT.md |
| D-05 | Terminal style logs | CONTEXT.md |
| D-06 | Right-side drawer editing | CONTEXT.md |
