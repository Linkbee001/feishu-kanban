import { Bot, User } from 'lucide-react';
import { MessageListItem } from '../../types/dashboard';
import { format } from 'date-fns';

interface MessageBubbleProps {
  message: MessageListItem;
  onViewRunLog?: (runId: string) => void;
}

export function MessageBubble({ message, onViewRunLog }: MessageBubbleProps) {
  const isUser = message.senderType === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-start' : 'justify-end'} mb-4`}>
      <div
        className={`max-w-[80%] px-4 py-3 rounded-2xl ${
          isUser
            ? 'bg-white text-ink border border-gray-200'
            : 'bg-primary/10 text-ink'
        }`}
      >
        {/* Header: sender name + timestamp */}
        <div className="flex items-center gap-2 mb-2">
          {/* Avatar icon */}
          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
            isUser ? 'bg-gray-100' : 'bg-primary/20'
          }`}>
            {isUser ? (
              <User className="w-3 h-3 text-muted" />
            ) : (
              <Bot className="w-3 h-3 text-primary" />
            )}
          </div>
          <span className="font-medium text-sm">{message.senderName}</span>
          <span className="text-xs text-muted">
            {format(new Date(message.receivedAt), 'yyyy-MM-dd HH:mm')}
          </span>
        </div>

        {/* Content */}
        <p className="text-sm whitespace-pre-wrap break-words">{message.rawText}</p>

        {/* Run log link (bot messages with agentRunId) */}
        {!isUser && message.agentRunId && onViewRunLog && (
          <button
            onClick={() => onViewRunLog(message.agentRunId!)}
            className="text-xs text-primary mt-2 hover:underline flex items-center gap-1"
          >
            查看运行日志
            <span className="text-primary">→</span>
          </button>
        )}
      </div>
    </div>
  );
}