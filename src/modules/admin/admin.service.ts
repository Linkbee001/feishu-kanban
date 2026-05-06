import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GroupRuntimeService } from '../agent/group-runtime.service';
import { FeishuService } from '../feishu/feishu.service';
import { GroupPolicyService } from '../project/group-policy.service';
import { ProjectMemberProfileService } from '../project/project-member-profile.service';
import { RepoSyncService } from '../repo/repo-sync.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runtime: GroupRuntimeService,
    private readonly feishu: FeishuService,
    private readonly policies: GroupPolicyService,
    private readonly memberProfiles: ProjectMemberProfileService,
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
