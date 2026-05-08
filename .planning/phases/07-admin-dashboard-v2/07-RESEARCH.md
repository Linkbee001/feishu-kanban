# Phase 07: Admin Dashboard V2 - Research

**Researched:** 2026-05-08
**Domain:** React Frontend, shadcn/ui, TanStack Table, Admin Dashboard Architecture
**Confidence:** HIGH

## Summary

This research covers the technical approach for重构 the Admin Dashboard V2 based on shadcn-admin template patterns. The phase implements a complete management interface with multi-level sidebar navigation, Data Tables for group management, Terminal-style log viewer, and Slide-over drawers for configuration editing.

**Primary recommendation:** Build on existing TanStack Table v8.21.3 + Radix UI primitives, extend current component architecture with new route-based pages, and create a Terminal component for log visualization. Leverage existing group-config APIs and extend admin APIs for messages and runs.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** 侧边栏多级菜单（Dashboard 风格）- Sidebar with multi-level navigation
- **D-02:** 每个功能独立路由页面 - Independent route pages for each feature
- **D-03:** 群列表展示使用表格视图（Data Table）- Table view for group list
- **D-04:** 消息记录使用历史消息记录展示 - Historical message records view
- **D-05:** 运行记录使用 Terminal 风格日志流 - Terminal-style log streaming
- **D-06:** 配置编辑使用右侧抽屉编辑（Slide-over）- Right-side drawer for config editing

### Claude's Discretion
- Component architecture patterns
- State management approach
- API design details
- Animation and transition behaviors

### Deferred Ideas (OUT OF SCOPE)
1. Real-time monitoring dashboard via WebSocket
2. Full-text message search
3. Bulk operations for group bind/unbind
4. Role-based permission management
5. Notification center

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-07-01 | Multi-level sidebar navigation with collapsible submenus | Implement nested nav structure with React Router integration |
| REQ-07-02 | Data Table with sorting, filtering, pagination for groups | Use TanStack Table v8.21.3 with existing pattern from RobotInstanceTable |
| REQ-07-03 | Terminal-style log viewer component | Build custom Terminal component with ANSI color support |
| REQ-07-04 | Slide-over Drawer for configuration editing | Extend Radix Dialog with custom positioning |
| REQ-07-05 | Message thread view with group filtering | Create message list component with API integration |
| REQ-07-06 | Backend APIs for groups, messages, and runs | Extend existing admin.controller.ts and create new endpoints |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Route Navigation | Browser/Client | — | React Router handles client-side routing |
| Data Table State | Browser/Client | — | TanStack Table manages sort/filter/pagination |
| Form Validation | Browser/Client | — | Client-side validation before API submission |
| Config Persistence | API/Backend | — | GroupConfigService handles PROJECT-CONFIG.md |
| Message Display | Browser/Client | API/Backend | Client renders, API provides message data |
| Log Streaming | Browser/Client | API/Backend | Polling or WebSocket for real-time logs |
| Terminal Rendering | Browser/Client | — | Pure presentation component |
| Session Management | API/Backend | — | GroupAgentSession in database |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.5 | UI framework | Existing project standard |
| React Router | ^7.x | Route management | Standard for SPA navigation |
| TanStack Table | 8.21.3 | Data tables | Already installed, proven in RobotInstanceTable |
| Radix UI | ^1.1.15 | Headless primitives | Already installed (@radix-ui/react-dialog, etc.) |
| Lucide React | ^1.14.0 | Icons | Already installed and used |
| Tailwind CSS | 4.2.4 | Styling | Existing project setup |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | ^3.x | Date formatting | For message timestamps and log dates |
| @radix-ui/react-collapsible | ^1.x | Sidebar submenus | Multi-level navigation expansion |
| @radix-ui/react-scroll-area | ^1.x | Scrollable regions | Terminal and message list scrolling |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TanStack Table | AG Grid | AG Grid heavier, TanStack already integrated |
| Radix Dialog | shadcn/ui Drawer | shadcn is wrapper around Radix, direct Radix more flexible |
| Custom Terminal | xterm.js | xterm.js overkill for read-only logs, custom lighter |

**Installation:**
```bash
cd frontend
npm install date-fns @radix-ui/react-collapsible @radix-ui/react-scroll-area
```

