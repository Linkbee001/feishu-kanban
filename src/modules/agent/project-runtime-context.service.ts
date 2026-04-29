import { Injectable } from '@nestjs/common';
import { GroupSessionStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ProjectContextBundle } from './agent.types';
import { FeishuProjectReader } from '../feishu/feishu-project-reader.service';

@Injectable()
export class ProjectRuntimeContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reader: FeishuProjectReader,
  ) {}

  async assemble(input: {
    projectId: string;
    environmentId: string;
    runtimeSessionKey: string;
    sessionMode: 'bootstrap' | 'active' | 'disabled';
    sessionStatus: 'idle' | 'busy' | 'error' | 'disabled';
    memorySummary?: string | null;
  }): Promise<ProjectContextBundle> {
    const [project, environment, recentMessages, recentRuns, recentArtifacts, recentTasks, policy, memberProfiles] = await Promise.all([
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
      this.prisma.groupRuntimeTask.findMany({
        where: { projectId: input.projectId },
        orderBy: [{ updatedAt: 'desc' }, { orderIndex: 'asc' }],
        take: 20,
      }),
      this.prisma.groupPolicy.findFirst({
        where: {
          projectId: input.projectId,
          archivedAt: null,
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.projectMemberProfile.findMany({
        where: {
          projectId: input.projectId,
          feishuChatId: projectChatIdFilter(input.runtimeSessionKey),
        },
        orderBy: [{ isDecisionMaker: 'desc' }, { updatedAt: 'desc' }],
        take: 50,
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
        repoCredentialRef: environment.repoCredentialRef,
        repoMirrorPath: environment.repoMirrorPath,
        repoSyncStatus: environment.repoSyncStatus,
        repoSyncError: environment.repoSyncError,
        repoHeadRef: environment.repoHeadRef,
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
      groupPolicy: policy
        ? {
            enabled: policy.enabled,
            mentionOnly: policy.mentionOnly,
            allowedSkills: Array.isArray(policy.allowedSkillsJson)
              ? policy.allowedSkillsJson.map((item) => String(item))
              : [],
            defaultEnvironmentId: policy.defaultEnvironmentId,
            allowAutoTaskCreation: policy.allowAutoTaskCreation,
            allowTaskBoardWrite: policy.allowTaskBoardWrite,
            allowDocWrite: policy.allowDocWrite,
            highRiskActionsRequireConfirmation: policy.highRiskActionsRequireConfirmation,
            archivedAt: policy.archivedAt?.toISOString() ?? null,
          }
        : null,
      memberProfiles: memberProfiles.map((profile) => ({
        id: profile.id,
        openId: profile.openId,
        displayName: profile.displayName,
        groupNickname: profile.groupNickname,
        projectRole: profile.projectRole,
        responsibility: profile.responsibility,
        permissionLevel: profile.permissionLevel,
        isDecisionMaker: profile.isDecisionMaker,
        isTaskAssignable: profile.isTaskAssignable,
        lastActiveAt: profile.lastActiveAt?.toISOString() ?? null,
      })),
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
      runtimeTasksSummary: {
        queued: recentTasks.filter((task) => task.status === 'queued').length,
        running: recentTasks.filter((task) => task.status === 'running').length,
        blocked: recentTasks.filter((task) => task.status === 'blocked').length,
        waitingConfirmation: recentTasks.filter((task) => task.status === 'waiting_confirmation').length,
        completed: recentTasks.filter((task) => task.status === 'completed').length,
        failed: recentTasks.filter((task) => task.status === 'failed').length,
        canceled: recentTasks.filter((task) => task.status === 'canceled').length,
        recent: recentTasks.map((task) => ({
          id: task.id,
          title: task.title,
          description: task.description,
          intent: task.intent,
          skillHint: task.skillHint,
          outputMode: task.outputMode,
          orderIndex: task.orderIndex,
          status: task.status,
          blockedReason: task.blockedReason,
          nextActionHint: task.nextActionHint,
          priority: task.priority,
          triggerType: task.triggerType,
          taskPayloadJson:
            task.taskPayloadJson && typeof task.taskPayloadJson === 'object' && !Array.isArray(task.taskPayloadJson)
              ? (task.taskPayloadJson as Record<string, unknown>)
              : null,
          resultSummary: task.resultSummary,
          lastError: task.lastError,
        })),
      },
      workspaceDocsSummary: docSnapshots.map((doc) => ({
        title: doc.title,
        token: doc.token,
        url: doc.url,
        updatedAt: doc.updatedAt,
        summary: doc.summary,
      })),
      folderEntries,
      folderEntriesTruncated,
      docSnapshots,
      bitableSnapshot,
      sourceErrors: Object.keys(sourceErrors).length ? sourceErrors : undefined,
    };
  }

  toSessionStatus(status?: GroupSessionStatus | null): 'idle' | 'busy' | 'error' | 'disabled' {
    if (status === GroupSessionStatus.busy) return 'busy';
    if (status === GroupSessionStatus.error) return 'error';
    if (status === GroupSessionStatus.disabled) return 'disabled';
    return 'idle';
  }
}

function projectChatIdFilter(runtimeSessionKey: string) {
  const parts = runtimeSessionKey.split(':');
  return parts.length >= 2 ? parts[1] : runtimeSessionKey;
}
