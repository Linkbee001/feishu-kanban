/**
 * RobotInstanceTable component
 * TanStack Table for displaying robot instances with sortable columns
 */

import { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  ColumnDef,
  SortingState,
} from '@tanstack/react-table';
import { useApi } from '../../hooks/useApi';
import { RobotInstance } from '../../types/admin';
import { StatusLabel } from './StatusLabel';

/**
 * Column definitions for RobotInstance table
 * Matches D-05 specification: Chat ID, Session Mode, Project Name, Last Active, Status
 */
const columns: ColumnDef<RobotInstance>[] = [
  { accessorKey: 'chatId', header: 'Chat ID' },
  { accessorKey: 'sessionMode', header: 'Session Mode' },
  { accessorKey: 'projectName', header: 'Project Name' },
  {
    accessorKey: 'lastActiveAt',
    header: 'Last Active',
    cell: ({ row }) => new Date(row.original.lastActiveAt).toLocaleString('zh-CN'),
  },
  {
    accessorKey: 'runtimeStatus',
    header: 'Status',
    cell: ({ row }) => <StatusLabel status={row.original.runtimeStatus} />,
  },
];

/**
 * RobotInstanceTable displays robot instance data in a sortable table
 * - Fetches data from /api/admin/robot-instances using useApi hook
 * - Columns match D-05 specification
 * - Column headers clickable for sorting (D-08)
 * - Shows loading and error states
 */
export function RobotInstanceTable() {
  const { data: instances, loading, error } = useApi<RobotInstance[]>(
    '/api/admin/robot-instances'
  );
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data: instances ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting },
    onSortingChange: setSorting,
  });

  if (loading) {
    return <div className="p-4 text-muted">加载中...</div>;
  }

  if (error) {
    return <div className="p-4 text-danger">加载失败: {error.message}</div>;
  }

  return (
    <table className="min-w-full bg-white border border-gray-200 rounded-lg">
      <thead className="bg-panel border-b border-gray-200">
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <th
                key={header.id}
                className="px-4 py-2 text-left text-sm font-semibold text-ink cursor-pointer hover:bg-primary/10"
                onClick={header.column.getToggleSortingHandler()}
              >
                {flexRender(header.column.columnDef.header, header.getContext())}
                {{
                  asc: ' ↑',
                  desc: ' ↓',
                }[header.column.getIsSorted() as string] ?? null}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id} className="border-b border-gray-200 hover:bg-primary/5">
            {row.getVisibleCells().map((cell) => (
              <td key={cell.id} className="px-4 py-2 text-sm text-ink">
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}