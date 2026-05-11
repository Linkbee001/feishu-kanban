# Phase 08: Admin Dashboard Redesign - Research

**Researched:** 2026-05-11
**Domain:** React + TypeScript + Tailwind CSS v4 + shadcn/ui + shadcn-admin template
**Confidence:** HIGH

## Summary

This research covers the complete redesign of the Feishu Kanban admin dashboard based on the **shadcn-admin** template by Satnaing. The goal is to replace the existing frontend entirely with a modern, well-structured admin interface that solves current interaction issues and establishes clear management logic.

A key requirement is the **Agent Testing Dashboard** - a specialized interface for testing AI agents with features like task triggering, real-time log streaming, and debugging information.

**Primary recommendation:** Use shadcn-admin as the foundation, adopt Tailwind CSS v4's CSS-first configuration, leverage TanStack Table for data grids, and preserve existing API hooks/types while rebuilding all UI components.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Admin Dashboard UI | Browser/Client | — | React SPA with client-side routing |
| Agent Testing Interface | Browser/Client | API/Backend | Client renders controls, backend executes agent tasks |
| Real-time Log Streaming | Browser/Client | API/Backend | Client polls/display logs, backend streams via API |
| Data Tables (Groups/Messages/Runs) | Browser/Client | API/Backend | Client-side TanStack Table with server-side pagination |
| Theme/Layout | Browser/Client | — | shadcn-admin layout components |
| Group Configuration | Browser/Client | API/Backend | Form in client, persistence in backend |

## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01: 迁移策略** — 完全重写
- 一次性替换整个 frontend 目录
- 从 shadcn-admin 模板重新开始
- 确保代码架构一致，避免遗留问题

**D-02: UI 组件策略** — 完整引入 shadcn/ui
- 使用 shadcn CLI 安装完整组件库
- 所有 UI 元素使用标准 shadcn 组件
- 自定义业务组件基于 shadcn 组件重新实现

**D-03: 布局架构** — 完全采用 shadcn-admin 布局
- 可折叠侧边栏（图标/文字模式切换）
- 顶部 Header（搜索、主题切换、用户菜单）
- Breadcrumb 导航
- 标准页面容器和间距

**D-04: 样式系统** — 迁移到标准 Tailwind
- 删除现有的手动 CSS 工具类
- 使用标准 Tailwind CSS 类名
- 采用 shadcn 的 CSS 变量系统定义主题色彩

**D-05: 数据表格** — 使用 shadcn-admin DataTable
- 采用 shadcn-admin 的 DataTable 组件封装
- 基于 TanStack Table，但使用标准封装模式
- 替换现有的 DataTable 实现

**D-06: 页面范围** — 全部页面重构
- Dashboard、群管理、消息记录、运行日志、系统设置全部重构
- 保持功能但使用 shadcn-admin 组件和布局重新实现
- 路由结构保持兼容

**D-07: 主题支持** — 仅 Light 模式
- 使用 shadcn-admin 的 Light 模式样式
- 不实现 Dark 模式切换
- 保持简洁，专注功能

### Claude's Discretion
- 具体组件组织结构
- Agent Testing Dashboard 的具体设计
-  Tailwind v4 主题变量命名

### Deferred Ideas (OUT OF SCOPE)
1. **Dark 模式支持** — 当前仅实现 Light 模式
2. **全局搜索（Command + K）** — 可作为后续增强
3. **移动端响应式优化** — 当前保持基本响应式
4. **RTL 支持** — 当前项目不需要
5. **国际化（i18n）** — 当前界面为中文

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-08-01 | 基于 shadcn-admin 模板建立新的前端项目结构 | shadcn-admin folder organization, vite + react setup |
| REQ-08-02 | 完整引入 shadcn/ui 组件库 | shadcn CLI installation, components.json configuration |
| REQ-08-03 | 实现标准 Tailwind CSS 样式系统 | Tailwind v4 CSS-first config, @theme directive |
| REQ-08-04 | 重构所有管理页面 | shadcn-admin page patterns, DataTable implementation |
| REQ-08-05 | 采用 shadcn-admin 的布局组件 | Sidebar, Header, Breadcrumb patterns from template |
| REQ-08-06 | 数据表格使用 shadcn-admin 的 DataTable 封装 | TanStack Table integration patterns |
| REQ-08-07 | Agent Testing Dashboard 设计 | Real-time logs, task triggers, debug panels |
| REQ-08-08 | 保持与现有后端 API 的兼容性 | Existing hooks/useApi.ts patterns remain valid |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | ^19.2.5 | UI framework | Latest stable, concurrent features [VERIFIED: package.json] |
| TypeScript | ^5.9.3 | Type safety | Industry standard for React projects [VERIFIED: package.json] |
| Tailwind CSS | ^4.2.4 | Styling | CSS-first configuration, no JS config needed [VERIFIED: package.json] |
| shadcn/ui | latest | Component library | Accessible, customizable, Tailwind-native [CITED: shadcn.io] |
| TanStack Table | ^8.21.3 | Data tables | Industry standard for React tables [VERIFIED: package.json] |
| React Router | ^7.15.0 | Routing | Modern data API router [VERIFIED: package.json] |
| Lucide React | ^1.14.0 | Icons | Standard icon library for shadcn/ui [VERIFIED: package.json] |
| date-fns | ^4.1.0 | Date formatting | Modern date utility library [VERIFIED: package.json] |
| Vite | ^6.3.5 | Build tool | Fast dev server, optimized builds [VERIFIED: package.json] |

