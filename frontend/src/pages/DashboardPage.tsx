import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Users, Activity, MessageSquare, Terminal, Settings, CheckCircle, RefreshCw, Plus } from 'lucide-react';
import { useApi } from '../hooks/useApi';

interface DashboardStats {
  totalGroups: number;
  activeSessions: number;
  pendingConfig: number;
  todayMessages: number;
  totalRuns: number;
}

interface ActivityItem {
  id: string;
  type: 'config_update' | 'task_complete' | 'group_bind' | 'message_received';
  title: string;
  description: string;
  timestamp: string;
  link?: string | null;
}

// Activity type to icon mapping
const activityIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  config_update: Settings,
  task_complete: CheckCircle,
  group_bind: Users,
  message_received: MessageSquare,
};

// Stats card component
function StatsCard({
  icon,
  title,
  value,
  subtitle,
  trend,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: number;
  subtitle: string;
  trend?: 'up' | 'down' | 'neutral';
}) {
  const Icon = icon;
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted mb-1">{title}</p>
          <p className="text-[28px] font-bold text-ink">{value.toLocaleString()}</p>
          <p className="text-xs text-muted mt-2 flex items-center gap-1">
            {trend === 'up' && <span className="text-green-500">+</span>}
            {trend === 'down' && <span className="text-danger">-</span>}
            {subtitle}
          </p>
        </div>
        <Icon className="w-8 h-8 text-primary/60" />
      </div>
    </div>
  );
}

// Activity item component
function ActivityItemRow({
  item,
  onClick,
}: {
  item: ActivityItem;
  onClick?: () => void;
}) {
  const Icon = activityIcons[item.type] || Settings;
  const timeAgo = formatTimeAgo(new Date(item.timestamp));

  return (
    <div
      className={`flex items-start gap-3 py-3 ${
        onClick ? 'cursor-pointer hover:bg-panel/50 -mx-2 px-2 rounded-lg transition-colors' : ''
      }`}
      onClick={onClick}
    >
      <Icon className="w-5 h-5 text-muted mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-ink font-medium">{item.title}</p>
        <p className="text-xs text-muted truncate">{item.description}</p>
      </div>
      <span className="text-xs text-muted whitespace-nowrap">{timeAgo}</span>
    </div>
  );
}

// Format timestamp to relative time
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;
  return date.toLocaleDateString('zh-CN');
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: stats,
    loading: statsLoading,
    error: statsError,
    refetch: refetchStats,
  } = useApi<DashboardStats>('/api/admin/dashboard/stats');

  const {
    data: activity,
    loading: activityLoading,
    error: activityError,
    refetch: refetchActivity,
  } = useApi<ActivityItem[]>('/api/admin/dashboard/activity?limit=10');

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchStats(), refetchActivity()]);
    setRefreshing(false);
  };

  const handleActivityClick = (item: ActivityItem) => {
    if (item.link) {
      navigate(item.link);
    }
  };

  // Quick actions
  const quickActions = [
    { label: '配置新群', icon: Plus, path: '/admin/groups' },
    { label: '查看消息', icon: MessageSquare, path: '/admin/messages' },
    { label: '查看运行日志', icon: Terminal, path: '/admin/runs' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[28px] font-bold text-ink">Dashboard</h1>
          <p className="text-sm text-muted mt-1">系统概览与统计信息</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-muted hover:bg-panel transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </div>

      {/* Error state */}
      {(statsError || activityError) && (
        <div className="p-4 bg-danger/10 border border-danger/30 rounded-xl text-danger">
          加载失败，请刷新重试
          <button onClick={handleRefresh} className="ml-4 underline">
            重试
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {statsLoading ? (
          // Loading skeleton
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
                <div className="h-8 bg-gray-200 rounded w-16 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-32" />
              </div>
            </div>
          ))
        ) : stats ? (
          <>
            <StatsCard
              icon={Users}
              title="总群数"
              value={stats.totalGroups}
              subtitle={`${stats.activeSessions} 活跃`}
              trend="neutral"
            />
            <StatsCard
              icon={Activity}
              title="活跃会话"
              value={stats.activeSessions}
              subtitle={`${stats.pendingConfig} 待配置`}
              trend="up"
            />
            <StatsCard
              icon={MessageSquare}
              title="今日消息"
              value={stats.todayMessages}
              subtitle="今日收到"
              trend="neutral"
            />
          </>
        ) : (
          // Empty state
          <div className="col-span-3 bg-white rounded-2xl p-8 text-center text-muted border border-dashed border-gray-300">
            <p className="text-lg">欢迎使用</p>
            <p className="text-sm mt-2">系统运行正常，暂无统计数据</p>
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-2xl shadow-sm">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-ink">最近活动</h2>
          <p className="text-sm text-muted mt-1">系统运行状态与操作记录</p>
        </div>
        <div className="p-4">
          {activityLoading ? (
            <div className="py-8 text-center text-muted">
              <div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-primary rounded-full mb-3 mx-auto" />
              <p>加载活动记录...</p>
            </div>
          ) : activity && activity.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {activity.map((item) => (
                <ActivityItemRow
                  key={item.id}
                  item={item}
                  onClick={item.link ? () => handleActivityClick(item) : undefined}
                />
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-muted border border-dashed border-gray-300 rounded-xl">
              <p>暂无活动记录</p>
              <p className="text-sm mt-2">系统运行正常，无近期操作</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-2xl shadow-sm">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-ink">快速操作</h2>
          <p className="text-sm text-muted mt-1">常用管理功能快捷入口</p>
        </div>
        <div className="p-4 flex flex-wrap gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.path}
                onClick={() => navigate(action.path)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors text-sm font-medium shadow-sm"
              >
                <Icon className="w-4 h-4" />
                {action.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Additional Stats Row */}
      {stats && (
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <Terminal className="w-8 h-8 text-warning/60" />
              <div>
                <p className="text-sm text-muted">总运行次数</p>
                <p className="text-xl font-bold text-ink">{stats.totalRuns.toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <Settings className="w-8 h-8 text-muted" />
              <div>
                <p className="text-sm text-muted">待配置群</p>
                <p className="text-xl font-bold text-ink">{stats.pendingConfig}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}