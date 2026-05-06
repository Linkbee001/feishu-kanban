import { useApi } from '../hooks/useApi';

interface DashboardStats {
  totalInstances: number;
  activeSessions: number;
  runningRuns: number;
  recentArtifacts: number;
}

export function Dashboard() {
  const { data: instances, loading } = useApi<{ chatId: string; runtimeStatus: string | null }[]>('/api/admin/robot-instances');

  // Calculate statistics from instances
  const stats: DashboardStats = {
    totalInstances: instances?.length ?? 0,
    activeSessions: instances?.filter(i => i.runtimeStatus === 'running').length ?? 0,
    runningRuns: 0, // Would need separate API call
    recentArtifacts: 0, // Would need separate API call
  };

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-muted">加载中...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="border-b border-gray-200 pb-4">
        <h2 className="text-xl font-semibold text-ink">仪表盘</h2>
        <p className="text-sm text-muted mt-1">关键统计和快速操作入口</p>
      </div>

      <div className="mt-6 grid grid-cols-4 gap-4">
        <StatCard label="机器人实例数" value={stats.totalInstances} />
        <StatCard label="活跃会话" value={stats.activeSessions} color="primary" />
        <StatCard label="运行中的 Agent" value={stats.runningRuns} color="warning" />
        <StatCard label="最近产物数" value={stats.recentArtifacts} />
      </div>

      <div className="mt-6 bg-gradient-to-br from-primary/10 to-white rounded-2xl p-4 border border-primary/20">
        <h3 className="font-semibold text-ink">快速操作</h3>
        <div className="mt-3 flex gap-3">
          <button className="px-4 py-2 rounded-full bg-primary text-white font-semibold hover:bg-primary/80 transition-colors">
            创建测试实例
          </button>
          <button className="px-4 py-2 rounded-full bg-primary/10 text-primary font-semibold hover:bg-primary/20 transition-colors">
            查看所有实例
          </button>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="font-semibold text-ink mb-3">最近事件</h3>
        <div className="border border-dashed border-gray-200 rounded-2xl p-4 bg-white/60">
          <p className="text-muted text-center">从左侧选择一个实例查看详细事件</p>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color = 'ink' }: { label: string; value: number; color?: string }) {
  const colorClasses = {
    ink: 'text-ink',
    primary: 'text-primary',
    warning: 'text-warning',
    danger: 'text-danger',
  };

  return (
    <div className="border border-gray-200 rounded-2xl bg-white p-3">
      <p className="text-sm text-muted">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${colorClasses[color as keyof typeof colorClasses]}`}>
        {value}
      </p>
    </div>
  );
}