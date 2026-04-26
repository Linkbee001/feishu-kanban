export type AgentOutputType = 'document' | 'task' | 'file' | 'log' | 'summary';

export interface AgentTaskOutput {
  title: string;
  description?: string;
  taskType?: 'feature' | 'bug' | 'risk' | 'todo' | 'release' | 'test';
  priority?: 'P0' | 'P1' | 'P2' | 'P3';
  assigneeHint?: string;
  dueDateHint?: string;
  aiSuggestion?: string;
}

export interface AgentOutput {
  type: AgentOutputType;
  title: string;
  content?: string;
  contentFormat?: 'markdown' | 'json' | 'text';
  filePath?: string;
  mimeType?: string;
  tasks?: AgentTaskOutput[];
  metadata?: Record<string, unknown>;
}

export interface PiMonoCreateRunRequest {
  runtimeSessionKey: string;
  sessionStoreRef?: string | null;
  agentScopeKey?: string;
  sessionMode?: 'bootstrap' | 'active' | 'disabled';
  project: {
    id: string;
    name: string;
    feishuChatId: string;
  };
  environment: {
    id: string;
    name: string;
    piMonoEnvId?: string | null;
    repoUrl?: string | null;
    repoBranch?: string | null;
    projectPath?: string | null;
    modelEndpoint?: string | null;
    modelName?: string | null;
    skillSet?: unknown;
  };
  source: {
    messageSourceId?: string | null;
    feishuMessageId?: string | null;
    senderOpenId?: string | null;
    traceId?: string | null;
  };
  intent: string;
  skillName?: string | null;
  prompt: string;
  outputSchema: unknown;
}

export interface PiMonoSessionSnapshot {
  runtimeSessionKey: string;
  piSessionId: string;
  sessionStoreDriver: 'local_file';
  sessionStoreRef?: string;
  memorySummary?: string;
}

export interface PiMonoExecutionResult {
  status: 'succeeded' | 'timeout' | 'canceled';
  outputSummary?: string;
  outputs?: AgentOutput[];
  session: PiMonoSessionSnapshot;
}
