import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ArtifactStatus, ArtifactType } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { assertArtifactTransition } from '../../common/state/state-machine';
import { AgentOutput, AgentTaskOutput, DigestTargetChannel } from '../agent/agent.types';
import { FeishuService } from '../feishu/feishu.service';

@Injectable()
export class ArtifactService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly feishu: FeishuService,
  ) {}

  list(projectId: string) {
    return this.prisma.artifact.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async find(id: string) {
    const artifact = await this.prisma.artifact.findUnique({ where: { id } });
    if (!artifact) throw new NotFoundException('Artifact not found');
    return artifact;
  }

  async createFromOutput(agentRunId: string, output: AgentOutput) {
    const run = await this.prisma.agentRun.findUnique({
      where: { id: agentRunId },
      include: { project: true, environment: true },
    });
    if (!run) throw new BadRequestException('Agent run not found');
    const type = this.toArtifactType(output.type);
    const contentHash = this.hash(JSON.stringify(output));
    const existing = await this.prisma.artifact.findFirst({
      where: {
        projectId: run.projectId,
        type,
        contentHash,
      },
    });
    if (existing) return existing;

    return this.prisma.artifact.create({
      data: {
        projectId: run.projectId,
        environmentId: run.environmentId,
        agentRunId: run.id,
        messageSourceId: run.messageSourceId,
        type,
        title: output.title,
        contentHash,
        metadata: output as any,
      },
    });
  }

  async syncArtifact(id: string) {
    const artifact = await this.prisma.artifact.findUnique({
      where: { id },
      include: {
        project: true,
        environment: true,
        agentRun: {
          include: {
            messageSource: true,
          },
        },
      },
    });
    if (!artifact) throw new NotFoundException('Artifact not found');
    if (artifact.status === ArtifactStatus.synced || artifact.status === ArtifactStatus.skipped) {
      return artifact;
    }

    const output = artifact.metadata as unknown as AgentOutput;
    const partialSync: Record<string, unknown> = {};
    try {
      if (artifact.type === ArtifactType.summary || artifact.type === ArtifactType.execution_log) {
        return this.markSynced(id, {});
      }
      if (!this.isPersistRequested(output)) {
        return this.markSkipped(id, 'Durable persistence was not requested for this output.');
      }
      if (artifact.type === ArtifactType.document) {
        if (!this.hasTargetChannel(output, 'feishu_doc')) {
          return this.markSkipped(id, 'Document output did not target feishu_doc.');
        }
        if (!(await this.canWriteTarget(artifact.projectId, artifact.agentRun?.messageSource?.feishuChatId, 'document'))) {
          return this.markSkipped(id, 'Group policy does not allow document writes.');
        }
        const doc = await this.feishu.createDocument(
          output.title,
          artifact.project.docFolderToken ?? undefined,
          output.content ?? output.title,
        );
        partialSync.feishuToken = doc.token ?? null;
        partialSync.feishuUrl = doc.url ?? null;
        return this.markSynced(id, partialSync);
      }
      if (artifact.type === ArtifactType.task) {
        if (!this.hasTargetChannel(output, 'bitable')) {
          return this.markSkipped(id, 'Task output did not target bitable.');
        }
        if (!(await this.canWriteTarget(artifact.projectId, artifact.agentRun?.messageSource?.feishuChatId, 'task'))) {
          return this.markSkipped(id, 'Group policy does not allow task board writes.');
        }
        const tasks = output.tasks?.length ? output.tasks : [{ title: output.title, description: output.content }];
        const records: string[] = [];

        for (const task of tasks) {
          const record = await this.feishu.createBitableRecord(
            artifact.project.bitableAppToken!,
            artifact.project.bitableTableId!,
            this.taskFields(task, artifact.environment?.name, artifact.agentRunId),
          );
          const recordId = record?.data?.record?.record_id ?? record?.data?.record_id;
          if (recordId) records.push(recordId);
        }

        return this.markSynced(id, { bitableRecordId: records.filter(Boolean).join(',') });
      }
      if (artifact.type === ArtifactType.file) {
        if (!this.isPersistRequested(output)) {
          return this.markSkipped(id, 'File output was not marked as durable.');
        }
        const fileName = output.filePath?.split(/[\\/]/).pop() ?? output.title;
        const bytes = Buffer.from(output.content ?? '', 'utf8');
        const uploaded = await this.feishu.uploadFile(fileName, bytes, output.mimeType);
        return this.markSynced(id, { fileKey: uploaded?.data?.file_key });
      }
      return this.markSkipped(id, 'Artifact type is not configured for formal sync.');
    } catch (error) {
      assertArtifactTransition(artifact.status, ArtifactStatus.failed);
      return this.prisma.artifact.update({
        where: { id },
        data: {
          status: ArtifactStatus.failed,
          ...partialSync,
          metadata: {
            ...(artifact.metadata as any),
            syncError: error instanceof Error ? error.message : String(error),
          },
        },
      });
    }
  }

  async retrySync(id: string) {
    const artifact = await this.find(id);
    if (artifact.status === ArtifactStatus.synced) return artifact;
    return this.syncArtifact(id);
  }

  private async markSynced(id: string, data: Record<string, unknown>) {
    const artifact = await this.find(id);
    assertArtifactTransition(artifact.status, ArtifactStatus.synced);
    const metadata =
      artifact.metadata && typeof artifact.metadata === 'object' && !Array.isArray(artifact.metadata)
        ? { ...(artifact.metadata as Record<string, unknown>) }
        : undefined;
    if (metadata) {
      delete metadata.syncError;
      delete metadata.syncSkipReason;
    }
    return this.prisma.artifact.update({
      where: { id },
      data: {
        status: ArtifactStatus.synced,
        ...(metadata ? { metadata: metadata as any } : {}),
        ...data,
      },
    });
  }

  private async markSkipped(id: string, reason?: string) {
    const artifact = await this.find(id);
    assertArtifactTransition(artifact.status, ArtifactStatus.skipped);
    const metadata =
      artifact.metadata && typeof artifact.metadata === 'object' && !Array.isArray(artifact.metadata)
        ? { ...(artifact.metadata as Record<string, unknown>) }
        : {};
    delete metadata.syncError;
    if (reason) {
      metadata.syncSkipReason = reason;
    }
    return this.prisma.artifact.update({
      where: { id },
      data: {
        status: ArtifactStatus.skipped,
        metadata: metadata as any,
      },
    });
  }

  private toArtifactType(type: AgentOutput['type']): ArtifactType {
    if (type === 'log') return ArtifactType.execution_log;
    return type as ArtifactType;
  }

  private isPersistRequested(output: AgentOutput) {
    return output.metadata?.persist === true;
  }

  private hasTargetChannel(output: AgentOutput, channel: DigestTargetChannel) {
    const channels = output.metadata?.targetChannels;
    return Array.isArray(channels) && channels.includes(channel);
  }

  private async canWriteTarget(projectId: string, feishuChatId: string | null | undefined, type: 'document' | 'task') {
    const chatId = feishuChatId?.trim();
    if (!chatId) {
      return true;
    }
    const policy = await this.prisma.groupPolicy.findFirst({
      where: {
        projectId,
        feishuChatId: chatId,
        archivedAt: null,
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        allowDocWrite: true,
        allowTaskBoardWrite: true,
      },
    });
    if (!policy) {
      return true;
    }
    return type === 'document' ? policy.allowDocWrite : policy.allowTaskBoardWrite;
  }

  private taskFields(task: AgentTaskOutput, environmentName?: string, agentRunId?: string | null) {
    return {
      任务标题: task.title,
      任务描述: task.description ?? '',
      任务类型: task.taskType ?? 'todo',
      优先级: task.priority ?? 'P2',
      状态: '待确认',
      负责人提示: task.assigneeHint ?? '',
      截止日期提示: task.dueDateHint ?? '',
      AI建议: task.aiSuggestion ?? '',
      来源环境: environmentName ?? '',
      执行记录: agentRunId ?? '',
    };
  }

  private hash(content: string) {
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}
