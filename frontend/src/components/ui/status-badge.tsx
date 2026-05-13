import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type GroupStatus = 'bound' | 'pending_config' | 'unbound';
type RunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';
type Status = GroupStatus | RunStatus;

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

const statusConfig: Record<Status, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'warning' }> = {
  // Group statuses
  bound: { label: '已绑定', variant: 'default' },
  pending_config: { label: '待配置', variant: 'warning' },
  unbound: { label: '已解绑', variant: 'outline' },
  // Run statuses
  queued: { label: '排队中', variant: 'outline' },
  running: { label: '运行中', variant: 'secondary' },
  succeeded: { label: '成功', variant: 'default' },
  failed: { label: '失败', variant: 'destructive' },
  canceled: { label: '已取消', variant: 'outline' },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, variant: 'outline' };

  return (
    <Badge
      variant={config.variant as 'default' | 'secondary' | 'destructive' | 'outline'}
      className={cn(
        config.variant === 'warning' && 'bg-amber-100 text-amber-800 hover:bg-amber-100',
        config.variant === 'secondary' && 'bg-blue-100 text-blue-800 hover:bg-blue-100',
        className
      )}
    >
      {config.label}
    </Badge>
  );
}
