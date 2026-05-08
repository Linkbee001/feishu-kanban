import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import * as Collapsible from '@radix-ui/react-collapsible';
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Terminal,
  Settings,
  ChevronRight,
} from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path?: string;
  children?: { id: string; label: string; path: string }[];
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' },
  {
    id: 'groups',
    label: '群管理',
    icon: Users,
    children: [
      { id: 'groups-list', label: '群列表', path: '/admin/groups' },
      { id: 'groups-pending', label: '待配置群', path: '/admin/groups?filter=pending' },
    ],
  },
  { id: 'messages', label: '消息记录', icon: MessageSquare, path: '/admin/messages' },
  { id: 'runs', label: '运行日志', icon: Terminal, path: '/admin/runs' },
  { id: 'settings', label: '系统设置', icon: Settings, path: '/admin/settings' },
];

export function Sidebar() {
  const location = useLocation();
  const [openSections, setOpenSections] = useState<string[]>(['groups']);

  const isActive = (path: string) => {
    if (path.includes('?')) {
      const [basePath] = path.split('?');
      return location.pathname === basePath && location.search === path.substring(path.indexOf('?'));
    }
    return location.pathname === path;
  };

  const isSectionActive = (item: NavItem) => {
    if (item.path) return isActive(item.path);
    if (item.children) {
      return item.children.some((child) => location.pathname === child.path);
    }
    return false;
  };

  const toggleSection = (id: string) => {
    setOpenSections((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  return (
    <div className="w-[280px] h-full bg-white border-r border-gray-200 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-xl font-bold text-ink">Feishu Kanban</h1>
        <p className="text-xs text-muted mt-1">管理后台</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const hasChildren = item.children && item.children.length > 0;
          const isOpen = openSections.includes(item.id);
          const sectionActive = isSectionActive(item);

          if (hasChildren) {
            return (
              <Collapsible.Root
                key={item.id}
                open={isOpen}
                onOpenChange={() => toggleSection(item.id)}
              >
                <Collapsible.Trigger asChild>
                  <button
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all text-left ${
                      sectionActive
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-ink hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 transition-transform duration-200 ${
                        isOpen ? 'rotate-90' : ''
                      }`}
                    />
                  </button>
                </Collapsible.Trigger>

                <Collapsible.Content className="overflow-hidden">
                  <div className="ml-4 mt-1 space-y-1">
                    {item.children?.map((child) => {
                      const childActive = isActive(child.path);
                      return (
                        <Link
                          key={child.id}
                          to={child.path}
                          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                            childActive
                              ? 'bg-primary/10 text-primary font-medium border-l-4 border-primary'
                              : 'text-muted hover:bg-gray-100'
                          }`}
                        >
                          <span>{child.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </Collapsible.Content>
              </Collapsible.Root>
            );
          }

          return (
            <Link
              key={item.id}
              to={item.path!}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                isActive(item.path!)
                  ? 'bg-primary/10 text-primary font-medium border-l-4 border-primary'
                  : 'text-ink hover:bg-gray-100'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200">
        <p className="text-xs text-muted text-center">v1.0.0</p>
      </div>
    </div>
  );
}
