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

export type SyncState = 'idle' | 'syncing' | 'success' | 'error';
