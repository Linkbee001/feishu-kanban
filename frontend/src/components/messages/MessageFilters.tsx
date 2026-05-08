import { GroupListItem, MessageType } from '../../types/dashboard';

interface MessageFiltersProps {
  groups: GroupListItem[];
  filters: {
    group: string;
    startDate: string;
    endDate: string;
    type: MessageType;
  };
  onFilterChange: (filters: Partial<MessageFiltersProps['filters']>) => void;
}

export function MessageFilters({ groups, filters, onFilterChange }: MessageFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl">
      {/* Group select */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-muted">群聊:</label>
        <select
          value={filters.group}
          onChange={(e) => onFilterChange({ group: e.target.value })}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">所有群</option>
          {groups.map((group) => (
            <option key={group.chatId} value={group.chatId}>
              {group.name}
            </option>
          ))}
        </select>
      </div>

      {/* Date range */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-muted">开始日期:</label>
        <input
          type="date"
          value={filters.startDate}
          onChange={(e) => onFilterChange({ startDate: e.target.value })}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm text-muted">结束日期:</label>
        <input
          type="date"
          value={filters.endDate}
          onChange={(e) => onFilterChange({ endDate: e.target.value })}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* Message type toggle */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-muted">类型:</label>
        <div className="flex gap-1">
          {(['all', 'user', 'bot'] as MessageType[]).map((type) => (
            <button
              key={type}
              onClick={() => onFilterChange({ type })}
              className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                filters.type === type
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-ink hover:bg-gray-200'
              }`}
            >
              {type === 'all' ? '全部' : type === 'user' ? '用户消息' : '机器人消息'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}