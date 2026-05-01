import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AgentRole,
  AgentRunStatus,
  GroupAgentSession,
  GroupSessionMode,
  GroupSessionStatus,
  Prisma,
} from '@prisma/client';
import Redis from 'ioredis';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  GroupAgentSessionAdapter,
  SessionContext,
  SessionMessageEnvelope,
  SessionSubmitResult,
} from './group-agent-session.types';
import { GROUP_AGENT_SESSION_REDIS } from './agent.constants';
import { PiMonoAdapter } from './pi-mono.adapter';
import { SummaryPolicy } from './agent.types';

type SessionState = {
  bootstrapDraft?: Record<string, string | undefined>;
  botBinding?: {
    appId?: string;
    botOpenId?: string;
    botName?: string;
    installedAt?: string;
    installedByOpenId?: string;
    updatedAt?: string;
  };
};

@Injectable()
export class GroupAgentSessionService implements GroupAgentSessionAdapter {
  private readonly logger = new Logger(GroupAgentSessionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly piMono: PiMonoAdapter,
    @Inject(GROUP_AGENT_SESSION_REDIS) private readonly redis: Redis,
  ) {}

  async getOrCreateSession(sessionKey: string, context: SessionContext): Promise<GroupAgentSession> {
    const role = context.agentRole ?? AgentRole.manager;
    const existing = await this.prisma.groupAgentSession.findUnique({
      where: {
        feishuChatId_agentRole: {
          feishuChatId: sessionKey,
          agentRole: role,
        },
      },
    });
    if (existing) {
      const nextData: Record<string, unknown> = {};
      if (context.projectId && !existing.projectId) {
        nextData.projectId = context.projectId;
        nextData.agentScopeKey = this.createAgentScopeKey(context.projectId, role);
      }
      if (context.environmentId && !existing.activeEnvironmentId) {
        nextData.activeEnvironmentId = context.environmentId;
      }
      if (context.sessionMode && existing.sessionMode !== context.sessionMode) {
        nextData.sessionMode = context.sessionMode;
      }
      if (!this.hasSummaryPolicy(existing.summaryPolicyJson)) {
        nextData.summaryPolicyJson = this.toSummaryPolicyJson(this.createDefaultSummaryPolicy());
      }
      if (!Object.keys(nextData).length) return existing;
      return this.prisma.groupAgentSession.update({
        where: { id: existing.id },
        data: nextData,
      });
    }

    return this.prisma.groupAgentSession.create({
      data: {
        projectId: context.projectId ?? null,
        feishuChatId: sessionKey,
        agentRole: role,
        agentScopeKey: this.createAgentScopeKey(context.projectId, role),
        runtimeSessionKey: this.createRuntimeSessionKey(sessionKey, role),
        sessionMode: context.sessionMode ?? (context.projectId ? GroupSessionMode.active : GroupSessionMode.bootstrap),
        status: GroupSessionStatus.idle,
        activeEnvironmentId: context.environmentId ?? null,
        summaryPolicyJson: this.toSummaryPolicyJson(this.createDefaultSummaryPolicy()),
      },
    });
  }

  async submitMessage(_sessionKey: string, _message: SessionMessageEnvelope): Promise<SessionSubmitResult> {
    return { status: 'failed', reason: 'submitMessage must be handled by AgentService' };
  }

  async isBusy(sessionKey: string): Promise<boolean> {
    const existing = await this.redis.get(this.lockKey(sessionKey));
    return Boolean(existing);
  }

  async getBusyReason(sessionKey: string): Promise<string | null> {
    const session = await this.prisma.groupAgentSession.findUnique({
      where: {
        feishuChatId_agentRole: {
          feishuChatId: sessionKey,
          agentRole: AgentRole.manager,
        },
      },
      select: {
        currentAgentRunId: true,
        status: true,
      },
    });
    if (!session) return null;
    if (session.currentAgentRunId) {
      return `run:${session.currentAgentRunId}`;
    }
    return session.status === GroupSessionStatus.busy ? 'busy' : null;
  }

  async rehydrateSession(sessionKey: string): Promise<void> {
    const session = await this.prisma.groupAgentSession.findUnique({
      where: {
        feishuChatId_agentRole: {
          feishuChatId: sessionKey,
          agentRole: AgentRole.manager,
        },
      },
      include: {
        activeEnvironment: {
          select: {
            projectPath: true,
          },
        },
      },
    });
    if (!session) return;

    const snapshot = await this.piMono.rehydrateSession({
      runtimeSessionKey: session.runtimeSessionKey,
      sessionStoreRef: session.sessionStoreRef,
      projectPath: session.activeEnvironment?.projectPath ?? null,
    });

    await this.prisma.groupAgentSession.update({
      where: { id: session.id },
      data: {
        piSessionId: snapshot.piSessionId,
        sessionStoreDriver: snapshot.sessionStoreDriver,
        sessionStoreRef: snapshot.sessionStoreRef,
        memorySummary: snapshot.memorySummary ?? session.memorySummary,
        lastRunAt: new Date(),
      },
    });
  }