**Version verification:** All core packages verified from frontend/package.json [VERIFIED: npm registry]

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                    Browser                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                              React Router                              │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │  │
│  │  │ Dashboard│  │ Groups   │  │ Messages │  │  Runs    │  │ Settings │  │  │
│  │  │  Page    │  │  Page    │  │  Page    │  │  Page    │  │  Page    │  │  │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  │  │
│  │       │             │             │             │             │       │  │
│  │       ▼             ▼             ▼             ▼             ▼       │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐              │  │
│  │  │ Stats    │  │ Data     │  │ Message  │  │ Terminal │              │  │
│  │  │ Cards    │  │ Table    │  │ Thread   │  │ Viewer   │              │  │
│  │  └──────────┘  └────┬─────┘  └──────────┘  └──────────┘              │  │
│  │                     │                                                │  │
│  │                     ▼                                                │  │
│  │              ┌──────────────┐                                         │  │
│  │              │   Drawer     │ ◄──────────────────┐                    │  │
│  │              │ (Slide-over)│                    │                    │  │
│  │              └─────────────┘                    │                    │  │
│  │                      │                          │                    │  │
│  │                      ▼                          │                    │  │
│  │              ┌──────────────┐          ┌───────┴───────┐            │  │
│  │              │ Config Form  │          │  Sidebar      │            │  │
│  │              │ (Reusable)   │          │  (Multi-level)│            │  │
│  │              └──────────────┘          └───────────────┘            │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────────────┤
│                              Custom Hooks                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ useGroups    │  │ useMessages  │  │ useRuns      │  │ useConfig    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘     │
├─────────────────────────────────────────────────────────────────────────────┤
│                              API Layer                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                           useApi Hook                                │   │
│  │  GET /api/admin/groups      GET /api/admin/messages                  │   │
│  │  GET /api/admin/runs        GET /api/group-config/:id                │   │
│  │  POST /api/group-config/:id/sync                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                   Backend                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐ │
│  │ AdminController │  │ GroupConfigCtrl │  │ New: MessagesController   │ │
│  │ - list groups   │  │ - sync group    │  │ - list messages             │ │
│  │ - get logs      │  │ - complete      │  │ - filter by group           │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘ │
│  ┌─────────────────┐  ┌─────────────────┐                                   │
│  │ AgentController │  │ PrismaService   │                                   │
│  │ - list runs     │  │ - queries       │                                   │
│  │ - get run       │  │ - relations     │                                   │
│  └─────────────────┘  └─────────────────┘                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
frontend/src/
├── pages/                    # Route-level page components (NEW)
│   ├── DashboardPage.tsx
│   ├── GroupsPage.tsx
│   ├── MessagesPage.tsx
│   ├── RunsPage.tsx
│   └── SettingsPage.tsx
├── components/
│   ├── layout/               # Layout components (NEW/REFACTORED)
│   │   ├── Sidebar.tsx           # Multi-level navigation
│   │   ├── Layout.tsx            # App shell with sidebar
│   │   └── Header.tsx            # Page header with breadcrumbs
│   ├── data-table/           # Data Table components (NEW)
│   │   ├── DataTable.tsx         # Generic TanStack wrapper
│   │   ├── ColumnHeader.tsx      # Sortable column header
│   │   ├── FilterBar.tsx         # Table filters
│   │   └── Pagination.tsx        # Table pagination
│   ├── drawer/               # Drawer components (NEW)
│   │   ├── Drawer.tsx            # Slide-over container
│   │   └── GroupConfigDrawer.tsx # Group config form in drawer
│   ├── terminal/             # Terminal components (NEW)
│   │   ├── Terminal.tsx          # Terminal container
│   │   ├── LogLine.tsx           # Individual log line
│   │   └── LogToolbar.tsx        # Terminal toolbar
│   ├── messages/             # Message components (NEW)
│   │   ├── MessageThread.tsx     # Message list container
│   │   ├── MessageBubble.tsx     # Single message bubble
│   │   └── MessageFilters.tsx    # Message filter bar
│   ├── GroupConfigPage.tsx   # EXISTING - can extract form
│   ├── Sidebar.tsx           # EXISTING - replace with new
│   └── Layout.tsx            # EXISTING - enhance
├── hooks/                    # Custom hooks
│   ├── useGroups.ts         # Groups data fetching (NEW)
│   ├── useMessages.ts       # Messages data fetching (NEW)
│   ├── useRuns.ts           # Runs/logs data fetching (NEW)
│   ├── useGroupConfig.ts    # EXISTING - reuse
│   └── useApi.ts            # EXISTING - reuse
├── types/                    # TypeScript types
│   ├── admin.ts             # EXISTING - extend
│   ├── group-config.ts      # EXISTING - reuse
│   └── dashboard.ts         # NEW - dashboard specific types
└── utils/                    # Utilities
    ├── formatters.ts        # NEW - date/text formatters
    └── validation.ts        # EXISTING - reuse