### shadcn/ui Components Required

Based on shadcn-admin template analysis, these components are typically needed:

**Layout Components:**
- `sidebar` — Main navigation (customized in shadcn-admin)
- `breadcrumb` — Navigation hierarchy
- `separator` — Visual dividers
- `scroll-area` — Custom scrollable containers

**Data Display:**
- `table` — Base table styling
- `data-table` — TanStack Table integration
- `card` — Content containers
- `badge` — Status indicators
- `avatar` — User/group avatars
- `tooltip` — Hover information

**Forms & Inputs:**
- `button` — Actions
- `input` — Text inputs
- `select` — Dropdown selections
- `dialog` — Modal dialogs
- `drawer` — Slide-over panels (for Group Config)
- `form` — Form validation with react-hook-form
- `label` — Form labels
- `textarea` — Multi-line text
- `switch` — Toggle controls
- `checkbox` — Multi-select
- `radio-group` — Single-select

**Feedback:**
- `toast` / `sonner` — Notifications
- `alert` — Warning/info messages
- `alert-dialog` — Confirmation dialogs
- `skeleton` — Loading states
- `progress` — Progress indicators

**Navigation:**
- `tabs` — Tabbed interfaces
- `collapsible` — Expandable sections
- `command` — Command palette (optional)
- `dropdown-menu` — Context menus

**Installation:**
```bash
# Initialize shadcn/ui (creates components.json)
npx shadcn@latest init

# Install required components
npx shadcn add sidebar breadcrumb separator scroll-area table card badge avatar tooltip button input select dialog drawer form label textarea switch checkbox radio-group toast alert alert-dialog skeleton progress tabs collapsible dropdown-menu
```

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Client)                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   shadcn-admin Layout                     │   │
│  │  ┌─────────────┐  ┌──────────────────────────────────┐  │   │
│  │  │   Sidebar   │  │           Header                 │  │   │
│  │  │  (Nav)      │  │  (Search, Theme, User Menu)      │  │   │
│  │  └─────────────┘  └──────────────────────────────────┘  │   │
│  │  ┌─────────────────────────────────────────────────────┐  │   │
│  │  │                   Main Content                     │  │   │
│  │  │  ┌──────────────────────────────────────────────┐  │  │   │
│  │  │  │              Page Components                  │  │  │   │
│  │  │  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐  │  │  │   │
│  │  │  │  │Dashboard │ │  Groups  │ │   Messages   │  │  │  │   │
│  │  │  │  │   Page   │ │   Page   │ │    Page      │  │  │  │   │
│  │  │  │  └──────────┘ └──────────┘ └──────────────┘  │  │  │   │
│  │  │  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐  │  │  │   │
│  │  │  │  │   Runs   │ │ Settings │ │Agent Testing │  │  │  │   │
│  │  │  │  │   Page   │ │   Page   │ │  Dashboard   │  │  │  │   │
│  │  │  │  └──────────┘ └──────────┘ └──────────────┘  │  │  │   │
│  │  │  └──────────────────────────────────────────────┘  │  │   │
│  │  └─────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ HTTP/REST
┌─────────────────────────────────────────────────────────────────┐
│                         API Server                             │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────────────────┐   │
│  │ Admin API   │  │ Group API   │  │   Robot Instance API  │   │
│  │ /api/admin  │  │/api/groups  │  │ /api/robot-instances  │   │
│  └─────────────┘  └─────────────┘  └───────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure (shadcn-admin based)

