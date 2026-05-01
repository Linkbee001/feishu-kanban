import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DEFAULT_MANAGER_SKILLS } from '../agent/role-profile.service';

@Injectable()
export class GroupPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureDefaultPolicy(input: {
    projectId: string;
    feishuChatId: string;
    defaultEnvironmentId?: string | null;
  }) {
    const skills = [...DEFAULT_MANAGER_SKILLS];

    return this.prisma.groupPolicy.upsert({
      where: {
        projectId_feishuChatId: {
          projectId: input.projectId,
          feishuChatId: input.feishuChatId,
        },
      },
      create: {
        projectId: input.projectId,
        feishuChatId: input.feishuChatId,
        enabled: true,
        mentionOnly: true,
        defaultQueueMode: 'collect',
        allowedSkillsJson: skills as Prisma.InputJsonValue,
        defaultEnvironmentId: input.defaultEnvironmentId ?? null,
        allowAutoTaskCreation: true,
        allowTaskBoardWrite: true,
        allowDocWrite: true,
        highRiskActionsRequireConfirmation: true,
      } as any,
      update: {
        defaultEnvironmentId: input.defaultEnvironmentId ?? null,
        defaultQueueMode: 'collect',
        allowedSkillsJson: skills as Prisma.InputJsonValue,
      } as any,
    });
  }

  async findByChat(feishuChatId: string) {
    return this.resolveByChat(feishuChatId);
  }

  async getByChat(feishuChatId: string) {
    const policy = await this.resolveByChat(feishuChatId);
    if (!policy) {
      throw new NotFoundException('Group policy not found');
    }
    return policy;
  }

  async updateByChat(feishuChatId: string, input: {
    enabled?: boolean;
    mentionOnly?: boolean;
    defaultQueueMode?: 'steer' | 'followup' | 'collect' | 'interrupt' | 'steer_backlog';
    allowedSkills?: string[];
    defaultEnvironmentId?: string | null;
    allowAutoTaskCreation?: boolean;
    allowTaskBoardWrite?: boolean;
    allowDocWrite?: boolean;
    highRiskActionsRequireConfirmation?: boolean;
    archivedAt?: string | null;
  }) {
    const current = await this.getByChat(feishuChatId);
    return this.prisma.groupPolicy.update({
      where: { id: current.id },
      data: {
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        ...(input.mentionOnly !== undefined ? { mentionOnly: input.mentionOnly } : {}),
        ...(input.defaultQueueMode !== undefined ? { defaultQueueMode: input.defaultQueueMode } : {}),
        ...(input.allowedSkills !== undefined
          ? { allowedSkillsJson: input.allowedSkills.map((item) => item.trim()).filter(Boolean) as Prisma.InputJsonValue }
          : {}),
        ...(input.defaultEnvironmentId !== undefined ? { defaultEnvironmentId: input.defaultEnvironmentId } : {}),
        ...(input.allowAutoTaskCreation !== undefined ? { allowAutoTaskCreation: input.allowAutoTaskCreation } : {}),
        ...(input.allowTaskBoardWrite !== undefined ? { allowTaskBoardWrite: input.allowTaskBoardWrite } : {}),
        ...(input.allowDocWrite !== undefined ? { allowDocWrite: input.allowDocWrite } : {}),
        ...(input.highRiskActionsRequireConfirmation !== undefined
          ? { highRiskActionsRequireConfirmation: input.highRiskActionsRequireConfirmation }
          : {}),
        ...(input.archivedAt !== undefined ? { archivedAt: input.archivedAt ? new Date(input.archivedAt) : null } : {}),
      },
    });
  }

  private async resolveByChat(feishuChatId: string) {
    const chatId = feishuChatId.trim();
    const existing = await this.prisma.groupPolicy.findFirst({
      where: {
        feishuChatId: chatId,
        archivedAt: null,
      },
      orderBy: { updatedAt: 'desc' },
    });
    if (existing) {
      return existing;
    }

    const project = await this.prisma.project.findUnique({
      where: { feishuChatId: chatId },
      select: {
        id: true,
        feishuChatId: true,
        defaultEnvironmentId: true,
      },
    });
    if (!project) {
      return null;
    }

    return this.ensureDefaultPolicy({
      projectId: project.id,
      feishuChatId: project.feishuChatId,
      defaultEnvironmentId: project.defaultEnvironmentId,
    });
  }

  toSnapshot(policy: Awaited<ReturnType<GroupPolicyService['findByChat']>>) {
    if (!policy) {
      return null;
    }
    return {
      enabled: policy.enabled,
      mentionOnly: policy.mentionOnly,
      defaultQueueMode: (policy as any).defaultQueueMode ?? 'collect',
      allowedSkills: Array.isArray(policy.allowedSkillsJson)
        ? policy.allowedSkillsJson.map((item) => String(item))
        : [],
      defaultEnvironmentId: policy.defaultEnvironmentId,
      allowAutoTaskCreation: policy.allowAutoTaskCreation,
      allowTaskBoardWrite: policy.allowTaskBoardWrite,
      allowDocWrite: policy.allowDocWrite,
      highRiskActionsRequireConfirmation: policy.highRiskActionsRequireConfirmation,
      archivedAt: policy.archivedAt?.toISOString() ?? null,
    };
  }
}
