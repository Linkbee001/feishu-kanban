import { useRef, useEffect } from 'react';
import { MessageSquare } from 'lucide-react';
import { MessageListItem } from '../../types/dashboard';
import { MessageBubble } from './MessageBubble';

interface MessageThreadProps {
  messages: MessageListItem[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onViewRunLog: (runId: string) => void;
}

export function MessageThread({
  messages,
  loading,
  hasMore,
  onLoadMore,
  onViewRunLog,
}: MessageThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on initial load
  useEffect(() => {
    if (scrollRef.current && messages.length > 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Empty state
  if (messages.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center border border-dashed border-gray-300 rounded-2xl bg-gray-50">
        <MessageSquare className="w-12 h-12 text-muted mb-4" />
        <h3 className="text-lg font-semibold text-ink mb-2">暂无消息记录</h3>
        <p className="text-sm text-muted">选择群聊查看消息历史</p>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-auto p-4 bg-gray-50 border border-gray-200 rounded-2xl"
      style={{ minHeight: '400px', maxHeight: '600px' }}
    >
      {/* Message list */}
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          onViewRunLog={onViewRunLog}
        />
      ))}

      {/* Loading indicator */}
      {loading && (
        <div className="flex justify-center py-4">
          <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      )}

      {/* Load more button */}
      {hasMore && !loading && (
        <div className="flex justify-center py-4">
          <button
            onClick={onLoadMore}
            className="px-4 py-2 text-sm text-primary hover:bg-primary/10 rounded-lg transition-colors"
          >
            加载更多...
          </button>
        </div>
      )}
    </div>
  );
}