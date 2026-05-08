import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fbf7f1] to-[#f5efe6]">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/90 backdrop-blur-sm">
        <div className="max-w-[1520px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-ink">Admin Dashboard</h1>
              <p className="text-sm text-muted mt-1">飞书机器人实例管理后台</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted">v1.4.0</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main layout */}
      <main className="max-w-[1520px] mx-auto px-6 py-6">
        <div className="grid grid-cols-[280px_1fr] gap-6">
          <Sidebar />
          <div className="bg-white/90 backdrop-blur-sm border border-white/70 rounded-3xl shadow-lg overflow-hidden">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
