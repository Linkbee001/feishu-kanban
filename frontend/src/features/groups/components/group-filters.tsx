import { Search, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface GroupFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  onRefresh: () => void;
  loading?: boolean;
  className?: string;
}

export function GroupFilters({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  onRefresh,
  loading = false,
  className,
}: GroupFiltersProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {/* Search Input */}
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search by name or Chat ID..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Status Filter */}
      <Select value={statusFilter} onValueChange={onStatusChange}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="All Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="bound">Bound</SelectItem>
          <SelectItem value="pending_config">Pending Config</SelectItem>
          <SelectItem value="unbound">Unbound</SelectItem>
        </SelectContent>
      </Select>

      {/* Refresh Button */}
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
