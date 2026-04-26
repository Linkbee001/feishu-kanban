import { Injectable } from '@nestjs/common';
import { GroupAgentSession } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ProjectContextBundle } from '../agent/agent.types';
import { FeishuProjectReader } from '../feishu/feishu-project-reader.service';

@Injectable()
export class ProjectContextAssembler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reader: FeishuProjectReader,
  ) {}

  async assembleForSession(session: GroupAgentSession): Promise<ProjectContextBundle> {
    if (!session.projectId) {
      throw new Error(`Group session ${session.id} is not bound to a project`);
    }

    const [project, environment, recentMessages, recentRuns, recentArtifacts] = await Promise.all([
      this.prisma.project.findUniqueOrThrow({
        where: { id: session.projectId },
      }),
      this.resolveEnvironment(session),
      this.prisma.messageSource.findMany({
        where: { projectId: session.projectId },
        orderBy: { receivedAt: 'desc' },
        take: 50,
      }),
      this.prisma.agentRun.findMany({
        where: { projectId: session.projectId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.artifact.findMany({
        where: { projectId: session.projectId },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
    ]);

    const sourceErrors: Record<string, string> = {};
    let folderEntries: ProjectContextBundle['folderEntries'] = [];
    let folderEntriesTruncated = false;
    let docSnapshots: ProjectContextBundle['docSnapshots'] = [];
    let bitableSnapshot: ProjectContextBundle['bitableSnapshot'] = null;

    if (project.docFolderToken) {
      try {
        const folder = await this.reader.scanProjectFolder(project.docFolderToken);
        folderEntries = folder.entries;
        folderEntriesTruncated = folder.truncated;
        docSnapshots = folder.documents;
      } catch (error) {
        sourceErrors.folder = error instanceof Error ? error.message : String(error);
      }
    }

    if (project.bitableAppToken && project.bitableTableId) {
      try {
        bitableSnapshot = await this.reader.readBitableSnapshot(project.bitableAppToken, project.bitableTableId);
      } catch (error) {
        sourceErrors.bitable = error instanceof Error ? error.message : String(error);
      }
    }

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
        runtimeSessionKey: session.runtimeSessionKey,
        memorySummary: session.memorySummary,
        sessionMode: session.sessionMode,
        status: session.status,
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
      folderEntries,
      folderEntriesTruncated,
      docSnapshots,
      bitableSnapshot,
      sourceErrors: Object.keys(sourceErrors).length ? sourceErrors : undefined,
    };
  }

  private async resolveEnvironment(session: GroupAgentSession) {
    const environmentId = session.activeEnvironmentId;
    if (environmentId) {
      return this.prisma.projectEnvironment.findUniqueOrThrow({ where: { id: environmentId } });
    }

    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: session.projectId! },
      select: { defaultEnvironmentId: true },
    });
    if (!project.defaultEnvironmentId) {
      throw new Error(`Project ${session.projectId} has no default environment`);
    }
    return this.prisma.projectEnvironment.findUniqueOrThrow({
      where: { id: project.defaultEnvironmentId },
    });
  }
}
