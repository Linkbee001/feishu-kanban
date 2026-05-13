import { useState, useEffect, useCallback } from 'react';

export interface LogLine {
  id: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | 'EXEC' | 'SUCCESS';
  message: string;
  timestamp: string;
}

interface UseLogPollReturn {
  logs: LogLine[];
  loading: boolean;
  error: Error | null;
  isPolling: boolean;
}

export function useLogPoll(runId: string | null, enabled: boolean = true): UseLogPollReturn {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchLogs = useCallback(async () => {
    if (!runId) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/runs/${runId}/logs`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      setLogs(data.logs || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch logs'));
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    if (!enabled || !runId) {
      setLogs([]);
      return;
    }

    fetchLogs();
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, [enabled, runId, fetchLogs]);

  return {
    logs,
    loading,
    error,
    isPolling: enabled && !!runId,
  };
}
