import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageBubble } from './message-bubble';
import { EmptyState } from '@/components/ui/empty-state';
import { MessageSquare } from 'lucide-react';
import { MessageListItem } from '@/types/dashboard';

interface MessageListProps {
  messages: MessageListItem[];
  loading?: boolean;
}

export function MessageList({
  messages,
  loading,
}: MessageListProps) {
  if (!loading && messages.length === 0) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="No messages found"
        description="Try adjusting your filters or wait for new messages."
      />
    );
  }

  return (
    <div className="space-y-4">
      <ScrollArea className="h-[500px] rounded-md border p-4">
        <div className="space-y-2">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
