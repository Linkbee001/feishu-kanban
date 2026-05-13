import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { MessageSquare } from 'lucide-react';
import { MessageFilters } from './components/message-filters';
import { MessageList } from './components/message-list';
import { EmptyState } from '@/components/ui/empty-state';
import { useMessages } from '@/hooks/useMessages';
import { MessageType } from '@/types/dashboard';

export function MessagesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const groupFromUrl = searchParams.get('group') || '';

  const [filters, setFilters] = useState({
    search: '',
    group: groupFromUrl,
    startDate: '',
    endDate: '',
    type: 'all' as MessageType,
  });

  const {
    messages,
    total,
    loading,
    error,
    setFilters: setActiveFilters,
    refetch,
  } = useMessages({
    group: filters.group,
    startDate: filters.startDate,
    endDate: filters.endDate,
    type: filters.type,
  });

  // Sync URL params
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.group) params.set('group', filters.group);
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    if (filters.type !== 'all') params.set('type', filters.type);
    setSearchParams(params, { replace: true });

    // Update active filters
    setActiveFilters({
      group: filters.group,
      startDate: filters.startDate,
      endDate: filters.endDate,
      type: filters.type,
    });
  }, [filters, setSearchParams]);

  const handleSearchChange = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, search: value }));
  }, []);

  const handleGroupChange = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, group: value === 'all' ? '' : value }));
  }, []);

  const handleTypeChange = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, type: value as MessageType }));
  }, []);

  const handleStartDateChange = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, startDate: value }));
  }, []);

  const handleEndDateChange = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, endDate: value }));
  }, []);

  // Filter messages by search locally
  const filteredMessages = messages.filter((m) => {
    if (!filters.search) return true;
    const searchLower = filters.search.toLowerCase();
    return (
      m.rawText.toLowerCase().includes(searchLower) ||
      m.senderName.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Messages</h1>
        <p className="text-muted-foreground">
          View and filter message history
        </p>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          <p>Failed to load messages: {error.message}</p>
        </div>
      )}

      {/* Filters */}
      <MessageFilters
        search={filters.search}
        onSearchChange={handleSearchChange}
        group={filters.group || 'all'}
        onGroupChange={handleGroupChange}
        type={filters.type}
        onTypeChange={handleTypeChange}
        startDate={filters.startDate}
        onStartDateChange={handleStartDateChange}
        endDate={filters.endDate}
        onEndDateChange={handleEndDateChange}
        onRefresh={refetch}
        loading={loading}
      />

      {/* Message List */}
      <MessageList
        messages={filteredMessages}
        loading={loading}
      />
    </div>
  );
}
