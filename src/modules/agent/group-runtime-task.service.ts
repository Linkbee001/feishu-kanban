import { Injectable } from '@nestjs/common';
import { GroupRuntimeTaskStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GroupRuntimeTaskSnapshot, GroupRuntimeToolActionType } from './agent.types';

@Injectable()
export class GroupRuntimeTaskService {
  constructor(private readonly prisma: PrismaService) {}

  async listForSession(groupSessionId: string): Promise<GroupRuntimeTaskSnapshot[]> {
    const tasks = await this.prisma.groupRuntimeTask.findMany({
      where: { groupSessionId },
      orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
    });
    return tasks.map((task) => ({
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
      taskPayloadJson: this.toObject(task.taskPayloadJson),
      resultSummary: task.resultSummary,
      lastError: task.lastError,
    }));
  }

  async hasRunnableTask(groupSessionId: string) {
    const count = await this.prisma.groupRuntimeTask.count({
      where: {
        groupSessionId,
        status: {
          in: [GroupRuntimeTaskStatus.queued, GroupRuntimeTaskStatus.running],
        },
      },
    });
    return count > 0;
  }

  async applyAction(input: {
    groupSessionId: string;
    projectId: string;
    environmentId: string;
    messageSourceId?: string | null;
    type: GroupRuntimeToolActionType;
    taskId?: string;
    title?: string;
    description?: string;
    intent?: string;
    skillHint?: string | null;
    outputMode?: string | null;
    taskPayload?: Record<string, unknown>;
    blockedReason?: string;
    nextActionHint?: string;
    priority?: number;
    triggerType?: string;
    resultSummary?: string;
    errorMessage?: string;
  }) {
    switch (input.type) {
      case 'create':
        return this.createTask(input);
      case 'update':
        return this.updateTask(input);
      case 'start':
        await this.ensureSingleRunningTask(input.groupSessionId, input.taskId);
        return this.transitionTask(input.groupSessionId, input.taskId, GroupRuntimeTaskStatus.running, {
          startedAt: new Date(),
          lastError: null,
          blockedReason: null,
          nextActionHint: null,
        });
      case 'complete':
        return this.transitionTask(input.groupSessionId, input.taskId, GroupRuntimeTaskStatus.completed, {
          resultSummary: input.resultSummary ?? null,
          finishedAt: new Date(),
          lastError: null,
        });
      case 'fail':
        return this.transitionTask(input.groupSessionId, input.taskId, GroupRuntimeTaskStatus.failed, {
          resultSummary: input.resultSummary ?? null,
          lastError: input.errorMessage ?? 'Task failed',
          finishedAt: new Date(),
        });
      case 'cancel':
        return this.transitionTask(input.groupSessionId, input.taskId, GroupRuntimeTaskStatus.canceled, {
          resultSummary: input.resultSummary ?? null,
          finishedAt: new Date(),
        });
      case 'block':
        return this.transitionTask(input.groupSessionId, input.taskId, GroupRuntimeTaskStatus.blocked, {
          resultSummary: input.resultSummary ?? null,
          blockedReason: input.blockedReason ?? 'Task is blocked',
          nextActionHint: input.nextActionHint ?? null,
        });
      default:
        return null;
    }
  }

  async attachConfirmation(taskId: string, confirmationRequestId: string) {
    return this.prisma.groupRuntimeTask.update({
      where: { id: taskId },
      data: {
        status: GroupRuntimeTaskStatus.waiting_confirmation,
        resultSummary: 'Waiting for confirmation',
        blockedReason: 'Waiting for confirmation',
      },
    }).then(async (task) => {
      await this.prisma.confirmationRequest.update({
        where: { id: confirmationRequestId },
        data: { groupRuntimeTaskId: task.id },
      });
      return task;
    });
  }

  async releaseBlockedTask(taskId: string, resultSummary: string) {
    return this.prisma.groupRuntimeTask.update({
      where: { id: taskId },
      data: {
        status: GroupRuntimeTaskStatus.queued,
        resultSummary,
        lastError: null,
        blockedReason: null,
        nextActionHint: null,
      },
    });
  }

