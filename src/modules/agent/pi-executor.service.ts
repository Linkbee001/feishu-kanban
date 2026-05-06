import { BadGatewayException, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { GROUP_AGENT_SESSION_REDIS } from './agent.constants';
import {
  AgentOutput,
  GroupRuntimeAction,
  GroupRuntimeTurnResult,
  ManagerInteractiveDecision,
  PiMonoCreateRunRequest,
  PiMonoExecutionResult,
  PiMonoSessionSnapshot,
} from './agent.types';
import { SessionRuntimeState, ActiveExecutionState, PiSessionStateService } from './pi-session-state.service';
import { PiSessionManager } from './pi-session-manager.service';
import { PiPromptBuilder } from './pi-prompt-builder.service';
import { PiOutputProcessor } from './pi-output-processor.service';

/**
 * Error class for execution abort scenarios (timeout or cancellation).
 */
class PiMonoExecutionAbortError extends Error {
  constructor(
    readonly code: 'CANCELED' | 'TIMEOUT',
    message: string,
  ) {
    super(message);
    this.name = 'PiMonoExecutionAbortError';
  }
}

/**
 * Input type for executePrompt method.
 */
export interface ExecutePromptInput {
  runId?: string;
  payload: PiMonoCreateRunRequest;
  timeoutMs: number;
}

/**
 * Input type for executeDecisionPrompt method.
 */
export interface ExecuteDecisionPromptInput {
  payload: PiMonoCreateRunRequest;
  timeoutMs: number;
}

/**
 * Input type for executeGroupRuntimePrompt method.
 */
export interface ExecuteGroupRuntimePromptInput {
  payload: PiMonoCreateRunRequest;
  timeoutMs: number;
}

/**
 * Result type for executeDecisionPrompt method.
 */
export interface DecisionPromptResult {
  status: 'succeeded' | 'timeout' | 'canceled';
  decision?: ManagerInteractiveDecision;
  session: PiMonoSessionSnapshot;
}

/**
 * Service for handling PiMono execution core.
 * Per D-01 (responsibility domains), D-02 (Pi prefix), D-03 (coordinator injection).
 * Extracted from pi-mono.adapter.ts methods:
 * - executePrompt (lines 702-809)
 * - executeDecisionPrompt (lines 811-897)
 * - executeGroupRuntimePrompt (lines 899-1016)
 * - cancelRun (lines 317-333)
 * - watchCancellation (lines 2681-2701)
 */
@Injectable()
export class PiExecutor {
  private readonly logger = new Logger(PiExecutor.name);

  constructor(
    private readonly sessionManager: PiSessionManager,
    private readonly promptBuilder: PiPromptBuilder,
    private readonly outputProcessor: PiOutputProcessor,
    private readonly config: ConfigService,
    private readonly sessionStateService: PiSessionStateService,
    @Inject(GROUP_AGENT_SESSION_REDIS) private readonly redis: Redis,
  ) {}

  /**
   * Execute a prompt for formal execution runs.
   * Handles timeout, cancellation, and output collection.
   * @param input Execution input with runId, payload, and timeout
   * @returns Execution result with status, outputs, and session snapshot
   */
  async executePrompt(input: ExecutePromptInput): Promise<PiMonoExecutionResult> {
    const state = await this.sessionManager.ensureSession({
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
    state.currentContext = {
      projectId: input.payload.project.id,
      environmentId: input.payload.environment.id,
      feishuChatId: input.payload.project.feishuChatId,
    };

    let cancelWatcher: NodeJS.Timeout | undefined;
    let timeoutHandle: NodeJS.Timeout | undefined;

    try {
      if (input.runId && await this.isCancellationRequested(input.runId)) {
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

      await state.session.prompt(this.promptBuilder.buildPrompt(input.payload));

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
      state.currentContext = undefined;
    }
  }

  /**
   * Execute a prompt for manager decision runs.
   * Returns a decision structure instead of outputs.
   * @param input Execution input with payload and timeout
   * @returns Decision result with status, decision, and session snapshot
   */
  async executeDecisionPrompt(input: ExecuteDecisionPromptInput): Promise<DecisionPromptResult> {
    const state = await this.sessionManager.ensureSession({
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
    state.currentContext = {
      projectId: input.payload.project.id,
      environmentId: input.payload.environment.id,
      feishuChatId: input.payload.project.feishuChatId,
    };

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

      await state.session.prompt(this.promptBuilder.buildPrompt(input.payload));

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
      state.currentContext = undefined;
    }
  }

  /**
   * Execute a prompt for group runtime turns.
   * Returns actions and outputs for runtime queue management.
   * @param input Execution input with payload and timeout
   * @returns Group runtime turn result with status, actions, outputs, and session snapshot
   */
  async executeGroupRuntimePrompt(input: ExecuteGroupRuntimePromptInput): Promise<GroupRuntimeTurnResult> {
    const state = await this.sessionManager.ensureSession({
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
    state.currentContext = {
      projectId: input.payload.project.id,
      environmentId: input.payload.environment.id,
      feishuChatId: input.payload.project.feishuChatId,
    };
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

      this.logger.log(
        `[PI-MONO SDK] calling session.prompt: session=${state.runtimeSessionKey} promptLength=${input.payload.prompt?.length ?? 0}`,
      );
      await state.session.prompt(this.promptBuilder.buildPrompt(input.payload));
      this.logger.log(
        `[PI-MONO SDK] session.prompt completed: session=${state.runtimeSessionKey}`,
      );

      const lastAssistantText = state.session.getLastAssistantText()?.trim();
      state.lastAssistantText = lastAssistantText;

      if (execution.timedOut) {
        throw new PiMonoExecutionAbortError('TIMEOUT', 'pi mono group runtime turn timed out');
      }
      if (execution.canceled) {
        throw new PiMonoExecutionAbortError('CANCELED', 'pi mono group runtime turn canceled');
      }

      const finalActions = this.ensureGroupRuntimeReplyAction(execution.actions ?? [], execution.outputs, lastAssistantText);
      const replyAction = finalActions.find(a => a.type === 'reply_group');
      this.logger.log(
        `[PI-MONO RESULT] status=succeeded actions=${finalActions.length} outputs=${execution.outputs?.length ?? 0} reply_group=${replyAction ? `"${(replyAction as any).text?.slice(0, 200)}..."` : 'none'}`,
      );
      return {
        status: 'succeeded',
        actions: finalActions,
        outputs: execution.outputs,
        outputSummary: execution.outputs.length ? this.buildOutputSummary(execution.outputs) : undefined,
        session: this.buildSessionSnapshot(state, execution.outputs, lastAssistantText),
      };
    } catch (error) {
      const lastAssistantText = state.session.getLastAssistantText()?.trim();
      state.lastAssistantText = lastAssistantText;

      if (execution.timedOut || (error instanceof PiMonoExecutionAbortError && error.code === 'TIMEOUT')) {
        const timeoutActions = execution.actions ?? [];
        const timeoutReply = timeoutActions.find(a => a.type === 'reply_group');
        this.logger.log(
          `[PI-MONO RESULT] status=timeout actions=${timeoutActions.length} outputs=${execution.outputs?.length ?? 0} reply_group=${timeoutReply ? `"${(timeoutReply as any).text?.slice(0, 200)}..."` : 'none'}`,
        );
        return {
          status: 'timeout',
          actions: timeoutActions,
          outputs: execution.outputs,
          session: this.buildSessionSnapshot(state, execution.outputs, lastAssistantText),
        };
      }

      if (execution.canceled || (error instanceof PiMonoExecutionAbortError && error.code === 'CANCELED')) {
        const cancelActions = execution.actions ?? [];
        const cancelReply = cancelActions.find(a => a.type === 'reply_group');
        this.logger.log(
          `[PI-MONO RESULT] status=canceled actions=${cancelActions.length} outputs=${execution.outputs?.length ?? 0} reply_group=${cancelReply ? `"${(cancelReply as any).text?.slice(0, 200)}..."` : 'none'}`,
        );
        return {
          status: 'canceled',
          actions: cancelActions,
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
      state.currentContext = undefined;
      state.currentRoleProfile = undefined;
    }
  }

  /**
   * Cancel a running execution by runId.
   * Sets Redis cancel key and aborts the session.
   * @param runId The run ID to cancel
   */
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

  // Private helper methods

  /**
   * Watch for cancellation requests during execution.
   * Polls Redis for cancel flag and aborts session if found.
   */
  private async watchCancellation(
    runId: string,
    state: SessionRuntimeState,
    execution: ActiveExecutionState,
  ): Promise<void> {
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

  /**
   * Check if cancellation has been requested for a runId.
   */
  private async isCancellationRequested(runId: string): Promise<boolean> {
    const value = await this.redis.get(this.cancelKey(runId));
    return value === '1';
  }

  /**
   * Find a live run by runId across all session states.
   */
  private findLiveRun(runId: string): SessionRuntimeState | null {
    // Iterate through all states managed by PiSessionStateService
    for (const state of this.sessionStateService.getAllStates()) {
      if (state.activeExecution?.runId === runId) {
        return state;
      }
    }
    return null;
  }

  /**
   * Build a session snapshot for persistence/return.
   */
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

  /**
   * Build fallback outputs when no structured outputs were emitted.
   */
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

  /**
   * Build a summary string from outputs.
   */
  private buildOutputSummary(outputs: AgentOutput[]): string {
    return outputs.map((output) => `${output.type}:${output.title}`).join(', ');
  }

  /**
   * Build memory summary from outputs and assistant text.
   */
  private buildMemorySummary(outputs?: AgentOutput[], assistantText?: string): string | undefined {
    if (!outputs?.length && !assistantText?.trim()) {
      return undefined;
    }
    if (!outputs?.length) {
      return assistantText?.trim().slice(0, 500) ?? undefined;
    }
    const summary = this.buildOutputSummary(outputs);
    if (assistantText?.trim()) {
      return `${summary}\n\n${assistantText.trim().slice(0, 500)}`;
    }
    return summary;
  }

  /**
   * Ensure group runtime reply action exists.
   * Adds a mandatory reply_group action if none present.
   */
  private ensureGroupRuntimeReplyAction(
    actions: GroupRuntimeAction[],
    outputs?: AgentOutput[],
    lastAssistantText?: string,
  ): GroupRuntimeAction[] {
    if (actions.some((action) => action.type === 'reply_group' && (action as any).text?.trim())) {
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

  /**
   * Build mandatory runtime reply text.
   */
  private buildMandatoryRuntimeReply(outputs?: AgentOutput[], lastAssistantText?: string): string {
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

  /**
   * Generate Redis key for cancellation flag.
   */
  private cancelKey(runId: string): string {
    return `pi-mono-cancel:${runId}`;
  }

  /**
   * Get TTL seconds for cancellation key.
   */
  private cancelTtlSeconds(): number {
    return (this.config.get<number>('AGENT_RUN_TIMEOUT_SECONDS') ?? 1800) + 60;
  }
}