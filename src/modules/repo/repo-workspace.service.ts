import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdirSync } from 'fs';
import * as path from 'path';
import { RepoWorkspacePaths } from './repo.types';

@Injectable()
export class RepoWorkspaceService {
  constructor(private readonly config: ConfigService) {}

  getRepoWorkspace(projectId: string, environmentId: string): RepoWorkspacePaths {
    const root = this.resolveMirrorRoot();
    const workspaceRoot = path.join(root, projectId, environmentId);
    const repoRoot = path.join(workspaceRoot, 'repo');
    const manifestPath = path.join(workspaceRoot, 'manifest.json');

    mkdirSync(workspaceRoot, { recursive: true });
    return { workspaceRoot, repoRoot, manifestPath };
  }

  private resolveMirrorRoot() {
    const configured = this.config.get<string>('REPO_MIRROR_ROOT')?.trim();
    const root = configured ? path.resolve(configured) : path.join(process.cwd(), '.runtime', 'repos');
    mkdirSync(root, { recursive: true });
    return root;
  }
}
