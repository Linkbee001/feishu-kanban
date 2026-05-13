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
import { DateRangePicker, type DateRange } from '@/components/ui/date-range-picker';
import { useGroups } from '@/hooks/useGroups';
import { cn } from '@/lib/utils';

interface MessageFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  group: string;
  onGroupChange: (value: string) => void;
  type: string;
  onTypeChange: (value: string) => void;
  dateRange: DateRange | undefined;
  onDateRangeChange: (value: DateRange | undefined) => void;
  onRefresh: () => void;
  loading?: boolean;
  className?: string;
}

export function MessageFilters({
  search,
  onSearchChange,
  group,
  onGroupChange,
  type,
  onTypeChange,
  dateRange,
  onDateRangeChange,
  onRefresh,
  loading,
  className,
}: MessageFiltersProps) {
  const { groups } = useGroups({ limit: 100 });

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {/* Search */}
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search messages..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Type Filter */}
      <Select value={type} onValueChange={onTypeChange}>
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder="All Types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          <SelectItem value="user">User</SelectItem>
          <SelectItem value="bot">Bot</SelectItem>
        </SelectContent>
      </Select>

      {/* Group Filter */}
      <Select value={group} onValueChange={onGroupChange}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="All Groups" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Groups</SelectItem>
          {groups.map((g) => (
            <SelectItem key={g.chatId} value={g.chatId}>
              {g.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Date Range */}
      <DateRangePicker
        value={dateRange}
        onChange={onDateRangeChange}
      />

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
