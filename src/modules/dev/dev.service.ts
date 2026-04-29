import { BadRequestException, Injectable } from '@nestjs/common';
import { EnvironmentStatus, EnvironmentType, ProjectStatus, RepoAccessMode } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GroupAgentSessionService } from '../agent/group-agent-session.service';
import { FeishuService } from '../feishu/feishu.service';

@Injectable()
export class DevService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly groupSessions: GroupAgentSessionService,
    private readonly feishu: FeishuService,
  ) {}

  async seedProject(input: {
    name?: string;
    feishuChatId?: string;
    ownerOpenId?: string;
    repoUrl?: string;
    repoBranch?: string;
    repoCredentialRef?: string;
  }) {
    const chatId = input.feishuChatId ?? 'dev_chat';
    const ownerOpenId = input.ownerOpenId ?? 'ou_dev_user';
    const project = await this.prisma.project.upsert({
      where: { feishuChatId: chatId },
      create: {
        name: input.name ?? '本地链路测试项目',
        description: 'Created by dev seed endpoint.',
        ownerOpenId,
        feishuChatId: chatId,
        status: ProjectStatus.active,
        docFolderToken: 'dev_doc_folder',
        bitableAppToken: 'dev_bitable_app',
        bitableTableId: 'dev_bitable_table',
        defaultSkillSet: {},
        createdBy: ownerOpenId,
      },
      update: {
        name: input.name ?? '本地链路测试项目',
        status: ProjectStatus.active,
      },
    });

    const existing = await this.prisma.projectEnvironment.findFirst({
      where: { projectId: project.id, type: EnvironmentType.default },
    });
    const environment = existing
      ? await this.prisma.projectEnvironment.update({
          where: { id: existing.id },
          data: {
            repoUrl: input.repoUrl,
            repoBranch: input.repoBranch ?? 'main',
            repoCredentialRef: input.repoCredentialRef,
            status: EnvironmentStatus.active,
            lastActiveAt: new Date(),
          },
        })
      : await this.prisma.projectEnvironment.create({
          data: {
            projectId: project.id,
            name: '默认主环境',
            type: EnvironmentType.default,
            repoUrl: input.repoUrl,
            repoBranch: input.repoBranch ?? 'main',
            repoCredentialRef: input.repoCredentialRef,
            repoAccessMode: RepoAccessMode.readonly,
            projectPath: process.env.PI_MONO_WORKDIR ?? '/workspace',
            modelName: process.env.PI_MONO_MODEL ?? 'kimi-k2.5',
            skillSet: {},
            status: EnvironmentStatus.active,
            createdBy: ownerOpenId,
            lastActiveAt: new Date(),
          },
        });

    const updatedProject = await this.prisma.project.update({
      where: { id: project.id },
      data: { defaultEnvironmentId: environment.id },
    });

    return { project: updatedProject, environment };
  }

  async cleanupResource(input: {
    resourceType: 'folder' | 'bitable' | 'bitableTable';
    resourceId: string;
    appToken?: string;
    detachProjects?: boolean;
  }) {
    const resourceType = input.resourceType;
    const resourceId = input.resourceId?.trim();
    const appTokenInput = input.appToken?.trim();
    const detachProjects = input.detachProjects !== false;

    if (!resourceType) throw new BadRequestException('resourceType is required');
    if (!resourceId) throw new BadRequestException('resourceId is required');

    const result = {
      resourceType,
      resourceId,
      appToken: appTokenInput ?? null,
      deleted: false,
      scope: 'resource',
      message: '',
      detachedProjects: [] as string[],
    };

    if (resourceType === 'folder') {
      await this.feishu.deleteDriveFile(resourceId, 'folder');
      result.deleted = true;
      result.scope = 'folder';
      result.message = 'Folder deleted. This is a folder-level cleanup.';

      if (detachProjects) {
        const projects = await this.prisma.project.findMany({
          where: { docFolderToken: resourceId },
          select: { id: true },
        });
        if (projects.length > 0) {
          await this.prisma.project.updateMany({
            where: { docFolderToken: resourceId },
            data: { docFolderToken: null },
          });
          result.detachedProjects = projects.map((project) => project.id);
        }
      }

      return result;
    }

    if (resourceType === 'bitable') {
      await this.feishu.deleteDriveFile(resourceId, 'bitable');
      result.deleted = true;
      result.scope = 'bitable-app';
      result.message = 'Bitable app deleted. This removes the whole app, not just a single table.';

      if (detachProjects) {
        const projects = await this.prisma.project.findMany({
          where: { bitableAppToken: resourceId },
          select: { id: true },
        });
        if (projects.length > 0) {
          await this.prisma.project.updateMany({
            where: { bitableAppToken: resourceId },
            data: {
              bitableAppToken: null,
              bitableTableId: null,
            },
          });
          result.detachedProjects = projects.map((project) => project.id);
        }
      }

      return result;
    }

    const resolvedAppToken = appTokenInput || (
      await this.prisma.project.findFirst({
        where: { bitableTableId: resourceId },
        select: { bitableAppToken: true },
      })
    )?.bitableAppToken;

    if (!resolvedAppToken) {
      throw new BadRequestException('appToken is required for bitableTable cleanup when no matching project record is found');
    }

    await this.feishu.deleteBitableTable(resolvedAppToken, resourceId);
    result.deleted = true;
    result.appToken = resolvedAppToken;
    result.scope = 'bitable-table';
    result.message = 'Only the specified bitable table was deleted. The parent bitable app is kept.';

    if (detachProjects) {
      const projects = await this.prisma.project.findMany({
        where: { bitableTableId: resourceId },
        select: { id: true },
      });
      if (projects.length > 0) {
        await this.prisma.project.updateMany({
          where: { bitableTableId: resourceId },
          data: { bitableTableId: null },
        });
        result.detachedProjects = projects.map((project) => project.id);
      }
    }

    return result;
  }

  async monitorSnapshot(input: {
    chatId?: string;
    projectId?: string;
    limitRuns?: number;
    limitArtifacts?: number;
    limitMessages?: number;
    limitConfirmations?: number;
  }) {
    const chatId = input.chatId?.trim() || undefined;
    let projectId = input.projectId?.trim() || undefined;
    const limitRuns = Math.min(Math.max(input.limitRuns ?? 12, 1), 50);
    const limitArtifacts = Math.min(Math.max(input.limitArtifacts ?? 12, 1), 50);
    const limitMessages = Math.min(Math.max(input.limitMessages ?? 12, 1), 50);
    const limitConfirmations = Math.min(Math.max(input.limitConfirmations ?? 8, 1), 30);

    let project =
      projectId
        ? await this.prisma.project.findUnique({
            where: { id: projectId },
            include: { environments: { orderBy: { createdAt: 'asc' } } },
          })
        : null;

    if (!project && chatId) {
      project = await this.prisma.project.findUnique({
        where: { feishuChatId: chatId },
        include: { environments: { orderBy: { createdAt: 'asc' } } },
      });
      projectId = project?.id;
    }

    const sessionWhere = {
      ...(chatId ? { feishuChatId: chatId } : {}),
      ...(projectId ? { projectId } : {}),
    };

    const sessions = await this.prisma.groupAgentSession.findMany({
      where: sessionWhere,
      include: {
        project: true,
        activeEnvironment: true,
        currentAgentRun: true,
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: chatId || projectId ? 5 : 12,
    });

    const activeSessions = sessions.filter((session) => session.status !== 'disabled' && session.sessionMode !== 'disabled');
    const disabledSessions = sessions.filter((session) => session.status === 'disabled' || session.sessionMode === 'disabled');

    const sessionLocks = await Promise.all(
      activeSessions.map(async (session) => ({
        feishuChatId: session.feishuChatId,
        ...(await this.groupSessions.inspectLock(session.feishuChatId)),
      })),
    );

    const runs = await this.prisma.agentRun.findMany({
      where: projectId ? { projectId } : undefined,
      include: {
        project: true,
        environment: true,
        messageSource: true,
        artifacts: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limitRuns,
    });

    const artifacts = await this.prisma.artifact.findMany({
      where: projectId ? { projectId } : undefined,
      include: {
        project: true,
        environment: true,
        agentRun: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limitArtifacts,
    });

    const messages = await this.prisma.messageSource.findMany({
      where: projectId
        ? { projectId }
        : chatId
          ? { feishuChatId: chatId }
          : undefined,
      orderBy: { receivedAt: 'desc' },
      take: limitMessages,
    });

    const confirmations = await this.prisma.confirmationRequest.findMany({
      where: projectId ? { projectId } : undefined,
      include: {
        messageSource: true,
      },
      orderBy: { expiresAt: 'desc' },
      take: limitConfirmations,
    });

    const runtimeTasks = await this.prisma.groupRuntimeTask.findMany({
      where: projectId ? { projectId } : undefined,
      orderBy: [{ updatedAt: 'desc' }, { orderIndex: 'asc' }],
      take: limitRuns,
    });

    const counts = {
      sessions: activeSessions.length,
      disabledSessions: disabledSessions.length,
      busySessions: activeSessions.filter((session) => session.status === 'busy').length,
      lockedChats: sessionLocks.filter((lock) => lock.locked).length,
      pendingConfirmations: confirmations.filter((item) => item.status === 'pending').length,
      runningRuns: runs.filter((run) => ['queued', 'running', 'syncing'].includes(run.status)).length,
      failedRuns: runs.filter((run) => ['failed', 'timeout', 'canceled'].includes(run.status)).length,
      syncedArtifacts: artifacts.filter((artifact) => artifact.status === 'synced').length,
      failedArtifacts: artifacts.filter((artifact) => artifact.status === 'failed').length,
      activeSessionRuns: activeSessions.filter((session) => Boolean(session.currentAgentRunId)).length,
      runtimeTasks: runtimeTasks.length,
      waitingRuntimeTasks: runtimeTasks.filter((task) => task.status === 'waiting_confirmation').length,
    };

    return {
      query: {
        chatId: chatId ?? null,
        projectId: projectId ?? null,
      },
      generatedAt: new Date().toISOString(),
      counts,
      project,
      sessions: activeSessions.map((session) => ({
        ...session,
        lock: sessionLocks.find((lock) => lock.feishuChatId === session.feishuChatId) ?? null,
      })),
      disabledSessions: disabledSessions.map((session) => ({
        ...session,
        lock: null,
      })),
      runtimeTasks,
      runs,
      artifacts,
      messages,
      confirmations,
    };
  }
}
