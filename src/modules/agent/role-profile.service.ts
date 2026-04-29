import { Injectable } from '@nestjs/common';
import { AgentRole, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CompiledRoleProfile } from './agent.types';

type CompileInput = {
  projectId?: string | null;
  projectName: string;
  feishuChatId: string;
  senderOpenId?: string | null;
  agentRole?: AgentRole;
};

type RoleProfileRecord = {
  agentRole: AgentRole;
  agentsMd: string;
  soulMd: string;
  userMdTemplate: string;
  standingOrdersMd: string;
  skillsJson: unknown;
  promptPreludeMd: string;
};

@Injectable()
export class RoleProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async compile(input: CompileInput): Promise<CompiledRoleProfile> {
    const role = input.agentRole ?? AgentRole.manager;
    const base = await this.ensureBaseProfile(role);
    const override = input.projectId
      ? await this.prisma.projectAgentProfileOverride.findUnique({
          where: {
            projectId_agentRole: {
              projectId: input.projectId,
              agentRole: role,
            },
          },
        })
      : null;
    const merged = this.mergeProfile(base, override?.overrideJson);
    const userMd = this.renderTemplate(merged.userMdTemplate, {
      projectName: input.projectName,
      feishuChatId: input.feishuChatId,
      senderOpenId: input.senderOpenId ?? '',
      agentRole: role,
    });
    const compiledContextFile = [
      '# AGENTS.md',
      '',
      merged.agentsMd,
      '',
      '## SOUL',
      merged.soulMd,
      '',
      '## USER',
      userMd,
      '',
      '## STANDING ORDERS',
      merged.standingOrdersMd,
      '',
      '## PRELUDE',
      merged.promptPreludeMd,
    ]
      .filter(Boolean)
      .join('\n');

