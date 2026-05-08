import { useEffect, useState } from 'react';
import { LayoutDashboard, Settings, RefreshCw } from 'lucide-react';
import { useApi } from '../hooks/useApi';

interface NavigationItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
}

interface RobotInstance {
  robotName: string;
  chatId: string;
  projectName: string;
  sessionStatus: string;
  sessionMode: string;
  runtimeStatus: string | null;
}

const navItems: NavigationItem[] = [
  { id: 'instances', label: '机器人实例', icon: LayoutDashboard, path: '/admin' },
  { id: 'group-config', label: '群配置', icon: Settings, path: '/admin/group-config' },
];

export function Sidebar() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const { data: instances, loading, error, refetch } = useApi<RobotInstance[]>('/api/admin/robot-instances');

  // Refresh when page becomes visible (returning from group-config)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refetch();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refetch]);

  // Update current path on navigation
  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleNavClick = (path: string) => {
    window.location.href = path;
  };

  const isNavActive = (path: string) => {
    if (path === '/admin') {
      return currentPath === '/admin' || currentPath === '/';
    }
    return currentPath === path;
  };

  return (
    <div className="space-y-4">
      {/* Navigation */}
      <div className="bg-white/90 backdrop-blur-sm border border-white/70 rounded-3xl shadow-lg overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-semibold text-ink">导航</h2>
        </div>
        <nav className="p-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = isNavActive(item.path);
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all text-left ${
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted hover:bg-gray-100'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Robot Instances */}
      <div className="bg-white/90 backdrop-blur-sm border border-white/70 rounded-3xl shadow-lg overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-ink">机器人实例</h2>
          <button
            onClick={refetch}
            disabled={loading}
            className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-50"
            title="刷新"
          >
            <RefreshCw className={`w-4 h-4 text-muted ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="p-4 space-y-3">
          {loading && (
            <p className="text-muted text-center py-4">加载中...</p>
          )}
          {error && (
            <p className="text-danger text-center py-4">加载失败: {error.message}</p>
          )}
          {!loading && !error && instances?.map((instance) => (
            <InstanceCard key={instance.chatId} instance={instance} />
          ))}
          {!loading && !error && instances?.length === 0 && (
            <p className="text-muted text-center py-4">暂无机器人实例</p>
          )}
        </div>
      </div>
    </div>
  );
}

function InstanceCard({ instance }: { instance: RobotInstance }) {
  return (
    <div className="border border-gray-200 rounded-2xl bg-white p-3 hover:border-primary/30 hover:shadow-md transition-all">
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
