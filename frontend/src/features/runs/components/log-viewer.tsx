import { useEffect, useRef, useState } from 'react';
import { Terminal, X, Pause, Play } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useLogPoll } from '@/hooks/useLogPoll';
import { LogLevel } from '@/types/dashboard';
import { cn } from '@/lib/utils';

interface LogViewerProps {
  runId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const levelColors: Record<LogLevel, string> = {
  INFO: 'text-gray-400',
  EXEC: 'text-blue-400',
  SUCCESS: 'text-green-400',
  WARN: 'text-yellow-400',
  ERROR: 'text-red-400',
  DEBUG: 'text-purple-400',
};

export function LogViewer({ runId, open, onOpenChange }: LogViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const { logs, loading, isPolling } = useLogPoll(runId, open);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[80vh]">
        <DrawerHeader className="border-b flex items-center justify-between">
          <div className="flex items-center gap-4">
            <DrawerTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              Run Logs
              {runId && (
                <Badge variant="secondary" className="font-mono text-xs">
                  {runId.slice(0, 8)}...
                </Badge>
              )}
            </DrawerTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAutoScroll(!autoScroll)}
            >
              {autoScroll ? (
                <>
                  <Pause className="h-4 w-4 mr-1" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-1" />
                  Resume
                </>
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DrawerHeader>

        <div className="flex-1 bg-[#0d1117] p-4 overflow-hidden">
          {loading && logs.length === 0 ? (
            <div className="text-gray-400 text-center py-8">Loading logs...</div>
          ) : logs.length === 0 ? (
            <div className="text-gray-400 text-center py-8">No logs available</div>
          ) : (
            <ScrollArea className="h-full" ref={scrollRef}>
              <div className="font-mono text-sm space-y-1">
                {logs.map((log, index) => (
                  <div key={index} className="flex gap-2">
                    <span className="text-gray-500 shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString('zh-CN')}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        'shrink-0 h-5 text-[10px] font-mono',
                        levelColors[log.level]
                      )}
                    >
                      {log.level}
                    </Badge>
                    <span className="text-gray-200">{log.message}</span>
                  </div>
                ))}
                {isPolling && (
                  <div className="text-gray-500 animate-pulse">...</div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
