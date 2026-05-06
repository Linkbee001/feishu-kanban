import { useState } from 'react';
import { useApi } from '../hooks/useApi';

interface InstanceDetailProps {
  chatId: string;
}

interface Instance {
  robotName: string;
  projectName: string;
  chatId: string;
}

interface RuntimeData {
  runtimeState?: { status?: string; queue?: { length?: number }; waitingReason?: string };
  runtimeEvents?: Array<{ eventType: string; createdAt: string; payload?: any }>;
  summary?: { queued?: number; running?: number; blocked?: number; waitingConfirmation?: number; completed?: number };
  isStreaming?: boolean;
}

interface LogsData {
  messages?: Array<any>;
  runs?: Array<any>;
  artifacts?: Array<any>;
  confirmations?: Array<any>;
  runtimeEvents?: Array<{ eventType: string; createdAt: string }>;
}

export function InstanceDetail({ chatId }: InstanceDetailProps) {
  const [activeTab, setActiveTab] = useState<'runtime' | 'logs' | 'policy'>('runtime');
  const { data: instance } = useApi<Instance>(`/api/admin/robot-instances/${encodeURIComponent(chatId)}`);
  const { data: runtime } = useApi<RuntimeData>(`/api/admin/robot-instances/${encodeURIComponent(chatId)}/runtime`);

  if (!instance) {
    return <div className="p-6 text-muted">加载中...</div>;
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-ink">{instance.robotName}</h2>
        <p className="text-sm text-muted">{instance.projectName} / {chatId}</p>
      </div>

      {/* Tabs */}
      <div className="px-4 py-3 flex gap-2 border-b border-gray-200">
        {(['runtime', 'logs', 'policy'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-2 rounded-full text-sm ${
              activeTab === tab
                ? 'bg-primary text-white'
                : 'bg-primary/10 text-ink'
            }`}
          >
            {tab === 'runtime' ? '运行时' : tab === 'logs' ? '事件日志' : '群策略'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4 overflow-auto">
        {activeTab === 'runtime' && <RuntimeContent runtime={runtime} />}
        {activeTab === 'logs' && <LogsContent chatId={chatId} />}
        {activeTab === 'policy' && <PolicyContent chatId={chatId} instance={instance} />}
      </div>

      {/* Quick actions */}
      <div className="p-4 border-t border-gray-200 flex gap-2">
        <button
          onClick={() => handleReset(chatId)}
          className="px-3 py-2 rounded-full bg-warning/10 text-warning text-sm font-semibold"
        >
          重置配置
        </button>
        <button
          onClick={() => handleDelete(chatId)}
          className="px-3 py-2 rounded-full bg-danger/10 text-danger text-sm font-semibold"
        >
          删除实例
        </button>
      </div>
    </div>
  );
}

function RuntimeContent({ runtime }: { runtime: any }) {
  if (!runtime) return <p className="text-muted">加载中...</p>;

  const runtimeState = runtime.runtimeState || {};
  const events = runtime.runtimeEvents || [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <KV label="Runtime 状态" value={runtimeState.status || '-'} />
        <KV label="队列长度" value={String(runtimeState.queue?.length || 0)} />
        <KV label="Waiting Reason" value={runtimeState.waitingReason || '-'} />
        <KV label="Streaming" value={String(runtimeState.isStreaming || false)} />
      </div>

      <div className="grid grid-cols-4 gap-2">
        <Stat label="Queued" value={runtime.summary?.queued || 0} />
        <Stat label="Running" value={runtime.summary?.running || 0} />
        <Stat label="Waiting" value={(runtime.summary?.blocked || 0) + (runtime.summary?.waitingConfirmation || 0)} color="warning" />
        <Stat label="Completed" value={runtime.summary?.completed || 0} />
      </div>

      <div>
        <h3 className="font-semibold text-ink mb-2">最近 Runtime Events</h3>
        <div className="space-y-2">
          {events.slice(-5).reverse().map((event: any, i: number) => (
            <div key={i} className="border border-gray-200 rounded-xl p-3 bg-white">
              <div className="flex justify-between">
                <span className="font-semibold">{event.eventType}</span>
                <span className="text-sm text-muted">{event.createdAt}</span>
              </div>
              <pre className="mt-2 text-sm text-muted overflow-auto">{JSON.stringify(event.payload, null, 2)}</pre>
            </div>
          ))}
          {events.length === 0 && <p className="text-muted text-center py-4">暂无事件</p>}
        </div>
      </div>
    </div>
  );
}

function LogsContent({ chatId }: { chatId: string }) {
  const { data: logs } = useApi<LogsData>(`/api/admin/robot-instances/${encodeURIComponent(chatId)}/logs`);

  if (!logs) return <p className="text-muted">加载中...</p>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <KV label="最近消息" value={`${logs.messages?.length || 0} 条`} />
        <KV label="最近 Runs" value={`${logs.runs?.length || 0} 个`} />
        <KV label="最近产物" value={`${logs.artifacts?.length || 0} 个`} />
        <KV label="确认记录" value={`${logs.confirmations?.length || 0} 条`} />
      </div>

      <div>
        <h3 className="font-semibold text-ink mb-2">Runtime 事件时间线</h3>
        <div className="space-y-2 max-h-[300px] overflow-auto">
          {logs.runtimeEvents?.slice(-10).reverse().map((event: any, i: number) => (
            <div key={i} className="border border-gray-200 rounded-xl p-2 bg-white text-sm">
              <span className="font-semibold">{event.eventType}</span>
              <span className="text-muted ml-2">{event.createdAt}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PolicyContent({ chatId, instance }: { chatId: string; instance: any }) {
  return (
    <div className="text-muted text-center py-8">
      <p>策略管理功能将在后续版本实现</p>
    </div>
  );
}

async function handleReset(chatId: string) {
  if (confirm('确定要重置配置吗？这将删除所有关联数据。')) {
    await fetch(`/api/admin/robot-instances/${encodeURIComponent(chatId)}/reset-config`, { method: 'POST' });
    window.location.reload();
  }
}

async function handleDelete(chatId: string) {
  if (confirm('确定要删除此实例吗？此操作不可恢复。')) {
    await fetch(`/api/admin/robot-instances/${encodeURIComponent(chatId)}`, { method: 'DELETE' });
    window.location.reload();
  }
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-gray-200 rounded-xl p-3 bg-white">
      <p className="text-sm text-muted">{label}</p>
      <p className="font-semibold text-ink mt-1">{value}</p>
    </div>
  );
}

function Stat({ label, value, color = 'ink' }: { label: string; value: number; color?: string }) {
  const colorClass = color === 'warning' ? 'text-warning' : 'text-ink';
  return (
    <div className="border border-gray-200 rounded-xl p-2 bg-white text-center">
      <p className="text-xs text-muted">{label}</p>
      <p className={`font-bold ${colorClass}`}>{value}</p>
    </div>
  );
}