import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AgentRole, GroupSessionMode } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FeishuService } from '../feishu/feishu.service';
import { GroupAgentSessionService } from '../agent/group-agent-session.service';
import { GroupPolicyService } from '../project/group-policy.service';
import { ProjectService } from '../project/project.service';
import { MarkdownProjectConfigParser } from './project-config.parser';

interface PendingConfigResponse {
  sessionMode: 'pending_config';
  chatId: string;
  chatName?: string;
  ownerOpenId?: string;
  memberCount?: number;
}

interface ActiveConfigResponse {
  sessionMode: 'active';
  chatId: string;
  projectId: string;
  projectName: string;
  projectDescription?: string;
  customPrompt?: string;
  policy: {
    enabled: boolean;
    mentionOnly: boolean;
    defaultQueueMode: string;
    allowedSkills: string[];
  };
  environment: {
    repoUrl?: string;
    repoBranch?: string;
    modelName?: string;
  };
}

interface BootstrapConfigResponse {
  sessionMode: 'bootstrap';
  chatId: string;
}

export type GroupFullConfigResponse = PendingConfigResponse | ActiveConfigResponse | BootstrapConfigResponse;

interface UpdateGroupConfigRequest {
  projectName?: string;
  projectDescription?: string;
  customPrompt?: string;
  policy?: Partial<{
    enabled: boolean;
    mentionOnly: boolean;
  }>;
  environment?: Partial<{
    repoUrl: string;
    repoBranch: string;
    modelName: string;
  }>;
}

@Injectable()
export class GroupConfigService {
  private readonly logger = new Logger(GroupConfigService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly feishu: FeishuService,
    private readonly groupSessions: GroupAgentSessionService,
    private readonly policies: GroupPolicyService,
    private readonly projects: ProjectService,
    private readonly parser: MarkdownProjectConfigParser,
  ) {}

  /**
   * Sync group metadata and create pending config session.
   * Per D-03: Returns group info from Feishu API for UI auto-fill.
   */
  async syncGroupInfo(input: { feishuChatId: string }): Promise<{
    chatId: string;
    chatName: string;
    members: Array<{ openId: string; name: string; isAdmin: boolean }>;
    ownerOpenId: string;
    memberCount: number;
  }> {
    // Fetch chat info and members from Feishu
    const [chatInfo, feishuMembers] = await Promise.all([
      this.feishu.getChatInfo(input.feishuChatId),
      this.feishu.listChatMembers(input.feishuChatId),
    ]);

    // Transform members to expected format
    const members = feishuMembers.map(m => ({
      openId: m.openId,
      name: m.displayName,
      isAdmin: false, // Feishu API doesn't provide this directly
    }));

    // Use first member as owner (since we can't determine admin from basic member list)
    const owner = members[0];

    // Validate that we have at least one member
    if (!owner) {
      throw new BadRequestException('群成员列表为空，无法确定群管理员');
    }

    // Create or get session
    await this.groupSessions.getOrCreateSession(input.feishuChatId, {
      feishuChatId: input.feishuChatId,
      sessionMode: GroupSessionMode.pending_config,
    });

    return {
      chatId: input.feishuChatId,
      chatName: chatInfo.name || input.feishuChatId,
      members,
      ownerOpenId: owner?.openId || '',
      memberCount: members.length,
    };
  }

  /**
   * Complete configuration by creating PROJECT-CONFIG.md and initializing project.
   * Per D-03: Called via /api/group-config/:chatId/complete endpoint.
   */
  async completeConfig(input: {
    feishuChatId: string;
    ownerOpenId: string;
    configMarkdown: string;
  }): Promise<{
    projectId: string;
    environmentId: string | null;
    configDocToken: string;
    configDocUrl: string;
  }> {
    const session = await this.prisma.groupAgentSession.findUnique({
      where: {
        feishuChatId_agentRole: {
          feishuChatId: input.feishuChatId,
          agentRole: AgentRole.manager,
        },
      },
    });
    if (!session || session.sessionMode !== GroupSessionMode.pending_config) {
      throw new BadRequestException('Session not in pending_config mode');
    }

    const parsed = this.parser.parseWithErrors(input.configMarkdown);
    if (parsed.parseErrors.length > 0) {
      throw new BadRequestException(`Config parse errors: ${parsed.parseErrors.join(', ')}`);
    }

    const folder = await this.feishu.createProjectFolder(parsed.config.project.name);

    const doc = await this.feishu.createDocument(
      'PROJECT-CONFIG.md',
      folder.token,
      input.configMarkdown,
    );

    const members = await this.feishu.listChatMembers(input.feishuChatId).catch(() => []);
    const project = await this.projects.initFromChat({
      name: parsed.config.project.name,
      description: parsed.config.project.description,
      ownerOpenId: input.ownerOpenId,
      feishuChatId: input.feishuChatId,
      createdBy: input.ownerOpenId,
      repoUrl: parsed.config.environment.repoUrl,
      repoBranch: parsed.config.environment.repoBranch,
      modelName: parsed.config.environment.modelName,
      members,
    });

    await this.prisma.project.update({
      where: { id: project.id },
      data: { configDocToken: doc.token },
    });

    await this.groupSessions.bindProjectSession({
      sessionId: session.id,
      feishuChatId: input.feishuChatId,
      projectId: project.id,
      environmentId: project.defaultEnvironmentId,
    });

    return {
      projectId: project.id,
      environmentId: project.defaultEnvironmentId,
      configDocToken: doc.token,
      configDocUrl: doc.url ?? this.feishu.documentUrl(doc.token),
    };
  }

