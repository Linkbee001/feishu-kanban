import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RepoCredentialResolver {
  constructor(private readonly config: ConfigService) {}

  resolveSecret(repoCredentialRef?: string | null): string | null {
    if (!repoCredentialRef?.trim()) {
      return null;
    }

    const parsed = this.parseSecretMap();
    const value = parsed[repoCredentialRef.trim()];
    if (!value?.trim()) {
      throw new Error(`Missing repo credential secret for ref "${repoCredentialRef}"`);
    }

    return value.trim();
  }

  private parseSecretMap(): Record<string, string> {
    const raw = this.config.get<string>('REPO_SECRET_MAP_JSON')?.trim();
    if (!raw) {
      return {};
    }

    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return Object.fromEntries(
        Object.entries(parsed).flatMap(([key, value]) =>
          typeof value === 'string' ? [[key, value]] : [],
        ),
      );
    } catch (error) {
      throw new Error(`Invalid REPO_SECRET_MAP_JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
