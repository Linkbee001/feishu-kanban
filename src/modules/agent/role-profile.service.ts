import { Injectable } from '@nestjs/common';
import { AgentRole } from '@prisma/client';
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
  skills: string[];
  promptPreludeMd: string;
};

export const DEFAULT_MANAGER_SKILLS = [
  'requirement-analysis',
  'document-generate',
  'task-breakdown',
  'progress-summary',
] as const;

const DEFAULT_MANAGER_PROFILE: RoleProfileRecord = {
  agentRole: AgentRole.manager,
  agentsMd: [
    'You are the long-running manager for a Feishu project group.',
    'You are a group project administrator, not a generic chat assistant and not a backend workflow engine.',
    'Turn group requests, decisions, blockers, progress, and risks into project management outcomes.',
    'Formal knowledge belongs in Feishu docs, and formal follow-up items belong in the bound Feishu task board.',
    'Internal runtime todos are only your scratchpad and are not the source of truth for official project tasks.',
  ].join('\n'),
  soulMd: [
    'Work like a careful project operator with concise group-facing communication.',
    'Prefer verified project resources over guesswork, and never invent unverified facts.',
  ].join('\n'),
  userMdTemplate: [
    'Project: {{projectName}}',
    'Chat: {{feishuChatId}}',
    'Last sender: {{senderOpenId}}',
    'Role: {{agentRole}}',
  ].join('\n'),
  standingOrdersMd: [
    'Keep group replies short and user-facing.',
    'Use project-bound Feishu docs and task board as the formal source of truth when available.',
    'Analyze, design, or break down work before deciding whether a formal document or task output is necessary.',
    'Treat runtime todos as internal coordination state only.',
    'Do not fabricate external facts, repository state, or project knowledge that you did not verify.',
  ].join('\n'),
  skills: [...DEFAULT_MANAGER_SKILLS],
  promptPreludeMd:
    'Prioritize the bound project resources and current group policy before relying on recent chat context alone.',
};

@Injectable()
export class RoleProfileService {
  async compile(input: CompileInput): Promise<CompiledRoleProfile> {
    const role = input.agentRole ?? AgentRole.manager;
    const profile = this.getRoleProfile(role);
    const userMd = this.renderTemplate(profile.userMdTemplate, {
      projectName: input.projectName,
      feishuChatId: input.feishuChatId,
      senderOpenId: input.senderOpenId ?? '',
      agentRole: role,
    });
    const compiledContextFile = [
      '# AGENTS.md',
      '',
      profile.agentsMd,
      '',
      '## SOUL',
      profile.soulMd,
      '',
      '## USER',
      userMd,
      '',
      '## STANDING ORDERS',
      profile.standingOrdersMd,
      '',
      '## PRELUDE',
      profile.promptPreludeMd,
    ]
      .filter(Boolean)
      .join('\n');

    return {
      agentRole: role,
      agentsMd: profile.agentsMd,
      soulMd: profile.soulMd,
      userMd,
      standingOrdersMd: profile.standingOrdersMd,
      promptPreludeMd: profile.promptPreludeMd,
      skills: [...profile.skills],
      compiledContextFile,
    };
  }

  getRoleProfile(role: AgentRole) {
    if (role !== AgentRole.manager) {
      throw new Error(`Unsupported agent role: ${role}`);
    }
    return {
      ...DEFAULT_MANAGER_PROFILE,
      skills: [...DEFAULT_MANAGER_PROFILE.skills],
    };
  }

  private renderTemplate(template: string, variables: Record<string, string>) {
    return Object.entries(variables).reduce(
      (content, [key, value]) => content.replaceAll(`{{${key}}}`, value),
      template,
    );
  }
}
