import { AgentRole, GroupAgentSession, GroupSessionMode } from '@prisma/client';
import { RuntimeSubmitResult } from './agent.types';

export interface SessionContext {
  projectId?: string | null;
  environmentId?: string | null;
  feishuChatId: string;
  agentRole?: AgentRole;
  sessionMode?: GroupSessionMode;
}

export interface SessionMessageEnvelope {
  messageSourceId?: string;
  senderOpenId: string;
  rawText: string;
  sourceType: 'group' | 'private' | 'system';
  feishuChatId?: string;
  feishuMessageId?: string | null;
  traceId?: string;
  metadata?: Record<string, unknown>;
}

export type SessionSubmitResult =
  | { status: 'accepted'; session: GroupAgentSession; runId?: string; lockToken?: string }
  | { status: 'rejected_busy'; session?: GroupAgentSession; reason?: string }
  | { status: 'failed'; session?: GroupAgentSession; reason: string };

export type RuntimeSessionSubmitResult = RuntimeSubmitResult & {
  session: GroupAgentSession;
};

export interface GroupAgentSessionAdapter {
  getOrCreateSession(sessionKey: string, context: SessionContext): Promise<GroupAgentSession>;
  submitMessage(sessionKey: string, message: SessionMessageEnvelope): Promise<SessionSubmitResult>;
  isBusy(sessionKey: string): Promise<boolean>;
  getBusyReason(sessionKey: string): Promise<string | null>;
  rehydrateSession(sessionKey: string): Promise<void>;
  closeSession(sessionKey: string): Promise<void>;
}
