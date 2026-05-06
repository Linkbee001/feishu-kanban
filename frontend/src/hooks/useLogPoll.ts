import { useState, useEffect } from 'react';

interface LogPollResult {
  logs: any[];
  lastFetched: number | null;
  error: Error | null;
}

export function useLogPoll(chatId: string, interval = 5000): LogPollResult {
  const [logs, setLogs] = useState<any[]>([]);
  const [lastFetched, setLastFetched] = useState<number | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchLogs = async () => {
      try {
        const since = lastFetched ?? Date.now() - interval;
        const url = `/api/admin/robot-instances/${encodeURIComponent(chatId)}/logs?since=${since}&limit=20`;

        const response = await fetch(url);
        if (!response.ok) throw new Error(`API error: ${response.status}`);

        const data = await response.json();
        if (mounted) {
          // Append new events, keep max 100
          const newEvents = data.runtimeEvents || [];
          setLogs(prev => [...prev.slice(-80), ...newEvents].slice(-100));
          setLastFetched(Date.now());
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Unknown error'));
        }
      }
    };

    fetchLogs();
    const timer = setInterval(fetchLogs, interval);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [chatId, interval, lastFetched]);

  return { logs, lastFetched, error };
}