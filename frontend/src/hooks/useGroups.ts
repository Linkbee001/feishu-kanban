import { useState, useCallback, useEffect } from 'react';
import { GroupListItem, GroupsResponse, GroupsQueryParams } from '../types/dashboard';

interface UseGroupsReturn {
  groups: GroupListItem[];
  total: number;
  page: number;
  limit: number;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
  setParams: (params: GroupsQueryParams) => void;
  unbind: (chatId: string) => Promise<void>;
  unbinding: boolean;
  unbindError: Error | null;
}

export function useGroups(initialParams?: GroupsQueryParams): UseGroupsReturn {
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(initialParams?.page ?? 1);
  const [limit, setLimit] = useState(initialParams?.limit ?? 25);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [params, setParamsState] = useState<GroupsQueryParams>(initialParams ?? {});
  const [unbinding, setUnbinding] = useState(false);
  const [unbindError, setUnbindError] = useState<Error | null>(null);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (params.status) queryParams.set('status', params.status);
      if (params.search) queryParams.set('search', params.search);
      queryParams.set('page', String(page));
      queryParams.set('limit', String(limit));

      const response = await fetch(`/api/admin/groups?${queryParams.toString()}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch groups: ${response.status}`);
      }

      const data: GroupsResponse = await response.json();
      setGroups(data.items);
      setTotal(data.total);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(new Error(message));
    } finally {
      setLoading(false);
    }
  }, [params.status, params.search, page, limit]);

  const setParams = useCallback((newParams: GroupsQueryParams) => {
    setParamsState((prev) => ({ ...prev, ...newParams }));
    if (newParams.page) setPage(newParams.page);
    if (newParams.limit) setLimit(newParams.limit);
  }, []);

  const unbind = useCallback(async (chatId: string) => {
    setUnbinding(true);
    setUnbindError(null);
    try {
      const response = await fetch(`/api/admin/groups/${encodeURIComponent(chatId)}/unbind`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({ message: 'Unbind failed' }));
        throw new Error(data.message || `Failed to unbind group: ${response.status}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setUnbindError(new Error(message));
      throw err;
    } finally {
      setUnbinding(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  return {
    groups,
    total,
    page,
    limit,
    loading,
    error,
    refetch: fetchGroups,
    setParams,
    unbind,
    unbinding,
    unbindError,
  };
}
