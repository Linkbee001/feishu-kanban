import { BadGatewayException, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import Redis from 'ioredis';
import * as path from 'path';
import type { AgentSession, ModelRegistry, SessionManager } from '@mariozechner/pi-coding-agent';
import { GROUP_AGENT_SESSION_REDIS } from './agent.constants';
import { AgentOutput, PiMonoCreateRunRequest, PiMonoExecutionResult, PiMonoSessionSnapshot } from './agent.types';

type PiSdkModule = typeof import('@mariozechner/pi-coding-agent');

type SessionRuntimeState = {
  runtimeSessionKey: string;
  cwd: string;
  session: AgentSession;
  sessionManager: SessionManager;
  sessionStoreRef?: string;
  lastAssistantText?: string;
  activeExecution?: ActiveExecutionState;
};

type ActiveExecutionState = {
  runId?: string;
  outputs: AgentOutput[];
  emitted: boolean;
  canceled: boolean;
  timedOut: boolean;
};

type EmitOutputsArgs = {
  outputs?: unknown;
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
    @Inject(GROUP_AGENT_SESSION_REDIS) private readonly redis: Redis,
  ) {}

  async executeRun(runId: string, payload: PiMonoCreateRunRequest): Promise<PiMonoExecutionResult> {
    return this.executePrompt({
      runId,
      payload,
      timeoutMs: this.resolveTimeoutMs(),
    });
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

  private async executePrompt(input: {
    runId?: string;
    payload: PiMonoCreateRunRequest;
    timeoutMs: number;
  }): Promise<PiMonoExecutionResult> {
    const state = await this.ensureSession({
      runtimeSessionKey: input.payload.runtimeSessionKey,
      sessionStoreRef: input.payload.sessionStoreRef,
      projectPath: input.payload.environment.projectPath,
    });
    const execution: ActiveExecutionState = {
      runId: input.runId,
      outputs: [],
      emitted: false,
      canceled: false,
      timedOut: false,
    };
    state.activeExecution = execution;

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
    }
  }

  private async ensureSession(input: {
    runtimeSessionKey: string;
    sessionStoreRef?: string | null;
    projectPath?: string | null;
  }): Promise<SessionRuntimeState> {
    const normalizedStoreRef = input.sessionStoreRef ? path.resolve(input.sessionStoreRef) : undefined;
    const cwd = this.resolveCwd(input.projectPath);
    const cached = this.sessions.get(input.runtimeSessionKey);
    if (
      cached &&
      cached.cwd === cwd &&
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

    const state: SessionRuntimeState = {
      runtimeSessionKey: input.runtimeSessionKey,
      cwd,
      session: undefined as unknown as AgentSession,
      sessionManager,
      sessionStoreRef: sessionManager.getSessionFile() ?? normalizedStoreRef,
      lastAssistantText: undefined,
      activeExecution: undefined,
    };

    const { session } = await sdk.createAgentSession({
      cwd,
      agentDir,
      authStorage,
      modelRegistry,
      model,
      thinkingLevel: this.resolveThinkingLevel(),
      sessionManager,
      tools: ['read', 'grep', 'find', 'ls', 'emit_outputs'],
      customTools: [this.createEmitOutputsTool(state)],
    });

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

        const outputs = this.normalizeOutputs(params.outputs);
        if (!outputs.length) {
          throw new Error('emit_outputs requires at least one valid AgentOutput');
        }

        activeExecution.outputs = outputs;
        activeExecution.emitted = true;
        return {
          content: [{ type: 'text', text: `Captured ${outputs.length} structured outputs.` }],
        };
      },
    } as any;
  }

  private normalizeOutputs(value: unknown): AgentOutput[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((item) => this.isAgentOutput(item));
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

  private buildPrompt(payload: PiMonoCreateRunRequest): string {
    return [
      'You are running as PiMono for the Feishu project collaboration backend.',
      `Runtime session: ${payload.runtimeSessionKey}`,
      `Agent scope: ${payload.agentScopeKey ?? 'not configured'}`,
      `Session mode: ${payload.sessionMode ?? 'active'}`,
      `Project: ${payload.project.name} (${payload.project.id})`,
      `Environment: ${payload.environment.name} (${payload.environment.id})`,
      `Repository: ${payload.environment.repoUrl ?? 'not configured'}`,
      `Branch: ${payload.environment.repoBranch ?? 'not configured'}`,
      `Intent: ${payload.intent}`,
      `Recommended skill: ${payload.skillName ?? 'none'}`,
      '',
      'Available built-in tools are read-only: read, grep, find, ls.',
      'When you are ready to produce the final formal result, call emit_outputs exactly once.',
      'Do not return raw JSON in assistant text.',
      'If no formal document, task, file, or log is needed, emit one summary output.',
      `Target output schema: ${JSON.stringify(payload.outputSchema)}`,
      '',
      'User request:',
      payload.prompt,
    ].join('\n');
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

  private resolveCwd(projectPath?: string | null) {
    const fallback = this.config.get<string>('PI_MONO_WORKDIR') || process.cwd();
    const cwd = projectPath || fallback;
    return existsSync(cwd) ? cwd : process.cwd();
  }
}
