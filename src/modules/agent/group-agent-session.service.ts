import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AgentRole,
  AgentRunStatus,
  GroupAgentSession,
  GroupSessionMode,
  GroupSessionStatus,
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

type SessionState = {
  bootstrapDraft?: Record<string, string | undefined>;
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
    const data: Record<string, unknown> = {
      sessionState: { bootstrapDraft: input.draft },
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

  getBootstrapDraft(session: GroupAgentSession) {
    const state = (session.sessionState ?? {}) as SessionState;
    return state.bootstrapDraft ?? {};
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
}
