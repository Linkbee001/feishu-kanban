import { useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { MessageSquare } from 'lucide-react';
import { useMessages } from '../hooks/useMessages';
import { useGroups } from '../hooks/useGroups';
import { MessageThread } from '../components/messages/MessageThread';
import { MessageFilters } from '../components/messages/MessageFilters';

export function MessagesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Initialize filters from URL query params
  const initialGroup = searchParams.get('group') ?? '';
  const initialStartDate = searchParams.get('startDate') ?? '';
  const initialEndDate = searchParams.get('endDate') ?? '';
  const initialType = (searchParams.get('type') as 'all' | 'user' | 'bot') ?? 'all';

  const {
    messages,
    total,
    loading,
    error,
    filters,
    setFilters,
    refetch,
    loadMore,
    hasMore,
  } = useMessages({
    group: initialGroup,
    startDate: initialStartDate,
    endDate: initialEndDate,
    type: initialType,
  });

  const { groups } = useGroups();

  // Sync URL params when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.group) params.set('group', filters.group);
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    if (filters.type !== 'all') params.set('type', filters.type);
    navigate(`/admin/messages?${params.toString()}`, { replace: true });
  }, [filters, navigate]);

  // Handle view run log navigation
  const handleViewRunLog = useCallback((runId: string) => {
    navigate(`/admin/runs?runId=${runId}`);
  }, [navigate]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-[28px] font-bold text-ink flex items-center gap-2">
          <MessageSquare className="w-7 h-7 text-primary" />
          消息记录
        </h1>
        <p className="text-sm text-muted mt-1">机器人消息历史</p>
      </div>

      {/* Filters */}
      <MessageFilters
        groups={groups}
        filters={filters}
        onFilterChange={setFilters}
      />

      {/* Error state */}
      {error && (
        <div className="p-4 bg-danger/10 border border-danger/30 rounded-xl text-danger">
          加载失败，请刷新重试: {error.message}
        </div>
      )}

      {/* Message thread */}
      <MessageThread
        messages={messages}
        loading={loading}
        hasMore={hasMore}
        onLoadMore={loadMore}
        onViewRunLog={handleViewRunLog}
      />

      {/* Stats */}
      {!loading && messages.length > 0 && (
        <div className="text-sm text-muted">
          显示 {messages.length} 条消息，共 {total} 条
        </div>
      )}
    </div>
  );
}