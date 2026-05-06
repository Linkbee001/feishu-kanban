import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';

interface LayoutProps {
  children: ReactNode;
  onSelectInstance?: (chatId: string) => void;
}

export function Layout({ children, onSelectInstance }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fbf7f1] to-[#f5efe6]">
      {/* Hero section */}
      <header className="max-w-[1520px] mx-auto px-6 py-6">
        <div className="bg-white/90 backdrop-blur-sm border border-white/70 rounded-3xl shadow-lg p-6">
          <h1 className="text-4xl font-bold tracking-tight text-ink">
            Runtime Console
          </h1>
          <p className="mt-3 text-muted max-w-[78ch] leading-relaxed">
            这个看板按 runtime-first 管理方式组织信息。我们把会话真实状态、队列策略、repo 能力状态和 runtime 事件时间线放到一线视图里，方便直接观察当前机器人是"正在跑什么、还在等什么、下一步为什么会这样"。
          </p>
        </div>
      </header>

      {/* Main layout */}
      <main className="max-w-[1520px] mx-auto px-6 pb-6">
        <div className="grid grid-cols-[360px_1fr] gap-4">
          <Sidebar onSelectInstance={onSelectInstance} />
          <div className="bg-white/90 backdrop-blur-sm border border-white/70 rounded-3xl shadow-lg overflow-hidden">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}