```

### Pattern 1: Data Table with TanStack Table
**What:** Reusable data table using TanStack Table v8 with sorting, filtering, pagination
**When to use:** Any tabular data display (groups list, messages list)
**Example:**
```typescript
// Source: frontend/src/components/admin/RobotInstanceTable.tsx (existing pattern)
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  FilterFn,
} from '@tanstack/react-table';

interface DataTableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData>[];
  enableSorting?: boolean;
  enableFiltering?: boolean;
}

export function DataTable<TData>({ data, columns, enableSorting = true }: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
  });

  // Render table using table.getRowModel().rows
}
```

### Pattern 2: Multi-Level Sidebar Navigation
**What:** Collapsible sidebar with nested menu items using Radix Collapsible
**When to use:** Navigation with hierarchical sections
**Example:**
```typescript
// Source: Based on shadcn-admin patterns + Radix UI Collapsible
import * as Collapsible from '@radix-ui/react-collapsible';
import { ChevronRight } from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType;
  path?: string;
  children?: NavItem[];
}

function SidebarItem({ item, depth = 0 }: { item: NavItem; depth?: number }) {
  const hasChildren = item.children && item.children.length > 0;
  const [open, setOpen] = useState(false);

  if (hasChildren) {
    return (
      <Collapsible.Root open={open} onOpenChange={setOpen}>
        <Collapsible.Trigger className="flex items-center w-full">
          <item.icon className="w-5 h-5" />
          <span>{item.label}</span>
          <ChevronRight className={`w-4 h-4 transition-transform ${open ? 'rotate-90' : ''}`} />
        </Collapsible.Trigger>
        <Collapsible.Content>
          {item.children.map(child => (
            <SidebarItem key={child.id} item={child} depth={depth + 1} />
          ))}
        </Collapsible.Content>
      </Collapsible.Root>
    );
  }

  return (
    <Link to={item.path} className="flex items-center">
      <item.icon className="w-5 h-5" />
      <span>{item.label}</span>
    </Link>
  );
}
```

### Pattern 3: Slide-over Drawer
**What:** Right-side drawer for configuration editing using Radix Dialog
**When to use:** Quick editing without context switch
**Example:**
```typescript
// Source: Based on Radix Dialog + shadcn/ui Drawer patterns
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
}