```
frontend/
├── src/
│   ├── components/
│   │   └── ui/              # shadcn/ui components (auto-generated)
│   │       ├── sidebar.tsx
│   │       ├── breadcrumb.tsx
│   │       ├── table.tsx
│   │       ├── data-table.tsx
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── badge.tsx
│   │       ├── dialog.tsx
│   │       ├── drawer.tsx
│   │       └── ...
│   │
│   ├── features/            # Feature-based organization
│   │   ├── layout/          # Layout components
│   │   │   ├── app-shell.tsx      # Main layout wrapper
│   │   │   ├── sidebar.tsx        # Custom sidebar wrapper
│   │   │   ├── header.tsx         # Top header
│   │   │   └── breadcrumb.tsx     # Breadcrumb navigation
│   │   │
│   │   ├── dashboard/       # Dashboard feature
│   │   │   ├── components/
│   │   │   │   ├── stats-card.tsx
│   │   │   │   ├── activity-list.tsx
│   │   │   │   └── quick-actions.tsx
│   │   │   └── page.tsx
│   │   │
│   │   ├── groups/          # Group management
│   │   │   ├── components/
│   │   │   │   ├── group-table.tsx
│   │   │   │   ├── group-filters.tsx
│   │   │   │   └── group-config-drawer.tsx
│   │   │   └── page.tsx
│   │   │
│   │   ├── messages/        # Message records
│   │   │   ├── components/
│   │   │   │   ├── message-list.tsx
│   │   │   │   └── message-bubble.tsx
│   │   │   └── page.tsx
│   │   │
│   │   ├── runs/            # Run logs
│   │   │   ├── components/
│   │   │   │   ├── run-table.tsx
│   │   │   │   ├── terminal.tsx
│   │   │   │   └── log-line.tsx
│   │   │   └── page.tsx
│   │   │
│   │   ├── settings/        # System settings
│   │   │   ├── components/
│   │   │   └── page.tsx
│   │   │
│   │   └── agent-testing/   # Agent Testing Dashboard
│   │       ├── components/
│   │       │   ├── task-trigger.tsx
│   │       │   ├── log-stream.tsx
│   │       │   ├── debug-panel.tsx
│   │       │   └── config-editor.tsx
│   │       └── page.tsx
│   │
│   ├── hooks/               # Reusable hooks
│   │   ├── use-api.ts       # Keep existing
│   │   ├── use-groups.ts    # Keep existing
│   │   ├── use-messages.ts  # Keep existing
│   │   ├── use-runs.ts      # Keep existing
│   │   └── use-log-poll.ts  # Keep existing
│   │
│   ├── lib/                 # Utilities
│   │   ├── utils.ts         # cn() and helpers
│   │   └── api.ts           # API client utilities
│   │
│   ├── types/               # TypeScript types
│   │   └── dashboard.ts     # Keep existing
│   │
│   ├── App.tsx              # Router setup
│   ├── main.tsx             # Entry point
│   └── index.css            # Tailwind v4 CSS-first config
│
├── components.json           # shadcn/ui configuration
├── vite.config.ts           # Vite configuration
├── tsconfig.json            # TypeScript config
└── package.json
```

### Pattern 1: shadcn-admin Layout Pattern
**What:** Three-panel layout with collapsible sidebar, header, and main content area
**When to use:** All admin pages
**Source:** https://github.com/satnaing/shadcn-admin

```typescript
// features/layout/app-shell.tsx
import { Sidebar } from "@/components/ui/sidebar"
import { Header } from "./header"

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Header />
        <main className="flex-1 p-6">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
```

### Pattern 2: DataTable with TanStack Table
**What:** Reusable data table with sorting, filtering, pagination
**When to use:** Groups list, Messages list, Runs list
**Source:** shadcn-admin + TanStack Table docs

```typescript
// components/ui/data-table.tsx
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface DataTableProps<TData> {
  columns: ColumnDef<TData>[]
  data: TData[]
}

export function DataTable<TData>({ columns, data }: DataTableProps<TData>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                暂无数据
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
```

### Pattern 3: Tailwind CSS v4 CSS-First Configuration
**What:** Configure Tailwind entirely through CSS, no JavaScript config file
**When to use:** New projects with Tailwind v4
**Source:** https://tailwindcss.com/blog/tailwindcss-v4

