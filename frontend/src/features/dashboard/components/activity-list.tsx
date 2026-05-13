import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { Settings, CheckCircle, Users, MessageSquare, LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ActivityItem } from '@/types/dashboard';

// Activity type to icon mapping
const activityIcons: Record<string, LucideIcon> = {
  config_update: Settings,
  task_complete: CheckCircle,
  group_bind: Users,
  message_received: MessageSquare,
};

// Activity type to color mapping
const activityColors: Record<string, string> = {
  config_update: 'bg-blue-100 text-blue-600',
  task_complete: 'bg-green-100 text-green-600',
  group_bind: 'bg-purple-100 text-purple-600',
  message_received: 'bg-orange-100 text-orange-600',
};

function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
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

interface ActivityListProps {
  activities: ActivityItem[];
  loading?: boolean;
  onActivityClick?: (activity: ActivityItem) => void;
}

export function ActivityList({
  activities,
  loading = false,
  onActivityClick,
}: ActivityListProps) {
  const navigate = useNavigate();

  const handleActivityClick = (activity: ActivityItem) => {
    if (onActivityClick) {
      onActivityClick(activity);
    } else if (activity.link) {
      navigate(activity.link);
    }
  };

  const limitedActivities = useMemo(() => activities.slice(0, 10), [activities]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No recent activity
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {limitedActivities.map((activity) => {
          const Icon = activityIcons[activity.type] || MessageSquare;
          const colorClass = activityColors[activity.type] || 'bg-gray-100 text-gray-600';
          const isClickable = activity.link || onActivityClick;

          return (
            <div
              key={activity.id}
              onClick={() => isClickable && handleActivityClick(activity)}
              className={cn(
                'flex items-start gap-3 p-2 rounded-lg transition-colors',
                isClickable && 'cursor-pointer hover:bg-muted'
              )}
            >
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                  colorClass
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{activity.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {activity.description}
                </p>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {formatRelativeTime(activity.timestamp)}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
