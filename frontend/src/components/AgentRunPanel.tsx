import { useApi } from '../hooks/useApi';

interface AgentRunPanelProps {
  projectId: string;
}

export function AgentRunPanel({ projectId }: AgentRunPanelProps) {
  // Note: Would need API endpoint for runs by project
  // For now, show placeholder

  return (
    <div className="p-4">
      <div className="border-b border-gray-200 pb-3">
        <h3 className="font-semibold text-ink">Agent Run 管理</h3>
        <p className="text-sm text-muted mt-1">创建、监控、取消 Agent 运行</p>
      </div>

      <div className="mt-4">
        <button className="px-4 py-2 rounded-full bg-primary text-white font-semibold">
          创建新运行
        </button>
      </div>

      <div className="mt-4 border border-dashed border-gray-200 rounded-xl p-4 bg-white/60">
        <p className="text-muted text-center">Agent Run 列表将在后续版本实现</p>
      </div>
    </div>
  );
}