```css
/* index.css - Tailwind v4 CSS-first config */
@import "tailwindcss";
@source "./src/**/*.{ts,tsx}";

@theme inline {
  /* Custom colors matching Feishu Kanban brand */
  --color-primary: #1d6b57;
  --color-primary-foreground: #ffffff;
  --color-warning: #aa5a22;
  --color-danger: #9a2f2f;
  --color-panel: #f5efe6;
  --color-ink: #17212a;
  --color-muted: #6b7780;

  /* shadcn/ui theme variables */
  --color-background: 0 0% 100%;
  --color-foreground: 222.2 84% 4.9%;
  --color-card: 0 0% 100%;
  --color-card-foreground: 222.2 84% 4.9%;
  --color-popover: 0 0% 100%;
  --color-popover-foreground: 222.2 84% 4.9%;
  --color-secondary: 210 40% 96.1%;
  --color-secondary-foreground: 222.2 47.4% 11.2%;
  --color-muted: 210 40% 96.1%;
  --color-muted-foreground: 215.4 16.3% 46.9%;
  --color-accent: 210 40% 96.1%;
  --color-accent-foreground: 222.2 47.4% 11.2%;
  --color-destructive: 0 84.2% 60.2%;
  --color-destructive-foreground: 210 40% 98%;
  --color-border: 214.3 31.8% 91.4%;
  --color-input: 214.3 31.8% 91.4%;
  --color-ring: 222.2 84% 4.9%;
  --radius-lg: 0.5rem;
  --radius-md: calc(var(--radius-lg) - 2px);
  --radius-sm: calc(var(--radius-lg) - 4px);
}
```

### Pattern 4: Drawer for Side Panels
**What:** Slide-over panel for editing without leaving context
**When to use:** Group configuration editing
**Source:** shadcn/ui Drawer component

```typescript
// features/groups/components/group-config-drawer.tsx
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"

export function GroupConfigDrawer({
  open,
  onOpenChange,
  groupId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  groupId: string | null
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="w-[400px] sm:w-[540px]">
        <DrawerHeader>
          <DrawerTitle>群配置</DrawerTitle>
        </DrawerHeader>
        {/* Config form here */}
      </DrawerContent>
    </Drawer>
  )
}
```

### Pattern 5: Real-time Log Streaming
**What:** Terminal-like interface with auto-scrolling logs
**When to use:** Agent Testing Dashboard log viewer
**Source:** Existing Terminal component pattern

```typescript
// features/agent-testing/components/log-stream.tsx
import { useRef, useEffect } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"

export function LogStream({ logs, autoScroll }: LogStreamProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  return (
    <ScrollArea ref={scrollRef} className="h-[400px] bg-[#0d1117] rounded-md p-4 font-mono text-sm">
      {logs.map((log, i) => (
        <div key={i} className="flex gap-2">
          <span className="text-gray-500">{log.timestamp}</span>
          <span className={getLevelColor(log.level)}>{log.level}</span>
          <span className="text-gray-300">{log.message}</span>
        </div>
      ))}
    </ScrollArea>
  )
}
```

## Agent Testing Dashboard Design

### Key Features Required

Based on the phase requirements for agent testing:

| Feature | Description | Components Needed |
|---------|-------------|-------------------|
| Task Trigger | Manually trigger agent runs for testing | Button, Form inputs, Select |
| Real-time Logs | Stream logs from running agents | LogStream, ScrollArea, Badge |
| Debug Info | Show agent context, variables, state | Card, Accordion, Code block |
| Config Panel | Edit agent parameters on the fly | Form, Input, Switch, Drawer |
| Status Monitor | Visual status of running agents | Badge, Progress, Card |

### Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────┐
│                    Agent Testing Dashboard                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐  ┌───────────────────────────────────┐ │
│  │   Task Trigger      │  │     Status Monitor                │ │
│  │   ┌───────────────┐  │  │  ┌─────┐ ┌─────┐ ┌─────┐        │ │
│  │   │ Select Group  │  │  │  │Idle │ │Running│ │Failed│       │ │
│  │   ├───────────────┤  │  │  └─────┘ └─────┘ └─────┘        │ │
│  │   │ Select Skill  │  │  └───────────────────────────────────┘ │
│  │   ├───────────────┤  │  ┌───────────────────────────────────┐ │
│  │   │ Intent Input  │  │  │     Real-time Log Stream          │ │
│  │   ├───────────────┤  │  │  [2024-01-15 10:23:45] [INFO] ... │ │
│  │   │ [ Trigger ]   │  │  │  [2024-01-15 10:23:46] [EXEC] ... │ │
│  │   └───────────────┘  │  │  [2024-01-15 10:23:47] [SUCCESS]  │ │
│  └─────────────────────┘  │  │  ...                              │ │
│  ┌─────────────────────┐  │  └───────────────────────────────────┘ │
│  │   Configuration     │  │  ┌───────────────────────────────────┐ │
│  │   ┌───────────────┐  │  │     Debug Information             │ │
│  │   │ Key-Value     │  │  │  Context: {...}                   │ │
│  │   │ Editor        │  │  │  Variables: {...}                 │ │
│  │   └───────────────┘  │  │  State: {...}                     │ │
│  └─────────────────────┘  │  └───────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Component Specifications

**TaskTrigger Component:**
- Group selector (groups with agent sessions)
- Skill selector (from available skills)
- Intent input (natural language task description)
- Trigger button with loading state

**LogStream Component:**
- Auto-scrolling terminal view
- Log level color coding (INFO, EXEC, SUCCESS, WARN, ERROR)
- Timestamp display
- Search/filter capability
- Pause/Resume auto-scroll

**DebugPanel Component:**
- Collapsible sections for context, variables, state
- JSON viewer with syntax highlighting
- Copy to clipboard functionality
- Refresh/reload button

## Migration Strategy

### What to Keep (Reusable Assets)

| Asset | Location | Rationale |
|-------|----------|-----------|
| API Hooks | `hooks/useApi.ts`, `hooks/useGroups.ts`, etc. | Business logic unchanged, API interface stable |
| Type Definitions | `types/dashboard.ts`, `types/group-config.ts`, `types/admin.ts` | Data models unchanged |
| API Utilities | `hooks/useApi.ts` (apiPost, apiPatch, apiDelete) | HTTP client patterns remain valid |
| Validation Utils | `utils/validation.ts` | Form validation logic reusable |
| Log Polling Logic | `hooks/useLogPoll.ts` | Real-time polling pattern still needed |

### What to Rewrite

| Component | Current Issues | New Implementation |
|-----------|---------------|-------------------|
| Layout | Custom implementation with manual CSS | shadcn-admin standard layout |
| Sidebar | Manual collapsible with custom styling | shadcn/ui Sidebar component |
| DataTable | Custom wrapper, manual styling | shadcn/ui DataTable with TanStack |
| index.css | 200+ lines manual utility classes | Standard Tailwind v4 config |
| Pages | Custom card styles, non-standard spacing | shadcn/ui Card, standard spacing |
| Terminal | Custom styling | shadcn/ui ScrollArea + custom colors |

### Migration Steps

1. **Initialize shadcn/ui**
   - Run `npx shadcn@latest init`
   - Configure components.json
   - Set up Tailwind v4 CSS-first config

2. **Install Components**
   - Install all required shadcn/ui components
   - Verify each component works in isolation

3. **Rebuild Layout**
   - Replace Layout.tsx with shadcn-admin pattern
   - Implement Sidebar with shadcn/ui components
   - Add Header with search, theme toggle (light only)

4. **Rebuild Pages**
   - Migrate each page one by one
   - Replace custom styling with shadcn/ui components
   - Maintain existing data fetching hooks

5. **Implement Agent Testing Dashboard**
   - Create new feature module
   - Build TaskTrigger, LogStream, DebugPanel components
   - Integrate with existing API hooks

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Data Tables | Custom table implementation | TanStack Table + shadcn/ui Table | Sorting, filtering, pagination, virtualization all built-in |
| Form Validation | Manual validation logic | react-hook-form + zod | Type-safe validation, error handling, form state management |
| Modal/Dialog | Custom modal implementation | shadcn/ui Dialog | Focus management, accessibility, animations handled |
| Toast Notifications | Custom toast system | shadcn/ui Sonner | Stacking, auto-dismiss, positioning handled |
| Command Palette | Custom search implementation | shadcn/ui Command | Filtering, keyboard navigation, accessibility |
| Date Picking | Custom date input | shadcn/ui Calendar + Popover | Localization, accessibility, range selection |
| Dropdown Menus | Custom dropdown | shadcn/ui DropdownMenu | Focus management, keyboard nav, positioning |
| Collapsible | Custom accordion | shadcn/ui Collapsible | Animation, accessibility, state management |
| Virtual Scrolling | Custom virtualization | @tanstack/react-virtual | Performance optimized for large lists |

