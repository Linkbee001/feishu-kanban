/**
 * AgentRunTable component
 * TanStack Table for displaying agent run data with pagination, sorting, and client-side filtering
 */

import { useState, useEffect, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  ColumnDef,
  SortingState,
} from '@tanstack/react-table';
import { useApi } from '../../hooks/useApi';
import { AgentRun } from '../../types/admin';
import { StatusLabel } from './StatusLabel';
import { PaginationControls } from './PaginationControls';
import { ConfirmDialog } from './ConfirmDialog';
import { apiDelete } from '../../hooks/useApi';

interface AgentRunTableProps {
  searchQuery?: string;
  statusFilter?: string | null;
}

/**
 * Column definitions for AgentRun table
 * Matches D-06 specification: Run ID, Status, Prompt, Created At
 */
const columns: ColumnDef<AgentRun>[] = [
  { accessorKey: 'id', header: 'Run ID' },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <StatusLabel status={row.original.status} />,
  },
  {
    accessorKey: 'prompt',
    header: 'Prompt',
    cell: ({ row }) => {
      const prompt = row.original.prompt;
      return prompt.length > 50 ? prompt.slice(0, 50) + '...' : prompt;
    },
  },
  {
    accessorKey: 'createdAt',
    header: 'Created At',
    cell: ({ row }) => new Date(row.original.createdAt).toLocaleString('zh-CN'),
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => (
      <div className="flex gap-2">
        {/* Cancel button for running runs */}
        {row.original.status === 'running' && (
          <ConfirmDialog
            title="确认取消"
            description={`取消 Agent Run ${row.original.id}，正在执行的任务将中断。`}
            confirmVariant="danger"
            onConfirm={() => apiDelete(`/api/agent-runs/${row.original.id}/cancel`)}
          >
            <button className="px-3 py-1 rounded bg-danger/10 text-danger text-sm hover:bg-danger/20">
              取消
            </button>
          </ConfirmDialog>
        )}
        {/* View details button */}
        <button
          className="px-3 py-1 rounded border border-gray-200 text-sm hover:bg-primary/10"
          onClick={() => {/* TODO: navigate to detail view */}}
        >
          详情
        </button>
      </div>
    ),
  },
];

/**
 * AgentRunTable renders agent run data with TanStack Table
 * - Fetches data from /api/agent-runs using useApi
 * - Pagination support with getPaginationRowModel (D-08)
 * - Sortable column headers (D-08)
 * - Client-side filtering by searchQuery and statusFilter (D-07)
 * - Pagination resets when data changes (per RESEARCH.md pitfall 4)
 * - Prompt truncated to 50 chars with ellipsis
 */
export function AgentRunTable({ searchQuery = '', statusFilter = null }: AgentRunTableProps) {
  const { data: agentRuns, loading, error } = useApi<AgentRun[]>('/api/agent-runs');

  // Sorting state
  const [sorting, setSorting] = useState<SortingState>([]);

  // Pagination state
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

  // Client-side filtering (D-07)
  const filteredData = useMemo(() => {
    if (!agentRuns) return [];

    return agentRuns.filter((run) => {
      // Search filter - matches id or prompt
      const matchesSearch = !searchQuery ||
        run.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        run.prompt.toLowerCase().includes(searchQuery.toLowerCase());

      // Status filter
      const matchesStatus = !statusFilter ||
        run.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [agentRuns, searchQuery, statusFilter]);

  // Create table instance
  const table = useReactTable({
    data: filteredData,
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

  // Reset pagination when data changes (per RESEARCH.md pitfall 4)
  useEffect(() => {
    if (filteredData) {
      table.setPageIndex(0);
    }
  }, [filteredData]);

  // Loading state
  if (loading) {
    return (
      <div className="p-6">
        <p className="text-muted">加载中...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-6">
        <p className="text-danger">加载失败: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="border-b border-gray-200 pb-4">
        <h2 className="text-xl font-semibold text-ink">Agent Run 列表</h2>
        <p className="text-sm text-muted mt-1">查看和管理所有 Agent 运行记录</p>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200 rounded-lg">
          <thead className="bg-panel">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className="px-4 py-3 text-left text-sm font-semibold text-ink cursor-pointer hover:bg-primary/10 transition-colors"
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {{
                      asc: ' ↑',
                      desc: ' ↓',
                    }[header.column.getIsSorted() as string] ?? ''}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-200">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="hover:bg-panel/50 transition-colors">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 text-sm text-ink">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination controls at bottom (D-08) */}
      <PaginationControls
        currentPage={table.getState().pagination.pageIndex}
        totalPages={table.getPageCount()}
        onPrevious={() => table.previousPage()}
        onNext={() => table.nextPage()}
      />
    </div>
  );
}