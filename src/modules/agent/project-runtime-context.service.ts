import { Injectable } from '@nestjs/common';
import { GroupSessionStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ProjectContextBundle } from './agent.types';

@Injectable()
export class ProjectRuntimeContextService {
  constructor(private readonly prisma: PrismaService) {}

  async assemble(input: {
    projectId: string;
    environmentId: string;
    runtimeSessionKey: string;
    sessionMode: 'bootstrap' | 'active' | 'disabled';
    sessionStatus: 'idle' | 'busy' | 'error' | 'disabled';
    memorySummary?: string | null;
  }): Promise<ProjectContextBundle> {
    const [project, environment, recentMessages, recentRuns, recentArtifacts] = await Promise.all([
      this.prisma.project.findUniqueOrThrow({
        where: { id: input.projectId },
      }),
      this.prisma.projectEnvironment.findUniqueOrThrow({
        where: { id: input.environmentId },
      }),
      this.prisma.messageSource.findMany({
        where: { projectId: input.projectId },
        orderBy: { receivedAt: 'desc' },
        take: 30,
      }),
      this.prisma.agentRun.findMany({
        where: { projectId: input.projectId },
        orderBy: { createdAt: 'desc' },
        take: 12,
      }),
      this.prisma.artifact.findMany({
        where: { projectId: input.projectId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    return {
      project: {
        id: project.id,
        name: project.name,
        feishuChatId: project.feishuChatId,
        docFolderToken: project.docFolderToken,
        bitableAppToken: project.bitableAppToken,
        bitableTableId: project.bitableTableId,
        defaultEnvironmentId: project.defaultEnvironmentId,
      },
      environment: {
        id: environment.id,
        name: environment.name,
        repoUrl: environment.repoUrl,
        repoBranch: environment.repoBranch,
        projectPath: environment.projectPath,
        modelName: environment.modelName,
        skillSet: environment.skillSet,
      },
      session: {
        runtimeSessionKey: input.runtimeSessionKey,
        memorySummary: input.memorySummary ?? null,
        sessionMode: input.sessionMode,
        status: input.sessionStatus,
      },
      recentMessages: recentMessages.map((message) => ({
        id: message.id,
        senderOpenId: message.senderOpenId,
        rawText: message.rawText,
        receivedAt: message.receivedAt.toISOString(),
      })),
      recentRuns: recentRuns.map((run) => ({
        id: run.id,
        intent: run.intent,
        status: run.status,
        outputSummary: run.outputSummary,
        finishedAt: run.finishedAt?.toISOString() ?? null,
      })),
      recentArtifacts: recentArtifacts.map((artifact) => ({
        id: artifact.id,
        type: artifact.type,
        title: artifact.title,
        status: artifact.status,
        createdAt: artifact.createdAt.toISOString(),
        feishuUrl: artifact.feishuUrl,
      })),
      folderEntries: [],
      folderEntriesTruncated: false,
      docSnapshots: [],
      bitableSnapshot: null,
      sourceErrors: {
        context: 'Interactive runtime context uses database-backed snapshots only.',
      },
    };
  }

  toSessionStatus(status?: GroupSessionStatus | null): 'idle' | 'busy' | 'error' | 'disabled' {
    if (status === GroupSessionStatus.busy) return 'busy';
    if (status === GroupSessionStatus.error) return 'error';
    if (status === GroupSessionStatus.disabled) return 'disabled';
    return 'idle';
  }
}
