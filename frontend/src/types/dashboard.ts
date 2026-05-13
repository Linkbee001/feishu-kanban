/**
 * Dashboard TypeScript types
 * Types for Groups, Messages, Runs data from backend API
 */

export type GroupStatus = 'bound' | 'pending_config' | 'unbound';

export interface GroupListItem {
  id: string;
  chatId: string;
  name: string;
  memberCount: number;
  status: GroupStatus;
  createdAt: string;
  lastActiveAt?: string;
}

export interface GroupListResponse {
  groups: GroupListItem[];
  total: number;
  page: number;
  limit: number;
}

// Alias for compatibility
export type GroupsResponse = GroupListResponse;

export interface GroupsQueryParams {
  status?: GroupStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export interface DashboardStats {
  totalGroups: number;
  activeSessions: number;
  pendingConfig: number;
  todayMessages: number;
  totalRuns: number;
}

export interface ActivityItem {
  id: string;
  type: 'config_update' | 'task_complete' | 'group_bind' | 'message_received';
  title: string;
  description: string;
  timestamp: string;
  link?: string | null;
}

// Message types
export type MessageType = 'all' | 'user' | 'bot';

export interface MessageListItem {
  id: string;
  feishuMessageId: string;
  feishuChatId: string;
  senderOpenId: string;
  senderName: string;
  rawText: string;
  isBotMentioned: boolean;
  receivedAt: string;
  senderType: 'user' | 'bot';
  agentRunId?: string | null;
}

export interface MessagesResponse {
  items: MessageListItem[];
  total: number;
  page: number;
  limit: number;
}

export interface MessagesQueryParams {
  group?: string;
  startDate?: string;
  endDate?: string;
  type?: MessageType;
  search?: string;
  page?: number;
  limit?: number;
}

export interface MessageGroup {
  chatId: string;
  chatName: string;
  messages: MessageListItem[];
  lastActivity: string; // ISO timestamp of most recent message
}

// Run/Log types
export type LogLevel = 'INFO' | 'EXEC' | 'SUCCESS' | 'WARN' | 'ERROR' | 'DEBUG';

export interface LogLine {
  timestamp: string;
  level: LogLevel;
  message: string;
  eventType?: string;
  createdAt?: string;
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface AgentRun {
  id: string;
  chatId: string;
  chatName?: string;
  runType: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';
  skillName?: string | null;
  intent: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
  errorMessage?: string | null;
}

export interface RunsResponse {
  items: AgentRun[];
  total: number;
  page: number;
  limit: number;
}

export interface RunLogsResponse {
  runId: string;
  chatId: string;
  chatName: string;
  runStatus: string;
  logs: LogLine[];
}
