/**
 * Three-state enum for session runtime state.
 * Replaces four overlapping state variables (activeExecution, currentTurn, waitingReason, session.isStreaming).
 */
export type RuntimeState = 'idle' | 'running' | 'waiting_confirmation';

/**
 * Session environment configuration for PiMono adapter.
 */
export interface SessionEnvironment {
  repoPath?: string;
  modelName: string;
  skillSet?: unknown;
}

/**
 * Group policy snapshot for permission checks before high-risk actions.
 */
export interface SessionGroupPolicy {
  mentionOnly: boolean;
  allowDocWrite: boolean;
  allowTaskBoardWrite: boolean;
}

/**
 * Single unified context object replacing multiple overlapping interfaces:
 * - RuntimeContextBinding (projectId/feishuChatId)
 * - RuntimeMinimalContext (environment/groupPolicy)
 * - PiMonoCreateRunRequest (split into SessionContext + execution params)
 * - ProjectContextBundle full (replaced by minimal SessionContext)
 */
export interface SessionContext {
  // Identity (for SDK calls + Feishu reply)
  projectId: string;
  feishuChatId: string;
  sessionId: string;

  // Execution config (for PiMono)
  environment: SessionEnvironment;

  // Business rules (for permission checks)
  groupPolicy: SessionGroupPolicy;

  // Runtime state (three-state enum)
  runtimeState: RuntimeState;
  waitingReason?: string;
  confirmationRequestId?: string;
}