export function Drawer({ open, onOpenChange, title, children }: DrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        <Dialog.Content className="fixed right-0 top-0 h-full w-[480px] bg-white shadow-xl">
          <div className="flex items-center justify-between p-4 border-b">
            <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
            <Dialog.Close className="p-2 hover:bg-gray-100 rounded">
              <X className="w-5 h-5" />
            </Dialog.Close>
          </div>
          <div className="p-4 overflow-auto h-[calc(100vh-64px)]">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

### Pattern 4: Terminal Log Viewer
**What:** Terminal-style component for displaying execution logs
**When to use:** Run logs, system logs, any streaming text output
**Example:**
```typescript
// Source: Custom pattern based on 07-UI-SPEC.md specifications
interface LogLine {
  timestamp: string;
  level: 'INFO' | 'EXEC' | 'SUCCESS' | 'WARN' | 'ERROR';
  message: string;
}

const levelColors = {
  INFO: '#58a6ff',
  EXEC: '#d2a8ff',
  SUCCESS: '#238636',
  WARN: '#d29922',
  ERROR: '#f85149',
};

export function Terminal({ logs }: { logs: LogLine[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  return (
    <div className="bg-[#0d1117] rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 p-2 bg-[#161b22] border-b border-[#30363d]">
        <button onClick={() => setAutoScroll(!autoScroll)}>
          {autoScroll ? 'Pause' : 'Resume'}
        </button>
      </div>
      <div
        ref={scrollRef}
        className="p-4 font-mono text-[13px] leading-5 h-[500px] overflow-auto"
        onScroll={() => setAutoScroll(false)}
      >
        {logs.map((log, i) => (
          <div key={i} className="whitespace-pre-wrap">
            <span className="text-gray-500">[{log.timestamp}]</span>
            <span style={{ color: levelColors[log.level] }}>[{log.level}]</span>
            <span className="text-[#c9d1d9]"> {log.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Pattern 5: Message Thread View
**What:** Chat-like interface for displaying message history
**When to use:** Message records, conversation history
**Example:**
```typescript
// Source: Based on 07-UI-SPEC.md specifications
interface Message {
  id: string;
  sender: 'user' | 'bot';
  senderName: string;
  content: string;
  timestamp: string;
  runId?: string;
}

export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.sender === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-start' : 'justify-end'} mb-4`}>
      <div
        className={`max-w-[80%] px-4 py-3 rounded-2xl ${
          isUser
            ? 'bg-white text-ink'
            : 'bg-primary/10 text-ink'
        }`}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm">{message.senderName}</span>
          <span className="text-xs text-muted">
            {format(new Date(message.timestamp), 'yyyy-MM-dd HH:mm')}
          </span>
        </div>
        <p className="text-sm">{message.content}</p>
        {message.runId && (
          <button className="text-xs text-primary mt-2 hover:underline">
            查看运行日志 →
          </button>
        )}
      </div>
    </div>
  );
}
```

### Anti-Patterns to Avoid
- **Don't use global state for drawer state:** Use local state or URL params for drawer open/close
- **Don't fetch all data at once:** Implement pagination and lazy loading for large tables
- **Don't block UI on API calls:** Use optimistic updates and loading states
- **Don't hand-roll table features:** Use TanStack Table for sorting/filtering/pagination
- **Don't ignore accessibility:** Ensure keyboard navigation and ARIA labels on all interactive elements

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Table sorting/filtering | Custom sort logic | TanStack Table | Battle-tested, handles edge cases |
| Drawer/modal state | useState + portals | Radix Dialog | Focus management, scroll locking |
| Sidebar collapse | Custom CSS | Radix Collapsible | Accessibility, animations |
| Scrollable regions | overflow-auto | Radix ScrollArea | Custom scrollbars, touch support |
| Form validation | Manual validation | Native HTML5 + custom | Consistent validation patterns |
| Date formatting | Manual string ops | date-fns | Internationalization, timezones |

**Key insight:** TanStack Table and Radix UI primitives are already installed and proven in the codebase. Extending them is safer than custom alternatives.

## Common Pitfalls

### Pitfall 1: Drawer State Synchronization
**What goes wrong:** Drawer state gets out of sync with URL, causing back button issues
**Why it happens:** Drawer managed purely with React state, no URL integration
**How to avoid:** Use URL query params (e.g., `?drawer=group-config&chatId=xxx`) and sync drawer open state with URL
**Warning signs:** Back button doesn't close drawer, drawer doesn't restore on refresh

### Pitfall 2: Table Performance with Large Data
**What goes wrong:** Data table becomes sluggish with thousands of rows
**Why it happens:** Rendering all rows at once without virtualization
**How to avoid:** Implement pagination server-side or use TanStack Table's pagination features with small page sizes (10-50)
**Warning signs:** Slow initial render, laggy scrolling, memory warnings

### Pitfall 3: Terminal Auto-Scroll UX
**What goes wrong:** Auto-scroll fights with manual scroll, frustrating users
**Why it happens:** Auto-scroll continues when user tries to read earlier logs
**How to avoid:** Pause auto-scroll when user manually scrolls up, resume when they scroll to bottom
**Warning signs:** Users complain about "jumping" logs, can't read error messages

### Pitfall 4: Form State in Drawer
**What goes wrong:** Form data persists across different groups, showing wrong config
**Why it happens:** Form state not reset when drawer opens for different item
**How to avoid:** Initialize form from fresh data fetch when drawer opens, use `key` prop to force remount
**Warning signs:** Wrong group config shown, stale data after save

### Pitfall 5: Sidebar Mobile Responsiveness
**What goes wrong:** Sidebar breaks layout on mobile or small screens
**Why it happens:** Fixed sidebar width doesn't account for viewport changes
**How to avoid:** Implement collapsible sidebar for tablet/mobile using breakpoints
**Warning signs:** Horizontal scroll, content cut off, sidebar overlapping content

## Code Examples

### API Integration Pattern
```typescript
// Source: Based on existing useGroupConfig.ts pattern
// hooks/useGroups.ts
import { useState, useEffect, useCallback } from 'react';

