import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { Terminal, Inbox } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';
import { Terminal as TerminalComponent } from '../components/terminal';
import { useRuns } from '../hooks/useRuns';
import { useGroups } from '../hooks/useGroups';
import { GroupListItem } from '../types/dashboard';

export function RunsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const runIdFromUrl = searchParams.get('runId');
  const groupFromUrl = searchParams.get('group');

  // State for group filter
  const [selectedGroup, setSelectedGroup] = useState<string>(groupFromUrl ?? '');
  const [searchQuery, setSearchQuery] = useState('');

  // Hooks
  const {
    runs,
    total,
    loading: runsLoading,
    error: runsError,
    logs,
    runId,
    runStatus,
    setRunId,
    logsLoading,
    autoRefresh,
    setAutoRefresh,
    clearLogs,
  } = useRuns({ group: selectedGroup });

  const { groups, loading: groupsLoading } = useGroups();

  // Set runId from URL on mount
  useEffect(() => {
    if (runIdFromUrl) {
      setRunId(runIdFromUrl);
    }
  }, [runIdFromUrl, setRunId]);

  // Update URL params when group changes
  const handleGroupChange = (groupId: string) => {
    setSelectedGroup(groupId);
    if (groupId) {
      setSearchParams({ group: groupId });
    } else {
      setSearchParams({});
    }
    clearLogs();
  };

  // Handle run selection
  const handleRunSelect = (id: string) => {
    setRunId(id);
    setSearchParams({ runId: id });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-[28px] font-bold text-ink">运行日志</h1>
        <p className="text-sm text-muted mt-1">任务执行日志</p>
      </div>

      {/* Run selector (if not viewing specific run) */}
      {!runId && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-ink">最近运行</h2>
            <p className="text-sm text-muted mt-1">选择运行查看详细日志</p>
          </div>

          {runsLoading ? (
            <div className="p-8 text-center text-muted">
              <div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-primary rounded-full mb-3 mx-auto" />
              <p>加载运行列表...</p>
            </div>
          ) : runsError ? (
            <div className="p-8 text-center text-danger">
              <p>加载失败: {runsError.message}</p>
            </div>
          ) : runs.length === 0 ? (
            <EmptyState
              icon={Inbox}
              heading="暂无运行日志"
              body="等待任务执行后查看日志"
            />
          ) : (
            <div className="divide-y divide-gray-100">
              {runs.slice(0, 10).map((run) => (
                <button
                  key={run.id}
                  onClick={() => handleRunSelect(run.id)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    {/* Status indicator */}
                    <span
                      className={`w-2 h-2 rounded-full ${
                        run.status === 'running'
                          ? 'bg-primary animate-pulse'
                          : run.status === 'succeeded'
                            ? 'bg-green-500'
                            : run.status === 'failed'
                              ? 'bg-danger'
                              : 'bg-gray-400'
                      }`}
                    />

                    <div>
                      <p className="font-medium text-ink">{run.intent}</p>
                      <p className="text-xs text-muted mt-0.5">
                        {run.chatName} • {run.skillName ?? '未知技能'}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-muted">
                      {run.startedAt
                        ? new Date(run.startedAt).toLocaleString('zh-CN')
                        : new Date(run.createdAt).toLocaleString('zh-CN')}
                    </p>
                    <p
                      className={`text-xs mt-1 ${
                        run.status === 'running'
                          ? 'text-primary'
                          : run.status === 'succeeded'
                            ? 'text-green-600'
                            : run.status === 'failed'
                              ? 'text-danger'
                              : 'text-muted'
                      }`}
                    >
                      {run.status === 'running' ? '运行中' : run.status === 'succeeded' ? '成功' : run.status === 'failed' ? '失败' : run.status}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {total > 10 && (
            <div className="p-3 border-t border-gray-200 text-center text-sm text-muted">
              共 {total} 条记录，显示前 10 条
            </div>
          )}
        </div>
      )}

      {/* Terminal */}
      {runId && (
        <div>
          {/* Run header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setRunId(null);
                  setSearchParams({});
                }}
                className="text-sm text-muted hover:text-ink transition-colors"
              >
                ← 返回运行列表
              </button>
              <span className="text-sm text-muted">|</span>
              <span className="text-sm text-ink font-medium">
                运行 {runId.slice(0, 8)}...
              </span>
              {runStatus && (
                <span
                  className={`px-2 py-0.5 rounded text-xs ${
                    runStatus === 'running'
                      ? 'bg-primary/10 text-primary'
                      : runStatus === 'succeeded'
                        ? 'bg-green-100 text-green-600'
                        : runStatus === 'failed'
                          ? 'bg-danger/10 text-danger'
                          : 'bg-gray-100 text-muted'
                  }`}
                >
                  {runStatus === 'running' ? '运行中' : runStatus === 'succeeded' ? '成功' : runStatus === 'failed' ? '失败' : runStatus}
                </span>
              )}
              {runStatus === 'running' && autoRefresh && (
                <span className="text-xs text-primary animate-pulse">实时更新中...</span>
              )}
            </div>
          </div>

          <TerminalComponent
            logs={logs}
            loading={logsLoading}
            autoScroll={autoRefresh}
            onAutoScrollChange={setAutoRefresh}
            onClear={clearLogs}
            groups={groups}
            selectedGroup={selectedGroup}
            onGroupChange={handleGroupChange}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        </div>
      )}

      {/* Terminal without runId (show all logs for selected group) */}
      {!runId && selectedGroup && (
        <TerminalComponent
          logs={[]}
          loading={false}
          autoScroll={false}
          onAutoScrollChange={setAutoRefresh}
          onClear={clearLogs}
          groups={groups}
          selectedGroup={selectedGroup}
          onGroupChange={handleGroupChange}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      )}
    </div>
  );
}