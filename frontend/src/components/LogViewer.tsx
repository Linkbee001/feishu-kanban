import { useLogPoll } from '../hooks/useLogPoll';

interface LogViewerProps {
  chatId: string;
}

export function LogViewer({ chatId }: LogViewerProps) {
  const { logs, error } = useLogPoll(chatId, 5000);

  if (error) {
    return (
      <div className="p-4 text-danger">
        <p>日志加载失败: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-gray-200 flex justify-between items-center">
        <h3 className="font-semibold text-ink">实时日志</h3>
        <span className="text-sm text-muted">自动刷新 (5s)</span>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-2 font-mono text-sm">
        {logs.length === 0 && (
          <p className="text-muted text-center py-8">暂无日志</p>
        )}

        {logs.map((event, i) => (
          <div key={i} className="border border-gray-200 rounded-lg p-2 bg-white">
            <div className="flex justify-between items-center">
              <span className="font-bold text-ink">{event.eventType}</span>
              <span className="text-xs text-muted">{event.createdAt}</span>
            </div>
            <pre className="mt-1 text-muted overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(event.payload || {}, null, 2).slice(0, 200)}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}