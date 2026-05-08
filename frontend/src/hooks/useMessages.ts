import { useState, useCallback, useEffect } from 'react';
import { MessageListItem, MessagesResponse, MessagesQueryParams, MessageType } from '../types/dashboard';

interface UseMessagesReturn {
  messages: MessageListItem[];
  total: number;
  page: number;
  limit: number;
  filters: {
    group: string;
    startDate: string;
    endDate: string;
    type: MessageType;
  };
  loading: boolean;
  error: Error | null;
  setFilters: (filters: Partial<UseMessagesReturn['filters']>) => void;
  refetch: () => void;
  loadMore: () => void;
  hasMore: boolean;
}

export function useMessages(initialFilters?: Partial<UseMessagesReturn['filters']>): UseMessagesReturn {
  const [messages, setMessages] = useState<MessageListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [filters, setFiltersState] = useState<UseMessagesReturn['filters']>({
    group: initialFilters?.group ?? '',
    startDate: initialFilters?.startDate ?? '',
    endDate: initialFilters?.endDate ?? '',
    type: initialFilters?.type ?? 'all',
  });

  const fetchMessages = useCallback(async (resetPage = false) => {
    setLoading(true);
    setError(null);
    try {
      const currentPage = resetPage ? 1 : page;
      const queryParams = new URLSearchParams();
      if (filters.group) queryParams.set('group', filters.group);
      if (filters.startDate) queryParams.set('startDate', filters.startDate);
      if (filters.endDate) queryParams.set('endDate', filters.endDate);
      if (filters.type !== 'all') queryParams.set('type', filters.type);
      queryParams.set('page', String(currentPage));
      queryParams.set('limit', String(limit));

      const response = await fetch(`/api/admin/messages?${queryParams.toString()}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch messages: ${response.status}`);
      }

      const data: MessagesResponse = await response.json();
      if (resetPage) {
        setMessages(data.items);
        setPage(1);
      } else {
        setMessages((prev) => [...prev, ...data.items]);
      }
      setTotal(data.total);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(new Error(message));
    } finally {
      setLoading(false);
    }
  }, [filters, page, limit]);

  const setFilters = useCallback((newFilters: Partial<UseMessagesReturn['filters']>) => {
    setFiltersState((prev) => ({ ...prev, ...newFilters }));
    setPage(1); // Reset page when filters change
  }, []);

  const loadMore = useCallback(() => {
    if (messages.length < total && !loading) {
      setPage((prev) => prev + 1);
    }
  }, [messages.length, total, loading]);

  const hasMore = messages.length < total;

  // Fetch when filters or page changes
  useEffect(() => {
    fetchMessages(true);
  }, [filters.group, filters.startDate, filters.endDate, filters.type]);

  // Fetch additional page when page increments
  useEffect(() => {
    if (page > 1) {
      fetchMessages(false);
    }
  }, [page]);

  return {
    messages,
    total,
    page,
    limit,
    filters,
    loading,
    error,
    setFilters,
    refetch: () => fetchMessages(true),
    loadMore,
    hasMore,
  };
}