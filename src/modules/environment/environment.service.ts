import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EnvironmentStatus, EnvironmentType, RepoAccessMode } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class EnvironmentService {
  constructor(private readonly prisma: PrismaService) {}

  async create(projectId: string, input: {
    name: string;
    type?: EnvironmentType | string;
    piMonoEnvId?: string;
    repoUrl?: string;
    repoBranch?: string;
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
    const environment = await this.prisma.projectEnvironment.create({
      data: {
        projectId,
        name: input.name,
        type: (input.type as EnvironmentType) ?? EnvironmentType.default,
        piMonoEnvId: input.piMonoEnvId,
        repoUrl: input.repoUrl,
        repoBranch: input.repoBranch,
        repoAccessMode: (input.repoAccessMode as RepoAccessMode) ?? RepoAccessMode.readonly,
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
    return this.prisma.projectEnvironment.update({ where: { id }, data });
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
