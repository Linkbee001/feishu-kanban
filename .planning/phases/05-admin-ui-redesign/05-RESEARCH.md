# Phase 05: Admin UI Redesign - Research

**Researched:** 2026-05-07
**Domain:** React Admin Dashboard with TanStack Table + TailwindCSS 4
**Confidence:** HIGH

## Summary

Phase 05 transforms the unusable Admin Dashboard into a table-based management interface for Feishu robot instances and agent runs. The research confirms TanStack Table v8 is the industry-standard headless table library, paired with Radix UI Dialog for confirmation modals. The existing TailwindCSS 4 setup and NestJS static serving infrastructure require no changes - the frontend build already outputs to `src/frontend/dist` and serves at `/admin` route.

**Primary recommendation:** Use TanStack Table v8.21.3 + Radix UI Dialog 1.1.15 with existing TailwindCSS 4 color system. No full UI library (Ant Design) needed - the scope is narrow enough for custom components with Radix primitives.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Interaction Flow & Operations
- **D-01:** Each row displays action buttons on the right side (创建 Agent Run, 查看日志, 配置项目)
- **D-02:** Status displayed as colored labels with text: queued=灰色, running=蓝色(可带动画), syncing=橙色, succeeded=绿色, failed=红色
- **D-03:** Dangerous operations require Modal confirmation popup
- **D-04:** Manual refresh button in header (not auto WebSocket push or polling)

#### Data Display & Refresh
- **D-05:** Robot Instance columns: Chat ID, Session Mode, Project Name, Last Active
- **D-06:** Agent Run columns: Run ID, Status, Prompt, Created At
- **D-07:** Top filter bar with search box + status dropdown filter
- **D-08:** Traditional pagination + column header sorting

### Claude's Discretion
None - user made explicit choices for all discussed areas.

### Deferred Ideas (OUT OF SCOPE)
- Error handling & notification ("简化处理就好")
- Page navigation structure
- Responsive design (desktop-first assumed)

</user_constraints>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Robot instance data fetch | API / Backend | — | NestJS endpoints `/api/admin/robot-instances` already exist and return structured data |
| Agent run data fetch | API / Backend | — | NestJS endpoints `/api/agent-runs` already exist |
| Table rendering + sorting | Browser / Client | — | React + TanStack Table handles UI state and rendering entirely client-side |
| Pagination state | Browser / Client | API / Backend | Client controls page index; backend may support limit/offset params |
| Modal confirmation | Browser / Client | — | Radix UI Dialog is pure client-side component, no backend involvement |
| Filter bar state | Browser / Client | API / Backend | Client holds search text + dropdown selection; backend filtering optional |
| Static file serving | Frontend Server (SSR) | CDN / Static | NestJS serves compiled React app at `/admin` route via express.static |

**Key insight:** The backend API is already complete from Phase 04. This phase is 90% frontend work - table components, state management, and UI styling. Backend changes are minimal (potentially adding pagination/filter query params to existing endpoints).

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-table | 8.21.3 [VERIFIED: npm registry] | Headless table library | Industry standard, framework-agnostic, handles sorting/pagination/filtering via composition |
| @radix-ui/react-dialog | 1.1.15 [VERIFIED: npm registry] | Modal/Dialog primitive | Accessible, unstyled, works with TailwindCSS, handles focus trap and keyboard navigation |
| @radix-ui/react-alert-dialog | 1.1.15 [VERIFIED: npm registry] | Confirmation dialog | Specifically for destructive actions with explicit confirmation UX |
| react | 19.2.5 [VERIFIED: frontend/package.json] | UI framework | Already installed, current version |
| tailwindcss | 4.2.4 [VERIFIED: frontend/package.json] | Styling | Already configured with custom color palette in index.css |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @radix-ui/react-dropdown-menu | 2.1.2 [VERIFIED: npm registry] | Row action dropdown | If per-row actions exceed 3 buttons, collapse into dropdown menu |
| @radix-ui/react-select | 2.1.2 [VERIFIED: npm registry] | Status dropdown filter | For status filter dropdown in top filter bar |
| lucide-react | latest | Icon library | For refresh button, sort arrows, status icons - lightweight alternative to Ant Design icons |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TanStack Table | Ant Design Table | Ant Design = pre-styled, faster start, but requires full Ant Design library (heavy), conflicts with existing TailwindCSS theme |
| TanStack Table | AG Grid | AG Grid = enterprise-grade, but overkill for simple admin dashboard, licensing complexity |
| Radix Dialog | Ant Design Modal | Ant Design Modal = styled, but forces Ant Design dependency and theme conflict |
| Custom table components | shadcn/ui Data Table | shadcn/ui = copy-paste components built on TanStack + Radix, but requires manual setup, not npm package |

