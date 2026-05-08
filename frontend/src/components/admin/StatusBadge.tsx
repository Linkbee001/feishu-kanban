/**
 * StatusBadge component
 * Displays group status with appropriate colors per UI-SPEC
 */

import { GroupStatus } from '../../types/dashboard';

interface StatusBadgeProps {
  status: GroupStatus;
}

const statusConfig: Record<GroupStatus, { label: string; bgClass: string; textClass: string }> = {
  bound: {
    label: '已绑定',
    bgClass: 'bg-primary/10',
    textClass: 'text-primary',
  },
  pending_config: {
    label: '待配置',
    bgClass: 'bg-warning/10',
    textClass: 'text-warning',
  },
  unbound: {
    label: '已解绑',
    bgClass: 'bg-gray-100',
    textClass: 'text-muted',
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig.unbound;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bgClass} ${config.textClass}`}
    >
      {config.label}
    </span>
  );
}
