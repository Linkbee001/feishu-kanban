import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface RunFiltersProps {
  status: string;
  onStatusChange: (value: string) => void;
  onRefresh: () => void;
  loading?: boolean;
  className?: string;
}

export function RunFilters({
  status,
  onStatusChange,
  onRefresh,
  loading,
  className,
}: RunFiltersProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Status Filter */}
      <Select value={status} onValueChange={onStatusChange}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="All Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="queued">Queued</SelectItem>
          <SelectItem value="running">Running</SelectItem>
          <SelectItem value="succeeded">Succeeded</SelectItem>
          <SelectItem value="failed">Failed</SelectItem>
          <SelectItem value="canceled">Canceled</SelectItem>
        </SelectContent>
      </Select>

      {/* Refresh */}
      <Button
        variant="outline"
        size="icon"
        onClick={onRefresh}
        disabled={loading}
      >
        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
      </Button>
    </div>
  );
}