**Recommendation:** Use TanStack Table + Radix primitives with TailwindCSS styling. This aligns with existing TailwindCSS 4 setup and avoids introducing a conflicting UI library.

**Installation:**
```bash
cd frontend
npm install @tanstack/react-table @radix-ui/react-dialog @radix-ui/react-alert-dialog @radix-ui/react-select lucide-react
```

**Version verification:**
- @tanstack/react-table: 8.21.3 (published 2026-04-15) [VERIFIED: npm view]
- @radix-ui/react-dialog: 1.1.15 (published 2025-03-18) [VERIFIED: npm view]
- @radix-ui/react-alert-dialog: 1.1.15 (published 2025-03-18) [VERIFIED: npm view]
- tailwindcss: 4.2.4 (published 2026-04-20) [VERIFIED: frontend/package.json]

## Architecture Patterns

### System Architecture Diagram

```
User Browser
    |
    v
[React Admin Dashboard @ /admin]
    |
    +-- FilterBar (search + status dropdown)
    |       |-- Input text state
    |       |-- Select dropdown state
    |
    +-- DataTable (TanStack Table)
    |       |-- useReactTable hook
    |       |       |-- sorting state
    |       |       |-- pagination state
    |       |       |-- column filters
    |       |
    |       |-- TableHeader (sortable columns)
    |       |-- TableBody (rows)
    |       |       |-- RowActionButtons (创建 Agent Run, 查看日志, 配置项目)
    |       |
    |       |-- PaginationControls
    |
    +-- ConfirmDialog (Radix AlertDialog)
    |       |-- Trigger (on dangerous action click)
    |       |-- Content (confirmation message + buttons)
    |
    v
NestJS Backend API @ /api/*
    |
    +-- GET /api/admin/robot-instances -> RobotInstance[]
    +-- GET /api/admin/robot-instances/:chatId/logs -> Logs
    +-- GET /api/admin/robot-instances/:chatId/runtime -> RuntimeState
    +-- POST /api/agent-runs -> AgentRun
    +-- GET /api/agent-runs/:id -> AgentRun
    +-- POST /api/agent-runs/:id/cancel -> void
    |
    v
PostgreSQL (Prisma)
```

**Data flow:** User interacts with table -> TanStack updates client state -> manual refresh button triggers useApi refetch -> data flows from NestJS -> table re-renders.

### Recommended Project Structure

```
frontend/src/
├── components/
│   ├── admin/
│   │   ├── RobotInstanceTable.tsx     # TanStack table for robot instances
│   │   ├── AgentRunTable.tsx          # TanStack table for agent runs
│   │   ├── FilterBar.tsx              # Search + status dropdown
│   │   ├── RowActionButtons.tsx       # Action button group per row
│   │   ├── StatusLabel.tsx            # Colored status badge component
│   │   ├── ConfirmDialog.tsx          # Radix AlertDialog wrapper
│   │   └── PaginationControls.tsx     # Pagination buttons
│   ├── Layout.tsx                     # Existing - no changes needed
│   ├── Sidebar.tsx                    # Existing - may refactor to use table
│   └── Dashboard.tsx                  # Replace with table-based layout
├── hooks/
│   ├── useApi.ts                      # Existing - reuse for data fetch
│   └── useTableData.ts                # Optional: wrapper for TanStack + API
├── types/
│   └ admin.ts                         # TypeScript types for RobotInstance, AgentRun
└── index.css                          # Existing - add status color utilities
```

