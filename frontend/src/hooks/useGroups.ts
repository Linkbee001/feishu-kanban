import { useState, useCallback, useEffect } from 'react';
import { apiGet, apiDelete } from './useApi';
import { GroupListResponse, GroupListItem, GroupStatus } from '../types/dashboard';

interface UseGroupsParams {
  page?: number;
  limit?: number;
  status?: GroupStatus;
  search?: string;
}

interface UseGroupsReturn {
  groups: GroupListItem[];
  total: number;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  setParams: (params: Partial<UseGroupsParams>) => void;
  unbind: (chatId: string) => Promise<void>;
  unbinding: boolean;
}

export function useGroups(initialParams: UseGroupsParams = {}): UseGroupsReturn {
  const [params, setParamsState] = useState<UseGroupsParams>({
    page: 1,
    limit: 25,
    ...initialParams,
  });
  const [data, setData] = useState<GroupListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [unbinding, setUnbinding] = useState(false);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.set('page', String(params.page));
      if (params.limit) queryParams.set('limit', String(params.limit));
      if (params.status) queryParams.set('status', params.status);
      if (params.search) queryParams.set('search', params.search);
      
      const response = await apiGet<GroupListResponse>(`/admin/groups?${queryParams.toString()}`);
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch groups'));
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const setParams = useCallback((newParams: Partial<UseGroupsParams>) => {
    setParamsState((prev) => ({ ...prev, ...newParams }));
  }, []);

  const unbind = useCallback(async (chatId: string) => {
    setUnbinding(true);
    try {
      await apiDelete(`/admin/groups/${chatId}`);
      await fetchGroups();
    } finally {
      setUnbinding(false);
    }
  }, [fetchGroups]);

  return {
    groups: data?.groups || [],
    total: data?.total || 0,
    loading,
    error,
    refetch: fetchGroups,
    setParams,
    unbind,
    unbinding,
  };
}
