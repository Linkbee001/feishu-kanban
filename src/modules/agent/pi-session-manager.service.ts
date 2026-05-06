import { BadGatewayException, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import Redis from 'ioredis';
import * as path from 'path';
import type { AgentSession, ModelRegistry, SessionManager } from '@mariozechner/pi-coding-agent';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FeishuProjectReader } from '../feishu/feishu-project-reader.service';
import { GROUP_AGENT_SESSION_REDIS } from './agent.constants';
import { CompiledRoleProfile, PiMonoSessionSnapshot } from './agent.types';
import { PiSessionStateService, SessionRuntimeState } from './pi-session-state.service';
import { resolveBundledPiSkillsDir } from './pi-skill-mapping';

type PiSdkModule = typeof import('@mariozechner/pi-coding-agent');

const nativeDynamicImport = new Function('specifier', 'return import(specifier)') as <T>(
  specifier: string,
) => Promise<T>;

/**
 * Service for managing PiMono session lifecycle.
 * Per D-01 (responsibility domains), D-02 (Pi prefix), D-03 (coordinator injection).
 * Extracted from pi-mono.adapter.ts methods:
 * - ensureSession (lines 1018-1157)
 * - closeSession (lines 353-361)
 * - rehydrateSession (lines 335-346)
 * - loadSdk (lines 2717-2720)
 * - createSessionManager (lines 2661-2679)
 * - resolveCwd (lines 2822-2833)
 */
@Injectable()
export class PiSessionManager {
  private readonly logger = new Logger(PiSessionManager.name);
  private sdkPromise?: Promise<PiSdkModule>;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly sessionState: PiSessionStateService,
    private readonly feishuReader: FeishuProjectReader,
    @Inject(GROUP_AGENT_SESSION_REDIS) private readonly redis: Redis,
  ) {}

  /**
   * Ensure a session exists for the given runtime session key.
   * Creates new session if none exists, returns cached if cwd matches,
   * disposes and recreates if cwd changes.
   */
  async ensureSession(input: {
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

    const cached = this.sessionState.getState(input.runtimeSessionKey);
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
      this.sessionState.clearState(input.runtimeSessionKey);
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

    // Create state via PiSessionStateService
    const state = this.sessionState.createState({
      runtimeSessionKey: input.runtimeSessionKey,
      cwd,
      sessionManager,
      sessionStoreRef: sessionManager.getSessionFile() ?? normalizedStoreRef,
      roleProfile: input.roleProfile,
    });

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
      customTools: [], // Tools created by PiToolRegistry (future extraction)
    };

    const { session } = await sdk.createAgentSession(sessionOptions);

    this.sessionState.updateSession(state, session);
    state.sessionStoreRef = sessionManager.getSessionFile() ?? state.sessionStoreRef;
    state.lastAssistantText = session.getLastAssistantText()?.trim();

    return state;
  }

  /**
   * Close and dispose a session.
   */
  async closeSession(runtimeSessionKey: string): Promise<void> {
    this.sessionState.clearState(runtimeSessionKey);
  }

  /**
   * Rehydrate an existing session from a stored session file.
   */
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

  /**
   * Build a session snapshot for persistence/return.
   */
  private buildSessionSnapshot(state: SessionRuntimeState): PiMonoSessionSnapshot {
    state.sessionStoreRef = state.sessionManager.getSessionFile() ?? state.sessionStoreRef;
    return {
      runtimeSessionKey: state.runtimeSessionKey,
      piSessionId: state.session.sessionId,
      sessionStoreDriver: 'local_file',
      sessionStoreRef: state.sessionStoreRef,
      memorySummary: state.lastAssistantText,
    };
  }

  /**
   * Load the Pi SDK module.
   */
  private async loadSdk(): Promise<PiSdkModule> {
    this.sdkPromise ??= nativeDynamicImport<PiSdkModule>('@mariozechner/pi-coding-agent');
    return this.sdkPromise;
  }

  /**
   * Create a SessionManager for the Pi SDK.
   */
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

  /**
   * Resolve the working directory for the session.
   */
  private resolveCwd(input: {
    repoMirrorPath?: string | null;
    repoSyncStatus?: string | null;
    projectPath?: string | null;
  }): string {
    const fallback = this.config.get<string>('PI_MONO_WORKDIR') || process.cwd();
    const cwd =
      input.repoMirrorPath && input.repoSyncStatus === 'ready'
        ? input.repoMirrorPath
        : input.projectPath || fallback;
    return existsSync(cwd) ? cwd : process.cwd();
  }

  /**
   * Resolve the model from the registry.
   */
  private resolveModel(modelRegistry: ModelRegistry) {
    const provider = this.config.get<string>('PI_MONO_PROVIDER') || 'bailian';
    const modelId = this.config.get<string>('PI_MONO_MODEL') || 'kimi-k2.5';
    const explicit = modelRegistry.find(provider, modelId);
    if (explicit) {
      return explicit;
    }

    const fallback = modelRegistry.getAvailable()[0] ?? modelRegistry.getAll()[0];
    if (fallback) {
      this.logger.warn(
        `Configured PiMono model ${provider}/${modelId} was not found, falling back to ${fallback.provider}/${fallback.id}`,
      );
      return fallback;
    }

    throw new BadGatewayException('No PiMono model is available');
  }

  /**
   * Resolve the thinking level configuration.
   */
  private resolveThinkingLevel(): 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' {
    return (this.config.get<'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'>('PI_MONO_THINKING_LEVEL') ?? 'off');
  }

  /**
   * Resolve the agent directory.
   */
  private resolveAgentDir(): string {
    return this.config.get<string>('PI_MONO_AGENT_DIR') || path.join(process.cwd(), '.pi-agent');
  }

  /**
   * Resolve the managed session directory.
   */
  private resolveManagedSessionDir(): string {
    return path.join(this.resolveAgentDir(), 'sessions', 'managed');
  }

  /**
   * Ensure custom models config exists for Bailian provider.
   */
  private ensureCustomModelsConfig(): void {
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
}