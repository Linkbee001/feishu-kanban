import { NavLink, useLocation } from 'react-router';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Terminal,
  Settings,
  FlaskConical,
  Bot,
} from 'lucide-react';

// Navigation items configuration
const navItems = [
  { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/admin/groups', label: '群管理', icon: Users },
  { path: '/admin/messages', label: '消息记录', icon: MessageSquare },
  { path: '/admin/runs', label: '运行日志', icon: Terminal },
  { path: '/admin/agent-testing', label: 'Agent测试', icon: FlaskConical, badge: 'New' },
  { path: '/admin/settings', label: '系统设置', icon: Settings },
];

export function AppSidebar() {
  const location = useLocation();

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Bot className="h-5 w-5" />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="font-semibold text-sm">Feishu Kanban</span>
            <span className="text-xs text-muted-foreground">管理后台</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path ||
              (item.path !== '/admin/dashboard' && location.pathname.startsWith(item.path));

            return (
              <SidebarMenuItem key={item.path}>
                <SidebarMenuButton
                  asChild
                  tooltip={item.label}
                  isActive={isActive}
                >
                  <NavLink to={item.path}>
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className="ml-auto text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded group-data-[collapsible=icon]:hidden">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center gap-2 px-2 py-2 group-data-[collapsible=icon]:hidden">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/10 text-primary text-xs">
              AD
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-medium">Admin</span>
            <span className="text-xs text-muted-foreground">admin@example.com</span>
          </div>
        </div>
        <div className="px-2 py-2 text-xs text-muted-foreground text-center group-data-[collapsible=icon]:block hidden">
          v1.6
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
