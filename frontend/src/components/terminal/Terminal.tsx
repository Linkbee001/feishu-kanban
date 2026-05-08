import { useRef, useEffect, useCallback } from 'react';
import { LogLine as LogLineType, GroupListItem } from '../../types/dashboard';
import { LogLine } from './LogLine';
import { LogToolbar } from './LogToolbar';

interface TerminalProps {
  logs: LogLineType[];
  loading: boolean;
  autoScroll: boolean;
  onAutoScrollChange: (enabled: boolean) => void;
  onClear: () => void;
  groups: GroupListItem[];
  selectedGroup: string;
  onGroupChange: (groupId: string) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export function Terminal({
  logs,
  loading,
  autoScroll,
  onAutoScrollChange,
  onClear,
  groups,
  selectedGroup,
  onGroupChange,
  searchQuery = '',
  onSearchChange,
}: TerminalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Handle scroll to detect if user scrolled up
  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      if (!isAtBottom && autoScroll) {
        onAutoScrollChange(false);
      }
    }
  }, [autoScroll, onAutoScrollChange]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Filter logs by search query
  const filteredLogs = searchQuery
    ? logs.filter((log) =>
        log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.level.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : logs;

  return (
    <div className="bg-[#0d1117] rounded-lg overflow-hidden flex flex-col h-[600px]">
      {/* Toolbar */}
      <LogToolbar
        autoScroll={autoScroll}
        onAutoScrollChange={onAutoScrollChange}
        onClear={onClear}
        groups={groups}
        selectedGroup={selectedGroup}
        onGroupChange={onGroupChange}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange ?? (() => {})}
      />

      {/* Scroll area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto p-4"
      >
        {loading && filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[#8b949e]">
            <div className="text-center">
              <div className="animate-spin w-6 h-6 border-2 border-[#30363d] border-t-primary rounded-full mb-3 mx-auto" />
              <p className="text-sm">加载日志...</p>
            </div>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[#8b949e]">
            <div className="text-center">
              <p className="text-lg">暂无运行日志</p>
              <p className="text-sm mt-2">等待任务执行后查看日志</p>
            </div>
          </div>
        ) : (
          <div className="space-y-0">
            {filteredLogs.map((log, index) => (
              <LogLine
                key={`${log.timestamp}-${index}`}
                timestamp={log.timestamp}
                level={log.level}
                message={log.message}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}