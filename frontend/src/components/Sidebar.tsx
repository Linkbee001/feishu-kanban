import { useApi } from '../hooks/useApi';

interface RobotInstance {
  robotName: string;
  chatId: string;
  projectName: string;
  sessionStatus: string;
  sessionMode: string;
  runtimeStatus: string | null;
}

export function Sidebar() {
  const { data: instances, loading, error } = useApi<RobotInstance[]>('/api/admin/robot-instances');

  if (loading) {
    return (
      <div className="bg-white/90 backdrop-blur-sm border border-white/70 rounded-3xl shadow-lg p-4">
        <p className="text-muted">加载中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white/90 backdrop-blur-sm border border-white/70 rounded-3xl shadow-lg p-4">
        <p className="text-danger">加载失败: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="bg-white/90 backdrop-blur-sm border border-white/70 rounded-3xl shadow-lg">
      <div className="p-4 border-b border-gray-200">
        <h2 className="font-semibold text-ink">机器人实例</h2>
        <p className="text-sm text-muted mt-1">
          从左侧选择一个群实例，查看它的 runtime 快照、任务投影、repo 能力和群策略。
        </p>
      </div>
      <div className="p-4 space-y-3">
        {instances?.map((instance) => (
          <InstanceCard key={instance.chatId} instance={instance} />
        ))}
        {instances?.length === 0 && (
          <p className="text-muted text-center py-4">暂无机器人实例</p>
        )}
      </div>
    </div>
  );
}

function InstanceCard({ instance }: { instance: RobotInstance }) {
  return (
    <div className="border border-gray-200 rounded-2xl bg-white p-3 hover:border-primary/30 hover:shadow-md transition-all cursor-pointer">
      <h3 className="font-semibold text-ink">{instance.robotName}</h3>
      <div className="mt-2 space-y-1 text-sm text-muted">
        <p>项目: {instance.projectName}</p>
        <p>Chat ID: {instance.chatId}</p>
        <p>Session: {instance.sessionStatus} / {instance.sessionMode}</p>
      </div>
      <div className="mt-2 flex gap-2 flex-wrap">
        <span className="px-2 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary">
          {instance.runtimeStatus ?? 'no-runtime'}
        </span>
      </div>
    </div>
  );
}