## Common Pitfalls

### Pitfall 1: Tailwind v4 @source Not Working
**What goes wrong:** The `@source` directive in CSS doesn't automatically pick up all classes
**Why it happens:** Tailwind v4 uses automatic content detection but may miss dynamically constructed class names
**How to avoid:** 
- Use full class names in source code (don't construct with string concatenation)
- Add explicit `@source` for external libraries
- Verify classes are present in the final CSS bundle

### Pitfall 2: shadcn/ui Component Customization
**What goes wrong:** Modifying shadcn/ui component internals breaks updates
**Why it happens:** shadcn CLI overwrites component files on update
**How to avoid:**
- Create wrapper components for customizations
- Use composition pattern instead of editing component internals
- Keep custom styles in variant props or wrapper classes

### Pitfall 3: TanStack Table State Management
**What goes wrong:** Table state (sorting, filtering) lost on re-render
**Why it happens:** State not properly persisted or managed
**How to avoid:**
- Use `state` prop to control table state
- Memoize columns definition with `useMemo`
- Use controlled state pattern for URL-sync

### Pitfall 4: Drawer/Dialog z-index Issues
**What goes wrong:** Content behind drawer is still interactive
**Why it happens:** Missing `DialogOverlay` or incorrect z-index stacking
**How to avoid:**
- Always use `DialogOverlay` component
- Ensure body scroll is locked when open
- Test tab navigation trapped within modal

### Pitfall 5: Real-time Log Memory Leaks
**What goes wrong:** Browser crashes after long-running log streams
**Why it happens:** Unlimited log accumulation in state
**How to avoid:**
- Implement log rotation (keep only last N entries)
- Use virtual scrolling for large log lists
- Clear logs periodically or on demand

### Pitfall 6: shadcn/ui Theme Variable Conflicts
**What goes wrong:** Custom colors don't match shadcn/ui expectations
**Why it happens:** shadcn components expect specific CSS variable formats
**How to avoid:**
- Use HSL format for colors in @theme
- Follow shadcn/ui's CSS variable naming convention
- Test components in both light and dark modes (even if only light is used)

## Code Examples

### Complete Sidebar Implementation

```typescript
// features/layout/sidebar.tsx
import { useLocation, Link } from "react-router"
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Terminal,
  Settings,
  Beaker,
} from "lucide-react"
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarFooter,
} from "@/components/ui/sidebar"

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/admin/dashboard" },
  { icon: Users, label: "群管理", path: "/admin/groups" },
  { icon: MessageSquare, label: "消息记录", path: "/admin/messages" },
  { icon: Terminal, label: "运行日志", path: "/admin/runs" },
  { icon: Beaker, label: "Agent测试", path: "/admin/agent-testing" },
  { icon: Settings, label: "系统设置", path: "/admin/settings" },
]

export function Sidebar() {
  const location = useLocation()

  return (
    <ShadcnSidebar>
      <SidebarHeader className="p-4">
        <h1 className="text-xl font-bold">Feishu Kanban</h1>
        <p className="text-xs text-muted-foreground">管理后台</p>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>导航</SidebarGroupLabel>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.path}>
                <SidebarMenuButton
                  asChild
                  isActive={location.pathname === item.path}
                >
                  <Link to={item.path}>
                    <item.icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <p className="text-xs text-muted-foreground text-center">v2.0.0</p>
      </SidebarFooter>
    </ShadcnSidebar>
  )
}
```

### Agent Testing Task Trigger

```typescript
// features/agent-testing/components/task-trigger.tsx
import { useState } from "react"
import { Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useGroups } from "@/hooks/use-groups"
import { apiPost } from "@/hooks/use-api"

export function TaskTrigger() {
  const [groupId, setGroupId] = useState("")
  const [skill, setSkill] = useState("")
  const [intent, setIntent] = useState("")
  const [loading, setLoading] = useState(false)
  const { groups } = useGroups()

  const handleTrigger = async () => {
    setLoading(true)
    try {
      await apiPost("/api/admin/agent/trigger", {
        groupId,
        skill,
        intent,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>触发任务</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>选择群组</Label>
          <Select value={groupId} onValueChange={setGroupId}>
            <SelectTrigger>
              <SelectValue placeholder="选择群组" />
            </SelectTrigger>
            <SelectContent>
              {groups.map((g) => (
                <SelectItem key={g.chatId} value={g.chatId}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>技能</Label>
          <Select value={skill} onValueChange={setSkill}>
            <SelectTrigger>
              <SelectValue placeholder="选择技能" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="chat">对话</SelectItem>
              <SelectItem value="task">任务执行</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>意图 / 指令</Label>
          <Input
            placeholder="输入自然语言指令..."
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
          />
        </div>

        <Button
          onClick={handleTrigger}
          disabled={!groupId || !skill || !intent || loading}
          className="w-full"
        >
          <Play className="w-4 h-4 mr-2" />
          {loading ? "触发中..." : "触发任务"}
        </Button>
      </CardContent>
    </Card>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tailwind v3 JS config | Tailwind v4 CSS-first | Jan 2025 | No tailwind.config.js needed, pure CSS configuration |
| React Router v6 | React Router v7 | Nov 2024 | Data API, better TypeScript support |
| shadcn CLI v1 | shadcn CLI v2 | 2024 | Improved component registry, better DX |
| Manual CSS utilities | @theme directive | Tailwind v4 | Native CSS variables, better runtime access |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | shadcn-admin template uses TanStack Router | Architecture Patterns | Router code would need adjustment for React Router v7 |
| A2 | shadcn/ui components work with Tailwind v4 | Standard Stack | May need component updates or compatibility layer |
| A3 | Existing API endpoints remain unchanged | Migration Strategy | Would need backend API documentation review |

## Open Questions

1. **Agent Testing API Endpoints**
   - What we know: Agent runs are tracked in database
   - What's unclear: Specific API endpoints for triggering agent tasks manually
   - Recommendation: Check backend controller for manual trigger endpoint

2. **Log Streaming Protocol**
   - What we know: useLogPoll.ts uses polling
   - What's unclear: Whether WebSocket is available for lower latency
   - Recommendation: Start with polling, upgrade to WebSocket if needed

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build | ✓ | 18+ (expected) | — |
| npm | Package install | ✓ | 9+ (expected) | Use pnpm/yarn |
| shadcn CLI | Component install | ✓ | latest | Manual component copy |

**Missing dependencies with no fallback:** None — all tools are standard Node.js tooling.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (recommended) + React Testing Library |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test` |
| Full suite command | `npm run test:ci` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-08-01 | Project structure matches shadcn-admin | manual | — | ❌ Wave 0 |
| REQ-08-02 | shadcn components render without error | component | `npm test src/components/ui/` | ❌ Wave 0 |
| REQ-08-03 | Tailwind classes apply correctly | visual | Manual verification | ❌ Wave 0 |
| REQ-08-04 | Pages load and display data | e2e | Playwright tests | ❌ Wave 0 |
| REQ-08-08 | API compatibility maintained | integration | `npm test src/hooks/` | ❌ Wave 0 |

### Wave 0 Gaps
- [ ] `vitest.config.ts` — test runner config
- [ ] `src/test/setup.ts` — test utilities setup
- [ ] `@testing-library/react` — component testing
- [ ] Component tests for shadcn/ui wrappers

*(If no gaps: "None — existing test infrastructure covers all phase requirements")*

## Sources

### Primary (HIGH confidence)
- shadcn-admin GitHub: https://github.com/satnaing/shadcn-admin — template structure, component organization
- shadcn.io template page: https://www.shadcn.io/template/satnaing-shadcn-admin — template features
- Tailwind CSS v4 blog: https://tailwindcss.com/blog/tailwindcss-v4 — CSS-first configuration

### Secondary (MEDIUM confidence)
- shadcn/ui documentation: https://ui.shadcn.com/docs — component APIs
- TanStack Table docs: https://tanstack.com/table/latest — data table patterns

### Tertiary (LOW confidence)
- React Router v7 docs — routing patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from package.json and official sources
- Architecture: HIGH — based on shadcn-admin template analysis
- Pitfalls: MEDIUM — based on common React/TypeScript patterns
- Agent Testing Dashboard: MEDIUM — based on requirements, not existing implementation

**Research date:** 2026-05-11
**Valid until:** 2026-06-11 (30 days for stable tech stack)