export interface Group {
  chatId: string;
  projectName: string;
  memberCount: number;
  status: 'bound' | 'pending_config' | 'unbound';
  createdAt: string;
}

export function useGroups() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/groups');
      if (!response.ok) throw new Error('Failed to fetch groups');
      const data = await response.json();
      setGroups(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  return { groups, loading, error, refetch: fetchGroups };
}
```

### Route Configuration
```typescript
// Source: React Router v7 pattern
// App.tsx or router configuration
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { GroupsPage } from './pages/GroupsPage';
import { MessagesPage } from './pages/MessagesPage';
import { RunsPage } from './pages/RunsPage';
import { SettingsPage } from './pages/SettingsPage';

const router = createBrowserRouter([
  {
    path: '/admin',
    element: <Layout />,
    children: [
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'groups', element: <GroupsPage /> },
      { path: 'messages', element: <MessagesPage /> },
      { path: 'runs', element: <RunsPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| TanStack Table v7 | TanStack Table v8 | 2023 | Better TypeScript, improved API |
| React Router v6 | React Router v7 | 2024 | Data APIs, better loading states |
| shadcn/ui CLI | Manual component install | Ongoing | More control, less magic |
| Context for state | URL as state | 2024 | Shareable links, persistence |

**Deprecated/outdated:**
- None identified - current stack is up to date

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Existing useApi hook can be extended for new endpoints | Code Examples | Need to create new hook pattern |
| A2 | RobotInstanceTable pattern can be generalized for Groups table | Pattern 1 | May need column customization |
| A3 | Radix Dialog can support drawer positioning with CSS | Pattern 3 | May need additional library |
| A4 | AdminService.getLogs provides sufficient data for Terminal | Backend APIs | May need additional log endpoints |
| A5 | Tailwind v4 CSS variables are compatible with custom theme | Standard Stack | Theme may need adjustment |

## Open Questions

1. **Real-time log streaming**
   - What we know: AdminService.getLogs returns historical data
   - What's unclear: Whether WebSocket streaming is needed for real-time updates
   - Recommendation: Start with polling, upgrade to WebSocket if needed

2. **Message pagination**
   - What we know: MessageSource table can have many records per group
   - What's unclear: Whether server-side pagination is required
   - Recommendation: Implement server-side pagination for messages endpoint

3. **Drawer vs Modal for mobile**
   - What we know: UI spec defines drawer as 480px right slide-over
   - What's unclear: Whether mobile should use drawer or full-screen modal
   - Recommendation: Use responsive drawer - full-screen on mobile, slide-over on desktop

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| React Router | Route management | ✗ | — | Install v7 |
| date-fns | Date formatting | ✗ | — | Install v3 |
| @radix-ui/react-collapsible | Sidebar | ✗ | — | Install latest |
| @radix-ui/react-scroll-area | Terminal scrolling | ✗ | — | Install latest |

**Missing dependencies with no fallback:**
- None - all have npm alternatives

**Missing dependencies with fallback:**
- date-fns - Can use native Date methods temporarily
- scroll-area - Can use native overflow-auto temporarily

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | React Testing Library + Vitest |
| Config file | vitest.config.ts (to be created) |
| Quick run command | `npm test` |
| Full suite command | `npm run test:coverage` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-07-01 | Sidebar navigation | unit | `npm test Sidebar.test.tsx` | ❌ Wave 0 |
| REQ-07-02 | Data Table sorting/filtering | unit | `npm test DataTable.test.tsx` | ❌ Wave 0 |
| REQ-07-03 | Terminal rendering | unit | `npm test Terminal.test.tsx` | ❌ Wave 0 |
| REQ-07-04 | Drawer open/close | unit | `npm test Drawer.test.tsx` | ❌ Wave 0 |
| REQ-07-05 | Message thread display | unit | `npm test MessageThread.test.tsx` | ❌ Wave 0 |
| REQ-07-06 | API integration | integration | `npm test api.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test --run`
- **Per wave merge:** `npm run test:coverage`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.ts` - Vitest configuration
- [ ] `src/test/setup.ts` - Test utilities and mocks
- [ ] `package.json` test scripts - Add vitest dependency
- [ ] Framework install: `npm install -D vitest @testing-library/react @testing-library/jest-dom` - Testing infrastructure

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | AdminAuthGuard already in place |
| V3 Session Management | Yes | Existing session management |
| V4 Access Control | Yes | Admin-only routes via AdminAuthGuard |
| V5 Input Validation | Yes | Use existing validation utilities |
| V6 Cryptography | No | Not applicable to admin UI |

### Known Threat Patterns for Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via message content | Tampering | Escape HTML in message display |
| CSRF on API calls | Spoofing | Existing CSRF protection on backend |
| Injection via log content | Tampering | Escape/validate log content before display |
| Unauthorized config changes | Elevation | AdminAuthGuard on all endpoints |

## API Design Recommendations

### New Backend Endpoints Required

Based on CONTEXT.md and UI-SPEC.md requirements:

| Endpoint | Method | Purpose | Response Type |
|----------|--------|---------|---------------|
| `/api/admin/groups` | GET | List all groups with status | `GroupListItem[]` |
| `/api/admin/groups/:chatId` | GET | Single group details | `GroupDetail` |
| `/api/admin/groups/:chatId/unbind` | POST | Unbind group | `{ success: boolean }` |
| `/api/admin/messages` | GET | List messages with filters | `MessageListItem[]` |
| `/api/admin/messages/:id` | GET | Single message details | `MessageDetail` |
| `/api/admin/runs` | GET | List agent runs | `AgentRunListItem[]` |
| `/api/admin/runs/:id/logs` | GET | Get run logs for terminal | `LogLine[]` |

### Data Models (Frontend Types)

```typescript
// types/dashboard.ts

export interface GroupListItem {
  chatId: string;
  name: string;
  memberCount: number;
  status: 'bound' | 'pending_config' | 'unbound';
  createdAt: string;
  lastActiveAt: string;
}

export interface GroupDetail extends GroupListItem {
  projectId: string | null;
  projectName: string | null;
  config: GroupConfig | null;
}

export interface MessageListItem {
  id: string;
  feishuMessageId: string;
  feishuChatId: string;
  senderOpenId: string;
  senderName: string;
  rawText: string;
  isBotMentioned: boolean;
  receivedAt: string;
  agentRunId?: string;
}

export interface LogLine {
  timestamp: string;
  level: 'INFO' | 'EXEC' | 'SUCCESS' | 'WARN' | 'ERROR';
  message: string;
  metadata?: Record<string, unknown>;
}
```

## Integration Points with Existing Code

### Reusable Components
| Component | Location | How to Reuse |
|-----------|----------|--------------|
| FilterBar | `components/admin/FilterBar.tsx` | Extend with new filter types |
| ConfirmDialog | `components/admin/ConfirmDialog.tsx` | Use as-is for destructive actions |
| StatusLabel | `components/admin/StatusLabel.tsx` | Extend with new status types |
| PaginationControls | `components/admin/PaginationControls.tsx` | Use with TanStack Table |

### Reusable Hooks
| Hook | Location | How to Reuse |
|------|----------|--------------|
| useApi | `hooks/useApi.ts` | Use for new endpoints |
| useGroupConfig | `hooks/useGroupConfig.ts` | Extend with update method |

### Reusable Backend Services
| Service | Location | How to Reuse |
|---------|----------|--------------|
| GroupConfigService | `src/modules/config/` | Add updateConfig method |
| AdminService | `src/modules/admin/` | Extend with groups/messages methods |

## Sources

### Primary (HIGH confidence)
- frontend/package.json - Package versions and dependencies
- frontend/src/components/admin/RobotInstanceTable.tsx - TanStack Table implementation pattern
- frontend/src/hooks/useGroupConfig.ts - API integration pattern
- src/modules/admin/admin.service.ts - Backend data models and queries
- src/modules/config/group-config.service.ts - Config management patterns
- 07-UI-SPEC.md - Visual and interaction specifications
- 07-CONTEXT.md - Phase requirements and decisions

### Secondary (MEDIUM confidence)
- TanStack Table v8 documentation (via Context7/official docs)
- Radix UI documentation (via Context7/official docs)
- shadcn-admin template patterns (referenced in CONTEXT.md)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All packages verified from package.json
- Architecture: HIGH - Based on existing codebase patterns
- Pitfalls: MEDIUM - Based on common React/TanStack patterns and project context
- API design: HIGH - Based on existing Prisma schema and AdminService

**Research date:** 2026-05-08
**Valid until:** 2026-06-08 (30 days for stable stack)
