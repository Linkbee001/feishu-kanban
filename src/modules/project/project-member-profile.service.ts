import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

type ChatMemberInput = {
  openId: string;
  displayName: string;
  groupNickname?: string | null;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class ProjectMemberProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async syncChatMembers(input: {
    projectId: string;
    feishuChatId: string;
    ownerOpenId: string;
    members: ChatMemberInput[];
  }) {
    const normalizedMembers = input.members
      .map((member) => ({
        openId: member.openId.trim(),
        displayName: member.displayName.trim(),
        groupNickname: member.groupNickname?.trim() || member.displayName.trim(),
        metadata: member.metadata ?? {},
      }))
      .filter((member) => member.openId && member.displayName);

    if (!normalizedMembers.some((member) => member.openId === input.ownerOpenId)) {
      normalizedMembers.unshift({
        openId: input.ownerOpenId,
        displayName: 'Project Owner',
        groupNickname: 'Project Owner',
        metadata: { injectedOwner: true },
      });
    }

    const operations = normalizedMembers.map((member) =>
      this.prisma.projectMemberProfile.upsert({
        where: {
          projectId_feishuChatId_openId: {
            projectId: input.projectId,
            feishuChatId: input.feishuChatId,
            openId: member.openId,
          },
        },
        create: {
          projectId: input.projectId,
          feishuChatId: input.feishuChatId,
          openId: member.openId,
          displayName: member.displayName,
          groupNickname: member.groupNickname,
          permissionLevel: member.openId === input.ownerOpenId ? 'admin' : 'member',
          isDecisionMaker: member.openId === input.ownerOpenId,
          isTaskAssignable: true,
          metadataJson: member.metadata as Prisma.InputJsonValue,
          lastActiveAt: member.openId === input.ownerOpenId ? new Date() : null,
        },
        update: {
          displayName: member.displayName,
          groupNickname: member.groupNickname,
          metadataJson: member.metadata as Prisma.InputJsonValue,
          ...(member.openId === input.ownerOpenId
            ? {
                permissionLevel: 'admin',
                isDecisionMaker: true,
              }
            : {}),
        },
      }),
    );

    await this.prisma.$transaction(operations);
    return this.listByChat(input.feishuChatId);
  }

  async touchMemberActivity(input: {
    projectId: string;
    feishuChatId: string;
    openId: string;
    displayName?: string | null;
  }) {
    if (!input.openId?.trim()) {
      return null;
    }

    return this.prisma.projectMemberProfile.upsert({
      where: {
        projectId_feishuChatId_openId: {
          projectId: input.projectId,
          feishuChatId: input.feishuChatId,
          openId: input.openId,
        },
      },
      create: {
        projectId: input.projectId,
        feishuChatId: input.feishuChatId,
        openId: input.openId,
        displayName: input.displayName?.trim() || input.openId,
        groupNickname: input.displayName?.trim() || input.openId,
        permissionLevel: 'member',
        isDecisionMaker: false,
        isTaskAssignable: true,
        metadataJson: {} as Prisma.InputJsonValue,
        lastActiveAt: new Date(),
      },
      update: {
        lastActiveAt: new Date(),
        ...(input.displayName?.trim()
          ? {
              displayName: input.displayName.trim(),
              groupNickname: input.displayName.trim(),
            }
          : {}),
      },
    });
  }

  listByChat(feishuChatId: string) {
    return this.prisma.projectMemberProfile.findMany({
      where: { feishuChatId },
      orderBy: [{ isDecisionMaker: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async updateByChat(feishuChatId: string, profileId: string, input: {
    groupNickname?: string | null;
    projectRole?: string | null;
    responsibility?: string | null;
    permissionLevel?: string;
    isDecisionMaker?: boolean;
    isTaskAssignable?: boolean;
  }) {
    const current = await this.prisma.projectMemberProfile.findFirst({
      where: {
        id: profileId,
        feishuChatId,
      },
    });
    if (!current) {
      throw new NotFoundException('Member profile not found');
    }

    return this.prisma.projectMemberProfile.update({
      where: { id: current.id },
      data: {
        ...(input.groupNickname !== undefined ? { groupNickname: input.groupNickname } : {}),
        ...(input.projectRole !== undefined ? { projectRole: input.projectRole } : {}),
        ...(input.responsibility !== undefined ? { responsibility: input.responsibility } : {}),
        ...(input.permissionLevel !== undefined ? { permissionLevel: input.permissionLevel } : {}),
        ...(input.isDecisionMaker !== undefined ? { isDecisionMaker: input.isDecisionMaker } : {}),
        ...(input.isTaskAssignable !== undefined ? { isTaskAssignable: input.isTaskAssignable } : {}),
      },
    });
  }

  toSnapshots(profiles: Array<Awaited<ReturnType<ProjectMemberProfileService['listByChat']>>[number]>) {
    return profiles.map((profile) => ({
      id: profile.id,
      openId: profile.openId,
      displayName: profile.displayName,
      groupNickname: profile.groupNickname,
      projectRole: profile.projectRole,
      responsibility: profile.responsibility,
      permissionLevel: profile.permissionLevel,
      isDecisionMaker: profile.isDecisionMaker,
      isTaskAssignable: profile.isTaskAssignable,
      lastActiveAt: profile.lastActiveAt?.toISOString() ?? null,
    }));
  }
}
