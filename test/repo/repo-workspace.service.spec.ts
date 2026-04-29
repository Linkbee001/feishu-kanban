import * as path from 'path';
import { RepoWorkspaceService } from '../../src/modules/repo/repo-workspace.service';

describe('RepoWorkspaceService', () => {
  it('creates a stable workspace layout under the configured mirror root', () => {
    const service = new RepoWorkspaceService({
      get: jest.fn((key: string) => {
        if (key === 'REPO_MIRROR_ROOT') {
          return path.join(process.cwd(), '.runtime-test', 'repos');
        }
        return undefined;
      }),
    } as any);

    const result = service.getRepoWorkspace('project_1', 'env_1');

    expect(result.workspaceRoot).toContain(path.join('.runtime-test', 'repos', 'project_1', 'env_1'));
    expect(result.repoRoot).toBe(path.join(result.workspaceRoot, 'repo'));
    expect(result.manifestPath).toBe(path.join(result.workspaceRoot, 'manifest.json'));
  });
});
