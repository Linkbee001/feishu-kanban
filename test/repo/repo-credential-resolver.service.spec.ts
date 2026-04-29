import { RepoCredentialResolver } from '../../src/modules/repo/repo-credential-resolver.service';

describe('RepoCredentialResolver', () => {
  it('resolves a configured secret ref from REPO_SECRET_MAP_JSON', () => {
    const resolver = new RepoCredentialResolver({
      get: jest.fn((key: string) =>
        key === 'REPO_SECRET_MAP_JSON' ? '{"github-prod":"token-123"}' : undefined,
      ),
    } as any);

    expect(resolver.resolveSecret('github-prod')).toBe('token-123');
  });

  it('throws a clear error when the secret ref is missing', () => {
    const resolver = new RepoCredentialResolver({
      get: jest.fn(() => '{"github-prod":"token-123"}'),
    } as any);

    expect(() => resolver.resolveSecret('missing-ref')).toThrow('Missing repo credential secret for ref "missing-ref"');
  });
});
