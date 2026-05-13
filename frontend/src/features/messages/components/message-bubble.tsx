import { User, Bot } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { MessageListItem } from '@/types/dashboard';

interface MessageBubbleProps {
  message: MessageListItem;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isBot = message.senderType === 'bot';
  const time = new Date(message.receivedAt).toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={cn('flex gap-3 p-3 rounded-lg', isBot ? 'bg-muted/50' : 'bg-background')}>
      {/* Avatar */}
      <Avatar className={cn('h-8 w-8', isBot ? 'bg-primary/10' : 'bg-secondary')}>
        <AvatarFallback className={cn('text-xs', isBot ? 'text-primary' : 'text-secondary-foreground')}>
          {isBot ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{message.senderName}</span>
          {message.isBotMentioned && (
            <Badge variant="secondary" className="text-[10px]">
              @bot
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">{time}</span>
        </div>
        <p className="text-sm mt-1 break-words">{message.rawText}</p>
      </div>
    </div>
  );
}
