import { useState, useCallback, useEffect } from 'react';
import { apiGet } from './useApi';
import { MessageListItem, MessagesResponse, MessageType } from '../types/dashboard';

interface UseMessagesReturn {
  messages: MessageListItem[];
  total: number;
  page: number;
  limit: number;
  filters: {
    search: string;
    group: string;
    startDate: string;
    endDate: string;
    type: MessageType;
  };
  loading: boolean;
  error: Error | null;
  setFilters: (filters: Partial<UseMessagesReturn['filters']>) => void;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  refetch: () => void;
}

interface UseMessagesParams {
  search?: string;
  group?: string;
  startDate?: string;
  endDate?: string;
  type?: MessageType;
}

export function useMessages(initialParams?: UseMessagesParams): UseMessagesReturn {
  const [messages, setMessages] = useState<MessageListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [filters, setFiltersState] = useState<UseMessagesReturn['filters']>({
    search: initialParams?.search ?? '',
    group: initialParams?.group ?? '',
    startDate: initialParams?.startDate ?? '',
    endDate: initialParams?.endDate ?? '',
    type: initialParams?.type ?? 'all',
  });

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (filters.search) queryParams.set('search', filters.search);
      if (filters.group) queryParams.set('group', filters.group);
      if (filters.startDate) queryParams.set('startDate', filters.startDate);
      if (filters.endDate) queryParams.set('endDate', filters.endDate);
      if (filters.type !== 'all') queryParams.set('type', filters.type);
      queryParams.set('page', String(page));
      queryParams.set('limit', String(limit));

      const data = await apiGet<MessagesResponse>(`/admin/messages?${queryParams.toString()}`);
      setMessages(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch messages'));
    } finally {
      setLoading(false);
    }
  }, [filters, page, limit]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const setFilters = useCallback((newFilters: Partial<UseMessagesReturn['filters']>) => {
    setFiltersState((prev) => ({ ...prev, ...newFilters }));
    setPage(1);
  }, []);

  return {
    messages,
    total,
    page,
    limit,
    filters,
    loading,
    error,
    setFilters,
    setPage,
    setLimit,
    refetch: fetchMessages,
  };
}
