import { useApi } from '../hooks/useApi';

interface RuntimeMonitorProps {
  chatId: string;
}

export function RuntimeMonitor({ chatId }: RuntimeMonitorProps) {
  const { data: runtime } = useApi(`/api/admin/robot-instances/${encodeURIComponent(chatId)}/runtime`);

  if (!runtime) {
    return <div className="p-4 text-muted">加载中...</div>;
  }

  const events = runtime.runtimeEvents || [];

  return (
    <div className="p-4">
      <div className="border-b border-gray-200 pb-3">
        <h3 className="font-semibold text-ink">运行时监控</h3>
        <p className="text-sm text-muted mt-1">实时查看运行时事件、任务板状态</p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="border border-gray-200 rounded-xl p-3 bg-white">
          <p className="text-sm text-muted">当前状态</p>
          <p className="font-bold text-primary mt-1">
            {runtime.runtimeState?.status || 'idle'}
          </p>
        </div>
        <div className="border border-gray-200 rounded-xl p-3 bg-white">
          <p className="text-sm text-muted">事件数量</p>
          <p className="font-bold text-ink mt-1">{events.length}</p>
        </div>
      </div>

      <div className="mt-4">
        <h4 className="font-semibold text-ink mb-2">事件时间线</h4>
        <div className="max-h-[200px] overflow-auto space-y-1">
          {events.slice(-20).reverse().map((event: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-sm p-1 border-b border-gray-100">
              <span className="font-semibold text-ink">{event.eventType}</span>
              <span className="text-muted">{event.createdAt}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}