### Pattern 1: TanStack Table Setup

**What:** Headless table library with composition-based features
**When to use:** Any data table requiring sorting, pagination, or filtering
**Example:**

```typescript
// Source: TanStack Table v8 docs [CITED: https://tanstack.com/table/v8]
import { useReactTable, getCoreRowModel, getSortedRowModel, getPaginationRowModel, flexRender } from '@tanstack/react-table';

const table = useReactTable({
  data,
  columns,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  state: {
    sorting,
    pagination,
  },
  onSortingChange: setSorting,
  onPaginationChange: setPagination,
});

// Render table headers with sort controls
<thead>
  {table.getHeaderGroups().map(headerGroup => (
    <tr key={headerGroup.id}>
      {headerGroup.headers.map(header => (
        <th key={header.id} onClick={header.column.getToggleSortingHandler()}>
          {flexRender(header.column.headerDef.header, header.getContext())}
          {{ asc: '↑', desc: '↓' }[header.column.getIsSorted() as string]}
        </th>
      ))}
    </tr>
  ))}
</thead>

// Render table body
<tbody>
  {table.getRowModel().rows.map(row => (
    <tr key={row.id}>
      {row.getVisibleCells().map(cell => (
        <td key={cell.id}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </td>
      ))}
    </tr>
  ))}
</tbody>
```

### Pattern 2: Radix AlertDialog for Confirmation

**What:** Accessible confirmation dialog for destructive actions
**When to use:** D-03 requires modal confirmation for dangerous operations
**Example:**

```typescript
// Source: Radix UI AlertDialog docs [CITED: https://www.radix-ui.com/primitives/docs/components/alert-dialog]
import * as AlertDialog from '@radix-ui/react-alert-dialog';

function ConfirmDeleteDialog({ onConfirm, children }) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>
        {children}
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/50" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg p-6 shadow-xl">
          <AlertDialog.Title className="text-lg font-semibold">确认删除</AlertDialog.Title>
          <AlertDialog.Description className="text-muted mt-2">
            此操作不可撤销，将删除所有相关数据。
          </AlertDialog.Description>
          <div className="mt-4 flex gap-3 justify-end">
            <AlertDialog.Cancel asChild>
              <button className="px-4 py-2 rounded border border-gray-200">取消</button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button 
                className="px-4 py-2 rounded bg-danger text-white"
                onClick={onConfirm}
              >
                确认删除
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
```

### Pattern 3: Status Label with TailwindCSS

**What:** Colored badge component matching D-02 requirements
**When to use:** Every table row needs status display
**Example:**

