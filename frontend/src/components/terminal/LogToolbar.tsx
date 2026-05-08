import { GroupListItem } from '../../types/dashboard';
import { Scroll, Trash2, Filter, Search } from 'lucide-react';

interface LogToolbarProps {
  autoScroll: boolean;
  onAutoScrollChange: (enabled: boolean) => void;
  onClear: () => void;
  groups: GroupListItem[];
  selectedGroup: string;
  onGroupChange: (groupId: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function LogToolbar({
  autoScroll,
  onAutoScrollChange,
  onClear,
  groups,
  selectedGroup,
  onGroupChange,
  searchQuery,
  onSearchChange,
}: LogToolbarProps) {
  return (
    <div className="bg-[#161b22] border-b border-[#30363d] p-2 flex items-center gap-2 flex-wrap">
      {/* Auto-scroll toggle */}
      <button
        onClick={() => onAutoScrollChange(!autoScroll)}
        className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 transition-colors ${
          autoScroll
            ? 'bg-primary/20 text-primary border border-primary/30'
            : 'bg-[#21262d] text-[#8b949e] border border-[#30363d]'
        }`}
        title={autoScroll ? '自动滚动: 开' : '自动滚动: 关'}
      >
        <Scroll className="w-4 h-4" />
        <span>自动滚动</span>
        <span className={`ml-1 px-1.5 py-0.5 rounded text-xs ${autoScroll ? 'bg-primary/30' : 'bg-[#30363d]'}`}>
          {autoScroll ? '开' : '关'}
        </span>
      </button>

      {/* Clear button */}
      <button
        onClick={onClear}
        className="px-3 py-1.5 rounded-md text-sm font-medium bg-[#21262d] text-[#8b949e] border border-[#30363d] flex items-center gap-1.5 hover:bg-[#30363d] hover:text-[#c9d1d9] transition-colors"
        title="清空日志"
      >
        <Trash2 className="w-4 h-4" />
        <span>清空</span>
      </button>

      {/* Group filter */}
      <div className="flex items-center gap-1.5">
        <Filter className="w-4 h-4 text-[#8b949e]" />
        <select
          value={selectedGroup}
          onChange={(e) => onGroupChange(e.target.value)}
          className="px-2 py-1.5 rounded-md text-sm bg-[#21262d] text-[#c9d1d9] border border-[#30363d] focus:outline-none focus:border-primary"
        >
          <option value="">所有群</option>
          {groups.map((group) => (
            <option key={group.chatId} value={group.chatId}>
              {group.name}
            </option>
          ))}
        </select>
      </div>

      {/* Search input */}
      <div className="flex items-center gap-1.5 ml-auto">
        <Search className="w-4 h-4 text-[#8b949e]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="搜索日志..."
          className="px-3 py-1.5 rounded-md text-sm bg-[#21262d] text-[#c9d1d9] border border-[#30363d] focus:outline-none focus:border-primary w-[200px]"
        />
      </div>
    </div>
  );
}