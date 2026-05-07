/**
 * FilterBar component
 * Search input, status dropdown, and manual refresh button
 * Implements D-07 (filter bar) and D-04 (manual refresh button)
 */

import * as Select from '@radix-ui/react-select';

interface FilterBarProps {
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string | null) => void;
  onRefresh: () => void;
}

/**
 * FilterBar renders search input, status dropdown, and refresh button
 * - Search input: placeholder "搜索项目名称或 Chat ID..."
 * - Status dropdown: Radix Select with options 全部状态, 运行中, 成功, 失败, 排队中
 * - Refresh button: "刷新数据" triggers onRefresh callback
 * - Uses TailwindCSS for styling
 */
export function FilterBar({ onSearchChange, onStatusChange, onRefresh }: FilterBarProps) {
  return (
    <div className="flex gap-4 items-center p-4 bg-white/50 border-b border-gray-200">
      {/* Search input */}
      <input
        type="text"
        placeholder="搜索项目名称或 Chat ID..."
        className="px-3 py-2 border border-gray-200 rounded-lg flex-1 text-ink focus:outline-none focus:border-primary"
        onChange={(e) => onSearchChange(e.target.value)}
      />

      {/* Status dropdown (Radix Select) */}
      <Select.Root onValueChange={(v) => onStatusChange(v === 'all' ? null : v)}>
        <Select.Trigger className="px-3 py-2 border border-gray-200 rounded-lg text-ink focus:outline-none focus:border-primary inline-flex items-center justify-between gap-2 min-w-[120px]">
          <Select.Value placeholder="筛选状态" />
          <Select.Icon>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content className="bg-white rounded-lg border border-gray-200 shadow-lg overflow-hidden">
            <Select.Viewport className="p-1">
              <Select.Item value="all" className="px-3 py-2 text-ink cursor-pointer hover:bg-primary/10 rounded outline-none select-none">
                <Select.ItemText>全部状态</Select.ItemText>
              </Select.Item>
              <Select.Item value="running" className="px-3 py-2 text-ink cursor-pointer hover:bg-primary/10 rounded outline-none select-none">
                <Select.ItemText>运行中</Select.ItemText>
              </Select.Item>
              <Select.Item value="succeeded" className="px-3 py-2 text-ink cursor-pointer hover:bg-primary/10 rounded outline-none select-none">
                <Select.ItemText>成功</Select.ItemText>
              </Select.Item>
              <Select.Item value="failed" className="px-3 py-2 text-ink cursor-pointer hover:bg-primary/10 rounded outline-none select-none">
                <Select.ItemText>失败</Select.ItemText>
              </Select.Item>
              <Select.Item value="queued" className="px-3 py-2 text-ink cursor-pointer hover:bg-primary/10 rounded outline-none select-none">
                <Select.ItemText>排队中</Select.ItemText>
              </Select.Item>
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>

      {/* Manual refresh button */}
      <button
        onClick={onRefresh}
        className="px-4 py-2 rounded-lg bg-primary text-white font-semibold hover:bg-primary/80 transition-colors inline-flex items-center gap-2"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="inline">
          <path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C14.8273 3 17.2999 4.30871 18.9138 6.26282C19.4328 6.89091 19.6939 7.48871 20 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M20 4V8H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        刷新数据
      </button>
    </div>
  );
}