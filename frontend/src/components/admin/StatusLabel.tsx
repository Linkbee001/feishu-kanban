/**
 * StatusLabel component
 * Renders colored badge with text for robot instance and agent run status
 */

import { Status } from '../../types/admin';

/**
 * Status configuration mapping
 * Matches D-02 color specification
 */
const STATUS_CONFIG: Record<Status, { bg: string; text: string; label: string; animate?: boolean }> = {
  queued: { bg: 'bg-status-queued', text: 'text-status-queued', label: 'queued' },
  running: { bg: 'bg-status-running', text: 'text-status-running', label: 'running', animate: true },
  syncing: { bg: 'bg-status-syncing', text: 'text-status-syncing', label: 'syncing' },
  succeeded: { bg: 'bg-status-succeeded', text: 'text-status-succeeded', label: 'succeeded' },
  failed: { bg: 'bg-status-failed', text: 'text-status-failed', label: 'failed' },
};

interface StatusLabelProps {
  status: Status | null;
}

/**
 * StatusLabel renders a colored badge with status text
 * - Uses TailwindCSS utility classes from index.css
 * - Running status shows animate-pulse dot indicator
 * - Defaults to 'queued' if status is null
 */
export function StatusLabel({ status }: StatusLabelProps) {
  const resolvedStatus = status ?? 'queued';
  const config = STATUS_CONFIG[resolvedStatus];

  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-bold ${config.bg} ${config.text}`}
    >
      {config.animate && <span className="animate-pulse inline-block mr-1">●</span>}
      {config.label}
    </span>
  );
}