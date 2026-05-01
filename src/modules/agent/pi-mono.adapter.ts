import { InjectQueue } from '@nestjs/bullmq';
import { BadGatewayException, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentRunStatus } from '@prisma/client';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import Redis from 'ioredis';
import * as path from 'path';
import type { AgentSession, ModelRegistry, SessionManager } from '@mariozechner/pi-coding-agent';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ARTIFACT_SYNC_QUEUE } from '../../queues/queue.constants';
import { FeishuService } from '../feishu/feishu.service';
import { FeishuProjectReader } from '../feishu/feishu-project-reader.service';
import { GROUP_AGENT_SESSION_REDIS } from './agent.constants';
import {
  AgentRunType,
  AgentOutput,
  CompiledRoleProfile,
  GroupRuntimeAction,
  GroupRuntimeConfirmationAction,
  GroupRuntimeTaskSnapshot,
  GroupRuntimeTodoWriteAction,
  GroupRuntimeTurnResult,
  ManagerInteractiveDecision,
  PiMonoCreateRunRequest,
  PiMonoExecutionResult,
  PiMonoSessionSnapshot,
  ProjectContextBundle,
  RuntimeContextBinding,
  RuntimeEvent,
  RuntimeEventType,
  RuntimeMinimalContext,
  RuntimeQueueItemSnapshot,
  RuntimeQueueMode,
  RuntimeResumeInput,
  RuntimeStateSnapshot,
  RuntimeSubmitMessageInput,
  RuntimeSubmitResult,
} from './agent.types';
import { MANAGER_INTERACTIVE_DECISION_SCHEMA } from './agent.schemas';
import { resolveBundledPiSkillsDir } from './pi-skill-mapping';

type PiSdkModule = typeof import('@mariozechner/pi-coding-agent');

type SessionRuntimeState = {
  runtimeSessionKey: string;
  cwd: string;
  session: AgentSession;
  sessionManager: SessionManager;
  sessionStoreRef?: string;
  lastAssistantText?: string;
  activeExecution?: ActiveExecutionState;
  currentProjectContextBundle?: ProjectContextBundle;
  currentContextBinding?: RuntimeContextBinding;
  currentMinimalContext?: RuntimeMinimalContext;
  currentRoleProfile?: CompiledRoleProfile;
  runtimeTaskSnapshots: GroupRuntimeTaskSnapshot[];
  pendingRuntimeTaskEvents: Array<{ type: RuntimeEventType; payload: Record<string, unknown> }>;
  queue: RuntimeQueuedMessage[];
  currentTurn?: RuntimeTurnState;
  waitingReason?: string;
  waitingTaskId?: string;
  eventSequence: number;
  recentEvents: RuntimeEvent[];
  actorQueue: Promise<unknown>;
  toolCache: Map<string, unknown>;
};

type RuntimeQueuedMessage = {
  queueItemId: string;
  mode: RuntimeQueueMode;
  summary: string;
  enqueuedAt: string;
  envelopes: RuntimeSubmitMessageInput['envelope'][];
};

type RuntimeTurnState = {
  turnId: string;
  startedAt: string;
  mode: 'group_runtime';
  messageSourceId?: string;
};

type ActiveExecutionState = {
  runId?: string;
  mode: 'outputs' | 'decision' | 'group_runtime';
  outputs: AgentOutput[];
  decision?: ManagerInteractiveDecision;
  actions?: GroupRuntimeAction[];
  emitted: boolean;
  canceled: boolean;
  timedOut: boolean;
};

type EmitOutputsArgs = {
  outputs?: unknown;
};

type EmitDecisionArgs = {
  decision?: unknown;
};

type ReadProjectDocArgs = {
  token?: string;
  title?: string;
};

type SearchProjectDocsArgs = {
  query?: string;
};

type ListRecentArtifactsArgs = {
  limit?: number;
};

type TodoListArgs = Record<string, never>;

type TodoWriteArgs = {
  action?: unknown;
  taskId?: unknown;
  title?: unknown;
  description?: unknown;
  intent?: unknown;
  skillHint?: unknown;
  outputMode?: unknown;
  taskPayload?: unknown;
  resultSummary?: unknown;
  errorMessage?: unknown;
};

type ReplyGroupArgs = {
  text?: unknown;
};

type RequestGroupConfirmationArgs = {
  taskId?: unknown;
  actionType?: unknown;
  summary?: unknown;
  detail?: unknown;
  payload?: unknown;
};

type ProjectRuntimeResource = {
  projectId: string;
  docFolderToken?: string | null;
  bitableAppToken?: string | null;
  bitableTableId?: string | null;
};

const nativeDynamicImport = new Function('specifier', 'return import(specifier)') as <T>(specifier: string) => Promise<T>;

class PiMonoExecutionAbortError extends Error {
  constructor(
    readonly code: 'CANCELED' | 'TIMEOUT',
    message: string,
  ) {
    super(message);
    this.name = 'PiMonoExecutionAbortError';
  }
}