  async closeSession(sessionKey: string): Promise<void> {
    const session = await this.prisma.groupAgentSession.findUnique({
      where: {
        feishuChatId_agentRole: {
          feishuChatId: sessionKey,
          agentRole: AgentRole.manager,
        },
      },
    });
    if (!session) return;
    await this.releaseLock(session.feishuChatId, session.activeLockToken ?? undefined);
    await this.prisma.groupAgentSession.update({
      where: { id: session.id },
      data: {
        status: GroupSessionStatus.disabled,
        sessionMode: GroupSessionMode.disabled,
        currentAgentRunId: null,
        activeLockToken: null,
      },
    });
  }

  createRuntimeSessionKey(chatId: string, role = AgentRole.manager) {
    return `chat:${chatId}:${role}`;
  }

  createAgentScopeKey(projectId?: string | null, role = AgentRole.manager) {
    return projectId ? `project:${projectId}:${role}` : `project:unbound:${role}`;
  }

  async tryAcquireLock(chatId: string, lockToken: string) {
    const ttlSeconds = (this.config.get<number>('AGENT_RUN_TIMEOUT_SECONDS') ?? 1800) + 60;
    const acquired = await this.redis.set(this.lockKey(chatId), lockToken, 'EX', ttlSeconds, 'NX');
    return acquired === 'OK';
  }

  async releaseLock(chatId: string, lockToken?: string) {
    if (!lockToken) {
      await this.redis.del(this.lockKey(chatId));
      return;
    }

    const script = `
      local key = KEYS[1]
      local token = ARGV[1]
      if redis.call("GET", key) == token then
        return redis.call("DEL", key)
      end
      return 0
    `;
    await this.redis.eval(script, 1, this.lockKey(chatId), lockToken);
  }

  async updateBootstrapState(
    sessionId: string,
    input: {
      draft: Record<string, string | undefined>;
      summary?: string | null;
      error?: string | null;
    },
  ) {
    const current = await this.prisma.groupAgentSession.findUnique({
      where: { id: sessionId },
      select: { sessionState: true },
    });
    const currentState = this.readSessionState(current?.sessionState);
    const data: Record<string, unknown> = {
      sessionState: {
        ...currentState,
        bootstrapDraft: input.draft,
      },
      lastMessageAt: new Date(),
    };
    if (input.summary !== undefined) {
      data.memorySummary = input.summary;
    }
    if (input.error !== undefined) {
      data.lastError = input.error;
    }

    return this.prisma.groupAgentSession.update({
      where: { id: sessionId },
      data,
    });
  }

  async getBotBinding(feishuChatId: string) {
    const session = await this.prisma.groupAgentSession.findUnique({
      where: {
        feishuChatId_agentRole: {
          feishuChatId,
          agentRole: AgentRole.manager,
        },
      },
      select: {
        sessionState: true,
      },
    });
    return this.readSessionState(session?.sessionState).botBinding ?? null;
  }

