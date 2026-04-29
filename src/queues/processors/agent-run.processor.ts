import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { AgentRunStatus } from '@prisma/client';
import { Job } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AgentService } from '../../modules/agent/agent.service';
import { AGENT_OUTPUT_SCHEMA } from '../../modules/agent/agent.schemas';
import { GroupAgentSessionService } from '../../modules/agent/group-agent-session.service';
import { PiMonoAdapter } from '../../modules/agent/pi-mono.adapter';
import { RepoSyncService } from '../../modules/repo/repo-sync.service';
import { AGENT_RUN_QUEUE, ARTIFACT_SYNC_QUEUE } from '../queue.constants';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Processor(AGENT_RUN_QUEUE)
export class AgentRunProcessor extends WorkerHost {
  private readonly logger = new Logger(AgentRunProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly agent: AgentService,
    private readonly groupSessions: GroupAgentSessionService,
    private readonly piMono: PiMonoAdapter,
    private readonly repoSync: RepoSyncService,
    @InjectQueue(ARTIFACT_SYNC_QUEUE) private readonly artifactQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<{ agentRunId: string }>) {
    const run = await this.prisma.agentRun.findUnique({
      where: { id: job.data.agentRunId },
      include: { project: true, environment: true, messageSource: true },
    });
    if (!run || run.status !== AgentRunStatus.queued) return;

    try {
      this.logger.log(`Starting agent run ${run.id}`);
      await this.agent.transition(run.id, AgentRunStatus.running, { startedAt: new Date(), progress: 5 });
      const groupSession = await this.prisma.groupAgentSession.findFirst({
        where: {
          OR: [{ currentAgentRunId: run.id }, { projectId: run.projectId }],
          agentRole: 'manager',
        },
        orderBy: { updatedAt: 'desc' },
      });
      if (groupSession) {
        await this.groupSessions.rehydrateSession(groupSession.feishuChatId);
      }

      const repoSync = await this.repoSync.ensureRepoFresh({
        projectId: run.project.id,
        environmentId: run.environment.id,
        repoUrl: run.environment.repoUrl,
        repoBranch: run.environment.repoBranch,
        repoCredentialRef: run.environment.repoCredentialRef,
        force: true,
      });
      if (run.environment.repoUrl && repoSync.status !== 'ready') {
        await this.agent.transition(run.id, AgentRunStatus.failed, {
          finishedAt: new Date(),
          errorCode: 'REPO_SYNC_FAILED',
          errorMessage: repoSync.error ?? 'Repository mirror sync failed before formal execution.',
        });
        return;
      }
      const environment = await this.prisma.projectEnvironment.findUniqueOrThrow({
        where: { id: run.environment.id },
      });

      const execution = await this.piMono.executeRun(run.id, {
        runtimeSessionKey:
          groupSession?.runtimeSessionKey ?? this.groupSessions.createRuntimeSessionKey(run.project.feishuChatId),
        sessionStoreRef: groupSession?.sessionStoreRef ?? null,
        agentScopeKey:
          groupSession?.agentScopeKey ?? this.groupSessions.createAgentScopeKey(run.projectId),
        sessionMode: groupSession?.sessionMode ?? 'active',
        requestKind: 'formal_execution',
        contextBinding: {
          groupSessionId: groupSession?.id ?? null,
          projectId: run.project.id,
          environmentId: environment.id,
          feishuChatId: run.project.feishuChatId,
        },
        minimalContext: {
          sessionMemorySummary: groupSession?.memorySummary ?? null,
          repoReady: environment.repoSyncStatus === 'ready',
          repoHeadRef: environment.repoHeadRef,
        },
        project: { id: run.project.id, name: run.project.name, feishuChatId: run.project.feishuChatId },
        environment: {
          id: environment.id,
          name: environment.name,
          piMonoEnvId: environment.piMonoEnvId,
          repoUrl: environment.repoUrl,
          repoBranch: environment.repoBranch,
          repoCredentialRef: environment.repoCredentialRef,
          repoMirrorPath: environment.repoMirrorPath,
          repoSyncStatus: environment.repoSyncStatus,
          repoSyncError: environment.repoSyncError,
          repoHeadRef: environment.repoHeadRef,
          projectPath: environment.projectPath,
          modelEndpoint: environment.modelEndpoint,
          modelName: environment.modelName,
          skillSet: environment.skillSet,
        },
        source: {
          messageSourceId: run.messageSourceId,
          feishuMessageId: run.messageSource?.feishuMessageId,
          senderOpenId: run.messageSource?.senderOpenId,
          traceId: run.messageSource?.traceId,
        },
        intent: run.intent,
        skillName: run.skillName,
        prompt: run.prompt,
        outputSchema: AGENT_OUTPUT_SCHEMA,
      });

      if (groupSession) {
        await this.groupSessions.syncRuntimeSessionState({
          sessionId: groupSession.id,
          piSessionId: execution.session.piSessionId,
          sessionStoreDriver: execution.session.sessionStoreDriver,
          sessionStoreRef: execution.session.sessionStoreRef ?? null,
          memorySummary: execution.session.memorySummary ?? null,
          lastError: execution.status === 'succeeded' ? null : undefined,
          touchMessageAt: true,
          touchRunAt: true,
        });
      }

      if (execution.status === 'succeeded') {
        const latest = await this.prisma.agentRun.findUnique({ where: { id: run.id } });
        if (latest?.status === AgentRunStatus.canceled) {
          await this.groupSessions.handleRunStatusTransition(run.id, AgentRunStatus.canceled);
          return;
        }

        await this.agent.transition(run.id, AgentRunStatus.syncing, {
          progress: 95,
          outputSummary: execution.outputSummary,
          rawOutputs: execution.outputs as any,
        });
        await this.artifactQueue.add('sync-run', { agentRunId: run.id }, { jobId: `${run.id}-sync` });
        this.logger.log(`Agent run ${run.id} completed in SDK runtime and entered syncing`);
        return;
      }

      if (execution.status === 'canceled') {
        const latest = await this.prisma.agentRun.findUnique({ where: { id: run.id } });
        if (latest?.status === AgentRunStatus.canceled) {
          await this.groupSessions.handleRunStatusTransition(run.id, AgentRunStatus.canceled);
        } else {
          await this.agent.transition(run.id, AgentRunStatus.canceled, {
            finishedAt: new Date(),
            errorCode: 'CANCELED',
            errorMessage: 'Agent run was canceled.',
          });
        }
        return;
      }

      await this.agent.transition(run.id, AgentRunStatus.timeout, {
        finishedAt: new Date(),
        errorCode: 'TIMEOUT',
        errorMessage: 'Agent run timed out in PiMono SDK runtime.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Agent run ${run.id} failed to start pi-mono: ${message}`, error instanceof Error ? error.stack : undefined);
      const latest = await this.prisma.agentRun.findUnique({ where: { id: run.id } });
      if (latest?.status === AgentRunStatus.canceled) {
        await this.groupSessions.handleRunStatusTransition(run.id, AgentRunStatus.canceled);
        return;
      }

      const groupSession = await this.prisma.groupAgentSession.findFirst({
        where: { currentAgentRunId: run.id },
      });
      if (groupSession) {
        await this.groupSessions.syncRuntimeSessionState({
          sessionId: groupSession.id,
          lastError: message,
          touchRunAt: true,
        });
      }

      await this.agent.transition(run.id, AgentRunStatus.failed, {
        finishedAt: new Date(),
        errorCode: 'PI_MONO_EXEC_FAILED',
        errorMessage: message,
      });
      throw error;
    }
  }
}
