import { Injectable } from '@nestjs/common';
import type { AgentSession, SessionManager } from '@mariozechner/pi-coding-agent';
import { CompiledRoleProfile, GroupRuntimeTaskSnapshot, RuntimeEvent, RuntimeEventType } from './agent.types';

/**
 * Internal state for a PiMono runtime session.
 * Extracted from pi-mono.adapter.ts for service decomposition.
 */
export type SessionRuntimeState = {
  runtimeSessionKey: string;
  cwd: string;
  session: AgentSession;
  sessionManager: SessionManager;
  sessionStoreRef?: string;
  lastAssistantText?: string;
  activeExecution?: ActiveExecutionState;
  currentProjectContextBundle?: any;
  currentRoleProfile?: CompiledRoleProfile;
  runtimeTaskSnapshots: GroupRuntimeTaskSnapshot[];
  pendingRuntimeTaskEvents: Array<{ type: RuntimeEventType; payload: Record<string, unknown> }>;
  currentTurn?: RuntimeTurnState;
  waitingReason?: string;
  waitingTaskId?: string;
  eventSequence: number;
  recentEvents: RuntimeEvent[];
  toolCache: Map<string, unknown>;
  confirmationQueue?: any[];
  turnQueue?: any[];
  currentContext?: SimplifiedContextBinding;
};

export type RuntimeTurnState = {
  turnId: string;
  startedAt: string;
  mode: 'group_runtime';
  messageSourceId?: string;
};

export type ActiveExecutionState = {
  runId?: string;
  mode: 'outputs' | 'decision' | 'group_runtime';
  outputs: any[];
  decision?: any;
  actions?: any[];
  emitted: boolean;
  canceled: boolean;
  timedOut: boolean;
};

export type SimplifiedContextBinding = {
  projectId: string;
  environmentId: string;
  feishuChatId: string;
  groupSessionId?: string | null;
};

/**
 * Service for managing PiMono session state lifecycle.
 * Per D-03 (coordinator pattern foundation), provides state creation/cleanup.
 */
@Injectable()
export class PiSessionStateService {
  private readonly sessions = new Map<string, SessionRuntimeState>();

  /**
   * Create a new SessionRuntimeState with default values.
   * Used by PiSessionManager.ensureSession for new sessions.
   */
  createState(input: {
    runtimeSessionKey: string;
    cwd: string;
    sessionManager: SessionManager;
    sessionStoreRef?: string;
    roleProfile?: CompiledRoleProfile;
  }): SessionRuntimeState {
    const state: SessionRuntimeState = {
      runtimeSessionKey: input.runtimeSessionKey,
      cwd: input.cwd,
      session: undefined as unknown as AgentSession,
      sessionManager: input.sessionManager,
      sessionStoreRef: input.sessionStoreRef,
      lastAssistantText: undefined,
      activeExecution: undefined,
      currentProjectContextBundle: undefined,
      currentRoleProfile: input.roleProfile,
      runtimeTaskSnapshots: [],
      pendingRuntimeTaskEvents: [],
      currentTurn: undefined,
      waitingReason: undefined,
      waitingTaskId: undefined,
      eventSequence: 0,
      recentEvents: [],
      toolCache: new Map(),
    };
    this.sessions.set(input.runtimeSessionKey, state);
    return state;
  }

  /**
   * Retrieve existing session state by key.
   */
  getState(runtimeSessionKey: string): SessionRuntimeState | undefined {
    return this.sessions.get(runtimeSessionKey);
  }

  /**
   * Update session property after session creation.
   */
  updateSession(state: SessionRuntimeState, session: AgentSession): void {
    state.session = session;
  }

  /**
   * Clear session state and dispose session.
   * Used by PiSessionManager.closeSession.
   */
  clearState(runtimeSessionKey: string): void {
    const state = this.sessions.get(runtimeSessionKey);
    if (state) {
      state.session?.dispose();
      this.sessions.delete(runtimeSessionKey);
    }
  }

  /**
   * Get all session states for iteration.
   * Used by PiExecutor for finding live runs during cancellation.
   */
  getAllStates(): IterableIterator<SessionRuntimeState> {
    return this.sessions.values();
  }
}