// src/modules/config/config.types.ts
// Configuration type definitions for PROJECT-CONFIG.md parsing

export interface ProjectConfigProject {
  name: string;
  description?: string;
  status: 'active' | 'initializing' | 'pending';
}

export interface ProjectConfigEnvironment {
  name: string;
  repoUrl?: string;
  repoBranch?: string;
  modelName?: string;
}

export interface ProjectConfigMember {
  name: string;
  openId: string;
  role: string;
  responsibilities?: string;
}

export interface ProjectConfigPolicy {
  enabled: boolean;
  mentionOnly: boolean;
  defaultEnvironmentId?: string;
}

export interface ProjectConfig {
  project: ProjectConfigProject;
  environment: ProjectConfigEnvironment;
  members: ProjectConfigMember[];
  policy: ProjectConfigPolicy;
  skills: string[];
  memory: string;
}

export interface ProjectConfigParser {
  parse(markdown: string): ProjectConfig;
}

export interface ProjectConfigParseResult {
  config: ProjectConfig;
  rawSections: Record<string, string>;
  parseErrors: string[];
}