@Injectable()
export class PiMonoAdapter {
  private readonly logger = new Logger(PiMonoAdapter.name);
  private readonly sessions = new Map<string, SessionRuntimeState>();
  private sdkPromise?: Promise<PiSdkModule>;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly feishu: FeishuService,
    private readonly feishuReader: FeishuProjectReader,
    @Inject(GROUP_AGENT_SESSION_REDIS) private readonly redis: Redis,
    @InjectQueue(ARTIFACT_SYNC_QUEUE) private readonly artifactQueue: Queue,
  ) {}

  async executeRun(runId: string, payload: PiMonoCreateRunRequest): Promise<PiMonoExecutionResult> {
    return this.executePrompt({
      runId,
      payload: {
        ...payload,
        requestKind: payload.requestKind ?? 'formal_execution',
      },
      timeoutMs: this.resolveTimeoutMs(),
    });
  }

  async runManagerDecision(input: {
    runtimeSessionKey: string;
    agentScopeKey?: string;
    sessionStoreRef?: string | null;
    sessionMode?: 'bootstrap' | 'active' | 'disabled';
    projectContextBundle?: PiMonoCreateRunRequest['projectContextBundle'];
    project: PiMonoCreateRunRequest['project'];
    environment: PiMonoCreateRunRequest['environment'];
    source: PiMonoCreateRunRequest['source'];
    prompt: string;
    timeoutMs?: number;
  }): Promise<ManagerInteractiveDecision> {
    const result = await this.executeDecisionPrompt({
      payload: {
        runtimeSessionKey: input.runtimeSessionKey,
        sessionStoreRef: input.sessionStoreRef ?? null,
        agentScopeKey: input.agentScopeKey,
        sessionMode: input.sessionMode ?? 'active',
        requestKind: 'interactive_decision',
        wakeMode: 'interactive',
        projectContextBundle: input.projectContextBundle,
        project: input.project,
        environment: input.environment,
        source: input.source,
        intent: 'requirement_analysis',
        skillName: null,
        prompt: input.prompt,
        outputSchema: MANAGER_INTERACTIVE_DECISION_SCHEMA,
      },
      timeoutMs: input.timeoutMs ?? 20_000,
    });

    if (result.status === 'succeeded' && result.decision) {
      return result.decision;
    }

    if (result.status === 'timeout') {
      throw new BadGatewayException('pi mono manager decision timed out');
    }

    throw new BadGatewayException('pi mono manager decision was canceled');
  }

  async runPrompt(input: {
    sessionKey: string;
    prompt: string;
    intent?: string;
    skillName?: string | null;
    outputSchema?: unknown;
    projectName?: string;
    timeoutMs?: number;
  }): Promise<AgentOutput[]> {
    const result = await this.executePrompt({
      payload: {
        runtimeSessionKey: input.sessionKey,
        sessionMode: 'bootstrap',
        requestKind: 'bootstrap',
        project: {
          id: 'bootstrap-project',
          name: input.projectName ?? 'Bootstrap Project',
          feishuChatId: input.sessionKey,
        },
        environment: {
          id: 'bootstrap-environment',
          name: 'Bootstrap Environment',
          projectPath: this.config.get<string>('PI_MONO_WORKDIR') || process.cwd(),
        },
        source: {},
        intent: input.intent ?? 'bootstrap',
        skillName: input.skillName ?? null,
        prompt: input.prompt,
        outputSchema: input.outputSchema ?? {},
      },
      timeoutMs: input.timeoutMs ?? 20_000,
    });

    if (result.status === 'succeeded') {
      return result.outputs ?? [];
    }

    if (result.status === 'timeout') {
      throw new BadGatewayException('pi mono bootstrap run timed out');
    }

    throw new BadGatewayException('pi mono bootstrap run was canceled');
  }

  async runGroupRuntimeTurn(input: {
    runtimeSessionKey: string;
    agentScopeKey?: string;
    sessionStoreRef?: string | null;
    sessionMode?: 'bootstrap' | 'active' | 'disabled';
    projectContextBundle?: PiMonoCreateRunRequest['projectContextBundle'];
    minimalContext?: RuntimeMinimalContext;
    runtimeTasks?: GroupRuntimeTaskSnapshot[];
    roleProfile?: CompiledRoleProfile;
    project: PiMonoCreateRunRequest['project'];
    environment: PiMonoCreateRunRequest['environment'];
    source: PiMonoCreateRunRequest['source'];
    prompt: string;
    timeoutMs?: number;
    requestKind?: 'group_runtime';
    outputSchema?: unknown;
  }): Promise<GroupRuntimeTurnResult> {
    return this.executeGroupRuntimePrompt({
      payload: {
        runtimeSessionKey: input.runtimeSessionKey,
        sessionStoreRef: input.sessionStoreRef ?? null,
        agentScopeKey: input.agentScopeKey,
        sessionMode: input.sessionMode ?? 'active',
        requestKind: 'group_runtime',
        wakeMode: 'interactive',
        projectContextBundle: input.projectContextBundle,
        minimalContext: input.minimalContext,
        runtimeTasks: input.runtimeTasks ?? [],
        roleProfile: input.roleProfile,
        project: input.project,
        environment: input.environment,
        source: input.source,
        intent: 'requirement_analysis',
        skillName: null,
        prompt: input.prompt,
        outputSchema: input.outputSchema ?? {},
      },
      timeoutMs: input.timeoutMs ?? 60_000,
    });
  }

  async cancelRun(runId: string): Promise<void> {
    await this.redis.set(this.cancelKey(runId), '1', 'EX', this.cancelTtlSeconds());

    const liveRun = this.findLiveRun(runId);
    if (!liveRun) {
      return;
    }

    if (liveRun.activeExecution) {
      liveRun.activeExecution.canceled = true;
    }
    try {
      await liveRun.session.abort();
    } catch (error) {
      this.logger.warn(`Failed to abort live pi mono run ${runId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async rehydrateSession(input: {
    runtimeSessionKey: string;
    sessionStoreRef?: string | null;
    projectPath?: string | null;
  }): Promise<PiMonoSessionSnapshot> {
    const state = await this.ensureSession({
      runtimeSessionKey: input.runtimeSessionKey,
      sessionStoreRef: input.sessionStoreRef,
      projectPath: input.projectPath,
    });
    return this.buildSessionSnapshot(state);
  }

  getSessionSnapshot(runtimeSessionKey: string): PiMonoSessionSnapshot | null {
    const state = this.sessions.get(runtimeSessionKey);
    return state ? this.buildSessionSnapshot(state) : null;
  }

  async closeSession(runtimeSessionKey: string): Promise<void> {
    const state = this.sessions.get(runtimeSessionKey);
    if (!state) {
      return;
    }

    state.session.dispose();
    this.sessions.delete(runtimeSessionKey);
  }

  async submitMessage(input: RuntimeSubmitMessageInput): Promise<RuntimeSubmitResult> {
    const state = await this.ensureSession({
      runtimeSessionKey: input.runtimeSessionKey,
      repoMirrorPath: input.environment.repoMirrorPath,
      repoSyncStatus: input.environment.repoSyncStatus,
      projectPath: input.environment.projectPath,
      roleProfile: input.roleProfile,
    });
    const result = await this.enqueueRuntimeActor(state, async () => {
      this.logger.log(
        `runtime submit: session=${state.runtimeSessionKey} source=${input.envelope.messageSourceId} mode=${input.queueMode ?? 'collect'}`,
      );
      await this.hydrateRuntimeState(state, input.contextBinding);
      state.currentContextBinding = input.contextBinding;
      state.currentMinimalContext = input.minimalContext;
      state.currentRoleProfile = input.roleProfile;

      const envelope = input.envelope;
      await this.recordRuntimeEvent(state, 'message_submitted', {
        messageSourceId: envelope.messageSourceId,
        sourceType: envelope.sourceType,
        rawText: envelope.rawText,
        queueMode: input.queueMode ?? 'collect',
      });

      if (state.activeExecution?.mode === 'group_runtime' && state.session.isStreaming) {
        return this.handleStreamingSubmission(state, input);
      }

      if (state.waitingReason) {
        const queued = this.enqueueRuntimeMessage(state, input.queueMode ?? 'collect', envelope);
        await this.recordRuntimeEvent(state, queued.type, queued.payload);
        return {
          accepted: true,
          action: queued.type === 'message_collected' ? 'collected' : 'queued',
          runtimeSessionKey: state.runtimeSessionKey,
          activeTurnId: state.currentTurn?.turnId,
        } satisfies RuntimeSubmitResult;
      }

      if (state.currentTurn) {
        const queued = this.enqueueRuntimeMessage(state, input.queueMode ?? 'collect', envelope);
        await this.recordRuntimeEvent(state, queued.type, queued.payload);
        return {
          accepted: true,
          action: queued.type === 'message_collected' ? 'collected' : 'queued',
          runtimeSessionKey: state.runtimeSessionKey,
          activeTurnId: state.currentTurn?.turnId,
        } satisfies RuntimeSubmitResult;
      }

      const turnId = randomUUID();
      state.currentTurn = {
        turnId,
        startedAt: new Date().toISOString(),
        mode: 'group_runtime',
        messageSourceId: envelope.messageSourceId,
      };
      void this.runRuntimeTurn({
        state,
        project: input.project,
        environment: input.environment,
        roleProfile: input.roleProfile,
        minimalContext: input.minimalContext,
        queueMode: input.queueMode ?? 'collect',
        reasonText: envelope.rawText,
        source: {
          messageSourceId: envelope.messageSourceId,
          feishuMessageId: envelope.feishuMessageId,
          senderOpenId: envelope.senderOpenId,
          traceId: envelope.traceId,
        },
      });

      return {
        accepted: true,
        action: 'run_now',
        runtimeSessionKey: state.runtimeSessionKey,
        activeTurnId: turnId,
      } satisfies RuntimeSubmitResult;
    });
    return result;
  }

  async resumeSession(input: RuntimeResumeInput): Promise<{ accepted: boolean }> {
    const state = await this.ensureSession({
      runtimeSessionKey: input.runtimeSessionKey,
      repoMirrorPath: input.environment.repoMirrorPath,
      repoSyncStatus: input.environment.repoSyncStatus,
      projectPath: input.environment.projectPath,
      roleProfile: input.roleProfile,
    });
    return this.enqueueRuntimeActor(state, async () => {
      await this.hydrateRuntimeState(state, input.contextBinding);
      state.currentContextBinding = input.contextBinding;
      state.currentMinimalContext = input.minimalContext;
      state.currentRoleProfile = input.roleProfile;
      state.waitingReason = undefined;
      state.waitingTaskId =
        typeof input.event.payload.taskId === 'string'
          ? this.resolveRuntimeTaskId(state, input.event.payload.taskId) ?? state.waitingTaskId
          : state.waitingTaskId;
      if (state.waitingTaskId) {
        this.transitionRuntimeTask(state, {
          type: 'todo_write',
          action: 'update',
          taskId: state.waitingTaskId,
          resultSummary: `Confirmation resolved via ${input.event.type}.`,
        });
        this.transitionRuntimeTask(state, {
          type: 'todo_write',
          action: 'start',
          taskId: state.waitingTaskId,
        });
      }
      await this.recordRuntimeEvent(state, 'session_resumed', {
        type: input.event.type,
        payload: input.event.payload,
        text: input.event.text ?? null,
      });

      const turnId = randomUUID();
      state.currentTurn = {
        turnId,
        startedAt: new Date().toISOString(),
        mode: 'group_runtime',
        messageSourceId:
          typeof input.event.payload.messageSourceId === 'string'
            ? input.event.payload.messageSourceId
            : undefined,
      };
      void this.runRuntimeTurn({
        state,
        project: input.project,
        environment: input.environment,
        roleProfile: input.roleProfile,
        minimalContext: input.minimalContext,
        queueMode: 'followup',
        reasonText:
          input.event.text ??
          `Resume the waiting runtime task after ${input.event.type}.`,
        source: {
          messageSourceId:
            typeof input.event.payload.messageSourceId === 'string'
              ? input.event.payload.messageSourceId
              : null,
          senderOpenId: null,
          traceId: null,
        },
      });
      return { accepted: true };
    });
  }

  getRuntimeState(runtimeSessionKey: string): RuntimeStateSnapshot | null {
    const state = this.sessions.get(runtimeSessionKey);
    if (!state) {
      return null;
    }
    return this.buildRuntimeStateSnapshot(state);
  }

  pullRuntimeEvents(input: {
    runtimeSessionKey: string;
    afterSequence?: number;
  }): RuntimeEvent[] {
    const state = this.sessions.get(input.runtimeSessionKey);
    if (!state) {
      return [];
    }
    return state.recentEvents.filter((event) => event.sequence > (input.afterSequence ?? 0));
  }

  private async executePrompt(input: {
    runId?: string;
    payload: PiMonoCreateRunRequest;
    timeoutMs: number;
  }): Promise<PiMonoExecutionResult> {
    const state = await this.ensureSession({
      runtimeSessionKey: input.payload.runtimeSessionKey,
      sessionStoreRef: input.payload.sessionStoreRef,
      repoMirrorPath: input.payload.environment.repoMirrorPath,
      repoSyncStatus: input.payload.environment.repoSyncStatus,
      projectPath: input.payload.environment.projectPath,
    });
    const execution: ActiveExecutionState = {
      runId: input.runId,
      mode: 'outputs',
      outputs: [],
      emitted: false,
      canceled: false,
      timedOut: false,
    };
    state.activeExecution = execution;
    state.currentProjectContextBundle = input.payload.projectContextBundle;
    state.currentContextBinding = input.payload.contextBinding;
    state.currentMinimalContext = input.payload.minimalContext;

    let cancelWatcher: NodeJS.Timeout | undefined;
    let timeoutHandle: NodeJS.Timeout | undefined;

    try {
      if (input.runId && (await this.isCancellationRequested(input.runId))) {
        execution.canceled = true;
        throw new PiMonoExecutionAbortError('CANCELED', 'pi mono run canceled before start');
      }

      if (input.runId) {
        cancelWatcher = setInterval(() => {
          void this.watchCancellation(input.runId!, state, execution);
        }, 500);
      }

      timeoutHandle = setTimeout(() => {
        execution.timedOut = true;
        void state.session.abort().catch((error) => {
          this.logger.warn(
            `Failed to abort timed out pi mono session ${state.runtimeSessionKey}: ${error instanceof Error ? error.message : String(error)}`,
          );
        });
      }, input.timeoutMs);

      await state.session.prompt(this.buildPrompt(input.payload));

      const lastAssistantText = state.session.getLastAssistantText()?.trim();
      state.lastAssistantText = lastAssistantText;

      if (execution.timedOut) {
        throw new PiMonoExecutionAbortError('TIMEOUT', 'pi mono run timed out');
      }
      if (execution.canceled) {
        throw new PiMonoExecutionAbortError('CANCELED', 'pi mono run canceled');
      }

      const outputs = execution.outputs.length ? execution.outputs : this.buildFallbackOutputs(lastAssistantText);
      return {
        status: 'succeeded',
        outputs,
        outputSummary: this.buildOutputSummary(outputs),
        session: this.buildSessionSnapshot(state, outputs, lastAssistantText),
      };
    } catch (error) {
      const lastAssistantText = state.session.getLastAssistantText()?.trim();
      state.lastAssistantText = lastAssistantText;

      if (execution.timedOut || (error instanceof PiMonoExecutionAbortError && error.code === 'TIMEOUT')) {
        return {
          status: 'timeout',
          outputs: [],
          session: this.buildSessionSnapshot(state, [], lastAssistantText),
        };
      }

      if (execution.canceled || (error instanceof PiMonoExecutionAbortError && error.code === 'CANCELED')) {
        return {
          status: 'canceled',
          outputs: [],
          session: this.buildSessionSnapshot(state, [], lastAssistantText),
        };
      }

      throw error;
    } finally {
      if (cancelWatcher) {
        clearInterval(cancelWatcher);
      }
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      if (input.runId) {
        await this.redis.del(this.cancelKey(input.runId));
      }
      state.sessionStoreRef = state.sessionManager.getSessionFile() ?? state.sessionStoreRef;
      state.activeExecution = undefined;
      state.currentProjectContextBundle = undefined;
      state.currentContextBinding = undefined;
      state.currentMinimalContext = undefined;
    }
  }

  private async executeDecisionPrompt(input: {
    payload: PiMonoCreateRunRequest;
    timeoutMs: number;
  }): Promise<{ status: 'succeeded' | 'timeout' | 'canceled'; decision?: ManagerInteractiveDecision; session: PiMonoSessionSnapshot }> {
    const state = await this.ensureSession({
      runtimeSessionKey: input.payload.runtimeSessionKey,
      sessionStoreRef: input.payload.sessionStoreRef,
      repoMirrorPath: input.payload.environment.repoMirrorPath,
      repoSyncStatus: input.payload.environment.repoSyncStatus,
      projectPath: input.payload.environment.projectPath,
    });
    const execution: ActiveExecutionState = {
      mode: 'decision',
      outputs: [],
      emitted: false,
      canceled: false,
      timedOut: false,
    };
    state.activeExecution = execution;
    state.currentProjectContextBundle = input.payload.projectContextBundle;
    state.currentContextBinding = input.payload.contextBinding;
    state.currentMinimalContext = input.payload.minimalContext;

    let timeoutHandle: NodeJS.Timeout | undefined;

    try {
      timeoutHandle = setTimeout(() => {
        execution.timedOut = true;
        void state.session.abort().catch((error) => {
          this.logger.warn(
            `Failed to abort timed out pi mono session ${state.runtimeSessionKey}: ${error instanceof Error ? error.message : String(error)}`,
          );
        });
      }, input.timeoutMs);

      await state.session.prompt(this.buildPrompt(input.payload));

      const lastAssistantText = state.session.getLastAssistantText()?.trim();
      state.lastAssistantText = lastAssistantText;

      if (execution.timedOut) {
        throw new PiMonoExecutionAbortError('TIMEOUT', 'pi mono manager decision timed out');
      }
      if (execution.canceled) {
        throw new PiMonoExecutionAbortError('CANCELED', 'pi mono manager decision canceled');
      }
      if (!execution.decision) {
        throw new Error('PiMono manager decision completed without emit_decision');
      }

      return {
        status: 'succeeded',
        decision: execution.decision,
        session: this.buildSessionSnapshot(state, undefined, lastAssistantText),
      };
    } catch (error) {
      const lastAssistantText = state.session.getLastAssistantText()?.trim();
      state.lastAssistantText = lastAssistantText;

      if (execution.timedOut || (error instanceof PiMonoExecutionAbortError && error.code === 'TIMEOUT')) {
        return {
          status: 'timeout',
          session: this.buildSessionSnapshot(state, undefined, lastAssistantText),
        };
      }

      if (execution.canceled || (error instanceof PiMonoExecutionAbortError && error.code === 'CANCELED')) {
        return {
          status: 'canceled',
          session: this.buildSessionSnapshot(state, undefined, lastAssistantText),
        };
      }

      throw error;
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      state.sessionStoreRef = state.sessionManager.getSessionFile() ?? state.sessionStoreRef;
      state.activeExecution = undefined;
      state.currentProjectContextBundle = undefined;
      state.currentContextBinding = undefined;
      state.currentMinimalContext = undefined;
    }
  }

  private async executeGroupRuntimePrompt(input: {
    payload: PiMonoCreateRunRequest;
    timeoutMs: number;
  }): Promise<GroupRuntimeTurnResult> {
    const state = await this.ensureSession({
      runtimeSessionKey: input.payload.runtimeSessionKey,
      sessionStoreRef: input.payload.sessionStoreRef,
      repoMirrorPath: input.payload.environment.repoMirrorPath,
      repoSyncStatus: input.payload.environment.repoSyncStatus,
      projectPath: input.payload.environment.projectPath,
      roleProfile: input.payload.roleProfile,
    });
    const execution: ActiveExecutionState = {
      mode: 'group_runtime',
      outputs: [],
      actions: [],
      emitted: false,
      canceled: false,
      timedOut: false,
    };
    state.activeExecution = execution;
    state.currentProjectContextBundle = input.payload.projectContextBundle;
    state.currentContextBinding = input.payload.contextBinding;
    state.currentMinimalContext = input.payload.minimalContext;
    state.currentRoleProfile = input.payload.roleProfile;
    if (input.payload.runtimeTasks?.length) {
      state.runtimeTaskSnapshots = input.payload.runtimeTasks;
    }

    let timeoutHandle: NodeJS.Timeout | undefined;

    try {
      timeoutHandle = setTimeout(() => {
        execution.timedOut = true;
        void state.session.abort().catch((error) => {
          this.logger.warn(
            `Failed to abort timed out pi mono session ${state.runtimeSessionKey}: ${error instanceof Error ? error.message : String(error)}`,
          );
        });
      }, input.timeoutMs);

      await state.session.prompt(this.buildPrompt(input.payload));

      const lastAssistantText = state.session.getLastAssistantText()?.trim();
      state.lastAssistantText = lastAssistantText;

      if (execution.timedOut) {
        throw new PiMonoExecutionAbortError('TIMEOUT', 'pi mono group runtime turn timed out');
      }
      if (execution.canceled) {
        throw new PiMonoExecutionAbortError('CANCELED', 'pi mono group runtime turn canceled');
      }

      return {
        status: 'succeeded',
        actions: this.ensureGroupRuntimeReplyAction(execution.actions ?? [], execution.outputs, lastAssistantText),
        outputs: execution.outputs,
        outputSummary: execution.outputs.length ? this.buildOutputSummary(execution.outputs) : undefined,
        session: this.buildSessionSnapshot(state, execution.outputs, lastAssistantText),
      };
    } catch (error) {
      const lastAssistantText = state.session.getLastAssistantText()?.trim();
      state.lastAssistantText = lastAssistantText;

      if (execution.timedOut || (error instanceof PiMonoExecutionAbortError && error.code === 'TIMEOUT')) {
        return {
          status: 'timeout',
          actions: execution.actions ?? [],
          outputs: execution.outputs,
          session: this.buildSessionSnapshot(state, execution.outputs, lastAssistantText),
        };
      }

      if (execution.canceled || (error instanceof PiMonoExecutionAbortError && error.code === 'CANCELED')) {
        return {
          status: 'canceled',
          actions: execution.actions ?? [],
          outputs: execution.outputs,
          session: this.buildSessionSnapshot(state, execution.outputs, lastAssistantText),
        };
      }

      throw error;
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      state.sessionStoreRef = state.sessionManager.getSessionFile() ?? state.sessionStoreRef;
      state.activeExecution = undefined;
      state.currentProjectContextBundle = undefined;
      state.currentContextBinding = undefined;
      state.currentMinimalContext = undefined;
      state.currentRoleProfile = undefined;
    }
  }

  private async ensureSession(input: {
    runtimeSessionKey: string;
    sessionStoreRef?: string | null;
    repoMirrorPath?: string | null;
    repoSyncStatus?: string | null;
    projectPath?: string | null;
    roleProfile?: CompiledRoleProfile;
  }): Promise<SessionRuntimeState> {
    const normalizedStoreRef = input.sessionStoreRef ? path.resolve(input.sessionStoreRef) : undefined;
    const cwd = this.resolveCwd({
      repoMirrorPath: input.repoMirrorPath,
      repoSyncStatus: input.repoSyncStatus,
      projectPath: input.projectPath,
    });
    const cached = this.sessions.get(input.runtimeSessionKey);
    if (
      cached &&
      cached.cwd === cwd &&
      (input.roleProfile?.compiledContextFile ?? cached.currentRoleProfile?.compiledContextFile ?? '') ===
        (cached.currentRoleProfile?.compiledContextFile ?? input.roleProfile?.compiledContextFile ?? '') &&
      (!normalizedStoreRef ||
        !cached.sessionStoreRef ||
        path.resolve(cached.sessionStoreRef) === normalizedStoreRef)
    ) {
      return cached;
    }

    if (cached) {
      cached.session.dispose();
      this.sessions.delete(input.runtimeSessionKey);
    }

    const sdk = await this.loadSdk();
    this.ensureCustomModelsConfig();

    const agentDir = this.resolveAgentDir();
    const modelsPath = path.join(agentDir, 'models.json');
    const authPath = path.join(agentDir, 'auth.json');
    const authStorage = sdk.AuthStorage.create(authPath);
    const modelRegistry = sdk.ModelRegistry.create(authStorage, modelsPath);
    const model = this.resolveModel(modelRegistry);

    const sessionManager = this.createSessionManager(sdk, {
      cwd,
      sessionStoreRef: normalizedStoreRef,
    });
    const ResourceLoaderCtor = (sdk as { DefaultResourceLoader?: new (...args: any[]) => { reload(): Promise<void> } })
      .DefaultResourceLoader;
    const resourceLoader = ResourceLoaderCtor
      ? new ResourceLoaderCtor({
          cwd,
          agentDir,
          additionalSkillPaths: [resolveBundledPiSkillsDir()],
          agentsFilesOverride: (current: { agentsFiles: Array<{ path: string; content: string }> }) => ({
            agentsFiles: input.roleProfile
              ? [
                  ...current.agentsFiles,
                  {
                    path: '/virtual/AGENTS.md',
                    content: input.roleProfile.compiledContextFile,
                  },
                ]
              : current.agentsFiles,
          }),
        })
      : undefined;
    if (resourceLoader) {
      await resourceLoader.reload();
    }

    const state: SessionRuntimeState = {
      runtimeSessionKey: input.runtimeSessionKey,
      cwd,
      session: undefined as unknown as AgentSession,
      sessionManager,
      sessionStoreRef: sessionManager.getSessionFile() ?? normalizedStoreRef,
      lastAssistantText: undefined,
      activeExecution: undefined,
      currentProjectContextBundle: undefined,
      currentContextBinding: undefined,
      currentMinimalContext: undefined,
      currentRoleProfile: input.roleProfile,
      runtimeTaskSnapshots: [],
      pendingRuntimeTaskEvents: [],
      queue: [],
      currentTurn: undefined,
      waitingReason: undefined,
      waitingTaskId: undefined,
      eventSequence: 0,
      recentEvents: [],
      actorQueue: Promise.resolve(),
      toolCache: new Map<string, unknown>(),
    };

    const customTools = [
      this.createEmitOutputsTool(state),
      this.createEmitDecisionTool(state),
      this.createListProjectFolderTool(state),
      this.createReadProjectDocTool(state),
      this.createSearchProjectDocsTool(state),
      this.createReadProjectBitableTool(state),
      this.createListRecentProjectArtifactsTool(state),
      this.createTodoListTool(state),
      this.createTodoWriteTool(state),
      this.createReplyGroupTool(state),
      this.createRequestGroupConfirmationTool(state),
    ];
    const sessionOptions: any = {
      cwd,
      agentDir,
      authStorage,
      modelRegistry,
      model,
      thinkingLevel: this.resolveThinkingLevel(),
      sessionManager,
      ...(resourceLoader ? { resourceLoader } : {}),
      tools: [
        'read',
        'grep',
        'find',
        'ls',
        'emit_outputs',
        'emit_decision',
        'list_project_folder',
        'read_project_doc',
        'search_project_docs',
        'read_project_bitable',
        'list_recent_project_artifacts',
        'todo_list',
        'todo_write',
        'reply_group',
        'request_group_confirmation',
      ],
      customTools,
    };

    const { session } = await sdk.createAgentSession(sessionOptions);

    state.session = session;
    state.sessionStoreRef = sessionManager.getSessionFile() ?? state.sessionStoreRef;
    state.lastAssistantText = session.getLastAssistantText()?.trim();
    this.sessions.set(input.runtimeSessionKey, state);
    return state;
  }

  private createEmitOutputsTool(state: SessionRuntimeState) {
    return {
      name: 'emit_outputs',
      label: 'emit_outputs',
      description: 'Emit the final structured AgentOutput array for the Feishu backend to persist.',
      promptSnippet: 'emit_outputs(outputs): send the final AgentOutput array to the backend.',
      promptGuidelines: [
        'Call emit_outputs exactly once when you have the final structured result.',
        'Use a summary output when no document, task, file, or log artifact is appropriate.',
        'If you emit a document for formal project knowledge, include metadata.persist=true and targetChannels=["feishu_doc"].',
        'If you emit tasks for the formal task board, include metadata.persist=true and targetChannels=["bitable"].',
      ],
      parameters: {
        type: 'object',
        properties: {
          outputs: {
            type: 'array',
            items: {
              type: 'object',
              required: ['type', 'title'],
              properties: {
                type: { enum: ['document', 'task', 'file', 'log', 'summary'] },
                title: { type: 'string' },
                content: { type: 'string' },
                contentFormat: { enum: ['markdown', 'json', 'text'] },
                filePath: { type: 'string' },
                mimeType: { type: 'string' },
                tasks: { type: 'array' },
                metadata: { type: 'object' },
              },
              additionalProperties: true,
            },
          },
        },
        required: ['outputs'],
        additionalProperties: false,
      } as any,
      execute: async (_toolCallId: string, params: EmitOutputsArgs) => {
        const activeExecution = state.activeExecution;
        if (!activeExecution) {
          throw new Error('emit_outputs called outside an active execution');
        }
        if (!['outputs', 'group_runtime'].includes(activeExecution.mode)) {
          this.logger.warn(`emit_outputs ignored outside supported mode: session=${state.runtimeSessionKey} mode=${activeExecution.mode}`);
          return {
            content: [{ type: 'text', text: 'emit_outputs is not available in this run mode.' }],
          };
        }

        const outputs = this.normalizeOutputs(params.outputs, activeExecution.mode);
        if (!outputs.length) {
          throw new Error('emit_outputs requires at least one valid AgentOutput');
        }

        activeExecution.outputs = outputs;
        activeExecution.emitted = true;
        this.logger.log(`emit_outputs captured: session=${state.runtimeSessionKey} outputs=${outputs.length}`);
        return {
          content: [{ type: 'text', text: `Captured ${outputs.length} structured outputs.` }],
        };
      },
    } as any;
  }

  private createEmitDecisionTool(state: SessionRuntimeState) {
    return {
      name: 'emit_decision',
      label: 'emit_decision',
      description: 'Emit the structured manager interaction decision for the Feishu backend.',
      promptSnippet: 'emit_decision(decision): send the final manager interaction decision to the backend.',
      promptGuidelines: [
        'Call emit_decision exactly once after deciding whether to ask a follow-up question, request confirmation, or execute.',
        'Use ask_followup instead of guessing when the request is ambiguous or missing key constraints.',
      ],
      parameters: {
        type: 'object',
        properties: {
          decision: MANAGER_INTERACTIVE_DECISION_SCHEMA,
        },
        required: ['decision'],
        additionalProperties: false,
      } as any,
      execute: async (_toolCallId: string, params: EmitDecisionArgs) => {
        const activeExecution = state.activeExecution;
        if (!activeExecution) {
          throw new Error('emit_decision called outside an active execution');
        }
        if (activeExecution.mode !== 'decision') {
          this.logger.warn(`emit_decision ignored outside decision mode: session=${state.runtimeSessionKey} mode=${activeExecution.mode}`);
          return {
            content: [{ type: 'text', text: 'emit_decision is only available during manager decision runs.' }],
          };
        }

        const decision = this.normalizeDecision(params.decision);
        if (!decision) {
          throw new Error('emit_decision requires a valid ManagerInteractiveDecision');
        }

        activeExecution.decision = decision;
        activeExecution.emitted = true;
        this.logger.log(`emit_decision captured: session=${state.runtimeSessionKey} action=${decision.action}`);
        return {
          content: [{ type: 'text', text: `Captured decision: ${decision.action}` }],
        };
      },
    } as any;
  }

  private createListProjectFolderTool(state: SessionRuntimeState) {
    return {
      name: 'list_project_folder',
      label: 'list_project_folder',
      description: 'List the Feishu project folder structure and recent readable documents metadata.',
      promptSnippet: 'list_project_folder(): inspect project folder entries and recent doc metadata from Feishu.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      } as any,
      execute: async () => {
        const project = await this.getProjectRuntimeResource(state);
        const cacheKey = `folder:${project.docFolderToken ?? 'none'}`;
        const result = await this.getOrLoadCachedToolResult(state, cacheKey, async () =>
          this.feishuReader.listProjectFolder(project.docFolderToken),
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(result) }],
        };
      },
    } as any;
  }

  private createReadProjectDocTool(_state: SessionRuntimeState) {
    return {
      name: 'read_project_doc',
      label: 'read_project_doc',
      description: 'Read a Feishu project document by token and return raw content summary.',
      promptSnippet: 'read_project_doc({ token, title }): fetch a specific project document.',
      parameters: {
        type: 'object',
        properties: {
          token: { type: 'string' },
          title: { type: 'string' },
        },
        required: ['token'],
        additionalProperties: false,
      } as any,
      execute: async (_toolCallId: string, params: ReadProjectDocArgs) => {
        const project = await this.getProjectRuntimeResource(_state);
        const doc = await this.feishuReader.readProjectDocument(params.token, params.title, {
          folderToken: project.docFolderToken,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(doc) }],
        };
      },
    } as any;
  }

  private createSearchProjectDocsTool(state: SessionRuntimeState) {
    return {
      name: 'search_project_docs',
      label: 'search_project_docs',
      description: 'Search recent Feishu project documents by title and cached summaries. Use read_project_doc for full content.',
      promptSnippet: 'search_project_docs({ query }): search recent project docs by metadata, then use read_project_doc on relevant tokens.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
        },
        required: ['query'],
        additionalProperties: false,
      } as any,
      execute: async (_toolCallId: string, params: SearchProjectDocsArgs) => {
        const project = await this.getProjectRuntimeResource(state);
        const result = await this.feishuReader.searchProjectDocuments(
          project.docFolderToken,
          params.query,
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(result) }],
        };
      },
    } as any;
  }

  private createReadProjectBitableTool(state: SessionRuntimeState) {
    return {
      name: 'read_project_bitable',
      label: 'read_project_bitable',
      description: 'Read the project bitable snapshot from Feishu.',
      promptSnippet: 'read_project_bitable(): fetch current task board snapshot from Feishu.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      } as any,
      execute: async () => {
        const project = await this.getProjectRuntimeResource(state);
        const cacheKey = `bitable:${project.bitableAppToken ?? 'none'}:${project.bitableTableId ?? 'none'}`;
        const result = await this.getOrLoadCachedToolResult(state, cacheKey, async () =>
          this.feishuReader.readBitableSnapshot(
            project.bitableAppToken,
            project.bitableTableId,
          ),
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(result) }],
        };
      },
    } as any;
  }

  private createListRecentProjectArtifactsTool(state: SessionRuntimeState) {
    return {
      name: 'list_recent_project_artifacts',
      label: 'list_recent_project_artifacts',
      description: 'List recent persisted artifacts for the current project.',
      promptSnippet: 'list_recent_project_artifacts({ limit }): inspect recent project outputs.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number' },
        },
        additionalProperties: false,
      } as any,
      execute: async (_toolCallId: string, params: ListRecentArtifactsArgs) => {
        const context = this.requireContextBinding(state);
        const limit = Math.min(Math.max(Number(params.limit ?? 10), 1), 20);
        const result = await this.prisma.artifact.findMany({
          where: { projectId: context.projectId },
          orderBy: { createdAt: 'desc' },
          take: limit,
          select: {
            id: true,
            type: true,
            title: true,
            status: true,
            createdAt: true,
            feishuUrl: true,
            metadata: true,
          },
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                result.map((item) => ({
                  ...item,
                  createdAt: item.createdAt.toISOString(),
                })),
              ),
            },
          ],
        };
      },
    } as any;
  }

  private createTodoListTool(state: SessionRuntimeState) {
    return {
      name: 'todo_list',
      label: 'todo_list',
      description: 'List the persisted runtime todo queue for the current group session.',
      promptSnippet: 'todo_list(): inspect the current runtime todo queue before choosing what to execute next.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      } as any,
      execute: async (_toolCallId: string, _params: TodoListArgs) => {
        return {
          content: [{ type: 'text', text: JSON.stringify(state.runtimeTaskSnapshots ?? []) }],
        };
      },
    } as any;
  }

  private createTodoWriteTool(state: SessionRuntimeState) {
    return {
      name: 'todo_write',
      label: 'todo_write',
      description: 'Write changes to the persisted runtime todo queue.',
      promptSnippet:
        'todo_write({ action, ... }): create, update, start, complete, fail, cancel, or block a persisted runtime todo.',
      parameters: {
        type: 'object',
        properties: {
          action: { enum: ['create', 'update', 'start', 'complete', 'fail', 'cancel', 'block'] },
          taskId: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          intent: { type: 'string' },
          skillHint: { type: 'string' },
          outputMode: { type: 'string' },
          taskPayload: { type: 'object' },
          resultSummary: { type: 'string' },
          errorMessage: { type: 'string' },
        },
        required: ['action'],
        additionalProperties: false,
      } as any,
      execute: async (_toolCallId: string, params: TodoWriteArgs) => {
        const activeExecution = state.activeExecution;
        if (!activeExecution || activeExecution.mode !== 'group_runtime') {
          throw new Error('todo_write is only available during group runtime turns');
        }
        const action = this.normalizeTodoWriteAction(params);
        if (!action) {
          throw new Error('todo_write requires a valid action payload');
        }
        const snapshot = this.transitionRuntimeTask(state, action);
        if (snapshot && !action.taskId) {
          action.taskId = snapshot.id;
        }
        activeExecution.actions ??= [];
        activeExecution.actions.push(action);
        this.logger.log(
          `todo_write captured: session=${state.runtimeSessionKey} action=${action.action} task=${action.taskId ?? 'unknown'}`,
        );
        return {
          content: [{ type: 'text', text: `Queued todo action: ${action.action}` }],
        };
      },
    } as any;
  }

  private createReplyGroupTool(state: SessionRuntimeState) {
    return {
      name: 'reply_group',
      label: 'reply_group',
      description: 'Reply to the current group chat as part of the runtime turn.',
      promptSnippet: 'reply_group({ text }): send a concise group-facing reply.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string' },
        },
        required: ['text'],
        additionalProperties: false,
      } as any,
      execute: async (_toolCallId: string, params: ReplyGroupArgs) => {
        const activeExecution = state.activeExecution;
        if (!activeExecution || activeExecution.mode !== 'group_runtime') {
          throw new Error('reply_group is only available during group runtime turns');
        }
        const text = typeof params.text === 'string' ? params.text.trim() : '';
        if (!text) {
          throw new Error('reply_group requires non-empty text');
        }
        activeExecution.actions ??= [];
        activeExecution.actions.push({ type: 'reply_group', text });
        this.logger.log(`reply_group captured: session=${state.runtimeSessionKey} length=${text.length}`);
        return {
          content: [{ type: 'text', text: 'Queued one group reply.' }],
        };
      },
    } as any;
  }

  private createRequestGroupConfirmationTool(state: SessionRuntimeState) {
    return {
      name: 'request_group_confirmation',
      label: 'request_group_confirmation',
      description: 'Pause the current runtime task and request a human confirmation in the group.',
      promptSnippet:
        'request_group_confirmation({ taskId, actionType, summary, detail, payload }): create a confirmation request and stop the blocked task.',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string' },
          actionType: { type: 'string' },
          summary: { type: 'string' },
          detail: { type: 'string' },
          payload: { type: 'object' },
        },
        required: ['actionType', 'summary', 'payload'],
        additionalProperties: false,
      } as any,
      execute: async (_toolCallId: string, params: RequestGroupConfirmationArgs) => {
        const activeExecution = state.activeExecution;
        if (!activeExecution || activeExecution.mode !== 'group_runtime') {
          throw new Error('request_group_confirmation is only available during group runtime turns');
        }
        const action = this.normalizeRuntimeConfirmationAction(params);
        if (!action) {
          throw new Error('request_group_confirmation requires a valid payload');
        }
        activeExecution.actions ??= [];
        activeExecution.actions.push(action);
        this.logger.log(
          `request_group_confirmation captured: session=${state.runtimeSessionKey} task=${action.taskId ?? 'none'} action=${action.actionType}`,
        );
        return {
          content: [{ type: 'text', text: `Queued confirmation request for ${action.actionType}.` }],
        };
      },
    } as any;
  }

  private requireContextBinding(state: SessionRuntimeState) {
    if (!state.currentContextBinding) {
      throw new Error('Feishu project tools require a runtime context binding');
    }

    return state.currentContextBinding;
  }

  private async getProjectRuntimeResource(state: SessionRuntimeState): Promise<ProjectRuntimeResource> {
    const context = this.requireContextBinding(state);
    return this.getOrLoadCachedToolResult(state, `project:${context.projectId}`, async () => {
      const project = await this.prisma.project.findUniqueOrThrow({
        where: { id: context.projectId },
        select: {
          id: true,
          docFolderToken: true,
          bitableAppToken: true,
          bitableTableId: true,
        },
      });
      return {
        projectId: project.id,
        docFolderToken: project.docFolderToken,
        bitableAppToken: project.bitableAppToken,
        bitableTableId: project.bitableTableId,
      };
    });
  }

  private async getOrLoadCachedToolResult<T>(state: SessionRuntimeState, key: string, loader: () => Promise<T>) {
    if (state.toolCache.has(key)) {
      return state.toolCache.get(key) as T;
    }

    const value = await loader();
    state.toolCache.set(key, value);
    return value;
  }

  private normalizeOutputs(
    value: unknown,
    mode?: ActiveExecutionState['mode'],
  ): AgentOutput[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((item) => this.isAgentOutput(item))
      .map((item) => this.applyOutputDeliveryDefaults(item, mode));
  }

  private applyOutputDeliveryDefaults(
    output: AgentOutput,
    mode?: ActiveExecutionState['mode'],
  ): AgentOutput {
    if (mode !== 'group_runtime') {
      return output;
    }

    if (!['document', 'task'].includes(output.type)) {
      return output;
    }

    const metadata =
      output.metadata && typeof output.metadata === 'object' && !Array.isArray(output.metadata)
        ? { ...output.metadata }
        : {};
    const channels = Array.isArray(metadata.targetChannels)
      ? metadata.targetChannels.map((channel) => String(channel))
      : [];

    if (metadata.persist === false) {
      return {
        ...output,
        metadata,
      };
    }

    if (output.type === 'document') {
      metadata.persist ??= true;
      if (!channels.length) {
        metadata.targetChannels = ['feishu_doc'];
      }
    }

    if (output.type === 'task') {
      metadata.persist ??= true;
      if (!channels.length) {
        metadata.targetChannels = ['bitable'];
      }
    }

    return {
      ...output,
      metadata,
    };
  }

  private isAgentOutput(value: unknown): value is AgentOutput {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const item = value as Record<string, unknown>;
    if (!['document', 'task', 'file', 'log', 'summary'].includes(String(item.type))) {
      return false;
    }
    if (typeof item.title !== 'string' || !item.title.trim()) {
      return false;
    }
    if (item.content !== undefined && typeof item.content !== 'string') {
      return false;
    }
    if (item.contentFormat !== undefined && !['markdown', 'json', 'text'].includes(String(item.contentFormat))) {
      return false;
    }
    if (item.filePath !== undefined && typeof item.filePath !== 'string') {
      return false;
    }
    if (item.mimeType !== undefined && typeof item.mimeType !== 'string') {
      return false;
    }
    if (item.tasks !== undefined) {
      if (!Array.isArray(item.tasks)) {
        return false;
      }
      for (const task of item.tasks) {
        if (!task || typeof task !== 'object' || typeof (task as { title?: unknown }).title !== 'string') {
          return false;
        }
      }
    }
    return true;
  }

  private normalizeDecision(value: unknown): ManagerInteractiveDecision | null {
    return this.isManagerInteractiveDecision(value) ? value : null;
  }

  private normalizeTodoWriteAction(value: TodoWriteArgs): GroupRuntimeTodoWriteAction | null {
    const action = String(value.action ?? '').trim();
    if (!['create', 'update', 'start', 'complete', 'fail', 'cancel', 'block'].includes(action)) {
      return null;
    }
    const normalized: GroupRuntimeTodoWriteAction = {
      type: 'todo_write',
      action: action as GroupRuntimeTodoWriteAction['action'],
    };
    if (typeof value.taskId === 'string' && value.taskId.trim()) normalized.taskId = value.taskId.trim();
    if (typeof value.title === 'string' && value.title.trim()) normalized.title = value.title.trim();
    if (typeof value.description === 'string') normalized.description = value.description.trim();
    if (typeof value.intent === 'string' && value.intent.trim()) normalized.intent = value.intent.trim();
    if (typeof value.skillHint === 'string') normalized.skillHint = value.skillHint.trim();
    if (typeof value.outputMode === 'string') normalized.outputMode = value.outputMode.trim();
    if (typeof value.resultSummary === 'string') normalized.resultSummary = value.resultSummary.trim();
    if (typeof value.errorMessage === 'string') normalized.errorMessage = value.errorMessage.trim();
    if (value.taskPayload && typeof value.taskPayload === 'object' && !Array.isArray(value.taskPayload)) {
      normalized.taskPayload = value.taskPayload as Record<string, unknown>;
    }
    return normalized;
  }

  private normalizeRuntimeConfirmationAction(value: RequestGroupConfirmationArgs): GroupRuntimeConfirmationAction | null {
    if (typeof value.actionType !== 'string' || !value.actionType.trim()) {
      return null;
    }
    if (typeof value.summary !== 'string' || !value.summary.trim()) {
      return null;
    }
    if (!value.payload || typeof value.payload !== 'object' || Array.isArray(value.payload)) {
      return null;
    }
    return {
      type: 'request_group_confirmation',
      taskId: typeof value.taskId === 'string' && value.taskId.trim() ? value.taskId.trim() : undefined,
      actionType: value.actionType.trim(),
      summary: value.summary.trim(),
      detail: typeof value.detail === 'string' ? value.detail.trim() : undefined,
      payload: value.payload as any,
    };
  }

  private isManagerInteractiveDecision(value: unknown): value is ManagerInteractiveDecision {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const item = value as Record<string, unknown>;
    if (!['ask_followup', 'request_confirmation', 'execute'].includes(String(item.action))) {
      return false;
    }
    if (!['low', 'medium', 'high'].includes(String(item.confidence))) {
      return false;
    }
    if (typeof item.reason !== 'string' || !item.reason.trim()) {
      return false;
    }
    if (typeof item.reply !== 'string' || !item.reply.trim()) {
      return false;
    }
    if (typeof item.intent !== 'string' || !item.intent.trim()) {
      return false;
    }
    if (item.executionGoal !== undefined && typeof item.executionGoal !== 'string') {
      return false;
    }
    if (item.executionPrompt !== undefined && typeof item.executionPrompt !== 'string') {
      return false;
    }
    if (item.outputMode !== undefined && !['summary', 'document', 'task', 'file', 'mixed'].includes(String(item.outputMode))) {
      return false;
    }
    if (item.targetChannels !== undefined) {
      if (!Array.isArray(item.targetChannels)) {
        return false;
      }
      for (const channel of item.targetChannels) {
        if (!['group_message', 'feishu_doc', 'bitable', 'internal_digest'].includes(String(channel))) {
          return false;
        }
      }
    }
    if (item.skillHint !== undefined && item.skillHint !== null && typeof item.skillHint !== 'string') {
      return false;
    }
    if (item.metadata !== undefined && (!item.metadata || typeof item.metadata !== 'object' || Array.isArray(item.metadata))) {
      return false;
    }
    return true;
  }

  private buildPrompt(payload: PiMonoCreateRunRequest): string {
    const requestKind = payload.requestKind ?? 'formal_execution';
    const decisionMode = requestKind === 'interactive_decision';
    const groupRuntimeMode = requestKind === 'group_runtime';
    const repoCapabilityState = this.describeRepoCapabilityState(payload);
    const promptGuidance = decisionMode
      ? [
          'You are the manager agent for a Feishu project collaboration workspace.',
          'Your job in this turn is to decide the next interaction step before any formal execution happens.',
          'If the request is ambiguous, missing key constraints, or you are not confident, ask exactly one concise follow-up question.',
          'If the request is clear but risky or likely to cause unwanted side effects, request confirmation.',
          'If the request is clear enough to proceed, choose execute and provide an executionGoal and executionPrompt.',
          'Call emit_decision exactly once with the final structured decision.',
          'Do not call emit_outputs during manager decision runs.',
        ]
      : groupRuntimeMode
        ? [
            'You are the long-running manager for a Feishu project group.',
            'This turn is a group runtime turn, not a formal execution run.',
            'You are a group project administrator, not a generic chat assistant and not a backend workflow engine.',
            'Every completed group runtime turn must end with a user-facing group reply.',
            'Treat the latest group message as a trigger signal, not as the only source of project context.',
            'Prefer concise group replies, runtime todo updates, and lightweight progress over large formal deliverables.',
            'Feishu docs are the formal knowledge base, and the bound Feishu task board is the formal follow-up board.',
            'Runtime todos are internal scratchpad state and are not the source of truth for official project tasks.',
            'Only call emit_outputs if a durable formal artifact is explicitly needed in this turn.',
            'Do not generate a large formal document by default during group runtime turns.',
          ]
      : [
          'You are running as PiMono for the Feishu project collaboration backend.',
          'This turn is a formal execution run that may produce persisted artifacts.',
          'When you are ready to produce the final formal result, call emit_outputs exactly once.',
          'Do not return raw JSON in assistant text.',
          'If no formal document, task, file, or log is needed, emit one summary output.',
        ];
    const groupRuntimeGuidance = groupRuntimeMode
      ? [
          'You are managing a long-running group runtime for a Feishu project workspace.',
          'Only act on explicit @bot requests and the persisted runtime todo queue.',
          'First decide whether the latest message creates new internal todos or updates existing ones.',
          'Maintain the persisted todo queue with todo_list and todo_write.',
          'At most one todo may be in running state at any time.',
          'You must call reply_group at least once in every completed turn, even if it is only a short acknowledgment or summary.',
          'If human confirmation is required, use request_group_confirmation and stop the blocked todo in waiting_confirmation.',
          'Use reply_group for concise user-facing updates.',
          'Read bound project resources on demand before relying on chat memory alone.',
          'Internal todos are not the official Feishu task board unless you explicitly emit a formal task output with persistence intent.',
          'When you are ready to persist formal deliverables, call emit_outputs exactly once and only for explicitly durable outputs.',
        ]
      : [];

    return [
      ...promptGuidance,
      ...groupRuntimeGuidance,
      '',
      '## Execution Bias',
      ...this.buildExecutionBiasLines(requestKind),
      '',
      '## Tooling',
      ...this.buildToolingLines(payload, groupRuntimeMode),
      '',
      '## Runtime Policy',
      ...this.buildRuntimePolicyLines(payload, requestKind, repoCapabilityState),
      '',
      '## Runtime Context',
      `Runtime session: ${payload.runtimeSessionKey}`,
      `Agent scope: ${payload.agentScopeKey ?? 'not configured'}`,
      `Session mode: ${payload.sessionMode ?? 'active'}`,
      `Request kind: ${requestKind}`,
      `Wake mode: ${payload.wakeMode ?? 'interactive'}`,
      `Digest type: ${payload.digestType ?? 'none'}`,
      `Project: ${payload.project.name} (${payload.project.id})`,
      `Environment: ${payload.environment.name} (${payload.environment.id})`,
      `Repository: ${payload.environment.repoUrl ?? 'not configured'}`,
      `Branch: ${payload.environment.repoBranch ?? 'not configured'}`,
      `Repo capability state: ${repoCapabilityState}`,
      `Repo mirror path: ${payload.environment.repoMirrorPath ?? 'not prepared'}`,
      `Repo sync status: ${payload.minimalContext?.repoReady ? 'ready' : payload.environment.repoSyncStatus ?? 'unknown'}`,
      `Repo head: ${payload.minimalContext?.repoHeadRef ?? payload.environment.repoHeadRef ?? 'unknown'}`,
      `Intent: ${payload.intent}`,
      groupRuntimeMode ? `Runtime task snapshot count: ${payload.runtimeTasks?.length ?? 0}` : undefined,
      payload.minimalContext?.sessionMemorySummary
        ? `Session memory summary: ${payload.minimalContext.sessionMemorySummary}`
        : 'Session memory summary: none',
      groupRuntimeMode
        ? `Group policy: mentionOnly=${payload.minimalContext?.groupPolicy?.mentionOnly ?? 'unknown'}, allowDocWrite=${payload.minimalContext?.groupPolicy?.allowDocWrite ?? 'unknown'}, allowTaskBoardWrite=${payload.minimalContext?.groupPolicy?.allowTaskBoardWrite ?? 'unknown'}, highRiskConfirmation=${payload.minimalContext?.groupPolicy?.highRiskActionsRequireConfirmation ?? 'unknown'}`
        : undefined,
      groupRuntimeMode
        ? `Project resources: docFolder=${payload.minimalContext?.resourceSummary?.hasDocFolder ? 'bound' : 'unbound'}, taskBoard=${payload.minimalContext?.resourceSummary?.hasTaskBoard ? 'bound' : 'unbound'}`
        : undefined,
      groupRuntimeMode
        ? `Recent project docs: ${this.describeRecentDocs(payload)}`
        : undefined,
      groupRuntimeMode
        ? `Task board summary: ${this.describeTaskBoardSummary(payload)}`
        : undefined,
      groupRuntimeMode
        ? `Recent formal artifacts: ${this.describeRecentArtifacts(payload)}`
        : undefined,
      payload.environment.repoSyncError ? `Latest repo sync error: ${payload.environment.repoSyncError}` : 'Latest repo sync error: none',
      payload.roleProfile ? 'A compiled role profile context file is attached below.' : 'No role profile is attached.',
      `Target output schema: ${JSON.stringify(payload.outputSchema)}`,
      '',
      ...(payload.roleProfile ? ['Compiled AGENTS.md (virtual):', payload.roleProfile.compiledContextFile, ''] : []),
      'User request:',
      payload.prompt,
    ].join('\n');
  }

  private buildExecutionBiasLines(requestKind: PiMonoCreateRunRequest['requestKind']) {
    const base = [
      '- Actionable request: act in this turn.',
      '- Continue until done or genuinely blocked; do not stop at a plan when tools can advance the work.',
      '- Weak or empty tool results: vary the query, path, or source before concluding.',
      '- Mutable facts require live verification through the tools available in this runtime.',
    ];

    if (requestKind === 'interactive_decision') {
      return [
        ...base,
        '- This is a decision turn: end with exactly one emit_decision call, not emit_outputs.',
        '- Ask for only the one missing decision that genuinely blocks safe execution.',
      ];
    }

    if (requestKind === 'group_runtime') {
      return [
        ...base,
        '- Prefer advancing the runtime queue and current todo state in this turn.',
        '- For longer work, send concise user-facing progress only when it materially helps; otherwise keep progress in runtime events and todo state.',
        '- A successful runtime turn must include a group-facing reply.',
        '- Final runtime completion should be backed by tool effects, runtime state changes, or emitted outputs.',
      ];
    }

    return [
      ...base,
      '- Final execution needs evidence: emitted outputs, verified file inspection, repo inspection, or a named blocker.',
      '- If no formal document, task, file, or log is needed, still emit one summary output with concrete evidence.',
    ];
  }

  private buildToolingLines(payload: PiMonoCreateRunRequest, groupRuntimeMode: boolean) {
    return [
      '- Built-in local tools: read, grep, find, ls.',
      '- Feishu tools are on-demand only: list_project_folder, read_project_doc, search_project_docs, read_project_bitable, list_recent_project_artifacts.',
      groupRuntimeMode
        ? '- Runtime tools: todo_list, todo_write, reply_group, request_group_confirmation, emit_outputs.'
        : '- Runtime tools for queue and group replies are not available in this request kind.',
      payload.environment.repoMirrorPath && payload.environment.repoSyncStatus === 'ready'
        ? '- Repo inspection is available through the ready local repo mirror; use it as the source of truth for code facts.'
        : '- Repo inspection is not currently available from a ready local mirror; do not assume repository contents.',
      '- Feishu project materials are only summarized lightly in prompt context; retrieve them on demand when you need real details.',
    ];
  }

  private buildRuntimePolicyLines(
    payload: PiMonoCreateRunRequest,
    requestKind: PiMonoCreateRunRequest['requestKind'],
    repoCapabilityState: string,
  ) {
    const lines = [
      `- Repo capability state is ${repoCapabilityState}; align your behavior to it instead of assuming code access.`,
      '- Do not fabricate code, files, or external project facts that were not verified in this turn.',
      '- Respect tool boundaries: use on-demand retrieval instead of asking for bulk context by default.',
    ];

    if (requestKind === 'group_runtime') {
      lines.push('- Human confirmation must go through request_group_confirmation and then stop the blocked task in waiting_confirmation.');
      lines.push('- Keep at most one runtime todo in running state at a time.');
      lines.push('- reply_group is mandatory for every completed turn and should stay concise and user-facing.');
      lines.push(
        `- Respect group policy boundaries: doc writes are ${
          payload.minimalContext?.groupPolicy?.allowDocWrite === false ? 'disabled' : 'allowed when explicitly requested'
        }, task board writes are ${
          payload.minimalContext?.groupPolicy?.allowTaskBoardWrite === false ? 'disabled' : 'allowed when explicitly requested'
        }.`,
      );
      lines.push('- Only durable outputs with explicit persistence intent should be considered for formal sync.');
    }

    if (requestKind === 'interactive_decision') {
      lines.push('- Do not start formal execution in a decision turn; decide only the next safe interaction step.');
    }

    if (requestKind === 'formal_execution') {
      lines.push('- Formal execution should finish with emit_outputs exactly once when the result is ready.');
    }

    return lines;
  }

  private describeRepoCapabilityState(payload: PiMonoCreateRunRequest) {
    if (!payload.environment.repoUrl?.trim()) {
      return 'repo_unconfigured';
    }
    if (payload.environment.repoSyncStatus === 'ready' || payload.minimalContext?.repoReady) {
      return 'repo_ready';
    }
    if (payload.environment.repoSyncStatus === 'error') {
      return 'repo_error';
    }
    return 'repo_initializing';
  }

  private describeRecentDocs(payload: PiMonoCreateRunRequest) {
    const docs = payload.minimalContext?.resourceSummary?.recentDocs ?? [];
    if (!docs.length) {
      return 'none';
    }
    return docs
      .map((doc) => `${doc.title}${doc.updatedAt ? ` (${doc.updatedAt})` : ''}`)
      .join('; ');
  }

  private describeTaskBoardSummary(payload: PiMonoCreateRunRequest) {
    const summary = payload.minimalContext?.resourceSummary?.taskBoardSummary;
    if (!summary) {
      return 'none';
    }
    return `pending_confirmation=${summary.pendingConfirmation}, blocked=${summary.blocked}, in_progress=${summary.inProgress}`;
  }

  private describeRecentArtifacts(payload: PiMonoCreateRunRequest) {
    const artifacts = payload.minimalContext?.resourceSummary?.recentArtifacts ?? [];
    if (!artifacts.length) {
      return 'none';
    }
    return artifacts.map((artifact) => `${artifact.type}:${artifact.title}`).join('; ');
  }

  private buildFallbackOutputs(text?: string | null): AgentOutput[] {
    return [
      {
        type: 'summary',
        title: 'PiMono execution summary',
        content: text?.trim() || 'PiMono run completed without a structured output tool call.',
        contentFormat: 'markdown',
        metadata: { fallback: true },
      },
    ];
  }

  private ensureGroupRuntimeReplyAction(
    actions: GroupRuntimeAction[],
    outputs?: AgentOutput[],
    lastAssistantText?: string,
  ): GroupRuntimeAction[] {
    if (actions.some((action) => action.type === 'reply_group' && action.text.trim())) {
      return actions;
    }
    return [
      ...actions,
      {
        type: 'reply_group',
        text: this.buildMandatoryRuntimeReply(outputs, lastAssistantText),
      },
    ];
  }

  private buildMandatoryRuntimeReply(outputs?: AgentOutput[], lastAssistantText?: string) {
    const assistantText = lastAssistantText?.trim();
    if (assistantText) {
      return assistantText.slice(0, 1000);
    }
    if (outputs?.length) {
      const titles = outputs
        .map((output) => output.title?.trim())
        .filter((title): title is string => !!title)
        .slice(0, 3);
      if (titles.length) {
        return `已处理完成。本轮结果：${titles.join('、')}。`;
      }
      return '已处理完成，我已经整理好了本轮结果。';
    }
    return '收到，这条消息我已经处理完了。';
  }

  private buildOutputSummary(outputs: AgentOutput[]): string {
    return outputs.map((output) => `${output.type}:${output.title}`).join(', ');
  }

  private buildMemorySummary(outputs?: AgentOutput[], assistantText?: string) {
    if (assistantText?.trim()) {
      return assistantText.trim().slice(0, 2000);
    }

    if (outputs?.length) {
      return outputs
        .map((output) => `${output.type}:${output.title}`)
        .join(', ')
        .slice(0, 2000);
    }

    return undefined;
  }

  private buildSessionSnapshot(
    state: SessionRuntimeState,
    outputs?: AgentOutput[],
    assistantText?: string,
  ): PiMonoSessionSnapshot {
    state.sessionStoreRef = state.sessionManager.getSessionFile() ?? state.sessionStoreRef;
    return {
      runtimeSessionKey: state.runtimeSessionKey,
      piSessionId: state.session.sessionId,
      sessionStoreDriver: 'local_file',
      sessionStoreRef: state.sessionStoreRef,
      memorySummary: this.buildMemorySummary(outputs, assistantText ?? state.lastAssistantText),
    };
  }

  private async enqueueRuntimeActor<T>(state: SessionRuntimeState, operation: () => Promise<T>): Promise<T> {
    const next = state.actorQueue.then(operation);
    state.actorQueue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  private async hydrateRuntimeState(state: SessionRuntimeState, contextBinding: RuntimeContextBinding) {
    if (state.eventSequence === 0) {
      const persistedEvents = await (this.prisma as any).runtimeEvent.findMany({
        where: { runtimeSessionKey: state.runtimeSessionKey },
        orderBy: { sequence: 'asc' },
        take: 100,
      });
      state.recentEvents = persistedEvents.map((event) => ({
        sequence: event.sequence,
        at: event.createdAt.toISOString(),
        type: event.eventType as RuntimeEventType,
        payload:
          event.payload && typeof event.payload === 'object' && !Array.isArray(event.payload)
            ? (event.payload as Record<string, unknown>)
            : {},
      }));
      state.eventSequence = persistedEvents[persistedEvents.length - 1]?.sequence ?? 0;
    }

    if (!state.runtimeTaskSnapshots.length && contextBinding.groupSessionId) {
      const tasks = await this.prisma.groupRuntimeTask.findMany({
        where: {
          groupSessionId: contextBinding.groupSessionId,
          status: {
            in: ['queued', 'running', 'blocked', 'waiting_confirmation'],
          },
        },
        orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
      });
      state.runtimeTaskSnapshots = tasks.map((task) => ({
        id: task.id,
        runtimeRef: this.extractRuntimeTaskRef(
          task.taskPayloadJson && typeof task.taskPayloadJson === 'object' && !Array.isArray(task.taskPayloadJson)
            ? (task.taskPayloadJson as Record<string, unknown>)
            : null,
        ),
        title: task.title,
        description: task.description,
        intent: task.intent,
        skillHint: task.skillHint,
        outputMode: task.outputMode,
        orderIndex: task.orderIndex,
        status: task.status,
        blockedReason: task.blockedReason,
        nextActionHint: task.nextActionHint,
        priority: task.priority,
        triggerType: task.triggerType,
        taskPayloadJson:
          task.taskPayloadJson && typeof task.taskPayloadJson === 'object' && !Array.isArray(task.taskPayloadJson)
            ? (task.taskPayloadJson as Record<string, unknown>)
            : null,
        resultSummary: task.resultSummary,
        lastError: task.lastError,
      }));
      const waiting = state.runtimeTaskSnapshots.find((task) => task.status === 'waiting_confirmation');
      if (waiting) {
        state.waitingTaskId = waiting.id;
        state.waitingReason = waiting.blockedReason ?? waiting.resultSummary ?? 'Waiting for confirmation';
      }
    }
  }

  private buildRuntimeStateSnapshot(state: SessionRuntimeState): RuntimeStateSnapshot {
    return {
      runtimeSessionKey: state.runtimeSessionKey,
      piSessionId: state.session.sessionId,
      status: state.waitingReason
        ? 'waiting_confirmation'
        : state.activeExecution
          ? state.activeExecution.canceled
            ? 'aborting'
            : 'running'
          : state.session.isCompacting
            ? 'compacting'
            : state.queue.length
              ? 'queued'
              : 'idle',
      currentTurn: state.currentTurn
        ? {
            turnId: state.currentTurn.turnId,
            mode: state.currentTurn.mode,
            messageSourceId: state.currentTurn.messageSourceId,
            startedAt: state.currentTurn.startedAt,
          }
        : undefined,
      queue: state.queue.map((item): RuntimeQueueItemSnapshot => ({
        queueItemId: item.queueItemId,
        messageSourceId: item.envelopes[0]?.messageSourceId,
        mode: item.mode,
        summary: item.summary,
        enqueuedAt: item.enqueuedAt,
      })),
      waitingReason: state.waitingReason,
      isStreaming: state.session.isStreaming,
      isCompacting: state.session.isCompacting,
      memorySummary: this.buildMemorySummary(undefined, state.lastAssistantText),
    };
  }

  private async handleStreamingSubmission(
    state: SessionRuntimeState,
    input: RuntimeSubmitMessageInput,
  ): Promise<RuntimeSubmitResult> {
    const queueMode = input.queueMode ?? 'collect';
    const envelope = input.envelope;

    if (queueMode === 'steer' && !state.session.isCompacting) {
      await state.session.steer(envelope.rawText);
      await this.recordRuntimeEvent(state, 'message_steered', {
        messageSourceId: envelope.messageSourceId,
        rawText: envelope.rawText,
      });
      return {
        accepted: true,
        action: 'steered',
        runtimeSessionKey: state.runtimeSessionKey,
        activeTurnId: state.currentTurn?.turnId,
      };
    }

    if (queueMode === 'interrupt') {
      const queued = this.enqueueRuntimeMessage(state, 'interrupt', envelope, true);
      if (state.activeExecution) {
        state.activeExecution.canceled = true;
      }
      await this.recordRuntimeEvent(state, 'message_interrupted', queued.payload);
      await state.session.abort().catch((error) => {
        this.logger.warn(
          `Failed to abort streaming runtime session ${state.runtimeSessionKey}: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
      return {
        accepted: true,
        action: 'interrupted',
        runtimeSessionKey: state.runtimeSessionKey,
        activeTurnId: state.currentTurn?.turnId,
      };
    }

    const queued = this.enqueueRuntimeMessage(state, queueMode, envelope);
    await this.recordRuntimeEvent(state, queued.type, queued.payload);
    return {
      accepted: true,
      action: queued.type === 'message_collected' ? 'collected' : 'queued',
      runtimeSessionKey: state.runtimeSessionKey,
      activeTurnId: state.currentTurn?.turnId,
    };
  }

  private enqueueRuntimeMessage(
    state: SessionRuntimeState,
    mode: RuntimeQueueMode,
    envelope: RuntimeSubmitMessageInput['envelope'],
    front = false,
  ) {
    if (mode === 'collect') {
      const candidate = front ? state.queue[0] : state.queue[state.queue.length - 1];
      if (candidate && candidate.mode === 'collect') {
        if (front) {
          candidate.envelopes.unshift(envelope);
        } else {
          candidate.envelopes.push(envelope);
        }
        candidate.summary = this.summarizeEnvelopes(candidate.envelopes);
        return {
          type: 'message_collected' as const,
          payload: {
            queueItemId: candidate.queueItemId,
            messageSourceId: envelope.messageSourceId,
            mode: candidate.mode,
            summary: candidate.summary,
          },
        };
      }
    }

    const item: RuntimeQueuedMessage = {
      queueItemId: randomUUID(),
      mode,
      summary: this.summarizeEnvelopes([envelope]),
      enqueuedAt: new Date().toISOString(),
      envelopes: [envelope],
    };
    if (front) {
      state.queue.unshift(item);
    } else {
      state.queue.push(item);
    }
    const eventType: 'message_collected' | 'message_queued' =
      mode === 'collect' ? 'message_collected' : 'message_queued';
    return {
      type: eventType,
      payload: {
        queueItemId: item.queueItemId,
        messageSourceId: envelope.messageSourceId,
        mode: item.mode,
        summary: item.summary,
      },
    };
  }

  private summarizeEnvelopes(envelopes: RuntimeSubmitMessageInput['envelope'][]) {
    if (envelopes.length === 1) {
      return envelopes[0].rawText.slice(0, 160);
    }
    return `${envelopes.length} queued messages: ${envelopes
      .map((item) => item.rawText.trim())
      .filter(Boolean)
      .slice(0, 3)
      .join(' | ')}`
      .slice(0, 200);
  }

  private async runRuntimeTurn(input: {
    state: SessionRuntimeState;
    project: PiMonoCreateRunRequest['project'];
    environment: PiMonoCreateRunRequest['environment'];
    roleProfile?: CompiledRoleProfile;
    minimalContext?: RuntimeMinimalContext;
    queueMode: RuntimeQueueMode;
    reasonText: string;
    source: PiMonoCreateRunRequest['source'];
  }) {
    const state = input.state;
    const turn = state.currentTurn;
    const contextBinding = state.currentContextBinding
      ? {
          projectId: state.currentContextBinding.projectId,
          environmentId: state.currentContextBinding.environmentId,
          feishuChatId: state.currentContextBinding.feishuChatId,
          groupSessionId: state.currentContextBinding.groupSessionId ?? null,
        }
      : undefined;
    if (!turn) {
      return;
    }

    await this.recordRuntimeEvent(state, 'turn_started', {
      turnId: turn.turnId,
      messageSourceId: turn.messageSourceId,
      queueLength: state.queue.length,
    });
    this.logger.log(
      `runtime turn started: session=${state.runtimeSessionKey} turn=${turn.turnId} source=${turn.messageSourceId ?? 'unknown'} queue=${state.queue.length}`,
    );

    try {
      const result = await this.executeGroupRuntimePrompt({
        payload: {
          runtimeSessionKey: state.runtimeSessionKey,
          sessionStoreRef: state.sessionStoreRef ?? null,
          sessionMode: 'active',
          requestKind: 'group_runtime',
          wakeMode: 'interactive',
          contextBinding: state.currentContextBinding,
          minimalContext: input.minimalContext,
          roleProfile: input.roleProfile,
          runtimeTasks: state.runtimeTaskSnapshots,
          project: input.project,
          environment: input.environment,
          source: input.source,
          intent: 'requirement_analysis',
          skillName: null,
          prompt: input.reasonText,
          outputSchema: {},
        },
        timeoutMs: this.resolveGroupRuntimeTimeoutMs(),
      });
      this.logger.log(
        `runtime turn result: session=${state.runtimeSessionKey} turn=${turn.turnId} status=${result.status} actions=${result.actions.length} outputs=${result.outputs?.length ?? 0}`,
      );

      if (result.status !== 'succeeded') {
        const salvaged = this.hasSalvageableRuntimeResult(result);
        if (salvaged) {
          await this.applyRuntimeTurnResult(state, result, input.source.messageSourceId ?? null, contextBinding);
        }
        if (result.status === 'timeout' && !salvaged) {
          await this.recordRuntimeEvent(state, 'reply_emitted', {
            text: '这条请求处理超时了。我已经停止本轮执行，请稍后重试，或者把问题拆小一点继续发给我。',
            messageSourceId: input.source.messageSourceId ?? null,
          });
        }
        await this.recordRuntimeEvent(state, 'turn_failed', {
          turnId: turn.turnId,
          status: result.status,
          salvaged,
        }, contextBinding);
      } else {
        await this.applyRuntimeTurnResult(state, result, input.source.messageSourceId ?? null, contextBinding);
        if (!state.waitingReason) {
          await this.recordRuntimeEvent(state, 'turn_completed', {
            turnId: turn.turnId,
            outputSummary: result.outputSummary ?? null,
          }, contextBinding);
        }
      }
    } catch (error) {
      this.logger.warn(
        `runtime turn exception: session=${state.runtimeSessionKey} turn=${turn.turnId} ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      await this.recordRuntimeEvent(state, 'turn_failed', {
        turnId: turn.turnId,
        errorMessage: error instanceof Error ? error.message : String(error),
      }, contextBinding);
      this.logger.warn(
        `Runtime turn ${turn.turnId} failed in session ${state.runtimeSessionKey}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      state.currentTurn = undefined;
      this.logger.log(
        `runtime turn finalized: session=${state.runtimeSessionKey} waiting=${state.waitingReason ? 'yes' : 'no'} queued=${state.queue.length}`,
      );
      if (!state.waitingReason) {
        await this.startNextQueuedTurn(state, input.project, input.environment, input.roleProfile, input.minimalContext);
      }
    }
  }

  private async startNextQueuedTurn(
    state: SessionRuntimeState,
    project: PiMonoCreateRunRequest['project'],
    environment: PiMonoCreateRunRequest['environment'],
    roleProfile?: CompiledRoleProfile,
    minimalContext?: RuntimeMinimalContext,
  ) {
    if (state.currentTurn || state.waitingReason || !state.queue.length) {
      return;
    }

    const next = state.queue.shift()!;
    state.currentTurn = {
      turnId: randomUUID(),
      startedAt: new Date().toISOString(),
      mode: 'group_runtime',
      messageSourceId: next.envelopes[0]?.messageSourceId,
    };

    void this.runRuntimeTurn({
      state,
      project,
      environment,
      roleProfile,
      minimalContext,
      queueMode: next.mode,
      reasonText: this.buildQueuedPrompt(next),
      source: {
        messageSourceId: next.envelopes[0]?.messageSourceId,
        feishuMessageId: next.envelopes[0]?.feishuMessageId,
        senderOpenId: next.envelopes[0]?.senderOpenId ?? null,
        traceId: next.envelopes[0]?.traceId ?? null,
      },
    });
  }

  private buildQueuedPrompt(item: RuntimeQueuedMessage) {
    if (item.envelopes.length === 1) {
      return item.envelopes[0].rawText;
    }
    return [
      'Process these collected group messages together as the next runtime turn:',
      ...item.envelopes.map((envelope, index) => `${index + 1}. ${envelope.rawText}`),
    ].join('\n');
  }

  private hasSalvageableRuntimeResult(result: GroupRuntimeTurnResult) {
    return (result.actions?.length ?? 0) > 0 || (result.outputs?.length ?? 0) > 0;
  }

  private async applyRuntimeTurnResult(
    state: SessionRuntimeState,
    result: GroupRuntimeTurnResult,
    messageSourceId: string | null,
    contextBinding?: RuntimeContextBinding,
  ) {
    for (const action of result.actions) {
      if (action.type === 'todo_write') {
        const snapshot = action.taskId ? this.findRuntimeTaskSnapshot(state, action.taskId) : null;
        await this.recordRuntimeEvent(
          state,
          'todo_changed',
          {
            action: action.action,
            task: snapshot,
            messageSourceId,
            feishuChatId: contextBinding?.feishuChatId ?? null,
          },
          contextBinding,
        );
        continue;
      }

      if (action.type === 'reply_group') {
        await this.recordRuntimeEvent(
          state,
          'reply_emitted',
          {
            text: action.text,
            messageSourceId,
            feishuChatId: contextBinding?.feishuChatId ?? null,
          },
          contextBinding,
        );
        continue;
      }

      if (action.type === 'request_group_confirmation') {
        let persistedTaskId: string | null = null;
        if (action.taskId) {
          const snapshot = this.findRuntimeTaskSnapshot(state, action.taskId);
          if (snapshot) {
            persistedTaskId = snapshot.id;
            snapshot.status = 'waiting_confirmation';
            snapshot.blockedReason = action.summary;
            snapshot.resultSummary = 'Waiting for confirmation';
            state.waitingTaskId = snapshot.id;
            state.waitingReason = snapshot.blockedReason ?? action.summary;
            await this.recordRuntimeEvent(
              state,
              'todo_changed',
              {
                action: 'waiting_confirmation',
                task: snapshot,
                messageSourceId,
                feishuChatId: contextBinding?.feishuChatId ?? null,
              },
              contextBinding,
            );
          }
          if (!persistedTaskId && this.isUuid(action.taskId)) {
            persistedTaskId = action.taskId;
          }
        } else {
          state.waitingReason = action.summary;
        }

        await this.recordRuntimeEvent(
          state,
          'confirmation_requested',
          {
            taskId: persistedTaskId,
            actionType: action.actionType,
            summary: action.summary,
            detail: action.detail ?? null,
            payload: action.payload,
            messageSourceId,
            feishuChatId: contextBinding?.feishuChatId ?? null,
          },
          contextBinding,
        );
        await this.recordRuntimeEvent(
          state,
          'session_waiting',
          {
            taskId: persistedTaskId,
            reason: action.summary,
            feishuChatId: contextBinding?.feishuChatId ?? null,
          },
          contextBinding,
        );
      }
    }

    if (result.outputs?.length) {
      await this.recordRuntimeEvent(
        state,
        'outputs_emitted',
        {
          outputs: result.outputs,
          messageSourceId,
          taskId: this.findActiveRuntimeTaskId(state),
          feishuChatId: contextBinding?.feishuChatId ?? null,
        },
        contextBinding,
      );
    }
  }

  private transitionRuntimeTask(state: SessionRuntimeState, action: GroupRuntimeTodoWriteAction) {
    if (action.action === 'create') {
      const requestedTaskId = typeof action.taskId === 'string' && action.taskId.trim() ? action.taskId.trim() : null;
      const internalTaskId = requestedTaskId && this.isUuid(requestedTaskId) ? requestedTaskId : randomUUID();
      const runtimeRef = requestedTaskId && !this.isUuid(requestedTaskId) ? requestedTaskId : null;
      const snapshot: GroupRuntimeTaskSnapshot = {
        id: internalTaskId,
        runtimeRef,
        title: action.title ?? 'Untitled runtime task',
        description: action.description ?? null,
        intent: action.intent ?? 'requirement_analysis',
        skillHint: action.skillHint ?? null,
        outputMode: action.outputMode ?? null,
        orderIndex: (state.runtimeTaskSnapshots[state.runtimeTaskSnapshots.length - 1]?.orderIndex ?? -1) + 1,
        status: 'queued',
        taskPayloadJson: this.withRuntimeTaskRef(action.taskPayload, runtimeRef),
        resultSummary: action.resultSummary ?? null,
        lastError: action.errorMessage ?? null,
      };
      state.runtimeTaskSnapshots.push(snapshot);
      return snapshot;
    }

    const snapshot = action.taskId ? this.findRuntimeTaskSnapshot(state, action.taskId) : null;
    if (!snapshot) {
      return null;
    }

    if (action.title !== undefined) snapshot.title = action.title;
    if (action.description !== undefined) snapshot.description = action.description;
    if (action.intent !== undefined) snapshot.intent = action.intent;
    if (action.skillHint !== undefined) snapshot.skillHint = action.skillHint ?? null;
    if (action.outputMode !== undefined) snapshot.outputMode = action.outputMode ?? null;
    if (action.taskPayload !== undefined) {
      snapshot.taskPayloadJson = this.withRuntimeTaskRef(action.taskPayload, snapshot.runtimeRef ?? null);
    }
    if (action.resultSummary !== undefined) snapshot.resultSummary = action.resultSummary;
    if (action.errorMessage !== undefined) snapshot.lastError = action.errorMessage;

    switch (action.action) {
      case 'update':
        break;
      case 'start':
        snapshot.status = 'running';
        snapshot.blockedReason = null;
        snapshot.lastError = null;
        break;
      case 'complete':
        snapshot.status = 'completed';
        break;
      case 'fail':
        snapshot.status = 'failed';
        break;
      case 'cancel':
        snapshot.status = 'canceled';
        break;
      case 'block':
        snapshot.status = 'blocked';
        snapshot.blockedReason = action.resultSummary ?? 'Task blocked';
        break;
    }

    return snapshot;
  }

  private findRuntimeTaskSnapshot(state: SessionRuntimeState, taskId: string) {
    const normalizedTaskId = taskId.trim();
    return (
      state.runtimeTaskSnapshots.find(
        (task) => task.id === normalizedTaskId || (task.runtimeRef != null && task.runtimeRef === normalizedTaskId),
      ) ?? null
    );
  }

  private findActiveRuntimeTaskId(state: SessionRuntimeState) {
    return (
      state.runtimeTaskSnapshots.find((task) => task.status === 'running')?.id ??
      state.waitingTaskId ??
      state.runtimeTaskSnapshots[state.runtimeTaskSnapshots.length - 1]?.id ??
      null
    );
  }

  private resolveRuntimeTaskId(state: SessionRuntimeState, taskId: string) {
    return this.findRuntimeTaskSnapshot(state, taskId)?.id ?? (this.isUuid(taskId) ? taskId : null);
  }

  private withRuntimeTaskRef(
    payload: Record<string, unknown> | null | undefined,
    runtimeRef: string | null,
  ): Record<string, unknown> | null {
    const base =
      payload && typeof payload === 'object' && !Array.isArray(payload)
        ? { ...payload }
        : payload === null
          ? null
          : {};
    if (!base) {
      return runtimeRef ? { __runtimeRef: runtimeRef } : null;
    }
    if (runtimeRef) {
      base.__runtimeRef = runtimeRef;
    } else {
      delete base.__runtimeRef;
    }
    return base;
  }

  private extractRuntimeTaskRef(payload: Record<string, unknown> | null) {
    return typeof payload?.__runtimeRef === 'string' && payload.__runtimeRef.trim()
      ? payload.__runtimeRef.trim()
      : null;
  }

  private isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
  }

  private async recordRuntimeEvent(
    state: SessionRuntimeState,
    type: RuntimeEventType,
    payload: Record<string, unknown>,
    contextBinding?: RuntimeContextBinding,
  ) {
    const event: RuntimeEvent = {
      sequence: state.eventSequence + 1,
      at: new Date().toISOString(),
      type,
      payload,
    };
    state.eventSequence = event.sequence;
    state.recentEvents.push(event);
    if (state.recentEvents.length > 100) {
      state.recentEvents.splice(0, state.recentEvents.length - 100);
    }
    this.logger.log(`runtime event: session=${state.runtimeSessionKey} seq=${event.sequence} type=${event.type}`);

    const eventContext = contextBinding ?? state.currentContextBinding;

    await (this.prisma as any).runtimeEvent.create({
      data: {
        runtimeSessionKey: state.runtimeSessionKey,
        groupSessionId: eventContext?.groupSessionId ?? null,
        projectId: eventContext?.projectId ?? null,
        environmentId: eventContext?.environmentId ?? null,
        sequence: event.sequence,
        eventType: event.type,
        payload: event.payload as any,
      },
    });

    await this.projectRuntimeEvent(state, event, eventContext);
    await this.syncRuntimeSessionProjection(state, event, eventContext);
  }

  private async projectRuntimeEvent(state: SessionRuntimeState, event: RuntimeEvent, contextBinding?: RuntimeContextBinding) {
    if (event.type === 'reply_emitted') {
      const chatId =
        typeof event.payload.feishuChatId === 'string'
          ? event.payload.feishuChatId
          : contextBinding?.feishuChatId ?? state.currentContextBinding?.feishuChatId;
      const text = typeof event.payload.text === 'string' ? event.payload.text : null;
      if (chatId && text) {
        this.logger.log(`sending group reply: session=${state.runtimeSessionKey} chat=${chatId} length=${text.length}`);
        await this.feishu.sendTextMessage('chat_id', chatId, text);
      }
      return;
    }

    if (event.type === 'todo_changed') {
      const binding = contextBinding ?? state.currentContextBinding;
      const task =
        event.payload.task && typeof event.payload.task === 'object' && !Array.isArray(event.payload.task)
          ? (event.payload.task as GroupRuntimeTaskSnapshot)
          : null;
      if (!task || !binding?.groupSessionId) {
        return;
      }
      await this.prisma.groupRuntimeTask.upsert({
        where: { id: task.id },
        create: {
          id: task.id,
          groupSessionId: binding.groupSessionId,
          projectId: binding.projectId,
          environmentId: binding.environmentId,
          messageSourceId:
            typeof event.payload.messageSourceId === 'string' ? event.payload.messageSourceId : null,
          title: task.title,
          description: task.description ?? null,
          intent: task.intent,
          skillHint: task.skillHint ?? null,
          outputMode: task.outputMode ?? null,
          orderIndex: task.orderIndex,
          status: task.status,
          blockedReason: task.blockedReason ?? null,
          nextActionHint: task.nextActionHint ?? null,
          priority: task.priority ?? 0,
          triggerType: task.triggerType ?? null,
          taskPayloadJson: (this.withRuntimeTaskRef(task.taskPayloadJson, task.runtimeRef ?? null) ?? {}) as any,
          resultSummary: task.resultSummary ?? null,
          lastError: task.lastError ?? null,
        },
        update: {
          messageSourceId:
            typeof event.payload.messageSourceId === 'string' ? event.payload.messageSourceId : undefined,
          title: task.title,
          description: task.description ?? null,
          intent: task.intent,
          skillHint: task.skillHint ?? null,
          outputMode: task.outputMode ?? null,
          orderIndex: task.orderIndex,
          status: task.status,
          blockedReason: task.blockedReason ?? null,
          nextActionHint: task.nextActionHint ?? null,
          priority: task.priority ?? 0,
          triggerType: task.triggerType ?? null,
          taskPayloadJson: (this.withRuntimeTaskRef(task.taskPayloadJson, task.runtimeRef ?? null) ?? {}) as any,
          resultSummary: task.resultSummary ?? null,
          lastError: task.lastError ?? null,
        },
      });
      return;
    }

    if (event.type === 'confirmation_requested') {
      await this.createRuntimeConfirmation(state, event.payload, contextBinding);
      return;
    }

    if (event.type === 'outputs_emitted') {
      await this.createRuntimeAuditRun(state, event.payload, contextBinding);
    }
  }

  private async syncRuntimeSessionProjection(
    state: SessionRuntimeState,
    event: RuntimeEvent,
    contextBinding?: RuntimeContextBinding,
  ) {
    const groupSessionId = contextBinding?.groupSessionId ?? state.currentContextBinding?.groupSessionId;
    if (!groupSessionId) {
      return;
    }

    const existing = await this.prisma.groupAgentSession.findUnique({
      where: { id: groupSessionId },
      select: { runtimeStateJson: true },
    });
    const existingState =
      existing?.runtimeStateJson &&
      typeof existing.runtimeStateJson === 'object' &&
      !Array.isArray(existing.runtimeStateJson)
        ? ({ ...(existing.runtimeStateJson as Record<string, unknown>) })
        : {};

    const snapshot = this.buildRuntimeStateSnapshot(state) as unknown as Record<string, unknown>;
    const nextState: Record<string, unknown> = {
      ...existingState,
      runtimeSessionKey: snapshot.runtimeSessionKey,
      piSessionId: snapshot.piSessionId,
      status: snapshot.status,
      queue: snapshot.queue,
      isStreaming: snapshot.isStreaming,
      isCompacting: snapshot.isCompacting,
      memorySummary: snapshot.memorySummary ?? null,
      currentTurn: snapshot.currentTurn ?? null,
      waitingReason: snapshot.waitingReason ?? null,
    };

    if (event.type === 'turn_completed' || event.type === 'turn_failed' || event.type === 'session_waiting') {
      await this.clearRuntimeProcessingReaction(nextState);
    }

    await this.prisma.groupAgentSession.update({
      where: { id: groupSessionId },
      data: {
        currentRuntimeTaskId: this.findActiveRuntimeTaskId(state),
        runtimeStateJson: nextState as any,
        lastRuntimeTurnAt: new Date(),
      },
    });
  }

  private async clearRuntimeProcessingReaction(runtimeState: Record<string, unknown>) {
    const reaction =
      runtimeState.processingReaction &&
      typeof runtimeState.processingReaction === 'object' &&
      !Array.isArray(runtimeState.processingReaction)
        ? (runtimeState.processingReaction as Record<string, unknown>)
        : null;
    const messageId = typeof reaction?.feishuMessageId === 'string' ? reaction.feishuMessageId : null;
    const reactionId = typeof reaction?.reactionId === 'string' ? reaction.reactionId : null;
    if (messageId && reactionId) {
      try {
        await this.feishu.removeMessageReaction(messageId, reactionId);
      } catch (error) {
        this.logger.warn(
          `Failed to clear processing reaction ${reactionId} for message ${messageId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    delete runtimeState.processingReaction;
  }

  private async createRuntimeConfirmation(
    state: SessionRuntimeState,
    payload: Record<string, unknown>,
    contextBinding?: RuntimeContextBinding,
  ) {
    const binding = contextBinding ?? state.currentContextBinding;
    const chatId = binding?.feishuChatId;
    const messageSourceId = typeof payload.messageSourceId === 'string' ? payload.messageSourceId : null;
    if (!chatId || !messageSourceId) {
      return;
    }
    const ttl = this.config.get<number>('CONFIRMATION_TTL_MINUTES') ?? 30;
    const expiresAt = new Date(Date.now() + ttl * 60_000);
    const confirmation = await this.prisma.confirmationRequest.create({
      data: {
        projectId: binding?.projectId,
        environmentId: binding?.environmentId,
        messageSourceId,
        groupRuntimeTaskId: typeof payload.taskId === 'string' ? payload.taskId : null,
        actionType: typeof payload.actionType === 'string' ? payload.actionType : 'runtime_confirmation',
        payload: (payload.payload ?? {}) as any,
        expiresAt,
      },
    });
    const sent = await this.feishu.sendCard(
      'chat_id',
      chatId,
      this.buildRuntimeConfirmationCard(
        confirmation.id,
        typeof payload.actionType === 'string' ? payload.actionType : 'runtime_confirmation',
        expiresAt,
        typeof payload.summary === 'string' ? payload.summary : undefined,
        typeof payload.detail === 'string' ? payload.detail : undefined,
      ),
    );
    const cardMessageId = (sent as any)?.data?.message_id ?? null;
    await this.prisma.confirmationRequest.update({
      where: { id: confirmation.id },
      data: { cardMessageId },
    });
  }

  private buildRuntimeConfirmationCard(
    id: string,
    actionType: string,
    expiresAt: Date,
    summary?: string,
    detail?: string,
  ) {
    return {
      config: { wide_screen_mode: true },
      header: { title: { tag: 'plain_text', content: '需要确认' }, template: 'orange' },
      elements: [
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: [
              `动作：${actionType}`,
              summary ? `说明：${summary}` : null,
              detail ? `原因：${detail}` : null,
              `过期时间：${expiresAt.toISOString()}`,
            ]
              .filter(Boolean)
              .join('\n'),
          },
        },
        {
          tag: 'action',
          actions: [
            {
              tag: 'button',
              text: { tag: 'plain_text', content: '确认' },
              type: 'primary',
              value: { confirmationId: id, decision: 'confirm' },
            },
            {
              tag: 'button',
              text: { tag: 'plain_text', content: '拒绝' },
              type: 'danger',
              value: { confirmationId: id, decision: 'reject' },
            },
          ],
        },
      ],
    };
  }

  private async createRuntimeAuditRun(
    state: SessionRuntimeState,
    payload: Record<string, unknown>,
    contextBinding?: RuntimeContextBinding,
  ) {
    const binding = contextBinding ?? state.currentContextBinding;
    if (!binding?.projectId || !binding.environmentId) {
      return;
    }
    const outputs = Array.isArray(payload.outputs) ? this.normalizeOutputs(payload.outputs) : [];
    if (!outputs.length) {
      return;
    }
    const taskId = typeof payload.taskId === 'string' ? payload.taskId : this.findActiveRuntimeTaskId(state);
    const task = taskId ? this.findRuntimeTaskSnapshot(state, taskId) : null;
    const run = await this.prisma.agentRun.create({
      data: {
        projectId: binding.projectId,
        environmentId: binding.environmentId,
        messageSourceId:
          typeof payload.messageSourceId === 'string' ? payload.messageSourceId : null,
        groupRuntimeTaskId: taskId,
        runType: 'runtime_audit' as AgentRunType,
        intent: task?.intent ?? 'requirement_analysis',
        skillName: task?.skillHint ?? null,
        prompt: 'Generated by runtime event projection.',
        status: AgentRunStatus.syncing,
        progress: 95,
        outputSummary: this.buildOutputSummary(outputs),
        rawOutputs: outputs as any,
        startedAt: new Date(),
      } as any,
    });
    await this.artifactQueue.add('sync-run', { agentRunId: run.id }, { jobId: `${run.id}-sync` });
  }

  private createSessionManager(
    sdk: PiSdkModule,
    input: {
      cwd: string;
      sessionStoreRef?: string;
    },
  ): SessionManager {
    if (input.sessionStoreRef && existsSync(input.sessionStoreRef)) {
      return sdk.SessionManager.open(
        input.sessionStoreRef,
        path.dirname(input.sessionStoreRef),
        input.cwd,
      ) as SessionManager;
    }

    const sessionDir = this.resolveManagedSessionDir();
    mkdirSync(sessionDir, { recursive: true });
    return sdk.SessionManager.create(input.cwd, sessionDir) as SessionManager;
  }

  private async watchCancellation(
    runId: string,
    state: SessionRuntimeState,
    execution: ActiveExecutionState,
  ) {
    if (execution.canceled) {
      return;
    }

    const requested = await this.isCancellationRequested(runId);
    if (!requested) {
      return;
    }

    execution.canceled = true;
    try {
      await state.session.abort();
    } catch (error) {
      this.logger.warn(`Failed to abort canceled pi mono run ${runId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async isCancellationRequested(runId: string): Promise<boolean> {
    const value = await this.redis.get(this.cancelKey(runId));
    return value === '1';
  }

  private findLiveRun(runId: string) {
    for (const state of this.sessions.values()) {
      if (state.activeExecution?.runId === runId) {
        return state;
      }
    }
    return null;
  }

  private async loadSdk(): Promise<PiSdkModule> {
    this.sdkPromise ??= nativeDynamicImport<PiSdkModule>('@mariozechner/pi-coding-agent');
    return this.sdkPromise;
  }

  private resolveModel(modelRegistry: ModelRegistry) {
    const provider = this.config.get<string>('PI_MONO_PROVIDER') || 'bailian';
    const modelId = this.config.get<string>('PI_MONO_MODEL') || 'kimi-k2.5';
    const explicit = modelRegistry.find(provider, modelId);
    if (explicit) {
      return explicit;
    }

    const fallback = modelRegistry.getAvailable()[0] ?? modelRegistry.getAll()[0];
    if (fallback) {
      this.logger.warn(`Configured PiMono model ${provider}/${modelId} was not found, falling back to ${fallback.provider}/${fallback.id}`);
      return fallback;
    }

    throw new BadGatewayException('No PiMono model is available');
  }

  private resolveThinkingLevel() {
    return this.config.get<'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'>('PI_MONO_THINKING_LEVEL') ?? 'off';
  }

  private resolveTimeoutMs() {
    return (this.config.get<number>('AGENT_RUN_TIMEOUT_SECONDS') ?? 1800) * 1000;
  }

  private resolveGroupRuntimeTimeoutMs() {
    const configuredMs = this.config.get<number>('PI_MONO_GROUP_RUNTIME_TIMEOUT_MS');
    if (typeof configuredMs === 'number' && Number.isFinite(configuredMs) && configuredMs >= 1_000) {
      return configuredMs;
    }

    const configuredSeconds = this.config.get<number>('PI_MONO_GROUP_RUNTIME_TIMEOUT_SECONDS');
    if (typeof configuredSeconds === 'number' && Number.isFinite(configuredSeconds) && configuredSeconds >= 30) {
      return configuredSeconds * 1000;
    }

    return 120_000;
  }

  private cancelTtlSeconds() {
    return (this.config.get<number>('AGENT_RUN_TIMEOUT_SECONDS') ?? 1800) + 60;
  }

  private cancelKey(runId: string) {
    return `pi-mono-cancel:${runId}`;
  }

  private resolveAgentDir() {
    return this.config.get<string>('PI_MONO_AGENT_DIR') || path.join(process.cwd(), '.pi-agent');
  }

  private resolveManagedSessionDir() {
    return path.join(this.resolveAgentDir(), 'sessions', 'managed');
  }

  private ensureCustomModelsConfig() {
    const provider = this.config.get<string>('PI_MONO_PROVIDER') || 'bailian';
    if (provider !== 'bailian') return;

    const agentDir = this.resolveAgentDir();
    const modelsPath = path.join(agentDir, 'models.json');
    mkdirSync(agentDir, { recursive: true });

    let existing: Record<string, unknown> = {};
    if (existsSync(modelsPath)) {
      try {
        existing = JSON.parse(readFileSync(modelsPath, 'utf8')) as Record<string, unknown>;
      } catch {
        existing = {};
      }
    }

    const modelId = this.config.get<string>('PI_MONO_MODEL') || 'kimi-k2.5';
    const providers = (existing.providers as Record<string, unknown> | undefined) ?? {};
    providers.bailian = {
      baseUrl: this.config.get<string>('BAILIAN_BASE_URL') || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      api: 'openai-completions',
      apiKey: 'DASHSCOPE_API_KEY',
      compat: {
        supportsDeveloperRole: false,
        supportsReasoningEffort: false,
        maxTokensField: 'max_tokens',
      },
      models: [
        {
          id: modelId,
          name: modelId === 'kimi-k2.5' ? 'Kimi K2.5 (Bailian)' : modelId,
          reasoning: false,
          input: ['text', 'image'],
          contextWindow: 128000,
          maxTokens: 16384,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        },
      ],
    };

    existing.providers = providers;
    writeFileSync(modelsPath, JSON.stringify(existing, null, 2), 'utf8');
  }

  private resolveCwd(input: {
    repoMirrorPath?: string | null;
    repoSyncStatus?: string | null;
    projectPath?: string | null;
  }) {
    const fallback = this.config.get<string>('PI_MONO_WORKDIR') || process.cwd();
    const cwd =
      input.repoMirrorPath && input.repoSyncStatus === 'ready'
        ? input.repoMirrorPath
        : input.projectPath || fallback;
    return existsSync(cwd) ? cwd : process.cwd();
  }
}
