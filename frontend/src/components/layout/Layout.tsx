import { Outlet } from 'react-router';
import { Sidebar } from './Sidebar';

export function Layout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fbf7f1] to-[#f5efe6]">
      <div className="flex h-screen">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Header */}
          <header className="h-16 bg-white/90 backdrop-blur-sm border-b border-gray-200 flex items-center px-6">
            <div className="flex items-center gap-2 text-sm text-muted">
              <span>Admin</span>
              <span>/</span>
              <span className="text-ink">Dashboard</span>
            </div>
          </header>

          {/* Content Area */}
          <main className="flex-1 p-6 overflow-auto">
            <div className="bg-white/90 backdrop-blur-sm border border-white/70 rounded-3xl shadow-lg p-6 min-h-full">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
