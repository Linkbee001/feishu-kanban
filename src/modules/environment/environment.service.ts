import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EnvironmentStatus, EnvironmentType, RepoAccessMode, RepoSyncStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RepoSyncQueueService } from '../repo/repo-sync-queue.service';

@Injectable()
export class EnvironmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repoSyncQueue: RepoSyncQueueService,
  ) {}

  async create(projectId: string, input: {
    name: string;
    type?: EnvironmentType | string;
    piMonoEnvId?: string;
    repoUrl?: string;
    repoBranch?: string;
    repoCredentialRef?: string;
    repoAccessMode?: RepoAccessMode | string;
    projectPath?: string;
    modelEndpoint?: string;
    modelName?: string;
    skillSet?: unknown;
    outputDir?: string;
    logUri?: string;
    createdBy: string;
    setDefault?: boolean;
  }) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new BadRequestException('Project not found');
    const hasRepo = Boolean(input.repoUrl?.trim());
    const environment = await this.prisma.projectEnvironment.create({
      data: {
        projectId,
        name: input.name,
        type: (input.type as EnvironmentType) ?? EnvironmentType.default,
        piMonoEnvId: input.piMonoEnvId,
        repoUrl: input.repoUrl,
        repoBranch: input.repoBranch,
        repoCredentialRef: input.repoCredentialRef,
        repoAccessMode: (input.repoAccessMode as RepoAccessMode) ?? RepoAccessMode.readonly,
        repoSyncStatus: hasRepo ? RepoSyncStatus.syncing : RepoSyncStatus.uninitialized,
        projectPath: input.projectPath,
        modelEndpoint: input.modelEndpoint,
        modelName: input.modelName,
        skillSet: input.skillSet ?? {},
        outputDir: input.outputDir,
        logUri: input.logUri,
        status: EnvironmentStatus.active,
        createdBy: input.createdBy,
        lastActiveAt: new Date(),
      },
    });
    if (hasRepo) {
      await this.repoSyncQueue.enqueueSync(projectId, environment.id, false);
    }
    if (input.setDefault) await this.setDefault(projectId, environment.id);
    return environment;
  }

  list(projectId: string) {
    return this.prisma.projectEnvironment.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' } });
  }

  async find(id: string) {
    const environment = await this.prisma.projectEnvironment.findUnique({ where: { id }, include: { project: true } });
    if (!environment) throw new NotFoundException('Environment not found');
    return environment;
  }

  async update(id: string, data: any) {
    await this.find(id);
    const repoConfigChanged =
      data.repoUrl !== undefined ||
      data.repoBranch !== undefined ||
      data.repoCredentialRef !== undefined;
    const nextRepoUrl = typeof data.repoUrl === 'string' ? data.repoUrl.trim() : undefined;
    const hasRepoConfigured = nextRepoUrl !== undefined ? Boolean(nextRepoUrl) : undefined;
    const updated = await this.prisma.projectEnvironment.update({
      where: { id },
      data: repoConfigChanged
        ? {
            ...data,
            repoSyncStatus: hasRepoConfigured === false ? RepoSyncStatus.uninitialized : RepoSyncStatus.syncing,
            repoSyncError: null,
            lastRepoSyncAt: null,
            repoHeadRef: null,
            repoMirrorPath: null,
          }
        : data,
    });
    if (repoConfigChanged && updated.repoUrl) {
      await this.repoSyncQueue.enqueueSync(updated.projectId, updated.id, false);
    }
    if (repoConfigChanged && !updated.repoUrl) {
      await this.prisma.projectEnvironment.update({
        where: { id: updated.id },
        data: {
          repoSyncStatus: RepoSyncStatus.uninitialized,
          repoMirrorPath: null,
          repoSyncError: null,
          lastRepoSyncAt: null,
          repoHeadRef: null,
        },
      });
    }
    return this.find(id);
  }

  async triggerRepoSync(id: string, force = true) {
    const environment = await this.find(id);
    if (!environment.repoUrl?.trim()) {
      throw new BadRequestException('Environment repo is not configured');
    }
    await this.prisma.projectEnvironment.update({
      where: { id: environment.id },
      data: {
        repoSyncStatus: RepoSyncStatus.syncing,
        repoSyncError: null,
      },
    });
    await this.repoSyncQueue.enqueueSync(environment.projectId, environment.id, force);
    return this.find(id);
  }

  async setDefault(projectId: string, environmentId: string) {
    const environment = await this.find(environmentId);
    if (environment.projectId !== projectId) throw new BadRequestException('Environment does not belong to project');
    await this.prisma.project.update({ where: { id: projectId }, data: { defaultEnvironmentId: environmentId } });
    return environment;
  }

  async getEffectiveEnvironment(projectId: string, chatId?: string, userOpenId?: string) {
    if (chatId) {
      if (userOpenId) {
        const context = await this.prisma.conversationContext.findFirst({
          where: {
            feishuChatId: chatId,
            OR: [{ userOpenId }, { userOpenId: null }],
            expiresAt: { gt: new Date() },
            environmentId: { not: null },
          },
          orderBy: { updatedAt: 'desc' },
        });
        if (context?.environmentId) return this.find(context.environmentId);
      }

      const groupSession = await this.prisma.groupAgentSession.findUnique({
        where: {
          feishuChatId_agentRole: {
            feishuChatId: chatId,
            agentRole: 'manager',
          },
        },
        select: { activeEnvironmentId: true },
      });
      if (groupSession?.activeEnvironmentId) {
        return this.find(groupSession.activeEnvironmentId);
      }
    }
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project?.defaultEnvironmentId) throw new BadRequestException('Project has no default environment');
    return this.find(project.defaultEnvironmentId);
  }
}
