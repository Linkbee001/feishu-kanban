import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { AgentRunStatus } from '@prisma/client';
import { Job } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AgentService } from '../../modules/agent/agent.service';
import { GroupAgentSessionService } from '../../modules/agent/group-agent-session.service';
import { IntentMapperService } from '../../modules/agent/intent-mapper.service';
import { PiMonoAdapter } from '../../modules/agent/pi-mono.adapter';
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
    private readonly intentMapper: IntentMapperService,
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

      const execution = await this.piMono.executeRun(run.id, {
        runtimeSessionKey:
          groupSession?.runtimeSessionKey ?? this.groupSessions.createRuntimeSessionKey(run.project.feishuChatId),
        sessionStoreRef: groupSession?.sessionStoreRef ?? null,
        agentScopeKey:
          groupSession?.agentScopeKey ?? this.groupSessions.createAgentScopeKey(run.projectId),
        sessionMode: groupSession?.sessionMode ?? 'active',
        project: { id: run.project.id, name: run.project.name, feishuChatId: run.project.feishuChatId },
        environment: {
          id: run.environment.id,
          name: run.environment.name,
          piMonoEnvId: run.environment.piMonoEnvId,
          repoUrl: run.environment.repoUrl,
          repoBranch: run.environment.repoBranch,
          projectPath: run.environment.projectPath,
          modelEndpoint: run.environment.modelEndpoint,
          modelName: run.environment.modelName,
          skillSet: run.environment.skillSet,
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
        outputSchema: this.intentMapper.outputSchema(),
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
