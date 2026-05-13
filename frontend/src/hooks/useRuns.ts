import { useState, useCallback, useEffect, useRef } from 'react';
import { AgentRun, LogLine, RunLogsResponse } from '../types/dashboard';

interface UseRunsParams {
  group?: string;
}

interface UseRunsReturn {
  runs: AgentRun[];
  total: number;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
  logs: LogLine[];
  runId: string | null;
  runStatus: string | null;
  setRunId: (id: string | null) => void;
  logsLoading: boolean;
  autoRefresh: boolean;
  setAutoRefresh: (enabled: boolean) => void;
  clearLogs: () => void;
}

export function useRuns(params: UseRunsParams = {}): UseRunsReturn {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const [logs, setLogs] = useState<LogLine[]>([]);
  const [runId, setRunIdState] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<string | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch runs list
  const fetchRuns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      queryParams.set('page', '1');
      queryParams.set('limit', '50');
      if (params.group) queryParams.set('group', params.group);

      const response = await fetch(`/api/admin/runs?${queryParams.toString()}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch runs: ${response.status}`);
      }

      const data = await response.json();
      setRuns(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(new Error(message));
    } finally {
      setLoading(false);
    }
  }, [params.group]);

  // Fetch logs for a specific run
  const fetchLogs = useCallback(async (id: string) => {
    setLogsLoading(true);
    try {
      const response = await fetch(`/api/admin/runs/${id}/logs`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch logs: ${response.status}`);
      }

      const data: RunLogsResponse = await response.json();
      setLogs(data.logs || []);
      setRunStatus(data.runStatus);
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  // Set run ID and fetch logs
  const setRunId = useCallback((id: string | null) => {
    setRunIdState(id);
    if (id) {
      fetchLogs(id);
    } else {
      setLogs([]);
      setRunStatus(null);
    }
  }, [fetchLogs]);

  // Clear logs
  const clearLogs = useCallback(() => {
    setRunIdState(null);
    setLogs([]);
    setRunStatus(null);
  }, []);

  // Poll logs when auto-refresh is enabled
  useEffect(() => {
    if (runId && autoRefresh) {
      pollIntervalRef.current = setInterval(() => {
        fetchLogs(runId);
      }, 3000);
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [runId, autoRefresh, fetchLogs]);

  // Initial fetch
  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  return {
    runs,
    total,
    loading,
    error,
    refetch: () => fetchRuns(),
    logs,
    runId,
    runStatus,
    setRunId,
    logsLoading,
    autoRefresh,
    setAutoRefresh,
    clearLogs,
  };
}
