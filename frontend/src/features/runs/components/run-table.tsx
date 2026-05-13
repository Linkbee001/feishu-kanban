import { useMemo, useState } from 'react';
import { MoreHorizontal, Terminal, RefreshCw } from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { AgentRun } from '@/types/dashboard';

interface RunTableProps {
  runs: AgentRun[];
  loading: boolean;
  error: Error | null;
  total: number;
  onViewLogs: (runId: string) => void;
}

export function RunTable({ runs, loading, error, total, onViewLogs }: RunTableProps) {
  const columns: ColumnDef<AgentRun>[] = useMemo(
    () => [
      {
        accessorKey: 'status',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: 'chatName',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Group" />
        ),
        cell: ({ row }) => row.original.chatName || row.original.chatId,
      },
      {
        accessorKey: 'skillName',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Skill" />
        ),
        cell: ({ row }) => row.original.skillName || 'Unknown',
      },
      {
        accessorKey: 'intent',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Intent" />
        ),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{row.original.intent}</span>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Created" />
        ),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {new Date(row.original.createdAt).toLocaleString('zh-CN')}
          </span>
        ),
      },
      {
        id: 'actions',
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onViewLogs(row.original.id)}>
                <Terminal className="mr-2 h-4 w-4" />
                View Logs
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [onViewLogs]
  );

  return (
    <DataTable
      columns={columns}
      data={runs}
      total={total}
      loading={loading}
      error={error}
      emptyMessage="No runs found"
      emptyDescription="Agent runs will appear here when tasks are executed."
    />
  );
}
