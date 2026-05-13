import { LucideIcon, Plus, MessageSquare, Terminal } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface QuickAction {
  label: string;
  icon: LucideIcon;
  path: string;
  variant?: 'default' | 'secondary' | 'outline' | 'ghost';
}

interface QuickActionsProps {
  actions?: QuickAction[];
  className?: string;
}

// Default actions
const defaultActions: QuickAction[] = [
  { label: '配置新群', icon: Plus, path: '/admin/groups', variant: 'default' },
  { label: '查看消息', icon: MessageSquare, path: '/admin/messages', variant: 'secondary' },
  { label: '查看运行日志', icon: Terminal, path: '/admin/runs', variant: 'outline' },
];

export function QuickActions({ actions = defaultActions, className }: QuickActionsProps) {
  const navigate = useNavigate();

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Button
                key={action.path}
                variant={action.variant}
                size="sm"
                className="gap-2"
                onClick={() => navigate(action.path)}
              >
                <Icon className="h-4 w-4" />
                {action.label}
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
