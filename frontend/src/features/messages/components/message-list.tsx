import { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getExpandedRowModel,
  ColumnDef,
  flexRender,
} from '@tanstack/react-table';
import {
  ChevronRight,
  ChevronDown,
  User,
  Bot,
  MessageSquare,
  ChevronLeft,
  ChevronsLeft,
  ChevronRight as ChevronRightIcon,
  ChevronsRight,
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MessageListItem, MessageGroup, GroupListItem } from '@/types/dashboard';

interface MessageListProps {
  messages: MessageListItem[];
  groups: GroupListItem[];
  loading?: boolean;
  total: number;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}

function createColumns(): ColumnDef<MessageListItem>[] {
  return [
    {
      id: 'expander',
      header: () => null,
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 p-0"
          onClick={(e) => {
            e.stopPropagation();
            row.toggleExpanded();
          }}
        >
          {row.getIsExpanded() ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
      ),
      size: 40,
    },
    {
      accessorKey: 'receivedAt',
      header: 'Time',
      cell: ({ row }) => {
        const date = new Date(row.original.receivedAt);
        return (
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {date.toLocaleString('zh-CN', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        );
      },
    },
    {
      accessorKey: 'senderName',
      header: 'Sender',
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          {row.original.senderType === 'bot' ? (
            <Bot className="h-3.5 w-3.5 text-blue-500" />
          ) : (
            <User className="h-3.5 w-3.5 text-green-500" />
          )}
          <span className="text-sm">{row.original.senderName}</span>
        </div>
      ),
    },
    {
      accessorKey: 'senderType',
      header: 'Type',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Badge variant={row.original.senderType === 'bot' ? 'default' : 'secondary'} className="text-xs">
            {row.original.senderType === 'bot' ? 'Bot' : 'User'}
          </Badge>
          {row.original.isBotMentioned && (
            <Badge variant="outline" className="text-xs">
              @bot
            </Badge>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'rawText',
      header: 'Content',
      cell: ({ row }) => (
        <span className="max-w-[300px] truncate block text-sm" title={row.original.rawText}>
          {row.original.rawText}
        </span>
      ),
    },
    {
      accessorKey: 'feishuChatId',
      header: 'Group',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.feishuChatId}
        </span>
      ),
    },
  ];
}

export function MessageList({
  messages,
  groups,
  loading,
  total,
  page,
  limit,
  onPageChange,
  onLimitChange,
}: MessageListProps) {
  const columns = useMemo(() => createColumns(), []);

  // Group messages by feishuChatId
  const messageGroups = useMemo<MessageGroup[]>(() => {
    const groupMap = new Map<string, MessageListItem[]>();

    for (const msg of messages) {
      const existing = groupMap.get(msg.feishuChatId) || [];
      existing.push(msg);
      groupMap.set(msg.feishuChatId, existing);
    }

    // Build group list with name lookup
    const result: MessageGroup[] = [];
    for (const [chatId, msgs] of groupMap) {
      const groupInfo = groups.find((g) => g.chatId === chatId);
      result.push({
        chatId,
        chatName: groupInfo?.name || chatId,
        messages: msgs,
        lastActivity: msgs.reduce(
          (latest, msg) => (msg.receivedAt > latest ? msg.receivedAt : latest),
          msgs[0]?.receivedAt || ''
        ),
      });
    }

    // Sort groups by most recent activity (D-14)
    result.sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));

    return result;
  }, [messages, groups]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const startRow = (page - 1) * limit + 1;
  const endRow = Math.min(page * limit, total);

  // Loading state
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {Array.from({ length: 6 }).map((_, i) => (
                  <TableHead key={i}>
                    <Skeleton className="h-4 w-20" />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, rowIdx) => (
                <TableRow key={rowIdx}>
                  {Array.from({ length: 6 }).map((_, colIdx) => (
                    <TableCell key={colIdx}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  // Empty state
  if (messages.length === 0) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="No messages found"
        description="Try adjusting your filters or wait for new messages."
      />
    );
  }

  return (
    <div className="space-y-2">
      {/* Grouped collapsible sections */}
      <div className="space-y-2">
        {messageGroups.map((group) => (
          <GroupMessageTable
            key={group.chatId}
            group={group}
            columns={columns}
          />
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-2 mt-4">
        <div className="text-sm text-muted-foreground">
          Showing {total > 0 ? startRow : 0}-{endRow} of {total} messages
        </div>
        <div className="flex items-center space-x-6 lg:space-x-8">
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium">Rows per page</p>
            <Select
              value={`${limit}`}
              onValueChange={(value) => onLimitChange(Number(value))}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue placeholder={limit} />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 20, 30, 40, 50].map((size) => (
                  <SelectItem key={size} value={`${size}`}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-[100px] items-center justify-center text-sm font-medium">
            Page {page} of {totalPages}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => onPageChange(1)}
              disabled={page <= 1}
            >
              <span className="sr-only">Go to first page</span>
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
            >
              <span className="sr-only">Go to previous page</span>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
            >
              <span className="sr-only">Go to next page</span>
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => onPageChange(totalPages)}
              disabled={page >= totalPages}
            >
              <span className="sr-only">Go to last page</span>
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Renders a single group's messages in a collapsible table */
function GroupMessageTable({
  group,
  columns,
}: {
  group: MessageGroup;
  columns: ColumnDef<MessageListItem>[];
}) {
  const table = useReactTable({
    data: group.messages,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  return (
    <Collapsible defaultOpen>
      <div className="rounded-md border">
        <CollapsibleTrigger className="flex items-center gap-2 w-full px-4 py-2 hover:bg-muted/50 transition-colors">
          <ChevronRight className="h-4 w-4 transition-transform duration-200 [[data-state=open]>&]:rotate-90" />
          <span className="font-medium text-sm">{group.chatName}</span>
          <span className="text-muted-foreground text-xs">
            ({group.messages.length})
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <>
                    <TableRow
                      key={row.id}
                      className="hover:bg-muted/50 cursor-pointer"
                      onClick={() => row.toggleExpanded()}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                    {row.getIsExpanded() && (
                      <TableRow key={`${row.id}-expanded`}>
                        <TableCell
                          colSpan={row.getVisibleCells().length}
                          className="bg-muted/30 p-4"
                        >
                          <div className="whitespace-pre-wrap break-words text-sm">
                            {row.original.rawText}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    No messages.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