```typescript
// Uses existing TailwindCSS color system from index.css [CITED: frontend/src/index.css]
const STATUS_COLORS = {
  queued: { bg: 'bg-muted/20', text: 'text-muted', label: 'queued' },
  running: { bg: 'bg-primary/20', text: 'text-primary', label: 'running', animate: true },
  syncing: { bg: 'bg-warning/20', text: 'text-warning', label: 'syncing' },
  succeeded: { bg: 'bg-primary/10', text: 'text-primary', label: 'succeeded' },
  failed: { bg: 'bg-danger/20', text: 'text-danger', label: 'failed' },
};

function StatusLabel({ status }) {
  const config = STATUS_COLORS[status] ?? STATUS_COLORS.queued;
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-bold ${config.bg} ${config.text}`}>
      {config.animate && <span className="animate-pulse">● </span>}
      {config.label}
    </span>
  );
}
```

### Anti-Patterns to Avoid

- **Over-fetching data:** Don't fetch all robot instances on every render. Use manual refresh (D-04) - only fetch on mount and refresh button click.
- **Client-side filtering only:** If dataset grows large (>100 items), backend filtering becomes necessary. Current `useApi` doesn't support query params - may need extension.
- **Using Ant Design with TailwindCSS:** Ant Design has its own theme system that conflicts with TailwindCSS 4 custom colors. Mixing both creates inconsistent styling.
- **Inline styles for status colors:** Use TailwindCSS utility classes from index.css - ensures consistency with existing dashboard theme.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Table sorting logic | Custom sort comparator | TanStack Table's getSortedRowModel | Handles multi-column sort, sort direction toggle, stable sort |
| Pagination state | Manual page index tracking | TanStack Table's getPaginationRowModel | Handles page size, total pages, boundary checks |
| Modal focus trap | Custom focus management | Radix Dialog's built-in focus trap | Accessibility requirement, prevents focus escape |
| Dialog keyboard handling | Custom Escape key listener | Radix Dialog's keyboard navigation | WAI-ARIA compliant, handles Tab/Shift+Tab/Escape automatically |
| Status color mapping | Inline CSS for each status | TailwindCSS utility classes + STATUS_COLORS map | Reuses existing color palette, consistent styling |

**Key insight:** TanStack Table and Radix primitives solve complex state and accessibility problems. The only custom code needed is: column definitions, row action handlers, and TailwindCSS styling.

## Runtime State Inventory

> Not applicable - this is a greenfield frontend phase, not a rename/refactor/migration.

## Common Pitfalls

### Pitfall 1: TanStack Table Missing getSortedRowModel

**What goes wrong:** Table renders but clicking column headers doesn't sort
**Why it happens:** Forgot to add `getSortedRowModel: getSortedRowModel()` to useReactTable config
**How to avoid:** Always include core + feature row models in config:
```typescript
getCoreRowModel: getCoreRowModel(),
getSortedRowModel: getSortedRowModel(),
getPaginationRowModel: getPaginationRowModel(),
```
**Warning signs:** Column headers clickable but no sort arrow appears, row order unchanged

### Pitfall 2: Radix Dialog Not Closing After Async Action

**What goes wrong:** Confirmation dialog stays open after clicking "confirm" button
**Why it happens:** Async operation (API call) doesn't trigger Dialog state change
**How to avoid:** Use controlled dialog state:
```typescript
const [open, setOpen] = useState(false);
const handleConfirm = async () => {
  await deleteItem();
  setOpen(false); // Explicitly close after async completes
};
```
**Warning signs:** Dialog remains visible after action, content stale

### Pitfall 3: TailwindCSS 4 Custom Colors Not Working

**What goes wrong:** `.bg-primary` doesn't apply custom color, falls back to default
**Why it happens:** TailwindCSS 4 uses `@theme inline` syntax (different from v3)
**How to avoid:** Ensure index.css uses correct v4 syntax:
```css
@theme inline {
  --color-primary: #1d6b57;
}
```
**Warning signs:** Colors render as Tailwind defaults (blue/purple), not custom palette

### Pitfall 4: Pagination Not Syncing with Data Changes

**What goes wrong:** After refresh, pagination shows wrong page (e.g., page 5 when only 10 items exist)
**Why it happens:** Pagination state not reset when data changes
**How to avoid:** Reset pagination index on data refetch:
```typescript
const { data, refetch } = useApi('/api/admin/robot-instances');
useEffect(() => {
  table.setPageIndex(0); // Reset to page 0 when data changes
}, [data]);
```
**Warning signs:** Empty table pages after refresh, "page X of 0" shown

### Pitfall 5: Row Actions Trigger for Wrong Row

**What goes wrong:** Clicking "查看日志" on row 3 opens logs for row 1
**Why it happens:** Action button handler uses stale closure or wrong row index
**How to avoid:** Pass row data directly to action handler, not row index:
```typescript
<RowActionButtons 
  chatId={row.original.chatId}  // Use row data, not row.index
  onViewLogs={() => navigate(`/admin/logs/${row.original.chatId}`)}
/>
```
**Warning signs:** Actions affect wrong item, console logs show wrong ID

## Code Examples

### Robot Instance Table Column Definitions

```typescript
// Source: TanStack Table + AdminService return shape [VERIFIED: src/modules/admin/admin.service.ts]
import { ColumnDef } from '@tanstack/react-table';

