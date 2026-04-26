import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AgentRunStatus } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { assertAgentRunTransition } from '../../common/state/state-machine';
import { AGENT_RUN_QUEUE, ARTIFACT_SYNC_QUEUE } from '../../queues/queue.constants';
import { GroupAgentSessionService } from './group-agent-session.service';
import { SessionSubmitResult } from './group-agent-session.types';
import { IntentMapperService } from './intent-mapper.service';
import { PiMonoAdapter } from './pi-mono.adapter';

@Injectable()
export class AgentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly intentMapper: IntentMapperService,
    private readonly groupSessions: GroupAgentSessionService,
    private readonly piMono: PiMonoAdapter,
    @InjectQueue(AGENT_RUN_QUEUE) private readonly agentRunQueue: Queue,
    @InjectQueue(ARTIFACT_SYNC_QUEUE) private readonly artifactSyncQueue: Queue,
  ) {}

  async createRun(input: {
    projectId: string;
    environmentId: string;
    messageSourceId?: string;
    prompt: string;
    intent?: string;
  }) {
    const project = await this.prisma.project.findUnique({ where: { id: input.projectId } });
    const environment = await this.prisma.projectEnvironment.findUnique({ where: { id: input.environmentId } });
    if (!project || !environment) throw new BadRequestException('Invalid project or environment');
    const detected = input.intent ?? this.intentMapper.detect(input.prompt);
    const run = await this.prisma.agentRun.create({
      data: {
        projectId: project.id,
        environmentId: environment.id,
        messageSourceId: input.messageSourceId,
        intent: detected,
        skillName: this.intentMapper.skillFor(detected as any),
        prompt: input.prompt,
      },
    });
    await this.agentRunQueue.add('start', { agentRunId: run.id }, { jobId: run.id });
    return run;
  }

  async submitGroupMessage(input: {
    sessionId: string;
    projectId: string;
    environmentId: string;
    feishuChatId: string;
    messageSourceId?: string;
    prompt: string;
    intent?: string;
  }): Promise<SessionSubmitResult> {
    const session = await this.prisma.groupAgentSession.findUnique({ where: { id: input.sessionId } });
    if (!session) {
      return { status: 'failed', reason: 'Group session not found' };
    }

    const project = await this.prisma.project.findUnique({ where: { id: input.projectId } });
    const environment = await this.prisma.projectEnvironment.findUnique({ where: { id: input.environmentId } });
    if (!project || !environment) {
      return { status: 'failed', session, reason: 'Invalid project or environment' };
    }

    const lockToken = `run-lock:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`;
    const acquired = await this.groupSessions.tryAcquireLock(input.feishuChatId, lockToken);
    if (!acquired) {
      return {
        status: 'rejected_busy',
        session,
        reason: (await this.groupSessions.getBusyReason(input.feishuChatId)) ?? 'busy',
      };
    }

    try {
      const detected = input.intent ?? this.intentMapper.detect(input.prompt);
      const run = await this.prisma.agentRun.create({
        data: {
          projectId: project.id,
          environmentId: environment.id,
          messageSourceId: input.messageSourceId,
          intent: detected,
          skillName: this.intentMapper.skillFor(detected as any),
          prompt: input.prompt,
        },
      });

      await this.groupSessions.markRunQueued({
        sessionId: session.id,
        runId: run.id,
        lockToken,
        environmentId: environment.id,
      });

      await this.agentRunQueue.add('start', { agentRunId: run.id }, { jobId: run.id });
      const updatedSession = await this.prisma.groupAgentSession.findUniqueOrThrow({ where: { id: session.id } });
      return { status: 'accepted', session: updatedSession, runId: run.id, lockToken };
    } catch (error) {
      await this.groupSessions.releaseLock(input.feishuChatId, lockToken);
      return {
        status: 'failed',
        session,
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async findRun(id: string) {
    const run = await this.prisma.agentRun.findUnique({ where: { id }, include: { artifacts: true } });
    if (!run) throw new NotFoundException('Agent run not found');
    return run;
  }

  async cancelRun(id: string) {
    const run = await this.findRun(id);
    assertAgentRunTransition(run.status, AgentRunStatus.canceled);

    if (run.status === AgentRunStatus.queued) {
      const queuedJob = await this.agentRunQueue.getJob(id);
      await queuedJob?.remove().catch(() => undefined);

      const updated = await this.prisma.agentRun.update({
        where: { id },
        data: {
          status: AgentRunStatus.canceled,
          finishedAt: new Date(),
          errorCode: 'CANCELED',
          errorMessage: 'Agent run canceled before execution started.',
        },
      });
      await this.groupSessions.handleRunStatusTransition(updated.id, AgentRunStatus.canceled);
      return updated;
    }

    await this.piMono.cancelRun(id);
    return this.prisma.agentRun.update({
      where: { id },
      data: {
        status: AgentRunStatus.canceled,
        finishedAt: new Date(),
        errorCode: 'CANCELED',
        errorMessage: 'Agent run cancellation requested.',
      },
    });
  }

  async transition(id: string, status: AgentRunStatus, data: Record<string, unknown> = {}) {
    const run = await this.findRun(id);
    assertAgentRunTransition(run.status, status);
    const updated = await this.prisma.agentRun.update({ where: { id }, data: { status, ...data } });
    await this.groupSessions.handleRunStatusTransition(
      updated.id,
      status,
      (data.errorMessage as string | undefined) ?? updated.errorMessage,
    );
    return updated;
  }

  async retrySync(id: string) {
    await this.findRun(id);
    await this.artifactSyncQueue.add('sync-run', { agentRunId: id });
    return { queued: true };
  }
}