  /**
   * Update existing PROJECT-CONFIG.md content.
   * Reads current config, merges updates, writes back.
   */
  async updateConfig(input: {
    feishuChatId: string;
    updates: Partial<{
      project: { name?: string; description?: string; status?: string };
      environment: { repoUrl?: string; repoBranch?: string; modelName?: string };
      policy: { enabled?: boolean; mentionOnly?: boolean };
      skills: string[];
      memory: string;
    }>;
  }): Promise<{ configDocToken: string; configDocUrl: string }> {
    const project = await this.prisma.project.findFirst({
      where: { feishuChatId: input.feishuChatId },
      select: { docFolderToken: true, configDocToken: true },
    });
    if (!project?.configDocToken) {
      throw new NotFoundException('Project or config document not found');
    }

    this.logger.warn('updateConfig not fully implemented - deferred to future phase');
    throw new BadRequestException('updateConfig not implemented in this phase');
  }

  /**
   * Get current config status for a chat.
   */
  async getConfigStatus(feishuChatId: string): Promise<{
    sessionMode: string;
    hasProject: boolean;
    projectId?: string;
  }> {
    const session = await this.prisma.groupAgentSession.findUnique({
      where: {
        feishuChatId_agentRole: {
          feishuChatId,
          agentRole: AgentRole.manager,
        },
      },
      select: { sessionMode: true, projectId: true },
    });
    return {
      sessionMode: session?.sessionMode ?? 'bootstrap',
      hasProject: Boolean(session?.projectId),
      projectId: session?.projectId ?? undefined,
    };
  }

  /**
   * Get full config data for drawer UI.
   * Returns different data based on session mode.
   */
  async getFullConfig(feishuChatId: string): Promise<GroupFullConfigResponse> {
    const session = await this.prisma.groupAgentSession.findUnique({
      where: {
        feishuChatId_agentRole: {
          feishuChatId,
          agentRole: AgentRole.manager,
        },
      },
      include: {
        project: {
          include: {
            environments: {
              where: { type: 'default' },
              take: 1,
            },
          },
        },
      },
    });

    if (!session) {
      return { sessionMode: 'bootstrap', chatId: feishuChatId };
    }

    if (session.sessionMode === GroupSessionMode.pending_config) {
      // Try to get cached group info from sessionState
      const state = this.readSessionState(session.sessionState);
      return {
        sessionMode: 'pending_config',
        chatId: feishuChatId,
        chatName: state.botBinding?.botName,
      };
    }

    if (session.sessionMode === GroupSessionMode.bootstrap) {
      return { sessionMode: 'bootstrap', chatId: feishuChatId };
    }

    // Active session - return full config
    const policy = await this.policies.findByChat(feishuChatId);
    const env = session.project?.environments?.[0];

    return {
      sessionMode: 'active',
      chatId: feishuChatId,
      projectId: session.projectId!,
      projectName: session.project?.name ?? '',
      projectDescription: session.project?.description ?? undefined,
      customPrompt: session.customPrompt ?? undefined,
      policy: {
        enabled: policy?.enabled ?? true,
        mentionOnly: policy?.mentionOnly ?? true,
        defaultQueueMode: policy?.defaultQueueMode ?? 'collect',
        allowedSkills: policy?.allowedSkillsJson as string[] ?? [],
      },
      environment: {
        repoUrl: env?.repoUrl ?? undefined,
        repoBranch: env?.repoBranch ?? undefined,
        modelName: env?.modelName ?? undefined,
      },
    };
  }

  /**
   * Update config for active groups.
   * Updates project name, description, customPrompt, policy, and environment settings.
   */
  async updateActiveConfig(feishuChatId: string, updates: UpdateGroupConfigRequest): Promise<void> {
    const session = await this.prisma.groupAgentSession.findUnique({
      where: {
        feishuChatId_agentRole: { feishuChatId, agentRole: AgentRole.manager },
      },
      include: { project: { include: { environments: { where: { type: 'default' } } } } },
    });

    if (!session || session.sessionMode !== GroupSessionMode.active) {
      throw new BadRequestException('Cannot update config for non-active session');
    }

    // Update customPrompt in session
    if (updates.customPrompt !== undefined) {
      await this.prisma.groupAgentSession.update({
        where: { id: session.id },
        data: { customPrompt: updates.customPrompt },
      });
    }

    // Update project name/description
    if (updates.projectName !== undefined || updates.projectDescription !== undefined) {
      await this.prisma.project.update({
        where: { id: session.projectId! },
        data: {
          ...(updates.projectName ? { name: updates.projectName } : {}),
          ...(updates.projectDescription ? { description: updates.projectDescription } : {}),
        },
      });
    }

    // Update policy
    if (updates.policy) {
      await this.policies.updateByChat(feishuChatId, updates.policy);
    }

    // Update environment (repo settings)
    if (updates.environment && session.project?.defaultEnvironmentId) {
      await this.prisma.projectEnvironment.update({
        where: { id: session.project.defaultEnvironmentId },
        data: {
          ...(updates.environment.repoUrl ? { repoUrl: updates.environment.repoUrl } : {}),
          ...(updates.environment.repoBranch ? { repoBranch: updates.environment.repoBranch } : {}),
          ...(updates.environment.modelName ? { modelName: updates.environment.modelName } : {}),
        },
      });
    }
  }

  private readSessionState(sessionState: any): { botBinding?: { botName?: string; botOpenId?: string } } {
    if (!sessionState) return {};
    try {
      return sessionState as { botBinding?: { botName?: string; botOpenId?: string } };
    } catch {
      return {};
    }
  }
}