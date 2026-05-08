import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GroupRuntimeService } from '../agent/group-runtime.service';
import { FeishuService } from '../feishu/feishu.service';
import { GroupPolicyService } from '../project/group-policy.service';
import { ProjectMemberProfileService } from '../project/project-member-profile.service';
import { ProjectService } from '../project/project.service';
import { RepoSyncService } from '../repo/repo-sync.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runtime: GroupRuntimeService,
    private readonly feishu: FeishuService,
    private readonly policies: GroupPolicyService,
    private readonly memberProfiles: ProjectMemberProfileService,
    private readonly projects: ProjectService,
    private readonly repoSync: RepoSyncService,
  ) {}

  async listRobotInstances() {
    const sessions = await this.prisma.groupAgentSession.findMany({
      include: {
        project: true,
        activeEnvironment: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
    const recentRuns = await this.prisma.agentRun.findMany({
      where: {
        projectId: {
          in: sessions.map((session) => session.projectId).filter(Boolean) as string[],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.max(sessions.length * 3, 10),
    });
    const recentArtifacts = await this.prisma.artifact.findMany({
      where: {
        projectId: {
          in: sessions.map((session) => session.projectId).filter(Boolean) as string[],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.max(sessions.length * 3, 10),
    });
    const policies = await this.prisma.groupPolicy.findMany({
      where: {
        feishuChatId: {
          in: sessions.map((session) => session.feishuChatId),
        },
        archivedAt: null,
      },
    });

    return sessions.map((session) => {
      const recentRun = recentRuns.find((run) => run.projectId === session.projectId);
      const recentArtifact = recentArtifacts.find((artifact) => artifact.projectId === session.projectId);
      const policy = policies.find((item) => item.feishuChatId === session.feishuChatId) ?? null;
      return {
        robotName: `${session.project?.name ?? 'Unbound'} manager`,
        chatId: session.feishuChatId,
        projectId: session.projectId,
        projectName: session.project?.name ?? '未绑定项目',
        projectDefaultEnvironmentId: session.project?.defaultEnvironmentId ?? null,
        initStatus: session.project ? session.project.status : 'uninitialized',
        sessionMode: session.sessionMode,
        sessionStatus: session.status,
        activeEnvironmentId: session.activeEnvironment?.id ?? null,
        activeEnvironmentName: session.activeEnvironment?.name ?? null,
        lastActiveAt: session.lastMessageAt?.toISOString() ?? session.updatedAt.toISOString(),
        lastError: session.lastError,
        runtimeState: this.runtimeStateFromJson(session.runtimeStateJson),
        runtimeStatus: this.runtimeStateFromJson(session.runtimeStateJson)?.status ?? null,
        recentSkill: recentRun?.skillName ?? recentRun?.intent ?? null,
        recentRunType: (recentRun as any)?.runType ?? null,
        recentArtifactSummary: recentArtifact ? `${recentArtifact.type}:${recentArtifact.title}` : null,
        taskCounts: { queued: 0, running: 0, blocked: 0, waitingConfirmation: 0, completed: 0, failed: 0, canceled: 0 },
        policy: this.policies.toSnapshot(policy),
        repoCapability: session.activeEnvironment ? this.repoSync.getCapabilitySnapshot(session.activeEnvironment) : null,
      };
    });
  }

  async getRobotInstance(chatId: string) {
    const session = await this.prisma.groupAgentSession.findUnique({
      where: {
        feishuChatId_agentRole: {
          feishuChatId: chatId,
          agentRole: 'manager',
        },
      },
      include: {
        project: true,
        activeEnvironment: true,
      },
    });
    if (!session) {
      throw new NotFoundException('Robot instance not found');
    }
    const policy = await this.policies.findByChat(chatId);
    const recentRun = await this.prisma.agentRun.findFirst({
      where: { projectId: session.projectId ?? undefined },
      orderBy: { createdAt: 'desc' },
    });
    const recentArtifact = await this.prisma.artifact.findFirst({
      where: { projectId: session.projectId ?? undefined },
      orderBy: { createdAt: 'desc' },
    });

    return {
      robotName: `${session.project?.name ?? 'Unbound'} manager`,
      chatId: session.feishuChatId,
      projectId: session.projectId,
      projectName: session.project?.name ?? '未绑定项目',
      projectDefaultEnvironmentId: session.project?.defaultEnvironmentId ?? null,
      initStatus: session.project ? session.project.status : 'uninitialized',
      sessionMode: session.sessionMode,
      sessionStatus: session.status,
      activeEnvironmentId: session.activeEnvironment?.id ?? null,
      activeEnvironmentName: session.activeEnvironment?.name ?? null,
      lastActiveAt: session.lastMessageAt?.toISOString() ?? session.updatedAt.toISOString(),
      lastError: session.lastError,
      runtimeState: this.runtimeStateFromJson(session.runtimeStateJson),
      runtimeStatus: this.runtimeStateFromJson(session.runtimeStateJson)?.status ?? null,
      recentSkill: recentRun?.skillName ?? recentRun?.intent ?? null,
      recentRunType: (recentRun as any)?.runType ?? null,
      recentArtifactSummary: recentArtifact ? `${recentArtifact.type}:${recentArtifact.title}` : null,
      taskCounts: { queued: 0, running: 0, blocked: 0, waitingConfirmation: 0, completed: 0, failed: 0, canceled: 0 },
      policy: this.policies.toSnapshot(policy),
      repoCapability: session.activeEnvironment ? this.repoSync.getCapabilitySnapshot(session.activeEnvironment) : null,
    };
  }

  /**
   * Quick delete all data associated with a robot instance (D-10).
   * Deletes RuntimeEvents, AgentRuns, Artifacts, ConfirmationRequests,
   * MessageSources, GroupAgentSession, and Project in cascade-safe order.
   */
  async deleteRobotInstance(chatId: string) {
    // Find session and project first
    const session = await this.prisma.groupAgentSession.findUnique({
      where: {
        feishuChatId_agentRole: {
          feishuChatId: chatId,
          agentRole: 'manager',
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Robot instance not found');
    }

    const projectId = session.projectId;

    // Delete in correct order (respecting foreign key constraints)
    const deleted = {
      runtimeEvents: 0,
      agentRuns: 0,
      artifacts: 0,
      messageSources: 0,
      confirmationRequests: 0,
      groupAgentSession: 0,
      project: 0,
    };

    if (projectId) {
      // Delete RuntimeEvents
      deleted.runtimeEvents = await this.prisma.runtimeEvent
        .deleteMany({
          where: { projectId },
        })
        .then((r) => r.count);

      // Delete AgentRuns
      deleted.agentRuns = await this.prisma.agentRun
        .deleteMany({
          where: { projectId },
        })
        .then((r) => r.count);

      // Delete Artifacts
      deleted.artifacts = await this.prisma.artifact
        .deleteMany({
          where: { projectId },
        })
        .then((r) => r.count);

      // Delete ConfirmationRequests
      deleted.confirmationRequests = await this.prisma.confirmationRequest
        .deleteMany({
          where: { projectId },
        })
        .then((r) => r.count);

      // Delete Project
      deleted.project = await this.prisma.project
        .deleteMany({
          where: { id: projectId },
        })
        .then((r) => r.count);
    }

    // Delete MessageSources (by chatId)
    deleted.messageSources = await this.prisma.messageSource
      .deleteMany({
        where: { feishuChatId: chatId },
      })
      .then((r) => r.count);

    // Delete GroupAgentSession
    deleted.groupAgentSession = await this.prisma.groupAgentSession
      .delete({
        where: {
          feishuChatId_agentRole: {
            feishuChatId: chatId,
            agentRole: 'manager',
          },
        },
      })
      .then(() => 1);

    return {
      chatId,
      projectId,
      deleted,
      message: 'Robot instance and all associated data deleted',
    };
  }

  /**
   * Reset robot instance to pending_config state (D-11).
   * Deletes associated project data and clears session state fields.
   */
  async resetRobotInstanceConfig(chatId: string) {
    const session = await this.prisma.groupAgentSession.findUnique({
      where: {
        feishuChatId_agentRole: {
          feishuChatId: chatId,
          agentRole: 'manager',
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Robot instance not found');
    }

    const projectId = session.projectId;

    // Delete associated project data if exists
    if (projectId) {
      // Delete in correct order
      await this.prisma.runtimeEvent.deleteMany({ where: { projectId } });
      await this.prisma.agentRun.deleteMany({ where: { projectId } });
      await this.prisma.artifact.deleteMany({ where: { projectId } });
      await this.prisma.confirmationRequest.deleteMany({ where: { projectId } });
      await this.prisma.project.delete({ where: { id: projectId } });
    }

    // Reset session to pending_config state
    const updatedSession = await this.prisma.groupAgentSession.update({
      where: {
        feishuChatId_agentRole: {
          feishuChatId: chatId,
          agentRole: 'manager',
        },
      },
      data: {
        projectId: null,
        status: 'idle',
        sessionMode: 'pending_config',
        runtimeStateJson: {},
        activeEnvironmentId: null,
        lastError: null,
      },
    });

    return {
      chatId,
      previousProjectId: projectId,
      session: {
        status: updatedSession.status,
        sessionMode: updatedSession.sessionMode,
        projectId: updatedSession.projectId,
      },
      message: 'Robot instance reset to pending_config state',
    };
  }

  async getRuntime(chatId: string) {
    const snapshot = await this.runtime.getSessionSnapshot(chatId);
    if (!snapshot) {
      throw new NotFoundException('Runtime snapshot not found');
    }
    const counts = summarizeTasks(snapshot.tasks ?? []);
    return {
      session: snapshot.session,
      profile: snapshot.profile,
      runtimeState: snapshot.runtimeState ?? null,
      runtimeEvents: snapshot.runtimeEvents ?? [],
      summary: counts,
      tasks: snapshot.tasks ?? [],
      taskProjectionSummary: summarizeTasks(snapshot.tasks ?? []),
      repoCapability: snapshot.session.activeEnvironmentId
        ? this.repoSync.getCapabilitySnapshot(
            await this.prisma.projectEnvironment.findUniqueOrThrow({
              where: { id: snapshot.session.activeEnvironmentId },
            }),
          )
        : null,
    };
  }

  async getTasks(chatId: string) {
    const snapshot = await this.runtime.getSessionSnapshot(chatId);
    return snapshot?.tasks ?? [];
  }

  async getLogs(chatId: string, options?: { since?: number; limit?: number; eventType?: string }) {
    const session = await this.prisma.groupAgentSession.findUnique({
      where: {
        feishuChatId_agentRole: {
          feishuChatId: chatId,
          agentRole: 'manager',
        },
      },
    });
    if (!session?.projectId) {
      throw new NotFoundException('Robot instance not found');
    }

    const limit = options?.limit ?? 50;
    const since = options?.since;

    const [messages, runs, artifacts, confirmations, runtimeEvents] = await Promise.all([
      this.prisma.messageSource.findMany({
        where: {
          feishuChatId: chatId,
          ...(since ? { receivedAt: { gte: new Date(since) } } : {}),
        },
        orderBy: { receivedAt: 'desc' },
        take: limit,
      }),
      this.prisma.agentRun.findMany({
        where: {
          projectId: session.projectId,
          ...(since ? { createdAt: { gte: new Date(since) } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.artifact.findMany({
        where: {
          projectId: session.projectId,
          ...(since ? { createdAt: { gte: new Date(since) } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.confirmationRequest.findMany({
        where: {
          projectId: session.projectId,
          ...(since ? { createdAt: { gte: new Date(since) } } : {}),
        },
        orderBy: { expiresAt: 'desc' },
        take: limit,
      }),
      (this.prisma as any).runtimeEvent.findMany({
        where: {
          projectId: session.projectId,
          ...(options?.eventType ? { eventType: options.eventType } : {}),
          ...(since ? { createdAt: { gte: new Date(since) } } : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { sequence: 'desc' }],
        take: limit * 2, // More runtime events for monitoring
      }),
    ]);

    return {
      chatId,
      projectId: session.projectId,
      messages,
      runs,
      artifacts,
      confirmations,
      runtimeEvents,
      fetchedAt: Date.now(),
    };
  }

  getMembers(chatId: string) {
    return this.memberProfiles.listByChat(chatId);
  }

  async syncMembers(chatId: string) {
    const project = await this.prisma.project.findUnique({
      where: { feishuChatId: chatId },
      select: {
        id: true,
        feishuChatId: true,
        ownerOpenId: true,
      },
    });
    if (!project) {
      throw new NotFoundException('Robot instance not found');
    }

    const members = await this.feishu.listChatMembers(chatId);
    return this.memberProfiles.syncChatMembers({
      projectId: project.id,
      feishuChatId: project.feishuChatId,
      ownerOpenId: project.ownerOpenId,
      members,
    });
  }

  async updateMember(chatId: string, profileId: string, body: any) {
    return this.memberProfiles.updateByChat(chatId, profileId, body ?? {});
  }

  async getPolicy(chatId: string) {
    const policy = await this.policies.getByChat(chatId);
    return this.policies.toSnapshot(policy);
  }

  async updatePolicy(chatId: string, body: any) {
    const updated = await this.policies.updateByChat(chatId, body ?? {});
    return this.policies.toSnapshot(updated);
  }

  private runtimeStateFromJson(value: unknown) {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? ({ ...(value as Record<string, unknown>) })
      : null;
  }

  /**
   * List groups with pagination, filtering, and sorting
   * Maps sessionMode to status: active→bound, pending_config→pending_config, bootstrap→unbound
   */
  async listGroups(options: {
    status?: string;
    search?: string;
    page: number;
    limit: number;
  }) {
    const { status, search, page, limit } = options;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    // Filter by status (mapped from sessionMode)
    if (status) {
      const statusMap: Record<string, string> = {
        bound: 'active',
        pending_config: 'pending_config',
        unbound: 'bootstrap',
      };
      const dbStatus = statusMap[status];
      if (dbStatus) {
        where.sessionMode = dbStatus;
      }
    }

    // Fetch sessions with project info
    const [sessions, total] = await Promise.all([
      this.prisma.groupAgentSession.findMany({
        where,
        include: {
          project: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.groupAgentSession.count({ where }),
    ]);

    // Map to GroupListItem format
    const items = sessions.map((session) => {
      const statusMap: Record<string, 'bound' | 'pending_config' | 'unbound'> = {
        active: 'bound',
        pending_config: 'pending_config',
        bootstrap: 'unbound',
        disabled: 'unbound',
      };

      return {
        chatId: session.feishuChatId,
        name: session.project?.name ?? '未命名群',
        memberCount: 0, // Will be populated from Feishu API or cached
        status: statusMap[session.sessionMode] ?? 'unbound',
        createdAt: session.createdAt.toISOString(),
        lastActiveAt: session.lastMessageAt?.toISOString() ?? session.updatedAt.toISOString(),
      };
    });

    // Apply search filter client-side for name/chatId (Prisma doesn't support OR across relations easily)
    let filteredItems = items;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredItems = items.filter(
        (item) =>
          item.name.toLowerCase().includes(searchLower) ||
          item.chatId.toLowerCase().includes(searchLower)
      );
    }

    return {
      items: filteredItems,
      total: search ? filteredItems.length : total,
      page,
      limit,
    };
  }

  /**
   * Unbind a group by chatId
   * Calls ProjectService.unbindByChat to remove chat binding
   */
  async unbindGroup(chatId: string) {
    return this.projects.unbindByChat(chatId);
  }

  /**
   * List messages with pagination and filtering
   * Returns combined user messages (from MessageSource) and bot responses (from AgentRun outputSummary)
   */
  async listMessages(options: {
    group?: string;
    startDate?: string;
    endDate?: string;
    type?: 'all' | 'user' | 'bot';
    page: number;
    limit: number;
  }) {
    const { group, startDate, endDate, type, page, limit } = options;
    const skip = (page - 1) * limit;

    // Build where clause for MessageSource
    const messageWhere: any = {};
    if (group) {
      messageWhere.feishuChatId = group;
    }
    if (startDate) {
      messageWhere.receivedAt = { ...messageWhere.receivedAt, gte: new Date(startDate) };
    }
    if (endDate) {
      messageWhere.receivedAt = { ...messageWhere.receivedAt, lte: new Date(endDate) };
    }

    // Fetch user messages from MessageSource
    const userMessages = type === 'bot' ? [] : await this.prisma.messageSource.findMany({
      where: messageWhere,
      orderBy: { receivedAt: 'asc' }, // Oldest first for chat view
    });

    // Fetch sender names from ProjectMemberProfile
    const senderProfiles = await this.prisma.projectMemberProfile.findMany({
      where: group ? { feishuChatId: group } : {},
      select: { openId: true, displayName: true, groupNickname: true },
    });

    // Build sender name lookup
    const senderNames: Record<string, string> = {};
    for (const profile of senderProfiles) {
      senderNames[profile.openId] = profile.groupNickname || profile.displayName;
    }

    // Map user messages to response format
    const userItems = userMessages.map((msg) => ({
      id: msg.id,
      feishuMessageId: msg.feishuMessageId,
      feishuChatId: msg.feishuChatId,
      senderOpenId: msg.senderOpenId,
      senderName: senderNames[msg.senderOpenId] || '未知用户',
      rawText: msg.rawText,
      isBotMentioned: msg.isBotMentioned,
      receivedAt: msg.receivedAt.toISOString(),
      senderType: 'user' as const,
      agentRunId: null,
    }));

    // Fetch bot responses from AgentRun (linked via messageSourceId)
    // Bot messages are derived from AgentRun.outputSummary for runs triggered by messages
    const botMessages =
      type === 'user'
        ? []
        : await this.prisma.agentRun.findMany({
            where: {
              messageSourceId: { in: userMessages.map((m) => m.id) },
              outputSummary: { not: null },
            },
            include: { messageSource: true },
            orderBy: { createdAt: 'asc' },
          });

    // Map bot messages to response format
    const botItems = botMessages
      .filter((run) => run.outputSummary && run.messageSource)
      .map((run) => ({
        id: `run-${run.id}`,
        feishuMessageId: run.messageSource?.feishuMessageId ?? '',
        feishuChatId: run.messageSource?.feishuChatId ?? '',
        senderOpenId: 'bot',
        senderName: '机器人',
        rawText: run.outputSummary ?? '',
        isBotMentioned: false,
        receivedAt: run.finishedAt?.toISOString() ?? run.createdAt.toISOString(),
        senderType: 'bot' as const,
        agentRunId: run.id,
      }));

    // Combine and sort by timestamp (oldest first)
    const allItems = [...userItems, ...botItems].sort(
      (a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime()
    );

    // Apply pagination
    const total = allItems.length;
    const paginatedItems = allItems.slice(skip, skip + limit);

    return {
      items: paginatedItems,
      total,
      page,
      limit,
    };
  }

  /**
   * Get single message by id
   */
  async getMessage(id: string) {
    // Check if it's a bot message (run-{id})
    if (id.startsWith('run-')) {
      const runId = id.slice(4);
      const run = await this.prisma.agentRun.findUnique({
        where: { id: runId },
        include: { messageSource: true },
      });
      if (!run) {
        throw new NotFoundException('Message not found');
      }
      return {
        id: `run-${run.id}`,
        feishuMessageId: run.messageSource?.feishuMessageId ?? '',
        feishuChatId: run.messageSource?.feishuChatId ?? '',
        senderOpenId: 'bot',
        senderName: '机器人',
        rawText: run.outputSummary ?? '',
        isBotMentioned: false,
        receivedAt: run.finishedAt?.toISOString() ?? run.createdAt.toISOString(),
        senderType: 'bot' as const,
        agentRunId: run.id,
      };
    }

    // User message
    const msg = await this.prisma.messageSource.findUnique({
      where: { id },
    });
    if (!msg) {
      throw new NotFoundException('Message not found');
    }

    // Get sender name
    const profile = await this.prisma.projectMemberProfile.findFirst({
      where: { feishuChatId: msg.feishuChatId, openId: msg.senderOpenId },
      select: { displayName: true, groupNickname: true },
    });

    const senderName = profile?.groupNickname || profile?.displayName || '未知用户';

    return {
      id: msg.id,
      feishuMessageId: msg.feishuMessageId,
      feishuChatId: msg.feishuChatId,
      senderOpenId: msg.senderOpenId,
      senderName,
      rawText: msg.rawText,
      isBotMentioned: msg.isBotMentioned,
      receivedAt: msg.receivedAt.toISOString(),
      senderType: 'user' as const,
      agentRunId: null,
    };
  }

  /**
   * List runs with pagination and filtering
   */
  async listRuns(options: { group?: string; status?: string; page: number; limit: number }) {
    const { group, status, page, limit } = options;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    // Filter by group (chatId) through project relation
    if (group) {
      const project = await this.prisma.project.findFirst({
        where: { feishuChatId: group },
        select: { id: true },
      });
      if (project) {
        where.projectId = project.id;
      } else {
        // No project for this chatId, return empty
        return { items: [], total: 0, page, limit };
      }
    }

    // Filter by status
    if (status) {
      where.status = status;
    }

    const [runs, total] = await Promise.all([
      this.prisma.agentRun.findMany({
        where,
        include: {
          project: { select: { feishuChatId: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.agentRun.count({ where }),
    ]);

    const items = runs.map((run) => ({
      id: run.id,
      chatId: run.project?.feishuChatId ?? '',
      chatName: run.project?.name ?? '未命名群',
      runType: run.runType,
      status: run.status,
      skillName: run.skillName ?? null,
      intent: run.intent,
      startedAt: run.startedAt?.toISOString() ?? null,
      finishedAt: run.finishedAt?.toISOString() ?? null,
      createdAt: run.createdAt.toISOString(),
      errorMessage: run.errorMessage ?? null,
    }));

    return { items, total, page, limit };
  }

  /**
   * Get logs for a specific run by runId
   * Queries RuntimeEvents and maps to LogLine format
   */
  async getRunLogs(runId: string) {
    const run = await this.prisma.agentRun.findUnique({
      where: { id: runId },
      include: {
        project: { select: { id: true, feishuChatId: true, name: true } },
      },
    });

    if (!run) {
      throw new NotFoundException('Run not found');
    }

    const projectId = run.projectId;

    // Fetch RuntimeEvents for this project
    // Note: RuntimeEvents are not directly linked to AgentRun
    // We filter by projectId and time range around the run
    const runtimeEvents = await (this.prisma as any).runtimeEvent.findMany({
      where: {
        projectId,
        createdAt: {
          gte: run.startedAt ?? run.createdAt,
          lte: run.finishedAt ?? new Date(),
        },
      },
      orderBy: [{ createdAt: 'asc' }, { sequence: 'asc' }],
      take: 500,
    });

    // Map to LogLine format with level determination
    const logs = runtimeEvents.map((event: any) => {
      const level = this.mapEventTypeToLogLevel(event.eventType, event.payload);
      const timestamp = event.createdAt.toISOString();
      const message = this.formatLogMessage(event);

      return {
        timestamp,
        level,
        message,
        metadata: event.payload,
      };
    });

    return {
      runId,
      chatId: run.project?.feishuChatId ?? '',
      chatName: run.project?.name ?? '未命名群',
      runStatus: run.status,
      logs,
    };
  }

  /**
   * Map RuntimeEvent eventType to log level
   */
  private mapEventTypeToLogLevel(eventType: string, payload: any): 'INFO' | 'EXEC' | 'SUCCESS' | 'WARN' | 'ERROR' {
    switch (eventType) {
      case 'message_submitted':
        return 'INFO';
      case 'turn_completed':
        // Check if turn was successful
        if (payload?.status === 'succeeded') return 'SUCCESS';
        if (payload?.status === 'failed' || payload?.error) return 'ERROR';
        return 'INFO';
      case 'confirmation_requested':
        return 'WARN';
      case 'session_state_changed':
        if (payload?.runtimeState === 'error') return 'ERROR';
        return 'INFO';
      default:
        return 'INFO';
    }
  }

  /**
   * Format log message from RuntimeEvent
   */
  private formatLogMessage(event: any): string {
    const payload = event.payload ?? {};
    const eventType = event.eventType;

    switch (eventType) {
      case 'message_submitted':
        return `收到消息: ${payload?.rawText?.slice(0, 100) ?? '(空)'}...`;
      case 'turn_completed':
        const status = payload?.status ?? 'unknown';
        const summary = payload?.outputSummary ?? '';
        return `任务完成: ${status}${summary ? ` - ${summary.slice(0, 80)}...` : ''}`;
      case 'confirmation_requested':
        return `等待确认: ${payload?.actionType ?? 'unknown'} - ${payload?.summary ?? ''}`;
      case 'session_state_changed':
        return `状态变更: ${payload?.runtimeState ?? 'unknown'}`;
      default:
        return `${eventType}: ${JSON.stringify(payload).slice(0, 100)}...`;
    }
  }
}

function emptyCounts() {
  return {
    queued: 0,
    running: 0,
    blocked: 0,
    waitingConfirmation: 0,
    completed: 0,
    failed: 0,
    canceled: 0,
  };
}

function summarizeTasks(tasks: Array<{ status: string }>) {
  const counts = emptyCounts();
  for (const task of tasks) {
    if (task.status === 'queued') counts.queued += 1;
    if (task.status === 'running') counts.running += 1;
    if (task.status === 'blocked') counts.blocked += 1;
    if (task.status === 'waiting_confirmation') counts.waitingConfirmation += 1;
    if (task.status === 'completed') counts.completed += 1;
    if (task.status === 'failed') counts.failed += 1;
    if (task.status === 'canceled') counts.canceled += 1;
  }
  return counts;
}
