import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { MessageFilters } from './components/message-filters';
import { MessageList } from './components/message-list';
import { useMessages } from '@/hooks/useMessages';
import { MessageType } from '@/types/dashboard';
import { type DateRange } from '@/components/ui/date-range-picker';

export function MessagesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const groupFromUrl = searchParams.get('group') || '';

  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const {
    messages,
    total,
    loading,
    error,
    filters,
    setFilters: setActiveFilters,
    refetch,
  } = useMessages({
    group: groupFromUrl,
    type: 'all',
  });

  // Sync URL params when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.group) params.set('group', filters.group);
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    if (filters.type !== 'all') params.set('type', filters.type);
    setSearchParams(params, { replace: true });
  }, [filters.group, filters.startDate, filters.endDate, filters.type, setSearchParams]);

  const handleSearchChange = useCallback((value: string) => {
    setActiveFilters({ search: value });
  }, [setActiveFilters]);

  const handleGroupChange = useCallback((value: string) => {
    setActiveFilters({ group: value === 'all' ? '' : value });
  }, [setActiveFilters]);

  const handleTypeChange = useCallback((value: string) => {
    setActiveFilters({ type: value as MessageType });
  }, [setActiveFilters]);

  const handleDateRangeChange = useCallback((value: DateRange | undefined) => {
    setDateRange(value);
    setActiveFilters({
      startDate: value?.from ? value.from.toISOString().split('T')[0] : '',
      endDate: value?.to ? value.to.toISOString().split('T')[0] : '',
    });
  }, [setActiveFilters]);

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
        dateRange={dateRange}
        onDateRangeChange={handleDateRangeChange}
        onRefresh={refetch}
        loading={loading}
      />

      {/* Message List */}
      <MessageList
        messages={messages}
        loading={loading}
      />
    </div>
  );
}