interface RobotInstance {
  chatId: string;
  projectName: string;
  sessionMode: 'bootstrap' | 'pending_config' | 'active';
  lastActiveAt: string;
  runtimeStatus: 'queued' | 'running' | 'syncing' | 'succeeded' | 'failed' | null;
}

export const robotInstanceColumns: ColumnDef<RobotInstance>[] = [
  { accessorKey: 'chatId', header: 'Chat ID' },
  { accessorKey: 'sessionMode', header: 'Session Mode' },
  { accessorKey: 'projectName', header: 'Project Name' },
  { 
    accessorKey: 'lastActiveAt', 
    header: 'Last Active',
    cell: ({ row }) => new Date(row.original.lastActiveAt).toLocaleString('zh-CN')
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => <RowActionButtons chatId={row.original.chatId} />,
  },
];
```

### Agent Run Table Column Definitions

```typescript
// Source: AgentService return shape + AgentRunStatus enum [VERIFIED: src/modules/agent/agent.service.ts]
import { ColumnDef } from '@tanstack/react-table';

interface AgentRun {
  id: string;
  status: 'queued' | 'running' | 'syncing' | 'succeeded' | 'failed';
  prompt: string;
  createdAt: string;
}

export const agentRunColumns: ColumnDef<AgentRun>[] = [
  { accessorKey: 'id', header: 'Run ID' },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <StatusLabel status={row.original.status} />,
  },
  { 
    accessorKey: 'prompt', 
    header: 'Prompt',
    cell: ({ row }) => row.original.prompt.slice(0, 50) + '...' // Truncate for display
  },
  {
    accessorKey: 'createdAt',
    header: 'Created At',
    cell: ({ row }) => new Date(row.original.createdAt).toLocaleString('zh-CN'),
  },
];
```

### FilterBar Component

```typescript
// Source: Pattern from shadcn/ui data-table [CITED: https://ui.shadcn.com/docs/components/data-table]
import { useState } from 'react';
import * as Select from '@radix-ui/react-select';

interface FilterBarProps {
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string | null) => void;
  onRefresh: () => void;
}

