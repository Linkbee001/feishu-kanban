import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ProjectStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GroupAgentSessionService } from '../agent/group-agent-session.service';
import { EnvironmentService } from '../environment/environment.service';
import { FeishuService } from '../feishu/feishu.service';
import { GroupPolicyService } from './group-policy.service';
import { ProjectMemberProfileService } from './project-member-profile.service';

@Injectable()
export class ProjectService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly groupSessions: GroupAgentSessionService,
    private readonly environments: EnvironmentService,
    private readonly feishu: FeishuService,
    private readonly policies: GroupPolicyService,
    private readonly memberProfiles: ProjectMemberProfileService,
  ) {}

  async initFromChat(input: {
    name: string;
    description?: string;
    ownerOpenId: string;
    feishuChatId: string;
    createdBy?: string;
    repoUrl?: string;
    repoBranch?: string;
    repoCredentialRef?: string;
    modelEndpoint?: string;
    modelName?: string;
    members?: Array<{
      openId: string;
      displayName: string;
      groupNickname?: string | null;
      metadata?: Record<string, unknown>;
    }>;
  }) {
    const normalized = {
      ...input,
      name: input.name?.trim(),
      description: input.description?.trim(),
      ownerOpenId: input.ownerOpenId?.trim(),
      feishuChatId: input.feishuChatId?.trim(),
      createdBy: input.createdBy?.trim(),
      repoUrl: input.repoUrl?.trim(),
      repoBranch: input.repoBranch?.trim(),
      repoCredentialRef: input.repoCredentialRef?.trim(),
      modelEndpoint: input.modelEndpoint?.trim(),
      modelName: input.modelName?.trim(),
      members: input.members ?? [],
    };

    if (!normalized.name) throw new BadRequestException('Project name is required');
    if (!normalized.ownerOpenId) throw new BadRequestException('ownerOpenId is required');
    if (!normalized.feishuChatId) throw new BadRequestException('feishuChatId is required');

    const existing = await this.prisma.project.findUnique({
      where: { feishuChatId: normalized.feishuChatId },
    });
    if (existing) throw new BadRequestException('This Feishu chat is already bound to a project');

    const folder = await this.feishu.createProjectFolder(normalized.name);
    const bitable = await this.feishu.createTaskBitable(normalized.name);
    await this.feishu.grantDrivePermission(folder.token, 'folder', normalized.ownerOpenId).catch(() => null);
    await this.feishu.grantDrivePermission(bitable.appToken, 'bitable', normalized.ownerOpenId).catch(() => null);

    const project = await this.prisma.project.create({
      data: {
        name: normalized.name,
        description: normalized.description,
        ownerOpenId: normalized.ownerOpenId,
        feishuChatId: normalized.feishuChatId,
        status: ProjectStatus.initializing,
        docFolderToken: folder.token,
        bitableAppToken: bitable.appToken,
        bitableTableId: bitable.tableId,
        defaultSkillSet: {},
        createdBy: normalized.createdBy ?? normalized.ownerOpenId,
      },
    });

    const environment = await this.environments.create(project.id, {
      name: '默认主环境',
      type: 'default',
      repoUrl: normalized.repoUrl,
      repoBranch: normalized.repoBranch ?? 'main',
      repoCredentialRef: normalized.repoCredentialRef,
      modelEndpoint: normalized.modelEndpoint,
      modelName: normalized.modelName,
      createdBy: normalized.createdBy ?? normalized.ownerOpenId,
      setDefault: true,
    });

    const updatedProject = await this.prisma.project.update({
      where: { id: project.id },
      data: {
        status: ProjectStatus.active,
        defaultEnvironmentId: environment.id,
      },
      include: { environments: true },
    });

    const result = {
      ...updatedProject,
      docFolderUrl: folder.url ?? this.feishu.folderUrl(folder.token),
      bitableUrl: bitable.url ?? this.feishu.bitableUrl(bitable.appToken, bitable.tableId),
    };

    await this.groupSessions.bindProjectSession({
      feishuChatId: normalized.feishuChatId,
      projectId: updatedProject.id,
      environmentId: environment.id,
    });

    await this.policies.ensureDefaultPolicy({
      projectId: updatedProject.id,
      feishuChatId: normalized.feishuChatId,
      defaultEnvironmentId: environment.id,
    });

    await this.memberProfiles.syncChatMembers({
      projectId: updatedProject.id,
      feishuChatId: normalized.feishuChatId,
      ownerOpenId: normalized.ownerOpenId,
      members: normalized.members,
    });

    await this.createWorkspaceSkeleton({
      projectName: normalized.name,
      projectDescription: normalized.description,
      docFolderToken: folder.token,
      repoUrl: environment.repoUrl,
      repoBranch: environment.repoBranch,
      modelName: environment.modelName,
    });

    const createdTabs = await this.feishu
      .createChatTabs(normalized.feishuChatId, [
        {
          tabName: '项目文档',
          url: result.docFolderUrl,
        },
        {
          tabName: '任务看板',
          url: result.bitableUrl,
        },
      ])
      .catch(() => null);

    const docTab = createdTabs?.tabs.find((tab) => tab.name === '项目文档' || tab.url === result.docFolderUrl);
    const bitableTab = createdTabs?.tabs.find((tab) => tab.name === '任务看板' || tab.url === result.bitableUrl);

    const projectWithTabs = await this.prisma.project.update({
      where: { id: updatedProject.id },
      data: {
        docChatTabId: docTab?.id ?? null,
        bitableChatTabId: bitableTab?.id ?? null,
      },
      include: { environments: true },
    });

    await this.feishu
      .sendTextMessage(
        'chat_id',
        normalized.feishuChatId,
        [
          `项目已初始化：${normalized.name}`,
          `项目文档：${result.docFolderUrl}`,
          `任务多维表：${result.bitableUrl}`,
          `默认环境：${environment.name}`,
          `仓库：${environment.repoUrl ?? '未配置'}`,
          `分支：${environment.repoBranch ?? 'main'}`,
        ].join('\n'),
      )
      .catch(() => null);

    return {
      ...result,
      docChatTabId: projectWithTabs.docChatTabId,
      bitableChatTabId: projectWithTabs.bitableChatTabId,
    };
  }

  async findById(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: { environments: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async findByChat(feishuChatId: string) {
    const project = await this.prisma.project.findUnique({
      where: { feishuChatId },
      include: { environments: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  listAvailableForUser(openId: string) {
    return this.prisma.project.findMany({
      where: {
        status: ProjectStatus.active,
        OR: [{ ownerOpenId: openId }, { createdBy: openId }],
      },
      include: { environments: true },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });
  }

  async cleanupByChat(feishuChatId: string) {
    const chatId = feishuChatId.trim();
    const project = await this.prisma.project.findUnique({
      where: { feishuChatId: chatId },
      include: { environments: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    const cleanup = {
      folderDeleted: false,
      bitableTableDeleted: false,
      bitableDeleted: false,
      tabsDeleted: 0,
      tabsMatched: 0,
      tabsError: null as string | null,
      folderError: null as string | null,
      bitableTableError: null as string | null,
      bitableError: null as string | null,
    };

    try {
      const removedTabs = await this.feishu.removeProjectChatTabs(chatId, {
        tabIds: [project.docChatTabId, project.bitableChatTabId].filter(Boolean) as string[],
        names: ['项目文档', '任务看板'],
        urls: [
          project.docFolderToken ? this.feishu.folderUrl(project.docFolderToken) : '',
          project.bitableAppToken ? this.feishu.bitableUrl(project.bitableAppToken, project.bitableTableId ?? undefined) : '',
        ],
      });
      cleanup.tabsDeleted = removedTabs.deleted;
      cleanup.tabsMatched = removedTabs.matched;
    } catch (error) {
      cleanup.tabsError = error instanceof Error ? error.message : String(error);
    }

    if (project.docFolderToken) {
      try {
        await this.feishu.deleteDriveFile(project.docFolderToken, 'folder');
        cleanup.folderDeleted = true;
      } catch (error) {
        cleanup.folderError = error instanceof Error ? error.message : String(error);
      }
    }

    if (project.bitableAppToken && project.bitableTableId) {
      try {
        await this.feishu.deleteBitableTable(project.bitableAppToken, project.bitableTableId);
        cleanup.bitableTableDeleted = true;
      } catch (error) {
        cleanup.bitableTableError = error instanceof Error ? error.message : String(error);
      }
    }

    if (project.bitableAppToken) {
      try {
        await this.feishu.deleteDriveFile(project.bitableAppToken, 'bitable');
        cleanup.bitableDeleted = true;
      } catch (error) {
        cleanup.bitableError = error instanceof Error ? error.message : String(error);
      }
    }

    await this.prisma.conversationContext.deleteMany({
      where: {
        feishuChatId: chatId,
        sourceType: 'group',
      },
    });
    await this.groupSessions.disableByChat(chatId);

    const archivedChatId = `cleaned:${chatId}:${Date.now()}`;
    const updatedProject = await this.prisma.project.update({
      where: { id: project.id },
      data: {
        feishuChatId: archivedChatId,
        status: ProjectStatus.closed,
        docFolderToken: null,
        bitableAppToken: null,
        bitableTableId: null,
        docChatTabId: null,
        bitableChatTabId: null,
      },
      include: { environments: true },
    });

    return {
      ...updatedProject,
      originalFeishuChatId: chatId,
      archivedFeishuChatId: archivedChatId,
      cleanup,
      message: 'Feishu resources cleaned and chat binding archived. You can initialize this chat again now.',
    };
  }

  async unbindByChat(feishuChatId: string) {
    const chatId = feishuChatId.trim();
    const project = await this.prisma.project.findUnique({ where: { feishuChatId: chatId } });
    if (!project) throw new NotFoundException('Project not found');

    const tabCleanup = {
      tabsDeleted: 0,
      tabsMatched: 0,
      tabsError: null as string | null,
    };

    try {
      const removedTabs = await this.feishu.removeProjectChatTabs(chatId, {
        tabIds: [project.docChatTabId, project.bitableChatTabId].filter(Boolean) as string[],
        names: ['项目文档', '任务看板'],
        urls: [
          project.docFolderToken ? this.feishu.folderUrl(project.docFolderToken) : '',
          project.bitableAppToken ? this.feishu.bitableUrl(project.bitableAppToken, project.bitableTableId ?? undefined) : '',
        ],
      });
      tabCleanup.tabsDeleted = removedTabs.deleted;
      tabCleanup.tabsMatched = removedTabs.matched;
    } catch (error) {
      tabCleanup.tabsError = error instanceof Error ? error.message : String(error);
    }

    const archivedChatId = `unbound:${chatId}:${Date.now()}`;
    await this.prisma.conversationContext.deleteMany({
      where: {
        feishuChatId: chatId,
        sourceType: 'group',
      },
    });
    await this.groupSessions.disableByChat(chatId);

    const updatedProject = await this.prisma.project.update({
      where: { id: project.id },
      data: {
        feishuChatId: archivedChatId,
        status: ProjectStatus.closed,
        docChatTabId: null,
        bitableChatTabId: null,
      },
      include: { environments: true },
    });

    return {
      ...updatedProject,
      originalFeishuChatId: chatId,
      archivedFeishuChatId: archivedChatId,
      cleanup: tabCleanup,
      message: 'Chat binding removed. You can re-run init-from-chat for this Feishu group now.',
    };
  }

  async update(id: string, data: { name?: string; description?: string; status?: ProjectStatus }) {
    await this.findById(id);
    return this.prisma.project.update({ where: { id }, data });
  }

  async archive(id: string) {
    await this.findById(id);
    return this.prisma.project.update({
      where: { id },
      data: { status: ProjectStatus.closed },
    });
  }

  private async createWorkspaceSkeleton(input: {
    projectName: string;
    projectDescription?: string;
    docFolderToken?: string | null;
    repoUrl?: string | null;
    repoBranch?: string | null;
    modelName?: string | null;
  }) {
    const docs = [
      {
        title: 'PROJECT.md',
        content: [
          `# ${input.projectName}`,
          '',
          input.projectDescription ?? '待补充项目描述。',
          '',
          '## 当前目标',
          '- 明确项目范围、阶段目标与近期交付。',
        ].join('\n'),
      },
      {
        title: 'MEMBERS.md',
        content: ['# Members', '', '待补充成员角色、职责与决策分工。'].join('\n'),
      },
      {
        title: 'RULES.md',
        content: ['# Rules', '', '- 高风险动作默认先确认。', '- 机器人默认只响应群内 @ 消息。'].join('\n'),
      },
      {
        title: 'MEMORY.md',
        content: ['# Memory', '', '记录长期有效的项目背景、约束与重要决定。'].join('\n'),
      },
      {
        title: 'SKILLS.md',
        content: ['# Skills', '', '列出当前允许机器人使用的主要技能与适用场景。'].join('\n'),
      },
      {
        title: 'ENV.md',
        content: [
          '# Environment',
          '',
          `- Repo: ${input.repoUrl ?? '未配置'}`,
          `- Branch: ${input.repoBranch ?? 'main'}`,
          `- Model: ${input.modelName ?? '未配置'}`,
        ].join('\n'),
      },
      {
        title: 'TASKS.md',
        content: ['# Tasks', '', '记录正式任务板之外的治理说明和任务同步约定。'].join('\n'),
      },
    ];

    for (const doc of docs) {
      await this.feishu.createDocument(doc.title, input.docFolderToken ?? undefined, doc.content).catch(() => null);
    }
  }
}
