export type AgentOutputType = 'document' | 'task' | 'file' | 'log' | 'summary';
export type AgentWakeMode = 'interactive' | 'scheduled_digest' | 'event_digest' | 'maintenance';
export type DigestType =
  | 'daily_status'
  | 'weekly_report_draft'
  | 'run_completion'
  | 'risk_watch'
  | 'stale_project';
export type DigestTargetChannel = 'group_message' | 'feishu_doc' | 'bitable' | 'internal_digest';
export type ManagerIntent =
  | 'project_init'
  | 'document_generate'
  | 'task_breakdown'
  | 'code_analysis'
  | 'progress_summary'
  | 'environment_switch'
  | 'weekly_report'
  | 'meeting_minutes'
  | 'requirement_analysis'
  | 'risk_review'
  | 'stale_project_review';
export type ManagerInteractiveAction = 'ask_followup' | 'request_confirmation' | 'execute';
export type ManagerInteractiveOutputMode = 'summary' | 'document' | 'task' | 'file' | 'mixed';

export interface SummaryPolicy {
  enabled: boolean;
  internalOnly: boolean;
  dailyStatus: boolean;
  weeklyDraft: boolean;
  timezone: string;
  dailyStatusChannel: DigestTargetChannel;
  weeklyDraftChannel: DigestTargetChannel;
}

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

export interface FeishuFolderEntrySnapshot {
  token: string;
  title: string;
  type: string;
  parentToken?: string | null;
  url?: string | null;
  updatedAt?: string | null;
}

export interface FeishuDocumentSnapshot {
  token: string;
  title: string;
  type: string;
  url?: string | null;
  updatedAt?: string | null;
  summary?: string | null;
  rawContent?: string | null;
}

export interface BitableRecordSnapshot {
  recordId: string;
  fields: Record<string, unknown>;
}

export interface BitableSnapshot {
  totalTasks: number;
  openTasks: number;
  blockedTasks: number;
  overdueTasks: number;
  unassignedTasks: number;
  fields: Array<{
    fieldId?: string;
    fieldName: string;
    type?: number;
  }>;
  recentRows: BitableRecordSnapshot[];
}

export interface ProjectContextBundle {
  project: {
    id: string;
    name: string;
    feishuChatId: string;
    docFolderToken?: string | null;
    bitableAppToken?: string | null;
    bitableTableId?: string | null;
    defaultEnvironmentId?: string | null;
  };
  environment: {
    id: string;
    name: string;
    repoUrl?: string | null;
    repoBranch?: string | null;
    projectPath?: string | null;
    modelName?: string | null;
    skillSet?: unknown;
  };
  session: {
    runtimeSessionKey: string;
    memorySummary?: string | null;
    sessionMode: 'bootstrap' | 'active' | 'disabled';
    status: 'idle' | 'busy' | 'error' | 'disabled';
  };
  recentMessages: Array<{
    id: string;
    senderOpenId: string;
    rawText: string;
    receivedAt: string;
  }>;
  recentRuns: Array<{
    id: string;
    intent: string;
    status: string;
    outputSummary?: string | null;
    finishedAt?: string | null;
  }>;
  recentArtifacts: Array<{
    id: string;
    type: string;
    title: string;
    status: string;
    createdAt: string;
    feishuUrl?: string | null;
  }>;
  folderEntries: FeishuFolderEntrySnapshot[];
  folderEntriesTruncated: boolean;
  docSnapshots: FeishuDocumentSnapshot[];
  bitableSnapshot: BitableSnapshot | null;
  sourceErrors?: Record<string, string>;
}

export interface ManagerDecision {
  wakeMode: AgentWakeMode;
  intent: ManagerIntent;
  targetChannels: DigestTargetChannel[];
  shouldNotifyGroup: boolean;
  shouldWriteDoc: boolean;
  confidence: 'low' | 'medium' | 'high';
  reason: string;
}

export interface ManagerInteractiveDecision {
  action: ManagerInteractiveAction;
  confidence: 'low' | 'medium' | 'high';
  reason: string;
  reply: string;
  intent: ManagerIntent;
  executionGoal?: string;
  executionPrompt?: string;
  outputMode?: ManagerInteractiveOutputMode;
  targetChannels?: DigestTargetChannel[];
  skillHint?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ManagerConfirmationPayload {
  reply: string;
  intent: ManagerIntent;
  executionGoal?: string;
  executionPrompt: string;
  outputMode?: ManagerInteractiveOutputMode;
  targetChannels?: DigestTargetChannel[];
  skillHint?: string | null;
  metadata?: Record<string, unknown>;
}

export interface PiMonoCreateRunRequest {
  runtimeSessionKey: string;
  sessionStoreRef?: string | null;
  agentScopeKey?: string;
  sessionMode?: 'bootstrap' | 'active' | 'disabled';
  requestKind?: 'bootstrap' | 'interactive_decision' | 'formal_execution';
  wakeMode?: AgentWakeMode;
  digestType?: DigestType | null;
  projectContextBundle?: ProjectContextBundle;
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

export type InteractiveGroupSubmitResult =
  | {
      status: 'followup';
      session: {
        id: string;
        runtimeSessionKey: string;
      };
      decision: ManagerInteractiveDecision;
      reply: string;
    }
  | {
      status: 'confirmation_requested';
      session: {
        id: string;
        runtimeSessionKey: string;
      };
      decision: ManagerInteractiveDecision;
      reply: string;
      actionType: string;
      confirmationPayload: ManagerConfirmationPayload;
    }
  | {
      status: 'accepted';
      session: {
        id: string;
        runtimeSessionKey: string;
      };
      decision: ManagerInteractiveDecision;
      reply: string;
      runId: string;
      lockToken: string;
    }
  | { status: 'rejected_busy'; reason?: string }
  | { status: 'failed'; reason: string };