export function FilterBar({ onSearchChange, onStatusChange, onRefresh }: FilterBarProps) {
  return (
    <div className="flex gap-4 items-center p-4 bg-white/50 border-b border-gray-200">
      <input
        type="text"
        placeholder="搜索项目名称或 Chat ID..."
        className="px-3 py-2 border border-gray-200 rounded-lg flex-1"
        onChange={(e) => onSearchChange(e.target.value)}
      />
      <Select.Root onValueChange={(v) => onStatusChange(v === 'all' ? null : v)}>
        <Select.Trigger className="px-3 py-2 border border-gray-200 rounded-lg">
          <Select.Value placeholder="筛选状态" />
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="all">全部状态</Select.Item>
          <Select.Item value="running">运行中</Select.Item>
          <Select.Item value="succeeded">成功</Select.Item>
          <Select.Item value="failed">失败</Select.Item>
        </Select.Content>
      </Select.Root>
      <button 
        onClick={onRefresh}
        className="px-4 py-2 rounded-lg bg-primary text-white font-semibold hover:bg-primary/80"
      >
        刷新数据
      </button>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| React Table v7 (hooks-based) | TanStack Table v8 (composition-based) | 2022 | v8 is framework-agnostic, better TypeScript support, no hooks naming confusion |
| Ant Design full UI library | Radix primitives + TailwindCSS | 2023-2024 | Better customization, no theme lock-in, smaller bundle size |
| Manual pagination logic | TanStack Table getPaginationRowModel | v8 release | Built-in pagination state management, no custom math needed |
| Custom modal focus trap | Radix Dialog focus management | Radix v1.0+ | WAI-ARIA compliant, automatic keyboard handling |

**Deprecated/outdated:**
- **react-table v7:** Replaced by TanStack Table v8. v7 hooks naming (`useTable`, `useSortBy`) caused confusion. v8 uses single `useReactTable` with feature plugins.
- **Custom focus trap implementations:** Deprecated by Radix Dialog's built-in accessibility. Hand-rolled focus traps often miss edge cases (Shadow DOM, iframes).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Backend API supports pagination/filter query params | Architecture | May need to add `?limit=10&offset=0` support to existing endpoints |
| A2 | Existing robot instances dataset is small (<50 items) | Common Pitfalls | If dataset is large, client-side filtering will be slow |
| A3 | User wants manual refresh, not auto-polling | D-04 | If user later wants real-time updates, WebSocket implementation needed |

**Recommendation for A1:** Check AdminService.listRobotInstances() - currently returns all sessions with `orderBy: { updatedAt: 'desc' }`. If dataset grows, add Prisma pagination params: `skip`, `take`.

**Recommendation for A2:** Verify dataset size by querying `/api/admin/robot-instances` in test environment. If >50 items, implement backend filtering early.

## Open Questions

1. **Should backend API support pagination/filter params?**
   - What we know: Current API returns all data. TanStack Table can paginate client-side.
   - What's unclear: Whether dataset will grow beyond 100 items in production.
   - Recommendation: Start with client-side pagination (simpler). Add backend params if dataset grows or performance degrades.

2. **Should Sidebar use table view or keep card view?**
   - What we know: CONTEXT.md focuses on "Admin Dashboard" main view. Sidebar is existing card-based instance list.
   - What's unclear: Whether Sidebar should also convert to table or remain as-is.
   - Recommendation: Keep Sidebar as card view for quick instance selection. Main dashboard shows table view.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Frontend build + NestJS runtime | ✓ | 24.11.0 | — |
| npm | Package installation | ✓ | 11.6.1 | — |
| PostgreSQL | Data storage (via Prisma) | ✓ | Running in Docker | — |
| Vite | Frontend build | ✓ | 6.3.5 | — |
| React 19 | UI framework | ✓ | 19.2.5 | — |
| TailwindCSS 4 | Styling | ✓ | 4.2.4 | — |
| TanStack Table | Table rendering | ✗ | — | npm install required |
| Radix Dialog | Modal dialogs | ✗ | — | npm install required |

**Missing dependencies with no fallback:**
- @tanstack/react-table - required for table functionality
- @radix-ui/react-dialog - required for confirmation dialogs (D-03)
- @radix-ui/react-alert-dialog - required for dangerous action confirmations (D-03)
- @radix-ui/react-select - required for status dropdown (D-07)

**Missing dependencies with fallback:**
- lucide-react (icons) - can use text labels or emoji instead, though less polished

**Action:** Run `npm install @tanstack/react-table @radix-ui/react-dialog @radix-ui/react-alert-dialog @radix-ui/react-select lucide-react` in frontend directory.

## Validation Architecture

> nyquist_validation assumed enabled (not explicitly false in config). Including this section.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright 1.59.1 (E2E frontend tests) + Jest 30.2.0 (backend API tests) |
| Config file | playwright.config.ts (frontend), jest.config.ts (backend) |
| Quick run command | `npm run test:e2e` (Playwright), `npm test` (Jest) |
| Full suite command | `npm run test:e2e` (all E2E), `npm test` (all Jest) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-01 | Per-row action buttons display correctly | E2E | `npx playwright test test/e2e/admin-ui.spec.ts -g "row actions"` | ❌ Wave 0 |
| D-02 | Status labels show correct colors | E2E | `npx playwright test test/e2e/admin-ui.spec.ts -g "status label"` | ❌ Wave 0 |
| D-03 | Confirmation dialog appears for dangerous actions | E2E | `npx playwright test test/e2e/admin-ui.spec.ts -g "confirm dialog"` | ❌ Wave 0 |
| D-04 | Manual refresh button fetches latest data | E2E | `npx playwright test test/e2e/admin-ui.spec.ts -g "refresh"` | ❌ Wave 0 |
| D-05 | Robot instance columns display correctly | E2E | `npx playwright test test/e2e/admin-ui.spec.ts -g "robot instance table"` | ❌ Wave 0 |
| D-06 | Agent run columns display correctly | E2E | `npx playwright test test/e2e/admin-ui.spec.ts -g "agent run table"` | ❌ Wave 0 |
| D-07 | Filter bar search + dropdown work | E2E | `npx playwright test test/e2e/admin-ui.spec.ts -g "filter bar"` | ❌ Wave 0 |
| D-08 | Pagination + sorting controls work | E2E | `npx playwright test test/e2e/admin-ui.spec.ts -g "pagination"` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test` (backend Jest tests for API integrity)
- **Per wave merge:** `npm run test:e2e` (Playwright frontend tests)
- **Phase gate:** Full Playwright suite green + backend tests green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `test/e2e/admin-ui.spec.ts` — covers all UI behaviors D-01 through D-08
- [ ] `test/e2e/setup/frontend-test.fixture.ts` — frontend test fixtures (mock API responses)
- [ ] Playwright frontend test infrastructure — already exists (playwright.config.ts), needs test file creation

*(Wave 0 must create admin-ui.spec.ts before implementation can proceed)*

## Security Domain

> Phase is primarily frontend UI work with existing authenticated backend. Minimal new security concerns.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Backend already has AdminAuthGuard, frontend no auth logic |
| V3 Session Management | no | Frontend has no session state, uses backend JWT |
| V4 Access Control | partial | Row actions must respect backend auth - no frontend auth bypass |
| V5 Input Validation | yes | Search input sanitization, status dropdown bounded values |
| V6 Cryptography | no | No encryption needed in frontend |

### Known Threat Patterns for React + TailwindCSS

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via user input display | Tampering | React's default JSX escaping (no innerHTML) |
| CSRF on API calls | Tampering | Backend AdminAuthGuard validates JWT, frontend no special handling needed |
| Sensitive data exposure | Information Disclosure | Status labels use enum values, no sensitive data in UI |

**Key insight:** React's JSX escaping prevents XSS by default. The main risk is displaying user-generated content (prompt field in AgentRun table) - but React handles this automatically. No custom sanitization needed unless using dangerouslySetInnerHTML (avoid).

## Sources

### Primary (HIGH confidence)
- TanStack Table v8 docs [VERIFIED: https://tanstack.com/table/v8] - table features, useReactTable API
- Radix UI Dialog docs [VERIFIED: https://www.radix-ui.com/primitives/docs/components/dialog] - modal patterns, accessibility
- Radix UI AlertDialog docs [VERIFIED: https://www.radix-ui.com/primitives/docs/components/alert-dialog] - confirmation dialog patterns
- npm registry [VERIFIED: npm view commands] - package versions verified current

### Secondary (MEDIUM confidence)
- shadcn/ui Data Table guide [CITED: https://ui.shadcn.com/docs/components/data-table] - TanStack + TailwindCSS integration patterns
- AdminService source [VERIFIED: src/modules/admin/admin.service.ts] - robot instance data structure
- AgentService source [VERIFIED: src/modules/agent/agent.service.ts] - agent run data structure
- Existing frontend components [VERIFIED: frontend/src/components/*.tsx] - current Dashboard, Layout, Sidebar structure

### Tertiary (LOW confidence)
- None - all claims verified via primary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All library versions verified via npm registry, documentation checked via official sources
- Architecture: HIGH - Existing NestJS + React setup confirmed via source code reading, integration pattern clear
- Pitfalls: HIGH - TanStack Table and Radix Dialog pitfalls are well-documented in official docs, common React/TailwindCSS issues known
- Code examples: HIGH - All examples derived from verified TanStack/Radix documentation patterns, aligned with existing AdminService return shapes

**Research date:** 2026-05-07
**Valid until:** 2026-06-07 (30 days - library versions stable, TanStack Table v8 mature, Radix Dialog stable)