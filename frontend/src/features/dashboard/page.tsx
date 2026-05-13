import { useEffect, useState, useCallback } from 'react';
import { Users, Activity, MessageSquare, Terminal, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { StatsCard } from './components/stats-card';
import { ActivityList } from './components/activity-list';
import { QuickActions } from './components/quick-actions';
import { DashboardStats, ActivityItem } from '@/types/dashboard';
import { apiGet } from '@/hooks/useApi';

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsData, activityData] = await Promise.all([
        apiGet<DashboardStats>('/admin/dashboard/stats'),
        apiGet<ActivityItem[]>('/admin/dashboard/activity?limit=10'),
      ]);
      setStats(statsData);
      setActivities(activityData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch dashboard data'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleRefresh = () => {
    fetchDashboard();
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your Feishu Kanban system
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={loading}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`}
          />
          Refresh
        </Button>
      </div>

      {/* Error State */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load dashboard data: {error.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatsCard
          icon={Users}
          title="Total Groups"
          value={stats?.totalGroups ?? 0}
          subtitle="All time"
          loading={loading}
        />
        <StatsCard
          icon={Activity}
          title="Active Sessions"
          value={stats?.activeSessions ?? 0}
          subtitle="Currently running"
          trend={stats?.activeSessions && stats.activeSessions > 0 ? 'up' : 'neutral'}
          loading={loading}
        />
        <StatsCard
          icon={MessageSquare}
          title="Today's Messages"
          value={stats?.todayMessages ?? 0}
          subtitle="Received today"
          loading={loading}
        />
        <StatsCard
          icon={Terminal}
          title="Total Runs"
          value={stats?.totalRuns ?? 0}
          subtitle="All time executions"
          loading={loading}
        />
        <StatsCard
          icon={Users}
          title="Pending Config"
          value={stats?.pendingConfig ?? 0}
          subtitle="Awaiting setup"
          trend={stats?.pendingConfig && stats.pendingConfig > 0 ? 'down' : 'neutral'}
          loading={loading}
        />
        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <QuickActions />
          </CardContent>
        </Card>
      </div>

      {/* Activity Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <ActivityList activities={activities} loading={loading} />
        </div>
      </div>
    </div>
  );
}
