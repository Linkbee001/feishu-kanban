import { useLocation } from 'react-router';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Home } from 'lucide-react';

// Route to breadcrumb mapping
const breadcrumbMap: Record<string, { label: string; parent?: string }> = {
  '/admin/dashboard': { label: 'Dashboard' },
  '/admin/groups': { label: '群管理', parent: 'Admin' },
  '/admin/messages': { label: '消息记录', parent: 'Admin' },
  '/admin/runs': { label: '运行日志', parent: 'Admin' },
  '/admin/agent-testing': { label: 'Agent测试', parent: 'Admin' },
  '/admin/settings': { label: '系统设置', parent: 'Admin' },
  '/admin/group-config': { label: '群组配置', parent: 'Admin' },
};

export function AppBreadcrumb() {
  const location = useLocation();
  const currentPath = location.pathname;
  const breadcrumb = breadcrumbMap[currentPath];

  if (!breadcrumb) {
    return null;
  }

  const items = [];

  // Add parent if exists
  if (breadcrumb.parent) {
    items.push(
      <BreadcrumbItem key="parent">
        <BreadcrumbLink href="/admin/dashboard" className="flex items-center gap-1">
          <Home className="h-3 w-3" />
          {breadcrumb.parent}
        </BreadcrumbLink>
      </BreadcrumbItem>
    );
    items.push(<BreadcrumbSeparator key="sep" />);
  }

  // Add current page
  items.push(
    <BreadcrumbItem key="current">
      <BreadcrumbPage>{breadcrumb.label}</BreadcrumbPage>
    </BreadcrumbItem>
  );

  return (
    <Breadcrumb className="mb-4">
      <BreadcrumbList>{items}</BreadcrumbList>
    </Breadcrumb>
  );
}
