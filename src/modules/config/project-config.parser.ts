import { Injectable } from '@nestjs/common';
import {
  ProjectConfig,
  ProjectConfigProject,
  ProjectConfigEnvironment,
  ProjectConfigMember,
  ProjectConfigPolicy,
  ProjectConfigParseResult,
} from './config.types';

@Injectable()
export class MarkdownProjectConfigParser {
  parse(markdown: string): ProjectConfig {
    const sections = this.extractSections(markdown);
    return {
      project: this.parseProjectSection(sections['Project'] ?? ''),
      environment: this.parseEnvironmentSection(sections['Environment'] ?? ''),
      members: this.parseMembersSection(sections['Members'] ?? ''),
      policy: this.parsePolicySection(sections['Policy'] ?? ''),
      skills: this.parseSkillsSection(sections['Skills'] ?? ''),
      memory: sections['Memory'] ?? '',
    };
  }

  parseWithErrors(markdown: string): ProjectConfigParseResult {
    const rawSections = this.extractSections(markdown);
    const parseErrors: string[] = [];
    if (!rawSections['Project']) parseErrors.push('Missing Project section');
    if (!rawSections['Environment']) parseErrors.push('Missing Environment section');

    return {
      config: this.parse(markdown),
      rawSections,
      parseErrors,
    };
  }

  private extractSections(markdown: string): Record<string, string> {
    const result: Record<string, string> = {};
    const sectionRegex = /^##\s+(\w+)\n([\s\S]*?)(?=\n##\s+\w+|\n*$)/gm;
    let match;
    while ((match = sectionRegex.exec(markdown)) !== null) {
      result[match[1]] = match[2].trim();
    }
    return result;
  }

  private parseProjectSection(content: string): ProjectConfigProject {
    const nameMatch = content.match(/^-\s+Name:\s*(.+)$/m);
    const descMatch = content.match(/^-\s+Description:\s*(.+)$/m);
    const statusMatch = content.match(/^-\s+Status:\s*(.+)$/m);
    return {
      name: nameMatch?.[1]?.trim() ?? '',
      description: descMatch?.[1]?.trim(),
      status: (statusMatch?.[1]?.trim() as ProjectConfigProject['status']) ?? 'pending',
    };
  }

  private parseEnvironmentSection(content: string): ProjectConfigEnvironment {
    const nameMatch = content.match(/^-\s+Name:\s*(.+)$/m);
    const repoMatch = content.match(/^-\s+Repo URL:\s*(.+)$/m);
    const branchMatch = content.match(/^-\s+Branch:\s*(.+)$/m);
    const modelMatch = content.match(/^-\s+Model:\s*(.+)$/m);
    return {
      name: nameMatch?.[1]?.trim() ?? '默认主环境',
      repoUrl: repoMatch?.[1]?.trim(),
      repoBranch: branchMatch?.[1]?.trim(),
      modelName: modelMatch?.[1]?.trim(),
    };
  }

  private parseMembersSection(content: string): ProjectConfigMember[] {
    const members: ProjectConfigMember[] = [];
    const tableRowRegex = /^\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/gm;
    let match;
    while ((match = tableRowRegex.exec(content)) !== null) {
      if (match[1].trim().toLowerCase().includes('name') && match[2].trim().toLowerCase().includes('open')) {
        continue;
      }
      members.push({
        name: match[1].trim(),
        openId: match[2].trim(),
        role: match[3].trim(),
        responsibilities: match[4]?.trim(),
      });
    }
    return members;
  }

  private parsePolicySection(content: string): ProjectConfigPolicy {
    const enabledMatch = content.match(/^-\s+Enabled:\s*(true|false)$/m);
    const mentionOnlyMatch = content.match(/^-\s+Mention Only:\s*(true|false)$/m);
    const defaultEnvMatch = content.match(/^-\s+Default Environment:\s*(.+)$/m);
    return {
      enabled: enabledMatch?.[1]?.toLowerCase() === 'true',
      mentionOnly: mentionOnlyMatch?.[1]?.toLowerCase() === 'true',
      defaultEnvironmentId: defaultEnvMatch?.[1]?.trim(),
    };
  }

  private parseSkillsSection(content: string): string[] {
    const skills: string[] = [];
    const listItemRegex = /^-\s+(.+)$/gm;
    let match;
    while ((match = listItemRegex.exec(content)) !== null) {
      skills.push(match[1].trim());
    }
    return skills;
  }
}