  async upsertBotBinding(input: {
    feishuChatId: string;
    projectId?: string | null;
    environmentId?: string | null;
    appId?: string | null;
    botOpenId?: string | null;
    botName?: string | null;
    installedByOpenId?: string | null;
  }) {
    const session = await this.getOrCreateSession(input.feishuChatId, {
      projectId: input.projectId ?? null,
      environmentId: input.environmentId ?? null,
      feishuChatId: input.feishuChatId,
      agentRole: AgentRole.manager,
      sessionMode: input.projectId ? GroupSessionMode.active : GroupSessionMode.bootstrap,
    });
    const currentState = this.readSessionState(session.sessionState);
    const currentBinding = currentState.botBinding ?? {};
    const nextBinding = {
      ...currentBinding,
      ...(input.appId?.trim() ? { appId: input.appId.trim() } : {}),
      ...(input.botOpenId?.trim() ? { botOpenId: input.botOpenId.trim() } : {}),
      ...(input.botName?.trim() ? { botName: input.botName.trim() } : {}),
      ...(input.installedByOpenId?.trim() ? { installedByOpenId: input.installedByOpenId.trim() } : {}),
      installedAt: currentBinding.installedAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return this.prisma.groupAgentSession.update({
      where: { id: session.id },
      data: {
        sessionState: {
          ...currentState,
          botBinding: nextBinding,
        },
      },
    });
  }

  async syncRuntimeSessionState(input: {
    sessionId: string;
    piSessionId?: string | null;
    sessionStoreDriver?: string | null;
    sessionStoreRef?: string | null;
    memorySummary?: string | null;
    lastError?: string | null;
    touchMessageAt?: boolean;
    touchRunAt?: boolean;
  }) {
    const data: Record<string, unknown> = {};
    if (input.piSessionId !== undefined) {
      data.piSessionId = input.piSessionId;
    }
    if (input.sessionStoreDriver !== undefined) {
      data.sessionStoreDriver = input.sessionStoreDriver;
    }
    if (input.sessionStoreRef !== undefined) {
      data.sessionStoreRef = input.sessionStoreRef;
    }
    if (input.memorySummary !== undefined) {
      data.memorySummary = input.memorySummary;
    }
    if (input.lastError !== undefined) {
      data.lastError = input.lastError;
    }
    if (input.touchMessageAt) {
      data.lastMessageAt = new Date();
    }
    if (input.touchRunAt) {
      data.lastRunAt = new Date();
    }

    return this.prisma.groupAgentSession.update({
      where: { id: input.sessionId },
      data,
    });
  }

  async syncGroupRuntimeState(input: {
    sessionId: string;
    currentRuntimeTaskId?: string | null;
    runtimeStateJson?: Record<string, unknown>;
    touchRuntimeTurnAt?: boolean;
  }) {
    const data: Record<string, unknown> = {};
    if (input.currentRuntimeTaskId !== undefined) {
      data.currentRuntimeTaskId = input.currentRuntimeTaskId;
    }
    if (input.runtimeStateJson !== undefined) {
      data.runtimeStateJson = input.runtimeStateJson;
    }
    if (input.touchRuntimeTurnAt) {
      data.lastRuntimeTurnAt = new Date();
    }

    return this.prisma.groupAgentSession.update({
      where: { id: input.sessionId },
      data,
    });
  }

  getBootstrapDraft(session: GroupAgentSession) {
    return this.readSessionState(session.sessionState).bootstrapDraft ?? {};
  }

  getSummaryPolicy(session: Pick<GroupAgentSession, 'summaryPolicyJson'>): SummaryPolicy {
    const value =
      session.summaryPolicyJson && typeof session.summaryPolicyJson === 'object' && !Array.isArray(session.summaryPolicyJson)
        ? (session.summaryPolicyJson as Record<string, unknown>)
        : {};
    const defaults = this.createDefaultSummaryPolicy();
    return {
      enabled: value.enabled === false ? false : defaults.enabled,
      internalOnly: value.internalOnly === false ? false : defaults.internalOnly,
      dailyStatus: value.dailyStatus === false ? false : defaults.dailyStatus,
      weeklyDraft: value.weeklyDraft === false ? false : defaults.weeklyDraft,
      timezone: typeof value.timezone === 'string' && value.timezone.trim() ? value.timezone : defaults.timezone,
      dailyStatusChannel:
        value.dailyStatusChannel === 'group_message' || value.dailyStatusChannel === 'internal_digest'
          ? (value.dailyStatusChannel as SummaryPolicy['dailyStatusChannel'])
          : defaults.dailyStatusChannel,
      weeklyDraftChannel:
        value.weeklyDraftChannel === 'group_message' ||
        value.weeklyDraftChannel === 'internal_digest' ||
        value.weeklyDraftChannel === 'feishu_doc'
          ? (value.weeklyDraftChannel as SummaryPolicy['weeklyDraftChannel'])
          : defaults.weeklyDraftChannel,
    };
  }

  async bindProjectSession(input: {
    sessionId?: string;
    feishuChatId: string;
    projectId: string;
    environmentId?: string | null;
  }) {
    const session =
      input.sessionId
        ? await this.prisma.groupAgentSession.findUnique({ where: { id: input.sessionId } })
        : await this.prisma.groupAgentSession.findUnique({
            where: {
              feishuChatId_agentRole: {
                feishuChatId: input.feishuChatId,
                agentRole: AgentRole.manager,
              },
            },
          });

    if (!session) {
      return this.getOrCreateSession(input.feishuChatId, {
        projectId: input.projectId,
        environmentId: input.environmentId ?? null,
        feishuChatId: input.feishuChatId,
        agentRole: AgentRole.manager,
        sessionMode: GroupSessionMode.active,
      });
    }

    return this.prisma.groupAgentSession.update({
      where: { id: session.id },
      data: {
        projectId: input.projectId,
        activeEnvironmentId: input.environmentId ?? null,
        sessionMode: GroupSessionMode.active,
        status: GroupSessionStatus.idle,
        agentScopeKey: this.createAgentScopeKey(input.projectId, session.agentRole),
        lastError: null,
        summaryPolicyJson: this.hasSummaryPolicy(session.summaryPolicyJson)
          ? (session.summaryPolicyJson as Prisma.InputJsonValue)
          : this.toSummaryPolicyJson(this.createDefaultSummaryPolicy()),
      },
    });
  }

  async markRunQueued(input: {
    sessionId: string;
    runId: string;
    lockToken: string;
    environmentId?: string | null;
  }) {
    await this.prisma.groupAgentSession.update({
      where: { id: input.sessionId },
      data: {
        status: GroupSessionStatus.busy,
        currentAgentRunId: input.runId,
        activeLockToken: input.lockToken,
        activeEnvironmentId: input.environmentId ?? null,
        lastMessageAt: new Date(),
        lastRunAt: new Date(),
        lastError: null,
      },
    });
  }

  async handleRunStatusTransition(runId: string, status: AgentRunStatus, errorMessage?: string | null) {
    const session = await this.prisma.groupAgentSession.findFirst({
      where: { currentAgentRunId: runId },
    });
    if (!session) return;

    const terminalStatuses: AgentRunStatus[] = [
      AgentRunStatus.succeeded,
      AgentRunStatus.failed,
      AgentRunStatus.timeout,
      AgentRunStatus.canceled,
    ];

    if (terminalStatuses.includes(status)) {
      await this.releaseLock(session.feishuChatId, session.activeLockToken ?? undefined);
      await this.prisma.groupAgentSession.update({
        where: { id: session.id },
        data: {
          status: status === AgentRunStatus.failed || status === AgentRunStatus.timeout ? GroupSessionStatus.error : GroupSessionStatus.idle,
          currentAgentRunId: null,
          activeLockToken: null,
          lastRunAt: new Date(),
          lastError: status === AgentRunStatus.failed || status === AgentRunStatus.timeout ? errorMessage ?? session.lastError : null,
        },
      });
      return;
    }

    if (status === AgentRunStatus.running || status === AgentRunStatus.syncing) {
      await this.prisma.groupAgentSession.update({
        where: { id: session.id },
        data: {
          status: GroupSessionStatus.busy,
          lastRunAt: new Date(),
        },
      });
    }
  }

  async disableByChat(feishuChatId: string) {
    const session = await this.prisma.groupAgentSession.findUnique({
      where: {
        feishuChatId_agentRole: {
          feishuChatId,
          agentRole: AgentRole.manager,
        },
      },
    });
    if (!session) return null;

    await this.releaseLock(feishuChatId, session.activeLockToken ?? undefined);
    return this.prisma.groupAgentSession.update({
      where: { id: session.id },
      data: {
        status: GroupSessionStatus.disabled,
        sessionMode: GroupSessionMode.disabled,
        currentAgentRunId: null,
        activeLockToken: null,
      },
    });
  }

  async releaseBootstrapLock(chatId: string, lockToken: string) {
    try {
      await this.releaseLock(chatId, lockToken);
    } catch (error) {
      this.logger.warn(`Failed to release bootstrap lock for ${chatId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async inspectLock(chatId: string) {
    const key = this.lockKey(chatId);
    const token = await this.redis.get(key);
    const ttlMs = await this.redis.pttl(key);
    return {
      key,
      token,
      ttlMs,
      locked: token !== null,
    };
  }

  private lockKey(chatId: string) {
    return `group-agent-lock:${chatId}`;
  }

  private createDefaultSummaryPolicy(): SummaryPolicy {
    return {
      enabled: true,
      internalOnly: true,
      dailyStatus: true,
      weeklyDraft: true,
      timezone: this.config.get<string>('DIGEST_TIMEZONE') ?? 'Asia/Shanghai',
      dailyStatusChannel: 'internal_digest',
      weeklyDraftChannel: 'internal_digest',
    };
  }

  private hasSummaryPolicy(value: unknown) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value as object).length > 0);
  }

  private toSummaryPolicyJson(value: SummaryPolicy): Prisma.InputJsonValue {
    return value as unknown as Prisma.InputJsonValue;
  }

  private readSessionState(value: unknown): SessionState {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as SessionState) : {};
  }
}
