import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { AgentRunStatus, GroupSessionMode, GroupSessionStatus } from '@prisma/client';
import { Job, Queue } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AgentService } from '../../modules/agent/agent.service';
import { PiMonoAdapter } from '../../modules/agent/pi-mono.adapter';
import { GroupAgentSessionService } from '../../modules/agent/group-agent-session.service';
import { ARTIFACT_SYNC_QUEUE, PROJECT_DIGEST_QUEUE } from '../queue.constants';
import { ProjectContextAssembler } from '../../modules/digest/project-context-assembler.service';
import { ProjectDigestService } from '../../modules/digest/project-digest.service';

type ScanJob = Record<string, never>;
type DigestJob = {
  sessionId: string;
  digestType: 'daily_status' | 'weekly_report_draft';
  targetChannels: Array<'group_message' | 'feishu_doc' | 'bitable' | 'internal_digest'>;
  triggerType: 'scheduled';
  internalOnly: boolean;
  periodKey: string;
};

@Processor(PROJECT_DIGEST_QUEUE)
export class ProjectDigestProcessor extends WorkerHost {
  private readonly logger = new Logger(ProjectDigestProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly agent: AgentService,
    private readonly piMono: PiMonoAdapter,
    private readonly groupSessions: GroupAgentSessionService,
    private readonly assembler: ProjectContextAssembler,
    private readonly digests: ProjectDigestService,
    @InjectQueue(PROJECT_DIGEST_QUEUE) private readonly digestQueue: Queue,
    @InjectQueue(ARTIFACT_SYNC_QUEUE) private readonly artifactQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<ScanJob | DigestJob>) {
    if (job.name === 'scan') {
      return this.processScan();
    }
    if (job.name === 'digest') {
      return this.processDigest(job as Job<DigestJob>);
    }
  }

  private async processScan() {
    const sessions = await this.prisma.groupAgentSession.findMany({
      where: {
        projectId: { not: null },
        sessionMode: GroupSessionMode.active,
        status: { not: GroupSessionStatus.disabled },
      },
      orderBy: { updatedAt: 'asc' },
    });

    for (const session of sessions) {
      if (session.status === GroupSessionStatus.busy) {
        continue;
      }

      const due = this.digests.getScheduledDigestJobs(session);
      for (const item of due) {
        const internalOnly = item.targetChannels.every((channel) => channel === 'internal_digest');
        await this.digestQueue.add(
          'digest',
          {
            sessionId: session.id,
            digestType: item.digestType,
            targetChannels: item.targetChannels,
            triggerType: 'scheduled',
            internalOnly,
            periodKey: item.periodKey,
          },
          {
            jobId: `${session.id}:${item.periodKey}`,
          },
        );
      }
    }
  }

  private async processDigest(job: Job<DigestJob>) {
    const session = await this.prisma.groupAgentSession.findUnique({
      where: { id: job.data.sessionId },
    });
    if (!session || !session.projectId || session.sessionMode !== GroupSessionMode.active) {
      return;
    }

    const context = await this.assembler.assembleForSession(session);
    const environmentId = session.activeEnvironmentId ?? context.environment.id;
    const run = await this.prisma.agentRun.create({
      data: {
        projectId: session.projectId,
        environmentId,
        messageSourceId: null,
        intent: job.data.digestType === 'weekly_report_draft' ? 'weekly_report' : 'progress_summary',
        skillName: job.data.digestType === 'weekly_report_draft' ? 'weekly_report' : 'progress_summary',
        prompt: this.digests.buildPrompt({
          digestType: job.data.digestType,
          wakeMode: 'scheduled_digest',
          targetChannels: job.data.targetChannels,
          internalOnly: job.data.internalOnly,
          context,
        }),
      },
    });

    const digestSessionKey = this.digests.buildDigestSessionKey(context.project.feishuChatId, job.data.digestType);

    try {
      await this.agent.transition(run.id, AgentRunStatus.running, {
        startedAt: new Date(),
        progress: 5,
      });

      const execution = await this.piMono.executeRun(run.id, {
        runtimeSessionKey: digestSessionKey,
        agentScopeKey: session.agentScopeKey,
        sessionMode: 'active',
        wakeMode: 'scheduled_digest',
        digestType: job.data.digestType,
        projectContextBundle: context,
        project: {
          id: context.project.id,
          name: context.project.name,
          feishuChatId: context.project.feishuChatId,
        },
        environment: {
          id: context.environment.id,
          name: context.environment.name,
          repoUrl: context.environment.repoUrl,
          repoBranch: context.environment.repoBranch,
          projectPath: context.environment.projectPath,
          modelName: context.environment.modelName,
          skillSet: context.environment.skillSet,
        },
        source: {},
        intent: run.intent,
        skillName: run.skillName,
        prompt: run.prompt,
        outputSchema: this.digests.buildOutputSchema(),
      });

      if (execution.status !== 'succeeded') {
        const status = execution.status === 'timeout' ? AgentRunStatus.timeout : AgentRunStatus.canceled;
        await this.agent.transition(run.id, status, {
          finishedAt: new Date(),
          errorCode: execution.status.toUpperCase(),
          errorMessage:
            execution.status === 'timeout'
              ? 'Scheduled digest timed out in PiMono SDK runtime.'
              : 'Scheduled digest was canceled.',
        });
        return;
      }

      const normalized = this.digests.normalizeSummaryOutput({
        projectId: context.project.id,
        digestType: job.data.digestType,
        targetChannels: job.data.targetChannels,
        internalOnly: job.data.internalOnly,
        context,
        output: execution.outputs?.find((item) => item.type === 'summary') ?? execution.outputs?.[0],
      });

      await this.agent.transition(run.id, AgentRunStatus.syncing, {
        progress: 95,
        outputSummary: normalized.output.title,
        rawOutputs: [normalized.output] as any,
      });

      await this.prisma.groupAgentSession.update({
        where: { id: session.id },
        data: {
          lastDigestAt: new Date(),
          lastDigestType: job.data.digestType,
          lastDigestHash: normalized.digestHash,
          lastDigestRunId: run.id,
        },
      });

      await this.artifactQueue.add('sync-run', { agentRunId: run.id }, { jobId: `${run.id}-sync` });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Digest run ${run.id} failed: ${message}`, error instanceof Error ? error.stack : undefined);
      await this.agent.transition(run.id, AgentRunStatus.failed, {
        finishedAt: new Date(),
        errorCode: 'PROJECT_DIGEST_FAILED',
        errorMessage: message,
      });
      throw error;
    } finally {
      await this.piMono.closeSession(digestSessionKey).catch(() => undefined);
    }
  }
}
