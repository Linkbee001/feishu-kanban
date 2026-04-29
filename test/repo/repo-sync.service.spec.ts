import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { RepoSyncStatus } from '@prisma/client';
import { RepoSyncService } from '../../src/modules/repo/repo-sync.service';

describe('RepoSyncService', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length) {
      rmSync(tempDirs.pop()!, { recursive: true, force: true });
    }
  });

  function tempDir(prefix: string) {
    const dir = mkdtempSync(path.join(os.tmpdir(), prefix));
    tempDirs.push(dir);
    return dir;
  }

  function git(cwd: string, args: string[]) {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    }).trim();
  }

  function createService(mirrorRoot: string, updates: any[] = []) {
    const prisma = {
      projectEnvironment: {
        update: jest.fn().mockImplementation(async (input: any) => {
          updates.push(input);
          return input.data;
        }),
      },
    };
    const config = {
      get: jest.fn((key: string) => {
        const values: Record<string, unknown> = {
          REPO_MIRROR_ROOT: mirrorRoot,
          REPO_SECRET_MAP_JSON: '{}',
          REPO_SYNC_TTL_SECONDS: 300,
        };
        return values[key];
      }),
    };
    const workspace = {
      getRepoWorkspace: jest.fn((projectId: string, environmentId: string) => {
        const workspaceRoot = path.join(mirrorRoot, projectId, environmentId);
        return {
          workspaceRoot,
          repoRoot: path.join(workspaceRoot, 'repo'),
          manifestPath: path.join(workspaceRoot, 'manifest.json'),
        };
      }),
    };
    const credentials = {
      resolveSecret: jest.fn().mockReturnValue(null),
    };

    return {
      service: new RepoSyncService(config as any, prisma as any, workspace as any, credentials as any),
      prisma,
      workspace,
      credentials,
    };
  }

  function createOriginRepo() {
    const repoDir = tempDir('repo-origin-');
    git(repoDir, ['init', '--initial-branch=main']);
    git(repoDir, ['config', 'user.email', 'repo@test.local']);
    git(repoDir, ['config', 'user.name', 'Repo Test']);
    writeFileSync(path.join(repoDir, 'README.md'), '# hello\n', 'utf8');
    git(repoDir, ['add', 'README.md']);
    git(repoDir, ['commit', '-m', 'init']);
    return repoDir;
  }

  it('clones a repo, records manifest data, and updates environment sync state', async () => {
    const mirrorRoot = tempDir('repo-mirror-');
    const origin = createOriginRepo();
    const updates: any[] = [];
    const { service, workspace } = createService(mirrorRoot, updates);

    const result = await service.ensureRepoFresh({
      projectId: 'project_1',
      environmentId: 'env_1',
      repoUrl: origin,
      repoBranch: 'main',
    });

    const { manifestPath, repoRoot } = workspace.getRepoWorkspace('project_1', 'env_1');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

    expect(result.status).toBe(RepoSyncStatus.ready);
    expect(result.synced).toBe(true);
    expect(manifest.repoRoot).toBe(repoRoot);
    expect(manifest.repoBranch).toBe('main');
    expect(manifest.status).toBe(RepoSyncStatus.ready);
    expect(updates.some((item) => item.data.repoSyncStatus === RepoSyncStatus.ready)).toBe(true);
  });

  it('fetches an existing mirror and advances the checked out head', async () => {
    const mirrorRoot = tempDir('repo-mirror-');
    const origin = createOriginRepo();
    const { service, workspace } = createService(mirrorRoot);

    await service.ensureRepoFresh({
      projectId: 'project_1',
      environmentId: 'env_1',
      repoUrl: origin,
      repoBranch: 'main',
    });
    writeFileSync(path.join(origin, 'CHANGELOG.md'), 'v2\n', 'utf8');
    git(origin, ['add', 'CHANGELOG.md']);
    git(origin, ['commit', '-m', 'second']);
    const expectedHead = git(origin, ['rev-parse', 'HEAD']);

    const result = await service.ensureRepoFresh({
      projectId: 'project_1',
      environmentId: 'env_1',
      repoUrl: origin,
      repoBranch: 'main',
    });

    const { repoRoot } = workspace.getRepoWorkspace('project_1', 'env_1');
    const mirrorHead = git(repoRoot, ['rev-parse', 'HEAD']);
    expect(result.headRef).toBe(expectedHead);
    expect(mirrorHead).toBe(expectedHead);
  });

  it('marks sync as error without deleting the previous mirror when fetch fails', async () => {
    const mirrorRoot = tempDir('repo-mirror-');
    const origin = createOriginRepo();
    const updates: any[] = [];
    const { service, workspace } = createService(mirrorRoot, updates);

    await service.ensureRepoFresh({
      projectId: 'project_1',
      environmentId: 'env_1',
      repoUrl: origin,
      repoBranch: 'main',
    });
    const { repoRoot } = workspace.getRepoWorkspace('project_1', 'env_1');

    const result = await service.ensureRepoFresh({
      projectId: 'project_1',
      environmentId: 'env_1',
      repoUrl: path.join(origin, 'missing.git'),
      repoBranch: 'main',
    });

    expect(result.status).toBe(RepoSyncStatus.error);
    expect(existsSync(path.join(repoRoot, '.git'))).toBe(true);
    expect(updates.some((item) => item.data.repoSyncStatus === RepoSyncStatus.error)).toBe(true);
  });
});
