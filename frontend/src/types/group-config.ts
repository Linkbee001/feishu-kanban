/**
 * Group Config TypeScript types
 */

export interface GroupMember {
  openId: string;
  name: string;
  isAdmin: boolean;
}

export interface GroupInfo {
  chatId: string;
  chatName: string;
  members: GroupMember[];
  ownerOpenId: string;
  memberCount: number;
}

export interface GroupConfigForm {
  chatId: string;
  projectName: string;
  description: string;
  repoUrl: string;
  repoBranch: string;
  modelName: string;
  mentionOnly: boolean;
  allowedSkills: string[];
  enabled: boolean;
}

export interface GroupConfig {
  chatId: string;
  name: string;
  projectId?: string;
  customPrompt?: string;
  isActive: boolean;
}

export interface GroupConfigFormData {
  projectId: string;
  customPrompt: string;
  isActive: boolean;
}

export type SyncState = 'idle' | 'syncing' | 'success' | 'error';

// New types for full config response (drawer)

export interface PendingConfigState {
  sessionMode: 'pending_config';
  chatId: string;
  chatName?: string;
  ownerOpenId?: string;
  memberCount?: number;
}

export interface ActiveConfigState {
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

export interface BootstrapConfigState {
  sessionMode: 'bootstrap';
  chatId: string;
}

export type GroupFullConfig = PendingConfigState | ActiveConfigState | BootstrapConfigState;

// Request types

export interface InitializeProjectRequest {
  projectName: string;
  description?: string;
  repoUrl?: string;
  repoBranch?: string;
  modelName?: string;
  ownerOpenId: string;
}

export interface UpdateConfigRequest {
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
