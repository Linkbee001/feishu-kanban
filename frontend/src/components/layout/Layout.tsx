import { useState, useEffect } from 'react';
import { Outlet } from 'react-router';
import { Menu, X } from 'lucide-react';
import { Sidebar } from './Sidebar';

// Media query hook for detecting mobile/tablet
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);

    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width: 1024px)');

  // Close sidebar when switching to desktop mode
  useEffect(() {
    if (!isMobile && sidebarOpen) {
      setSidebarOpen(false);
    }
  }, [isMobile, sidebarOpen]);

  // Close sidebar on navigation (mobile)
  const handleSidebarClose = () => {
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fbf7f1] to-[#f5efe6]">
      <div className="flex h-screen">
        {/* Mobile sidebar backdrop */}
        {isMobile && sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div
          className={
            isMobile
              ? `fixed inset-y-0 left-0 z-50 w-[280px] transform transition-transform duration-300 ease-in-out ${
                  sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                }`
              : 'w-[280px] flex-shrink-0'
          }
        >
          <Sidebar onClose={handleSidebarClose} isMobile={isMobile} />
        </div>

        {/* Main Content */}
        <div className={`flex-1 flex flex-col min-w-0 overflow-hidden ${!isMobile ? 'lg:ml-0' : ''}`}>
          {/* Header */}
          <header className="h-16 bg-white/90 backdrop-blur-sm border-b border-gray-200 flex items-center px-6 gap-4">
            {/* Hamburger menu button (mobile only) */}
            {isMobile && (
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-lg hover:bg-panel transition-colors"
              >
                {sidebarOpen ? (
                  <X className="w-6 h-6 text-ink" />
                ) : (
                  <Menu className="w-6 h-6 text-ink" />
                )}
              </button>
            )}

            {/* Breadcrumb */}
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