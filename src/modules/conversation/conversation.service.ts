import { Injectable } from '@nestjs/common';
import { SourceType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class ConversationService {
  constructor(private readonly prisma: PrismaService) {}

  async getActiveContext(input: {
    sourceType: SourceType;
    feishuChatId: string;
    userOpenId?: string;
  }) {
    return this.prisma.conversationContext.findFirst({
      where: {
        sourceType: input.sourceType,
        feishuChatId: input.feishuChatId,
        userOpenId: input.userOpenId ?? null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async selectProject(input: {
    sourceType: SourceType;
    feishuChatId: string;
    userOpenId?: string;
    projectId: string;
    environmentId?: string | null;
    ttlMinutes?: number;
  }) {
    const expiresAt = new Date(Date.now() + (input.ttlMinutes ?? 30) * 60_000);
    const existing = await this.prisma.conversationContext.findFirst({
      where: {
        sourceType: input.sourceType,
        feishuChatId: input.feishuChatId,
        userOpenId: input.userOpenId ?? null,
      },
    });

    if (existing) {
      return this.prisma.conversationContext.update({
        where: { id: existing.id },
        data: {
          projectId: input.projectId,
          environmentId: input.environmentId ?? existing.environmentId,
          expiresAt,
        },
      });
    }

    return this.prisma.conversationContext.create({
      data: {
        sourceType: input.sourceType,
        feishuChatId: input.feishuChatId,
        userOpenId: input.userOpenId ?? null,
        projectId: input.projectId,
        environmentId: input.environmentId ?? null,
        expiresAt,
      },
    });
  }

  async switchEnvironment(input: {
    sourceType: SourceType;
    feishuChatId: string;
    userOpenId?: string;
    projectId: string;
    environmentId: string;
    ttlMinutes?: number;
  }) {
    const expiresAt = new Date(Date.now() + (input.ttlMinutes ?? 30) * 60_000);
    const existing = await this.prisma.conversationContext.findFirst({
      where: {
        sourceType: input.sourceType,
        feishuChatId: input.feishuChatId,
        userOpenId: input.userOpenId ?? null,
      },
    });

    if (existing) {
      return this.prisma.conversationContext.update({
        where: { id: existing.id },
        data: {
          projectId: input.projectId,
          environmentId: input.environmentId,
          expiresAt,
        },
      });
    }

    return this.prisma.conversationContext.create({
      data: {
        sourceType: input.sourceType,
        feishuChatId: input.feishuChatId,
        userOpenId: input.userOpenId ?? null,
        projectId: input.projectId,
        environmentId: input.environmentId,
        expiresAt,
      },
    });
  }

  cleanupExpired() {
    return this.prisma.conversationContext.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  }
}
