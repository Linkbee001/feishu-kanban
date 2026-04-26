import { Processor, WorkerHost } from '@nestjs/bullmq';
import { AgentRunStatus, ArtifactStatus } from '@prisma/client';
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

    if (run.messageSource?.feishuChatId) {
      const links = synced.map((artifact) => this.formatArtifactLine(artifact)).join('\n');
      await this.feishu.sendTextMessage(
        'chat_id',
        run.messageSource.feishuChatId,
        `Execution completed: ${run.intent}\nEnvironment: ${run.environment.name}\nRun ID: ${run.id}\n${links}`,
      );
      return;
    }

    const digestSummary = this.getDigestSummaryOutput(outputs);
    if (digestSummary && run.project.feishuChatId) {
      await this.feishu.sendTextMessage('chat_id', run.project.feishuChatId, digestSummary.content ?? digestSummary.title);
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

  private formatArtifactLine(artifact: SyncedArtifact) {
    const target = artifact.feishuUrl ?? artifact.bitableRecordId ?? artifact.fileKey;
    return target ? `${artifact.title}: ${target}` : `${artifact.title}: synced`;
  }
}
