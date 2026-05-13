import { useState, useCallback } from 'react';
import { Terminal } from 'lucide-react';
import { RunTable } from './components/run-table';
import { RunFilters } from './components/run-filters';
import { LogViewer } from './components/log-viewer';
import { EmptyState } from '@/components/ui/empty-state';
import { useRuns } from '@/hooks/useRuns';

export function RunsPage() {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [logViewerOpen, setLogViewerOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  const { runs, total, loading, error, refetch } = useRuns({
    group: statusFilter === 'all' ? undefined : statusFilter,
  });

  const handleViewLogs = useCallback((runId: string) => {
    setSelectedRunId(runId);
    setLogViewerOpen(true);
  }, []);

  const handleLogViewerClose = useCallback((open: boolean) => {
    setLogViewerOpen(open);
    if (!open) {
      setSelectedRunId(null);
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Runs</h1>
        <p className="text-muted-foreground">
          View agent run history and logs
        </p>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          <p>Failed to load runs: {error.message}</p>
        </div>
      )}

      {/* Filters */}
      <RunFilters
        status={statusFilter}
        onStatusChange={setStatusFilter}
        onRefresh={refetch}
        loading={loading}
      />

      {/* Table or Empty State */}
      {runs.length === 0 && !loading && statusFilter === 'all' ? (
        <EmptyState
          icon={Terminal}
          title="No runs found"
          description="Agent runs will appear here when tasks are executed."
        />
      ) : (
        <RunTable
          runs={runs}
          loading={loading}
          error={error}
          total={total}
          onViewLogs={handleViewLogs}
        />
      )}

      {/* Log Viewer */}
      <LogViewer
        runId={selectedRunId}
        open={logViewerOpen}
        onOpenChange={handleLogViewerClose}
      />
    </div>
  );
}
