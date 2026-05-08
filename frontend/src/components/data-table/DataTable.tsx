/**
 * DataTable component
 * Generic TanStack Table wrapper with sorting support
 */

import { ReactNode } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  Row,
  OnChangeFn,
} from '@tanstack/react-table';

interface DataTableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData>[];
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  loading?: boolean;
  error?: Error | null;
  emptyMessage?: string;
  onRowClick?: (row: Row<TData>) => void;
}

export function DataTable<TData>({
  data,
  columns,
  sorting,
  onSortingChange,
  loading = false,
  error = null,
  emptyMessage = '暂无数据',
  onRowClick,
}: DataTableProps<TData>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting },
    onSortingChange,
  });

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl">
        <div className="p-12 text-center text-muted">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/3 mx-auto mb-4" />
            <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto" />
          </div>
          <p className="mt-4">加载中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl">
        <div className="p-8 text-center text-danger">
          <p>加载失败: {error.message}</p>
          <p className="text-sm text-muted mt-2">请刷新重试</p>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl">
        <div className="p-12 text-center text-muted">
          <p>{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <table className="min-w-full">
        <thead className="bg-panel border-b border-gray-200">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-4 py-3 text-left text-sm font-semibold text-ink whitespace-nowrap"
                >
                  {header.column.getCanSort() ? (
                    <button
                      onClick={header.column.getToggleSortingHandler()}
                      className="flex items-center gap-1 hover:bg-primary/10 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      <SortIndicator sorted={header.column.getIsSorted()} />
                    </button>
                  ) : (
                    flexRender(header.column.columnDef.header, header.getContext())
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-gray-100 last:border-b-0 hover:bg-primary/5 transition-colors"
              onClick={() => onRowClick?.(row)}
            >
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className="px-4 py-3 text-sm text-ink whitespace-nowrap"
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SortIndicator({ sorted }: { sorted: false | 'asc' | 'desc' }) {
  if (!sorted) {
    return <span className="text-muted/30 text-xs">↕</span>;
  }
  return (
    <span className="text-primary text-xs">
      {sorted === 'asc' ? '↑' : '↓'}
    </span>
  );
}
