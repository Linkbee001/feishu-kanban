import { useState, useCallback } from 'react';
import { FlaskConical, Play, Pause, RotateCcw, Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { useGroups } from '@/hooks/useGroups';
import { useLogPoll } from '@/hooks/useLogPoll';
import { LogLevel } from '@/types/dashboard';
import { apiPost } from '@/hooks/useApi';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const SKILLS = [
  { value: 'chat', label: 'Chat', description: 'General conversation' },
  { value: 'task', label: 'Task', description: 'Task execution' },
  { value: 'analyze', label: 'Analyze', description: 'Data analysis' },
  { value: 'search', label: 'Search', description: 'Information retrieval' },
];

const levelColors: Record<LogLevel, string> = {
  INFO: 'text-gray-400',
  EXEC: 'text-blue-400',
  SUCCESS: 'text-green-400',
  WARN: 'text-yellow-400',
  ERROR: 'text-red-400',
  DEBUG: 'text-purple-400',
};

export function AgentTestingPage() {
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedSkill, setSelectedSkill] = useState('');
  const [intent, setIntent] = useState('');
  const [triggering, setTriggering] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const { groups, loading: groupsLoading } = useGroups();
  const { logs, loading: logsLoading } = useLogPoll(runId, !!runId);

  const handleTrigger = useCallback(async () => {
    if (!selectedGroup || !selectedSkill || !intent) {
      toast.error('Please fill in all fields');
      return;
    }

    setTriggering(true);
    try {
      const response = await apiPost<{ runId: string; status: string }>('/admin/agent/trigger', {
        groupId: selectedGroup,
        skill: selectedSkill,
        intent,
      });
      setRunId(response.runId);
      toast.success('Task triggered successfully');
    } catch (error) {
      toast.error('Failed to trigger task');
    } finally {
      setTriggering(false);
    }
  }, [selectedGroup, selectedSkill, intent]);

  const handleReset = () => {
    setRunId(null);
    setSelectedGroup('');
    setSelectedSkill('');
    setIntent('');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Agent Testing</h1>
        <p className="text-muted-foreground">
          Test and debug AI agent behavior in real-time
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Task Trigger Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Task Trigger
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Group Selector */}
            <div className="space-y-2">
              <Label>Group</Label>
              <Select value={selectedGroup} onValueChange={setSelectedGroup} disabled={groupsLoading}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a group" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group) => (
                    <SelectItem key={group.chatId} value={group.chatId}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Skill Selector */}
            <div className="space-y-2">
              <Label>Skill</Label>
              <Select value={selectedSkill} onValueChange={setSelectedSkill}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a skill" />
                </SelectTrigger>
                <SelectContent>
                  {SKILLS.map((skill) => (
                    <SelectItem key={skill.value} value={skill.value}>
                      <div className="flex flex-col">
                        <span>{skill.label}</span>
                        <span className="text-xs text-muted-foreground">{skill.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Intent Input */}
            <div className="space-y-2">
              <Label>Intent</Label>
              <Textarea
                placeholder="Describe the task in natural language..."
                value={intent}
                onChange={(e) => setIntent(e.target.value)}
                className="min-h-[100px]"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={handleTrigger}
                disabled={triggering || !selectedGroup || !selectedSkill || !intent}
                className="flex-1"
              >
                <Play className="mr-2 h-4 w-4" />
                {triggering ? 'Triggering...' : 'Trigger Task'}
              </Button>
              <Button variant="outline" onClick={handleReset} disabled={!runId}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset
              </Button>
            </div>

            {runId && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FlaskConical className="h-4 w-4" />
                Run ID: <code className="bg-muted px-1 rounded">{runId.slice(0, 8)}</code>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status Monitor */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="secondary" className="h-5">Status</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-500">
                  {logsLoading ? '...' : logs.filter((l) => l.level === 'INFO').length}
                </div>
                <div className="text-sm text-muted-foreground">Info</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-500">
                  {logsLoading ? '...' : logs.filter((l) => l.level === 'EXEC').length}
                </div>
                <div className="text-sm text-muted-foreground">Execute</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-500">
                  {logsLoading ? '...' : logs.filter((l) => l.level === 'SUCCESS').length}
                </div>
                <div className="text-sm text-muted-foreground">Success</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Log Stream */}
      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Real-time Log Stream
          </CardTitle>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="autoscroll"
                checked={autoScroll}
                onCheckedChange={setAutoScroll}
              />
              <Label htmlFor="autoscroll" className="text-sm cursor-pointer">
                Auto-scroll
              </Label>
            </div>
            {logsLoading && (
              <Badge variant="secondary" className="animate-pulse">
                Polling...
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-[#0d1117] rounded-lg overflow-hidden">
            <ScrollArea className="h-[400px] p-4">
              {logs.length === 0 ? (
                <div className="text-gray-500 text-center py-12">
                  No logs yet. Trigger a task to see real-time logs.
                </div>
              ) : (
                <div className="font-mono text-sm space-y-1">
                  {logs.map((log, index) => (
                    <div key={index} className="flex gap-2">
                      <span className="text-gray-500 shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString('zh-CN')}
                      </span>
                      <span className={cn('shrink-0', levelColors[log.level])}>
                        [{log.level}]
                      </span>
                      <span className="text-gray-200">{log.message}</span>
                    </div>
                  ))}
                  {logsLoading && (
                    <div className="text-gray-500 animate-pulse">...</div>
                  )}
                </div>
              )}
            </ScrollArea>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
