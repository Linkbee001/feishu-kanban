export type AgentOutputType = 'document' | 'task' | 'file' | 'log' | 'summary';
export type AgentWakeMode = 'interactive' | 'scheduled_digest' | 'event_digest' | 'maintenance';
export type RuntimeSessionMode = 'bootstrap' | 'active' | 'disabled';
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
export type GroupRuntimeTaskStatus =
  | 'queued'
  | 'running'
  | 'blocked'
  | 'waiting_confirmation'
  | 'completed'
  | 'failed'
  | 'canceled';
export type GroupRuntimeToolActionType = 'create' | 'update' | 'start' | 'complete' | 'fail' | 'cancel' | 'block';
export type AgentRunType = 'formal_execution' | 'runtime_audit' | 'bootstrap' | 'digest';
export type RuntimeEventType =
  | 'message_submitted'
  | 'turn_completed'
  | 'confirmation_requested'
  | 'session_state_changed';

export interface GroupPolicySnapshot {
  enabled: boolean;
  mentionOnly: boolean;
  allowedSkills: string[];
  defaultEnvironmentId?: string | null;
  allowAutoTaskCreation: boolean;
  allowTaskBoardWrite: boolean;
  allowDocWrite: boolean;
  highRiskActionsRequireConfirmation: boolean;
  archivedAt?: string | null;
}

export interface ProjectMemberProfileSnapshot {
  id: string;
  openId: string;
  displayName: string;
  groupNickname?: string | null;
  projectRole?: string | null;
  responsibility?: string | null;
  permissionLevel: string;
  isDecisionMaker: boolean;
  isTaskAssignable: boolean;
  lastActiveAt?: string | null;
}

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

export interface ProjectResourceSummary {
  hasDocFolder: boolean;
  hasTaskBoard: boolean;
  recentDocs: Array<{
    title: string;
    updatedAt?: string | null;
  }>;
  taskBoardSummary?: {
    pendingConfirmation: number;
    blocked: number;
    inProgress: number;
  } | null;
  recentArtifacts: Array<{
    title: string;
    type: string;
    createdAt: string;
    feishuUrl?: string | null;
  }>;
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
    repoCredentialRef?: string | null;
    repoMirrorPath?: string | null;
    repoSyncStatus?: string | null;
    repoSyncError?: string | null;
    repoHeadRef?: string | null;
    projectPath?: string | null;
    modelName?: string | null;
    skillSet?: unknown;
  };
  session: {
    runtimeSessionKey: string;
    memorySummary?: string | null;
    sessionMode: RuntimeSessionMode;
    status: 'idle' | 'busy' | 'error' | 'disabled';
  };
  groupPolicy?: GroupPolicySnapshot | null;
  memberProfiles: ProjectMemberProfileSnapshot[];
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
  runtimeTasksSummary: {
    queued: number;
    running: number;
    blocked: number;
    waitingConfirmation: number;
    completed: number;
    failed: number;
    canceled: number;
    recent: GroupRuntimeTaskSnapshot[];
  };
  workspaceDocsSummary: Array<{
    title: string;
    token: string;
    url?: string | null;
    updatedAt?: string | null;
    summary?: string | null;
  }>;
  folderEntries: FeishuFolderEntrySnapshot[];
  folderEntriesTruncated: boolean;
  docSnapshots: FeishuDocumentSnapshot[];
  bitableSnapshot: BitableSnapshot | null;
  sourceErrors?: Record<string, string>;
}

export interface CompiledRoleProfile {
  agentRole: 'manager';
  agentsMd: string;
  soulMd: string;
  userMd: string;
  standingOrdersMd: string;
  promptPreludeMd: string;
  skills: string[];
  compiledContextFile: string;
}

export interface GroupRuntimeTaskSnapshot {
  id: string;
  runtimeRef?: string | null;
  title: string;
  description?: string | null;
  intent: string;
  skillHint?: string | null;
  outputMode?: string | null;
  orderIndex: number;
  status: GroupRuntimeTaskStatus;
  blockedReason?: string | null;
  nextActionHint?: string | null;
  priority?: number;
  triggerType?: string | null;
  taskPayloadJson?: Record<string, unknown> | null;
  resultSummary?: string | null;
  lastError?: string | null;
}

export interface RuntimeEvent {
  sequence: number;
  at: string;
  type: RuntimeEventType;
  payload: Record<string, unknown>;
}

export interface RuntimeSubmitMessageInput {
  runtimeSessionKey: string;
  envelope: {
    messageSourceId: string;
    sourceType: 'group' | 'dm' | 'system';
    senderOpenId?: string | null;
    feishuChatId?: string | null;
    feishuMessageId?: string | null;
    traceId?: string | null;
    rawText: string;
    metadata?: Record<string, unknown>;
  };
  environment: PiMonoCreateRunRequest['environment'];
  project: PiMonoCreateRunRequest['project'];
  roleProfile?: CompiledRoleProfile;
}

export interface RuntimeResumeInput {
  runtimeSessionKey: string;
  event: {
    type: 'confirmation_resolved' | 'system_followup';
    payload: Record<string, unknown>;
    text?: string;
  };
  environment: PiMonoCreateRunRequest['environment'];
  project: PiMonoCreateRunRequest['project'];
  roleProfile?: CompiledRoleProfile;
}

export interface RuntimeSubmitResult {
  accepted: boolean;
  action: 'run_now' | 'steered' | 'queued' | 'collected' | 'dropped' | 'interrupted';
  runtimeSessionKey: string;
  activeTurnId?: string;
}

export interface GroupRuntimeTodoWriteAction {
  type: 'todo_write';
  action: GroupRuntimeToolActionType;
  taskId?: string;
  title?: string;
  description?: string;
  intent?: string;
  skillHint?: string | null;
  outputMode?: string | null;
  taskPayload?: Record<string, unknown>;
  blockedReason?: string;
  nextActionHint?: string;
  priority?: number;
  triggerType?: string;
  resultSummary?: string;
  errorMessage?: string;
}

export interface GroupRuntimeReplyAction {
  type: 'reply_group';
  text: string;
}

export interface GroupRuntimeConfirmationAction {
  type: 'request_group_confirmation';
  taskId?: string;
  actionType: string;
  summary: string;
  detail?: string;
  payload: ManagerConfirmationPayload;
}

export type GroupRuntimeAction =
  | GroupRuntimeTodoWriteAction
  | GroupRuntimeReplyAction
  | GroupRuntimeConfirmationAction;

export interface GroupRuntimeTurnResult {
  status: 'succeeded' | 'timeout' | 'canceled';
  actions: GroupRuntimeAction[];
  outputs?: AgentOutput[];
  outputSummary?: string;
  session: PiMonoSessionSnapshot;
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
  sessionMode?: RuntimeSessionMode;
  requestKind?: 'bootstrap' | 'interactive_decision' | 'formal_execution' | 'group_runtime';
  wakeMode?: AgentWakeMode;
  digestType?: DigestType | null;
  projectContextBundle?: ProjectContextBundle;
  roleProfile?: CompiledRoleProfile;
  runtimeTasks?: GroupRuntimeTaskSnapshot[];
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
    repoCredentialRef?: string | null;
    repoMirrorPath?: string | null;
    repoSyncStatus?: string | null;
    repoSyncError?: string | null;
    repoHeadRef?: string | null;
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

export interface GroupRuntimeResumeInput {
  confirmationId?: string;
  taskId?: string;
  eventText: string;
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
