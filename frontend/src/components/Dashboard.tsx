/**
 * Dashboard component
 * Main admin dashboard with integrated tables and filter bar
 * Implements D-04 (manual refresh), D-07 (filter bar), and table integration
 */

import { useState, useCallback } from 'react';
import { RobotInstanceTable } from './admin/RobotInstanceTable';
import { AgentRunTable } from './admin/AgentRunTable';
import { FilterBar } from './admin/FilterBar';
import { useApi } from '../hooks/useApi';

/**
 * Dashboard renders the main admin UI
 * - Filter bar at top with search, status dropdown, and manual refresh
 * - Robot Instance Table below filter bar
 * - Agent Run Table at bottom
 * - Filter state passed to both tables for client-side filtering
 */
export function Dashboard() {
  // Filter state (D-07)
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // Fetch data with refetch capability for manual refresh (D-04)
  const { refetch: refetchInstances } = useApi('/api/admin/robot-instances');
  const { refetch: refetchRuns } = useApi('/api/agent-runs');

  // Manual refresh handler - triggers refetch for both tables (D-04)
  const handleRefresh = useCallback(() => {
    refetchInstances();
    refetchRuns();
  }, [refetchInstances, refetchRuns]);

  return (
    <div className="p-6">
      {/* Header section */}
      <div className="border-b border-gray-200 pb-4">
        <h2 className="text-xl font-semibold text-ink">机器人实例管理</h2>
        <p className="text-sm text-muted mt-1">管理飞书机器人实例和 Agent 运行状态</p>
      </div>

      {/* Filter bar with manual refresh (D-04, D-07) */}
      <div className="mt-4">
        <FilterBar
          onSearchChange={setSearchQuery}
          onStatusChange={setStatusFilter}
          onRefresh={handleRefresh}
        />
      </div>

      {/* Robot Instance Table */}
      <div className="mt-6">
        <h3 className="font-semibold text-ink mb-3">机器人实例</h3>
        <RobotInstanceTable searchQuery={searchQuery} statusFilter={statusFilter} />
      </div>

      {/* Agent Run Table */}
      <div className="mt-6">
        <h3 className="font-semibold text-ink mb-3">Agent 运行记录</h3>
        <AgentRunTable searchQuery={searchQuery} statusFilter={statusFilter} />
      </div>
    </div>
  );
}