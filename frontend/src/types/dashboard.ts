/**
 * Dashboard TypeScript types
 * Types for Groups, Messages, Runs data from backend API
 */

export type GroupStatus = 'bound' | 'pending_config' | 'unbound';

export interface GroupListItem {
  chatId: string;
  name: string;
  memberCount: number;
  status: GroupStatus;
  createdAt: string;
  lastActiveAt: string;
}

export interface GroupsResponse {
  items: GroupListItem[];
  total: number;
  page: number;
  limit: number;
}

export interface GroupsQueryParams {
  status?: GroupStatus;
  search?: string;
  page?: number;
  limit?: number;
}

// Message types
export interface MessageItem {
  id: string;
  chatId: string;
  senderName: string;
  senderType: 'user' | 'bot';
  content: string;
  createdAt: string;
  runId?: string;
}

export interface MessagesResponse {
  items: MessageItem[];
  total: number;
  page: number;
  limit: number;
}

// Run/Log types
export interface RunLogItem {
  id: string;
  chatId: string;
  runType: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';
  skillName?: string;
  intent?: string;
  createdAt: string;
  completedAt?: string;
}

export interface RunLogsResponse {
  items: RunLogItem[];
  total: number;
  page: number;
  limit: number;
}
