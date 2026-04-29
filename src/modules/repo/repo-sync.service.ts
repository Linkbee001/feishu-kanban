import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RepoSyncStatus } from '@prisma/client';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EnsureRepoFreshInput, EnsureRepoFreshResult, RepoSyncManifest } from './repo.types';
import { RepoWorkspaceService } from './repo-workspace.service';
import { RepoCredentialResolver } from './repo-credential-resolver.service';

const execFileAsync = promisify(execFile);

@Injectable()
export class RepoSyncService {
  private readonly inFlight = new Map<string, Promise<EnsureRepoFreshResult>>();

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly workspace: RepoWorkspaceService,
    private readonly credentials: RepoCredentialResolver,
  ) {}

  async ensureRepoFresh(input: EnsureRepoFreshInput): Promise<EnsureRepoFreshResult> {
    const key = `${input.projectId}:${input.environmentId}`;
    const existing = this.inFlight.get(key);
    if (existing) {
      return existing;
    }

    const promise = this.ensureRepoFreshInternal(input).finally(() => {
      this.inFlight.delete(key);
    });
    this.inFlight.set(key, promise);
    return promise;
  }

  async maybeRefreshForInteractive(input: EnsureRepoFreshInput & { lastRepoSyncAt?: Date | null; repoSyncStatus?: RepoSyncStatus | null }) {
    if (!input.repoUrl?.trim()) {
      return { attempted: false, reason: 'repo_not_configured' as const, result: null };
    }

    if (!input.force && input.repoSyncStatus === RepoSyncStatus.ready && !this.isExpired(input.lastRepoSyncAt)) {
      return { attempted: false, reason: 'fresh' as const, result: null };
    }

    const result = await this.ensureRepoFresh(input);
    return { attempted: true, reason: 'synced' as const, result };
  }

  isRepoAvailable(input: { repoMirrorPath?: string | null; repoSyncStatus?: RepoSyncStatus | null }) {
    return Boolean(
      input.repoMirrorPath &&
        input.repoSyncStatus === RepoSyncStatus.ready &&
        existsSync(path.join(input.repoMirrorPath, '.git')),
    );
  }

  isExpired(lastRepoSyncAt?: Date | null) {
    if (!lastRepoSyncAt) {
      return true;
    }

    const ttlSeconds = this.config.get<number>('REPO_SYNC_TTL_SECONDS') ?? 300;
    return Date.now() - lastRepoSyncAt.getTime() > ttlSeconds * 1000;
  }

  private async ensureRepoFreshInternal(input: EnsureRepoFreshInput): Promise<EnsureRepoFreshResult> {
    const repoBranch = input.repoBranch?.trim() || 'main';
    const repoUrl = input.repoUrl?.trim();
    const { repoRoot, manifestPath } = this.workspace.getRepoWorkspace(input.projectId, input.environmentId);

    if (!repoUrl) {
      const error = 'Repository URL is not configured for this environment.';
      await this.persistState(input.environmentId, manifestPath, {
        projectId: input.projectId,
        environmentId: input.environmentId,
        repoUrl: null,
        repoBranch,
        repoRoot,
        status: RepoSyncStatus.uninitialized,
        syncedAt: null,
        headRef: null,
        error,
      });
      return { repoRoot, synced: false, status: RepoSyncStatus.uninitialized, error };
    }

    await this.prisma.projectEnvironment.update({
      where: { id: input.environmentId },
      data: {
        repoMirrorPath: repoRoot,
        repoSyncStatus: RepoSyncStatus.syncing,
        repoSyncError: null,
      },
    });

    try {
      mkdirSync(path.dirname(repoRoot), { recursive: true });
      const token = this.credentials.resolveSecret(input.repoCredentialRef);

      if (!existsSync(path.join(repoRoot, '.git'))) {
        if (existsSync(repoRoot)) {
          rmSync(repoRoot, { recursive: true, force: true });
        }
        await this.runGit(
          [
            'clone',
            '--branch',
            repoBranch,
            '--single-branch',
            repoUrl,
            repoRoot,
          ],
          undefined,
          token,
        );
      } else {
        await this.runGit(['remote', 'set-url', 'origin', repoUrl], repoRoot);
        await this.runGit(['fetch', '--prune', 'origin', repoBranch], repoRoot, token);
      }

      await this.runGit(['checkout', '-B', repoBranch, `origin/${repoBranch}`], repoRoot);
      await this.runGit(['reset', '--hard', `origin/${repoBranch}`], repoRoot);
      await this.runGit(['clean', '-fd'], repoRoot);

      const headRef = (await this.runGit(['rev-parse', 'HEAD'], repoRoot)).trim();
      const syncedAt = new Date().toISOString();
      await this.persistState(input.environmentId, manifestPath, {
        projectId: input.projectId,
        environmentId: input.environmentId,
        repoUrl,
        repoBranch,
        repoRoot,
        status: RepoSyncStatus.ready,
        syncedAt,
        headRef,
        error: null,
      });

      return {
        repoRoot,
        headRef,
        synced: true,
        status: RepoSyncStatus.ready,
        error: null,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const previousHeadRef = this.readExistingHeadRef(manifestPath);
      await this.persistState(input.environmentId, manifestPath, {
        projectId: input.projectId,
        environmentId: input.environmentId,
        repoUrl,
        repoBranch,
        repoRoot,
        status: RepoSyncStatus.error,
        syncedAt: new Date().toISOString(),
        headRef: previousHeadRef,
        error: message,
      });

      return {
        repoRoot,
        headRef: previousHeadRef,
        synced: false,
        status: RepoSyncStatus.error,
        error: message,
      };
    }
  }

  private readExistingHeadRef(manifestPath: string) {
    if (!existsSync(manifestPath)) {
      return null;
    }

    try {
      const parsed = JSON.parse(readFileSync(manifestPath, 'utf8')) as RepoSyncManifest;
      return parsed.headRef ?? null;
    } catch {
      return null;
    }
  }

  private async persistState(environmentId: string, manifestPath: string, manifest: RepoSyncManifest) {
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    await this.prisma.projectEnvironment.update({
      where: { id: environmentId },
      data: {
        repoMirrorPath: manifest.repoRoot,
        repoSyncStatus: manifest.status,
        repoSyncError: manifest.error,
        lastRepoSyncAt: manifest.syncedAt ? new Date(manifest.syncedAt) : null,
        repoHeadRef: manifest.headRef,
      },
    });
  }

  private async runGit(args: string[], cwd?: string, token?: string | null) {
    const fullArgs = token ? ['-c', `http.extraHeader=${this.buildAuthHeader(token)}`, ...args] : args;
    const result = await execFileAsync('git', fullArgs, { cwd, windowsHide: true });
    return `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
  }

  private buildAuthHeader(token: string) {
    const encoded = Buffer.from(`x-access-token:${token}`, 'utf8').toString('base64');
    return `AUTHORIZATION: basic ${encoded}`;
  }
}
