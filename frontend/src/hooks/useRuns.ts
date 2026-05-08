import { useState, useCallback, useEffect } from 'react';
import { AgentRun, RunsResponse, LogLine, RunLogsResponse } from '../types/dashboard';

interface UseRunsReturn {
  runs: AgentRun[];
  total: number;
  page: number;
  limit: number;
  loading: boolean;
  error: Error | null;
  refetch: () => void;

  // Run-specific logs
  logs: LogLine[];
  runId: string | null;
  runStatus: string | null;
  setRunId: (id: string | null) => void;
  logsLoading: boolean;
  logsError: Error | null;

  // Polling for active runs
  autoRefresh: boolean;
  setAutoRefresh: (enabled: boolean) => void;

  // Clear local logs
  clearLogs: () => void;
}

export function useRuns(initialOptions?: { group?: string; page?: number; limit?: number }): UseRunsReturn {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(initialOptions?.page ?? 1);
  const [limit, setLimit] = useState(initialOptions?.limit ?? 50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const [logs, setLogs] = useState<LogLine[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<string | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<Error | null>(null);

  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchRuns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (initialOptions?.group) queryParams.set('group', initialOptions.group);
      queryParams.set('page', String(page));
      queryParams.set('limit', String(limit));

      const response = await fetch(`/api/admin/runs?${queryParams.toString()}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch runs: ${response.status}`);
      }

      const data: RunsResponse = await response.json();
      setRuns(data.items);
      setTotal(data.total);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(new Error(message));
    } finally {
      setLoading(false);
    }
  }, [initialOptions?.group, page, limit]);

  const fetchLogs = useCallback(async (id: string) => {
    setLogsLoading(true);
    setLogsError(null);
    try {
      const response = await fetch(`/api/admin/runs/${encodeURIComponent(id)}/logs`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch run logs: ${response.status}`);
      }

      const data: RunLogsResponse = await response.json();
      setLogs(data.logs);
      setRunStatus(data.runStatus);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setLogsError(new Error(message));
    } finally {
      setLogsLoading(false);
    }
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
    setRunId(null);
    setRunStatus(null);
  }, []);

  // Fetch runs on mount and when params change
  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  // Fetch logs when runId changes
  useEffect(() => {
    if (runId) {
      fetchLogs(runId);
    }
  }, [runId, fetchLogs]);

  // Polling for active runs
  useEffect(() => {
    if (autoRefresh && runId && runStatus === 'running') {
      const interval = setInterval(() => fetchLogs(runId), 3000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, runId, runStatus, fetchLogs]);

  return {
    runs,
    total,
    page,
    limit,
    loading,
    error,
    refetch: fetchRuns,

    logs,
    runId,
    runStatus,
    setRunId,
    logsLoading,
    logsError,

    autoRefresh,
    setAutoRefresh,
    clearLogs,
  };
}