  async cancelQueuedTasksForSession(groupSessionId: string, input?: {
    excludeMessageSourceId?: string | null;
    resultSummary?: string;
  }) {
    return this.prisma.groupRuntimeTask.updateMany({
      where: {
        groupSessionId,
        status: GroupRuntimeTaskStatus.queued,
        ...(input?.excludeMessageSourceId
          ? { messageSourceId: { not: input.excludeMessageSourceId } }
          : {}),
      },
      data: {
        status: GroupRuntimeTaskStatus.canceled,
        resultSummary: input?.resultSummary ?? 'Canceled as superseded by a newer group request.',
        finishedAt: new Date(),
      },
    });
  }

  private async createTask(input: {
    groupSessionId: string;
    projectId: string;
    environmentId: string;
    messageSourceId?: string | null;
    title?: string;
    description?: string;
    intent?: string;
    skillHint?: string | null;
    outputMode?: string | null;
    taskPayload?: Record<string, unknown>;
    blockedReason?: string;
    nextActionHint?: string;
    priority?: number;
    triggerType?: string;
  }) {
    if (!input.title?.trim() || !input.intent?.trim()) {
      return null;
    }
    const last = await this.prisma.groupRuntimeTask.findFirst({
      where: { groupSessionId: input.groupSessionId },
      orderBy: [{ orderIndex: 'desc' }, { createdAt: 'desc' }],
      select: { orderIndex: true },
    });
    return this.prisma.groupRuntimeTask.create({
      data: {
        groupSessionId: input.groupSessionId,
        projectId: input.projectId,
        environmentId: input.environmentId,
        messageSourceId: input.messageSourceId,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        intent: input.intent.trim(),
        skillHint: input.skillHint ?? null,
        outputMode: input.outputMode ?? null,
        orderIndex: (last?.orderIndex ?? -1) + 1,
        priority: input.priority ?? 0,
        triggerType: input.triggerType ?? null,
        blockedReason: input.blockedReason ?? null,
        nextActionHint: input.nextActionHint ?? null,
        taskPayloadJson: (input.taskPayload ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  private async updateTask(input: {
    groupSessionId: string;
    taskId?: string;
    title?: string;
    description?: string;
    intent?: string;
    skillHint?: string | null;
    outputMode?: string | null;
    taskPayload?: Record<string, unknown>;
    blockedReason?: string;
    nextActionHint?: string;
    priority?: number;
    triggerType?: string;
  }) {
    if (!input.taskId) {
      return null;
    }
    return this.prisma.groupRuntimeTask.updateMany({
      where: {
        id: input.taskId,
        groupSessionId: input.groupSessionId,
      },
      data: {
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description.trim() || null } : {}),
        ...(input.intent !== undefined ? { intent: input.intent.trim() } : {}),
        ...(input.skillHint !== undefined ? { skillHint: input.skillHint } : {}),
        ...(input.outputMode !== undefined ? { outputMode: input.outputMode } : {}),
        ...(input.blockedReason !== undefined ? { blockedReason: input.blockedReason } : {}),
        ...(input.nextActionHint !== undefined ? { nextActionHint: input.nextActionHint } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.triggerType !== undefined ? { triggerType: input.triggerType } : {}),
        ...(input.taskPayload !== undefined ? { taskPayloadJson: input.taskPayload as Prisma.InputJsonValue } : {}),
      },
    });
  }

  private async ensureSingleRunningTask(groupSessionId: string, taskId?: string) {
    const existing = await this.prisma.groupRuntimeTask.findFirst({
      where: {
        groupSessionId,
        status: GroupRuntimeTaskStatus.running,
        ...(taskId ? { id: { not: taskId } } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throw new Error(`Another running task already exists for session ${groupSessionId}`);
    }
  }

  private async transitionTask(
    groupSessionId: string,
    taskId: string | undefined,
    status: GroupRuntimeTaskStatus,
    data: Record<string, unknown>,
  ) {
    if (!taskId) {
      return null;
    }
    return this.prisma.groupRuntimeTask.updateMany({
      where: {
        id: taskId,
        groupSessionId,
      },
      data: {
        status,
        ...data,
      },
    });
  }

  private toObject(value: unknown) {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }
}
