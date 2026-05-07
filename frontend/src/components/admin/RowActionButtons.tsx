/**
 * RowActionButtons component
 * Per-row action button group for table rows
 * Implements D-01: Each row displays action buttons: 创建 Agent Run, 查看日志, 配置项目
 */

import { useState } from 'react';
import { apiPost, apiDelete } from '../../hooks/useApi';
import { ConfirmDialog } from './ConfirmDialog';

interface RowActionButtonsProps {
  chatId: string; // Use row data directly (pitfall 5 prevention)
  projectName: string;
  onViewLogs?: () => void;
  onConfigureProject?: () => void;
}

/**
 * RowActionButtons displays action buttons for a table row
 * - Three buttons displayed: 创建 Agent Run, 查看日志, 配置项目
 * - Buttons styled with TailwindCSS
 * - Dangerous action (删除项目) wrapped in ConfirmDialog
 * - Action handlers use row data (chatId), not row index
 * - Buttons have hover states
 * - Exported for use in table actions column
 */
export function RowActionButtons({
  chatId,
  projectName,
  onViewLogs,
  onConfigureProject,
}: RowActionButtonsProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateAgentRun = async () => {
    setIsLoading(true);
    try {
      await apiPost('/api/agent-runs', {
        projectId: chatId,
        environmentId: 'default',
      });
      // Could trigger a refresh callback here if provided
    } catch (error) {
      console.error('Failed to create agent run:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteProject = async () => {
    setIsLoading(true);
    try {
      await apiDelete(`/api/admin/robot-instances/${chatId}`);
      // Could trigger a refresh callback here if provided
    } catch (error) {
      console.error('Failed to delete project:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex gap-2">
      {/* 创建 Agent Run button */}
      <button
        className="px-3 py-1 rounded bg-primary text-white text-sm hover:bg-primary/80 disabled:opacity-50"
        onClick={handleCreateAgentRun}
        disabled={isLoading}
      >
        创建 Agent Run
      </button>

      {/* 查看日志 button */}
      <button
        className="px-3 py-1 rounded border border-gray-200 text-sm hover:bg-primary/10 hover:border-primary"
        onClick={onViewLogs}
      >
        查看日志
      </button>

      {/* 配置项目 button */}
      <button
        className="px-3 py-1 rounded border border-gray-200 text-sm hover:bg-primary/10 hover:border-primary"
        onClick={onConfigureProject}
      >
        配置项目
      </button>

      {/* 删除项目 button (dangerous) */}
      <ConfirmDialog
        title="确认删除"
        description={`删除项目 ${projectName} 及所有相关数据，此操作不可撤销。`}
        confirmVariant="danger"
        onConfirm={handleDeleteProject}
      >
        <button className="px-3 py-1 rounded bg-danger/10 text-danger text-sm hover:bg-danger/20">
          删除
        </button>
      </ConfirmDialog>
    </div>
  );
}