    return {
      agentRole: role,
      agentsMd: merged.agentsMd,
      soulMd: merged.soulMd,
      userMd,
      standingOrdersMd: merged.standingOrdersMd,
      promptPreludeMd: merged.promptPreludeMd,
      skills: this.normalizeSkills(merged.skillsJson),
      compiledContextFile,
    };
  }

  async getRoleProfile(role: AgentRole) {
    return this.ensureBaseProfile(role);
  }

  async updateRoleProfile(role: AgentRole, input: Partial<RoleProfileRecord>) {
    return this.prisma.agentRoleProfile.upsert({
      where: { agentRole: role },
      create: {
        agentRole: role,
        agentsMd: input.agentsMd ?? this.defaultAgentsMd(),
        soulMd: input.soulMd ?? this.defaultSoulMd(),
        userMdTemplate: input.userMdTemplate ?? this.defaultUserMdTemplate(),
        standingOrdersMd: input.standingOrdersMd ?? this.defaultStandingOrdersMd(),
        skillsJson: (input.skillsJson ?? this.defaultSkills()) as Prisma.InputJsonValue,
        promptPreludeMd: input.promptPreludeMd ?? this.defaultPromptPreludeMd(),
      },
      update: {
        ...(input.agentsMd !== undefined ? { agentsMd: input.agentsMd } : {}),
        ...(input.soulMd !== undefined ? { soulMd: input.soulMd } : {}),
        ...(input.userMdTemplate !== undefined ? { userMdTemplate: input.userMdTemplate } : {}),
        ...(input.standingOrdersMd !== undefined ? { standingOrdersMd: input.standingOrdersMd } : {}),
        ...(input.skillsJson !== undefined ? { skillsJson: input.skillsJson as Prisma.InputJsonValue } : {}),
        ...(input.promptPreludeMd !== undefined ? { promptPreludeMd: input.promptPreludeMd } : {}),
      },
    });
  }

  async getProjectOverride(projectId: string, role: AgentRole) {
    return this.prisma.projectAgentProfileOverride.findUnique({
      where: {
        projectId_agentRole: {
          projectId,
          agentRole: role,
        },
      },
    });
  }

  async updateProjectOverride(projectId: string, role: AgentRole, overrideJson: Record<string, unknown>) {
    return this.prisma.projectAgentProfileOverride.upsert({
      where: {
        projectId_agentRole: {
          projectId,
          agentRole: role,
        },
      },
      create: {
        projectId,
        agentRole: role,
        overrideJson: overrideJson as Prisma.InputJsonValue,
      },
      update: {
        overrideJson: overrideJson as Prisma.InputJsonValue,
      },
    });
  }

  private async ensureBaseProfile(role: AgentRole) {
    const existing = await this.prisma.agentRoleProfile.findUnique({
      where: { agentRole: role },
    });
    if (existing) {
      return existing;
    }

    return this.prisma.agentRoleProfile.create({
      data: {
        agentRole: role,
        agentsMd: this.defaultAgentsMd(),
        soulMd: this.defaultSoulMd(),
        userMdTemplate: this.defaultUserMdTemplate(),
        standingOrdersMd: this.defaultStandingOrdersMd(),
        skillsJson: this.defaultSkills() as Prisma.InputJsonValue,
        promptPreludeMd: this.defaultPromptPreludeMd(),
      },
    });
  }

  private mergeProfile(base: RoleProfileRecord, overrideJson: unknown): RoleProfileRecord {
    const override =
      overrideJson && typeof overrideJson === 'object' && !Array.isArray(overrideJson)
        ? (overrideJson as Record<string, unknown>)
        : {};
    return {
      agentRole: base.agentRole,
      agentsMd: typeof override.agentsMd === 'string' ? override.agentsMd : base.agentsMd,
      soulMd: typeof override.soulMd === 'string' ? override.soulMd : base.soulMd,
      userMdTemplate: typeof override.userMdTemplate === 'string' ? override.userMdTemplate : base.userMdTemplate,
      standingOrdersMd:
        typeof override.standingOrdersMd === 'string' ? override.standingOrdersMd : base.standingOrdersMd,
      skillsJson: override.skillsJson ?? base.skillsJson,
      promptPreludeMd: typeof override.promptPreludeMd === 'string' ? override.promptPreludeMd : base.promptPreludeMd,
    };
  }

  private normalizeSkills(value: unknown) {
    if (!Array.isArray(value)) {
      return this.defaultSkills();
    }
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  private renderTemplate(template: string, variables: Record<string, string>) {
    return Object.entries(variables).reduce(
      (content, [key, value]) => content.replaceAll(`{{${key}}}`, value),
      template,
    );
  }

  private defaultAgentsMd() {
    return [
      'You are the long-running manager runtime for a Feishu project workspace.',
      'Classify @bot messages into internal tasks, maintain the persisted todo queue, and execute one task at a time.',
      'Do not assume internal todos are the same as the official project task board.',
    ].join('\n');
  }

  private defaultSoulMd() {
    return [
      'Work like a careful project operator.',
      'Stay concise in group replies and explicit about blockers, assumptions, and requested confirmations.',
    ].join('\n');
  }

  private defaultUserMdTemplate() {
    return [
      'Project: {{projectName}}',
      'Chat: {{feishuChatId}}',
      'Last sender: {{senderOpenId}}',
      'Role: {{agentRole}}',
    ].join('\n');
  }

  private defaultStandingOrdersMd() {
    return [
      'Only respond to explicit @bot messages in the bound project group.',
      'Extract actionable work into persisted todos before doing execution.',
      'Keep at most one todo in running state.',
      'If human confirmation is required, stop the running todo in waiting_confirmation and ask through the confirmation tool.',
      'Use Feishu read tools on demand; do not assume remote documents are mirrored locally.',
    ].join('\n');
  }

  private defaultPromptPreludeMd() {
    return 'You may inspect the local repo mirror when it is ready. Otherwise, say code context is currently unavailable.';
  }

  private defaultSkills() {
    return ['requirement-analysis', 'task-breakdown', 'code-analysis', 'document-generate', 'progress-summary'];
  }
}
