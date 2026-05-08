/**
 * Dashboard component - Complete admin management interface
 * Shows robot instance table as main view, with detail view on selection
 */

import { useState, useCallback } from 'react';
import { RobotInstanceTable } from './admin/RobotInstanceTable';
import { AgentRunTable } from './admin/AgentRunTable';
import { FilterBar } from './admin/FilterBar';
import { InstanceDetail } from './InstanceDetail';
import { useApi } from '../hooks/useApi';

/**
 * Dashboard renders the complete admin UI
 * - Filter bar with search, status filter, and refresh
 * - Robot Instance Table with row actions
 * - Instance Detail view (replaces table when instance selected)
 * - Agent Run Table at bottom
 */
export function Dashboard() {
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const { refetch: refetchInstances } = useApi('/api/admin/robot-instances');
  const { refetch: refetchRuns } = useApi('/api/agent-runs');

  const handleRefresh = useCallback(() => {
    refetchInstances();
    refetchRuns();
  }, [refetchInstances, refetchRuns]);

  const handleBack = () => {
    setSelectedChatId(null);
  };

  return (
    <div className="space-y-6">
      {/* Filter bar - always visible */}
      <FilterBar
        onSearchChange={setSearchQuery}
        onStatusChange={setStatusFilter}
        onRefresh={handleRefresh}
      />

      {/* Main content area - either table or detail view */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {selectedChatId ? (
          /* Detail View */
          <div className="p-6">
            <button
              onClick={handleBack}
              className="mb-4 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              返回列表
            </button>
            <InstanceDetail chatId={selectedChatId} />
          </div>
        ) : (
          /* Table View */
          <div className="p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-ink">机器人实例</h2>
              <p className="text-sm text-muted">点击实例查看详情或执行操作</p>
            </div>
            <RobotInstanceTable
              searchQuery={searchQuery}
              statusFilter={statusFilter}
              onSelectInstance={setSelectedChatId}
            />
          </div>
        )}
      </div>

      {/* Agent Run Table - only show in list view */}
      {!selectedChatId && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-ink">Agent 运行记录</h2>
              <p className="text-sm text-muted">最近的 Agent 运行任务</p>
            </div>
            <AgentRunTable searchQuery={searchQuery} statusFilter={statusFilter} />
          </div>
        </div>
      )}
    </div>
  );
}
