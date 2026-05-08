/**
 * GroupsPage component
 * Group management page with DataTable, filtering, and pagination
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { ColumnDef, SortingState } from '@tanstack/react-table';
import { useNavigate, useSearchParams } from 'react-router';
import { Plus, Search, RefreshCw, MoreHorizontal, Settings, MessageSquare, Unlink } from 'lucide-react';
import { DataTable, Pagination } from '../components/data-table';
import { StatusBadge } from '../components/admin/StatusBadge';
import { ConfirmDialog } from '../components/admin/ConfirmDialog';
import { GroupConfigDrawer } from '../components/drawer';
import { useGroups } from '../hooks/useGroups';
import { GroupListItem, GroupStatus } from '../types/dashboard';

const STATUS_OPTIONS: { value: GroupStatus | ''; label: string }[] = [
  { value: '', label: '全部状态' },
  { value: 'bound', label: '已绑定' },
  { value: 'pending_config', label: '待配置' },
  { value: 'unbound', label: '已解绑' },
];

export function GroupsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<GroupStatus | ''>('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  // URL-based drawer state
  const drawerOpen = searchParams.get('drawer') === 'group-config';
  const drawerChatId = searchParams.get('chatId') || null;

  const { groups, total, loading, error, refetch, setParams } = useGroups({
    page,
    limit,
  });

  // Open drawer by setting URL params
  const openDrawer = useCallback((chatId: string) => {
    setSearchParams({ drawer: 'group-config', chatId });
  }, [setSearchParams]);

  // Close drawer by clearing URL params
  const closeDrawer = useCallback(() => {
    setSearchParams({});
  }, [setSearchParams]);

  // Handle drawer saved - refresh table and close
  const handleDrawerSaved = useCallback(() => {
    refetch();
    closeDrawer();
  }, [refetch, closeDrawer]);

  // Apply filters
  const filteredGroups = useMemo(() => {
    let result = groups;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (group) =>
          group.name.toLowerCase().includes(query) ||
          group.chatId.toLowerCase().includes(query)
      );
    }

    if (statusFilter) {
      result = result.filter((group) => group.status === statusFilter);
    }

    return result;
  }, [groups, searchQuery, statusFilter]);

  // Handle filter changes
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setPage(1);
  }, []);

  const handleStatusChange = useCallback((value: GroupStatus | '') => {
    setStatusFilter(value);
    setParams({ status: value || undefined });
    setPage(1);
  }, [setParams]);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
    setParams({ page: newPage });
  }, [setParams]);

  const handleLimitChange = useCallback((newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
    setParams({ limit: newLimit, page: 1 });
  }, [setParams]);

  // Row actions
  const handleConfigure = useCallback((chatId: string) => {
    openDrawer(chatId);
  }, [openDrawer]);

  const handleViewMessages = useCallback((chatId: string) => {
    navigate(`/admin/messages?group=${encodeURIComponent(chatId)}`);
  }, [navigate]);

  const handleUnbind = useCallback((chatId: string, name: string) => {
    // Unbind is handled via ConfirmDialog in RowActions
  }, []);

  // Table columns
  const columns: ColumnDef<GroupListItem>[] = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: '群名称',
        cell: ({ row }) => (
          <span className="font-medium text-ink">{row.original.name}</span>
        ),
        meta: { width: 'flex' },
      },
      {
        accessorKey: 'chatId',
        header: 'Chat ID',
        cell: ({ row }) => (
          <code className="text-xs bg-gray-100 px-2 py-1 rounded">{row.original.chatId}</code>
        ),
        meta: { width: '200px' },
      },
      {
        accessorKey: 'memberCount',
        header: '成员数',
        cell: ({ row }) => (
          <span className="text-muted">{row.original.memberCount}</span>
        ),
        meta: { width: '100px' },
      },
      {
        accessorKey: 'status',
        header: '状态',
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
        meta: { width: '120px' },
      },
      {
        accessorKey: 'createdAt',
        header: '创建时间',
        cell: ({ row }) => (
          <span className="text-muted text-xs">
            {new Date(row.original.createdAt).toLocaleDateString('zh-CN')}
          </span>
        ),
        meta: { width: '160px' },
      },
      {
        id: 'actions',
        header: '操作',
        cell: ({ row }) => (
          <RowActions
            group={row.original}
            onConfigure={handleConfigure}
            onViewMessages={handleViewMessages}
            onUnbind={handleUnbind}
          />
        ),
        meta: { width: '120px' },
      },
    ],
    [handleConfigure, handleViewMessages, handleUnbind]
  );

  return (
    <div>
      {/* Page Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[28px] font-bold text-ink">群管理</h1>
          <p className="text-sm text-muted mt-1">群列表与管理</p>
        </div>
        <button
          onClick={() => handleConfigure('')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          配置新群
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 flex items-center gap-4">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              placeholder="搜索群名称或 Chat ID..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted">状态:</span>
          <select
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value as GroupStatus | '')}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={refetch}
          className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-muted hover:bg-panel transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          刷新
        </button>
      </div>

      {/* Data Table */}
      <DataTable
        data={filteredGroups}
        columns={columns}
        sorting={sorting}
        onSortingChange={setSorting}
        loading={loading}
        error={error}
        emptyMessage="暂无群数据"
      />

      {/* Pagination */}
      {!loading && !error && (
        <Pagination
          total={total}
          page={page}
          limit={limit}
          onPageChange={handlePageChange}
          onLimitChange={handleLimitChange}
        />
      )}

      {/* Group Config Drawer */}
      <GroupConfigDrawer
        chatId={drawerChatId}
        open={drawerOpen}
        onOpenChange={(open) => {
          if (!open) closeDrawer();
        }}
        onSaved={handleDrawerSaved}
      />
    </div>
  );
}

// Row Actions Dropdown Component
interface RowActionsProps {
  group: GroupListItem;
  onConfigure: (chatId: string) => void;
  onViewMessages: (chatId: string) => void;
  onUnbind: (chatId: string, name: string) => void;
}

function RowActions({ group, onConfigure, onViewMessages, onUnbind }: RowActionsProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleUnbindClick = () => {
    setIsOpen(false);
    onUnbind(group.chatId, group.name);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-primary hover:bg-primary/10 rounded-lg transition-colors"
      >
        <Settings className="w-4 h-4" />
        <span>配置</span>
        <MoreHorizontal className="w-3 h-3" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1">
            <button
              onClick={() => {
                onConfigure(group.chatId);
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-ink hover:bg-panel transition-colors"
            >
              <Settings className="w-4 h-4" />
              配置
            </button>
            <button
              onClick={() => {
                onViewMessages(group.chatId);
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-ink hover:bg-panel transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              查看消息
            </button>
            <div className="border-t border-gray-100 my-1" />
            <ConfirmDialog
              title="解绑群"
              description={`确定要解绑群"${group.name}"吗？解绑后机器人将不再响应此群消息。`}
              onConfirm={handleUnbindClick}
              confirmText="解绑"
              cancelText="取消"
              confirmVariant="danger"
            >
              <button
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-danger hover:bg-danger/5 transition-colors"
              >
                <Unlink className="w-4 h-4" />
                解绑
              </button>
            </ConfirmDialog>
          </div>
        </>
      )}
    </div>
  );
}
