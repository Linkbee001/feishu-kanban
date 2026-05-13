import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { MoreHorizontal, Settings, MessageSquare, Unlink } from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { GroupListItem, GroupStatus } from '@/types/dashboard';

interface GroupTableProps {
  groups: GroupListItem[];
  loading: boolean;
  error: Error | null;
  total: number;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  onConfigure: (chatId: string) => void;
  onUnbind: (chatId: string) => void;
}

export function GroupTable({
  groups,
  loading,
  error,
  total,
  page,
  limit,
  onPageChange,
  onLimitChange,
  onConfigure,
  onUnbind,
}: GroupTableProps) {
  const navigate = useNavigate();

  const columns: ColumnDef<GroupListItem>[] = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Group Name" />
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name}</span>
        ),
      },
      {
        accessorKey: 'chatId',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Chat ID" />
        ),
        cell: ({ row }) => (
          <code className="bg-muted px-2 py-1 rounded text-xs">
            {row.original.chatId}
          </code>
        ),
      },
      {
        accessorKey: 'memberCount',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Members" />
        ),
        cell: ({ row }) => (
          <span>{row.original.memberCount}</span>
        ),
      },
      {
        accessorKey: 'status',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => (
          <StatusBadge status={row.original.status as GroupStatus} />
        ),
      },
      {
        accessorKey: 'createdAt',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Created" />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {new Date(row.original.createdAt).toLocaleDateString('zh-CN')}
          </span>
        ),
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          const group = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onConfigure(group.chatId)}>
                  <Settings className="mr-2 h-4 w-4" />
                  Configure
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    navigate(`/admin/messages?group=${group.chatId}`)
                  }
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  View Messages
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => onUnbind(group.chatId)}
                >
                  <Unlink className="mr-2 h-4 w-4" />
                  Unbind
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [navigate, onConfigure, onUnbind]
  );

  return (
    <DataTable
      columns={columns}
      data={groups}
      total={total}
      loading={loading}
      error={error}
      emptyMessage="No groups found"
      emptyDescription="Try adjusting your search or filters."
    />
  );
}
