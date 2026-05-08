import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AgentRole, GroupSessionMode } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FeishuService } from '../feishu/feishu.service';
import { GroupAgentSessionService } from '../agent/group-agent-session.service';
import { ProjectService } from '../project/project.service';
import { MarkdownProjectConfigParser } from './project-config.parser';

@Injectable()
export class GroupConfigService {
  private readonly logger = new Logger(GroupConfigService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly feishu: FeishuService,
    private readonly groupSessions: GroupAgentSessionService,
    private readonly projects: ProjectService,
    private readonly parser: MarkdownProjectConfigParser,
  ) {}

  /**
   * Sync group metadata and create pending config session.
   * Per D-05: Manual trigger only for this phase.
   */
  async syncGroupInfo(input: { feishuChatId: string }): Promise<{ sessionId: string; sessionMode: string }> {
    const session = await this.groupSessions.getOrCreateSession(input.feishuChatId, {
      feishuChatId: input.feishuChatId,
      sessionMode: GroupSessionMode.pending_config,
    });
    return {
      sessionId: session.id,
      sessionMode: session.sessionMode,
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
}