import { Processor, WorkerHost } from '@nestjs/bullmq';
import { AgentRunStatus, ArtifactStatus, ArtifactType } from '@prisma/client';
import { Job } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AgentService } from '../../modules/agent/agent.service';
import { AgentOutput } from '../../modules/agent/agent.types';
import { ArtifactService } from '../../modules/artifact/artifact.service';
import { FeishuService } from '../../modules/feishu/feishu.service';
import { ARTIFACT_SYNC_QUEUE } from '../queue.constants';

type SyncedArtifact = {
  status: ArtifactStatus;
  feishuUrl?: string | null;
  bitableRecordId?: string | null;
  fileKey?: string | null;
  title: string;
  metadata?: unknown;
};

@Processor(ARTIFACT_SYNC_QUEUE)
export class ArtifactSyncProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly artifacts: ArtifactService,
    private readonly agent: AgentService,
    private readonly feishu: FeishuService,
  ) {
    super();
  }

  async process(job: Job<{ agentRunId?: string; artifactId?: string }>) {
    if (job.data.artifactId) return this.artifacts.syncArtifact(job.data.artifactId);
    if (!job.data.agentRunId) return;

    const run = await this.prisma.agentRun.findUnique({
      where: { id: job.data.agentRunId },
      include: { project: true, environment: true, messageSource: true },
    });
    if (!run) return;

    const outputs = (run.rawOutputs as unknown as AgentOutput[]) ?? [];
    const synced: SyncedArtifact[] = [];

    for (const output of outputs) {
      const artifact = await this.artifacts.createFromOutput(run.id, output);
      synced.push(await this.artifacts.syncArtifact(artifact.id));
    }

    const failed = synced.filter((artifact) => artifact.status === ArtifactStatus.failed);
    if (failed.length) {
      const errorMessage = failed
        .map((artifact) => {
          const syncError =
            artifact.metadata && typeof artifact.metadata === 'object'
              ? ((artifact.metadata as Record<string, unknown>).syncError as string | undefined)
              : undefined;
          return syncError ? `${artifact.title}: ${syncError}` : artifact.title;
        })
        .join('; ');

      await this.agent.transition(run.id, AgentRunStatus.failed, {
        progress: 100,
        finishedAt: new Date(),
        errorCode: 'ARTIFACT_SYNC_FAILED',
        errorMessage,
      });

      if (run.messageSource?.feishuChatId) {
        const lines = failed.map((artifact) => `${artifact.title}: sync failed`);
        await this.feishu.sendTextMessage(
          'chat_id',
          run.messageSource.feishuChatId,
          `Execution failed: ${run.intent}\nEnvironment: ${run.environment.name}\nRun ID: ${run.id}\n${lines.join('\n')}`,
        );
      }
      return;
    }

    await this.agent.transition(run.id, AgentRunStatus.succeeded, { progress: 100, finishedAt: new Date() });

    const digestSummary = this.getDigestSummaryOutput(outputs);
    if (digestSummary && run.project.feishuChatId) {
      await this.feishu.sendTextMessage('chat_id', run.project.feishuChatId, digestSummary.content ?? digestSummary.title);
      return;
    }

    if (
      run.messageSource?.feishuChatId &&
      synced.some((artifact) => artifact.status === ArtifactStatus.synced) &&
      !(await this.hasExplicitGroupReply(run))
    ) {
      const autoReply = this.buildAutoReply(synced);
      if (autoReply) {
        await this.feishu.sendTextMessage('chat_id', run.messageSource.feishuChatId, autoReply);
      }
    }
  }

  private getDigestSummaryOutput(outputs: AgentOutput[]) {
    const summary = outputs.find((output) => output.type === 'summary');
    if (!summary) {
      return null;
    }

    const metadata =
      summary.metadata && typeof summary.metadata === 'object' && !Array.isArray(summary.metadata)
        ? summary.metadata
        : null;
    const targetChannels = Array.isArray(metadata?.targetChannels) ? metadata.targetChannels : [];
    const internalOnly = metadata?.internalOnly === true;

    if (internalOnly || !targetChannels.includes('group_message')) {
      return null;
    }

    return summary;
  }

  private async hasExplicitGroupReply(run: {
    id: string;
    runType?: string | null;
    projectId?: string;
    messageSourceId?: string | null;
    startedAt?: Date | null;
    rawOutputs?: unknown;
  }) {
    const outputs = (run.rawOutputs as AgentOutput[] | null) ?? [];
    if (this.getDigestSummaryOutput(outputs)) {
      return true;
    }

    if (!run.messageSourceId || !run.projectId) {
      return false;
    }

    const since = run.startedAt ? new Date(run.startedAt.getTime() - 10 * 60_000) : new Date(Date.now() - 10 * 60_000);
    const events = await (this.prisma as any).runtimeEvent.findMany({
      where: {
        projectId: run.projectId,
        eventType: 'reply_emitted',
        createdAt: { gte: since },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 20,
      select: {
        payload: true,
      },
    });

    return events.some((event: any) => {
      const payload =
        event?.payload && typeof event.payload === 'object' && !Array.isArray(event.payload)
          ? (event.payload as Record<string, unknown>)
          : null;
      return payload?.messageSourceId === run.messageSourceId;
    });
  }

  private buildAutoReply(synced: SyncedArtifact[]) {
    const successful = synced.filter((artifact) => artifact.status === ArtifactStatus.synced);
    if (!successful.length) {
      return null;
    }

    const documents = successful.filter((artifact) => this.toArtifactType(artifact) === ArtifactType.document);
    const tasks = successful.filter((artifact) => this.toArtifactType(artifact) === ArtifactType.task);
    const files = successful.filter((artifact) => this.toArtifactType(artifact) === ArtifactType.file);

    if (documents.length === 1 && !tasks.length && !files.length) {
      const document = documents[0];
      return document.feishuUrl
        ? `已生成《${document.title}》，并已沉淀到项目文档：${document.feishuUrl}`
        : `已生成《${document.title}》，并已沉淀到项目文档。`;
    }

    if (tasks.length && !documents.length && !files.length) {
      return tasks.length === 1
        ? '已整理 1 项任务，并写入任务板。'
        : `已整理 ${tasks.length} 项任务，并写入任务板。`;
    }

    const parts: string[] = [];
    if (documents.length) {
      parts.push(documents.length === 1 ? '1 份文档' : `${documents.length} 份文档`);
    }
    if (tasks.length) {
      parts.push(tasks.length === 1 ? '1 项任务' : `${tasks.length} 项任务`);
    }
    if (files.length) {
      parts.push(files.length === 1 ? '1 个文件' : `${files.length} 个文件`);
    }
    return parts.length ? `已完成正式产出：${parts.join('、')}。` : null;
  }

  private toArtifactType(artifact: SyncedArtifact) {
    const metadata =
      artifact.metadata && typeof artifact.metadata === 'object' && !Array.isArray(artifact.metadata)
        ? (artifact.metadata as Record<string, unknown>)
        : null;
    return metadata?.type === 'task'
      ? ArtifactType.task
      : metadata?.type === 'file'
        ? ArtifactType.file
        : metadata?.type === 'document'
          ? ArtifactType.document
          : ArtifactType.summary;
  }
}
