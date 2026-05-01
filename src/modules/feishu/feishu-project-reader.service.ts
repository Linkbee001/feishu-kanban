import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BitableRecordSnapshot,
  BitableSnapshot,
  FeishuDocumentSnapshot,
  FeishuFolderEntrySnapshot,
} from '../agent/agent.types';
import { FeishuService } from './feishu.service';

type DriveEntry = FeishuFolderEntrySnapshot;
type TaskFieldHints = {
  statusField?: string;
  assigneeField?: string;
  dueDateField?: string;
};

type FolderScanResult = {
  entries: FeishuFolderEntrySnapshot[];
  documents: FeishuDocumentSnapshot[];
  truncated: boolean;
};

type ScanProjectFolderOptions = {
  includeDocumentContents?: boolean;
};

@Injectable()
export class FeishuProjectReader {
  private readonly logger = new Logger(FeishuProjectReader.name);
  private readonly folderCache = new Map<string, { expiresAt: number; value: FolderScanResult }>();
  private readonly documentCache = new Map<string, { expiresAt: number; value: FeishuDocumentSnapshot | null }>();

  constructor(
    private readonly feishu: FeishuService,
    private readonly config: ConfigService,
  ) {}

  async scanProjectFolder(
    folderToken?: string | null,
    options: ScanProjectFolderOptions = {},
  ): Promise<FolderScanResult> {
    if (!folderToken) {
      return { entries: [], documents: [], truncated: false };
    }

    const includeDocumentContents = options.includeDocumentContents ?? true;
    const cacheKey = `${folderToken}:${includeDocumentContents ? 'full' : 'meta'}`;
    const cached = this.getFreshFolderCache(cacheKey);
    if (cached) {
      return cached;
    }

    const maxEntries = this.config.get<number>('DIGEST_FOLDER_SCAN_LIMIT') ?? 500;
    const maxDocContents = this.config.get<number>('DIGEST_DOC_CONTENT_LIMIT') ?? 20;
    const queue: string[] = [folderToken];
    const entries: DriveEntry[] = [];
    let truncated = false;

    while (queue.length && entries.length < maxEntries) {
      const currentFolder = queue.shift()!;
      let pageToken: string | undefined;

      do {
        const response = await this.feishu.listDriveFiles({
          folderToken: currentFolder,
          pageToken,
          pageSize: Math.min(200, maxEntries - entries.length),
          orderBy: 'EditedTime',
          direction: 'DESC',
        });
        const items = this.normalizeDriveEntries(response, currentFolder);

        for (const item of items) {
          if (entries.length >= maxEntries) {
            truncated = true;
            break;
          }
          entries.push(item);
          if (item.type === 'folder') {
            queue.push(item.token);
          }
        }

        pageToken =
          response?.data?.page_token ??
          response?.data?.next_page_token ??
          response?.data?.nextPageToken ??
          undefined;
        const hasMore = Boolean(
          response?.data?.has_more ??
            response?.data?.hasMore ??
            (pageToken ? true : false),
        );
        if (!hasMore) {
          pageToken = undefined;
        }
      } while (pageToken && entries.length < maxEntries);
    }

    const textDocs = entries
      .filter((entry) => this.isReadableDocument(entry.type))
      .sort((a, b) => {
        const left = Date.parse(a.updatedAt ?? '') || 0;
        const right = Date.parse(b.updatedAt ?? '') || 0;
        return right - left;
      })
      .slice(0, maxDocContents);

    const documents: FeishuDocumentSnapshot[] = [];
    for (const doc of textDocs) {
      if (!includeDocumentContents) {
        const cachedDoc = this.getCachedDocument(doc.token);
        documents.push({
          token: doc.token,
          title: doc.title,
          type: doc.type,
          url: doc.url ?? null,
          updatedAt: doc.updatedAt ?? null,
          rawContent: cachedDoc?.rawContent ?? null,
          summary: cachedDoc?.summary ?? null,
        });
        continue;
      }

      const snapshot = await this.readProjectDocument(doc.token, doc.title, {
        maxContentLength: 4_000,
        preserveMissingAsNull: false,
      });
      documents.push(
        snapshot ?? {
          token: doc.token,
          title: doc.title,
          type: doc.type,
          url: doc.url ?? null,
          updatedAt: doc.updatedAt ?? null,
          rawContent: null,
          summary: null,
        },
      );
    }

    const result = { entries, documents, truncated };
    this.setFolderCache(cacheKey, result);
    return result;
  }

  async listProjectFolder(folderToken?: string | null) {
    return this.scanProjectFolder(folderToken, { includeDocumentContents: false });
  }

  async readProjectDocument(
    token?: string | null,
    title?: string | null,
    options: {
      maxContentLength?: number;
      preserveMissingAsNull?: boolean;
      folderToken?: string | null;
    } = {},
  ): Promise<FeishuDocumentSnapshot | null> {
    const normalizedToken = token?.trim();
    const resolvedToken = await this.resolveDocumentToken(normalizedToken, title, options.folderToken);
    const effectiveTitle = title?.trim() || normalizedToken || resolvedToken;
    if (!resolvedToken) {
      return options.preserveMissingAsNull ?? true
        ? null
        : {
            token: normalizedToken ?? effectiveTitle ?? 'unknown-doc',
            title: effectiveTitle || 'Unknown document',
            type: 'docx',
            rawContent: null,
            summary: 'Unable to resolve a valid Feishu document token from the provided title or identifier.',
            url: null,
            updatedAt: null,
          };
    }

    const documentMeta = options.folderToken
      ? await this.findDocumentEntry(options.folderToken, resolvedToken, effectiveTitle)
      : null;
    const finalTitle = documentMeta?.title ?? effectiveTitle ?? resolvedToken ?? 'Unknown document';
    if (!normalizedToken) {
      if (!resolvedToken) {
        return null;
      }
    }

    const cached = this.getCachedDocument(resolvedToken);
    if (cached) {
      return this.withDocumentOverrides(cached, finalTitle, options.maxContentLength);
    }

    try {
      const raw = await this.feishu.getDocumentRawContent(resolvedToken);
      const rawContent =
        raw?.data?.content ??
        raw?.data?.raw_content ??
        raw?.data?.rawContent ??
        '';
      const snapshot: FeishuDocumentSnapshot = {
        token: resolvedToken,
        title: finalTitle,
        type: 'docx',
        rawContent: rawContent.slice(0, options.maxContentLength ?? 8_000),
        summary: this.summarize(rawContent),
        url: documentMeta?.url ?? this.feishu.documentUrl(resolvedToken),
        updatedAt: documentMeta?.updatedAt ?? null,
      };
      this.setDocumentCache(resolvedToken, snapshot);
      return snapshot;
    } catch (error) {
      if (this.isRateLimitError(error)) {
        const stale = this.getStaleDocument(resolvedToken);
        if (stale) {
          this.logger.warn(`Feishu doc raw_content rate limited for ${resolvedToken}; using cached snapshot`);
          return this.withDocumentOverrides(stale, finalTitle, options.maxContentLength);
        }

        return {
          token: resolvedToken,
          title: finalTitle,
          type: 'docx',
          rawContent: null,
          summary: 'Feishu document content is temporarily unavailable because the doc API is rate limited.',
          url: documentMeta?.url ?? this.feishu.documentUrl(resolvedToken),
          updatedAt: documentMeta?.updatedAt ?? null,
        };
      }

      if (options.preserveMissingAsNull ?? true) {
        return null;
      }
      return null;
    }
  }

  async searchProjectDocuments(folderToken?: string | null, query?: string | null) {
    const keyword = query?.trim().toLowerCase();
    if (!folderToken || !keyword) {
      return [];
    }

    const folder = await this.scanProjectFolder(folderToken, { includeDocumentContents: false });
    return folder.documents.filter((doc) => {
      const cached = this.getCachedDocument(doc.token);
      return [doc.title, doc.summary, doc.rawContent, cached?.summary, cached?.rawContent]
        .filter((item): item is string => typeof item === 'string')
        .some((item) => item.toLowerCase().includes(keyword));
    });
  }

  async readBitableSnapshot(appToken?: string | null, tableId?: string | null): Promise<BitableSnapshot | null> {
    if (!appToken || !tableId) {
      return null;
    }

    const rowLimit = this.config.get<number>('DIGEST_BITABLE_ROW_LIMIT') ?? 2000;
    const fieldsResponse = await this.feishu.listBitableFields(appToken, tableId);
    const fields = this.normalizeBitableFields(fieldsResponse);
    const hints = this.resolveTaskFieldHints(fields);
    const rows: BitableRecordSnapshot[] = [];
    let pageToken: string | undefined;

    while (rows.length < rowLimit) {
      const response = await this.feishu.listBitableRecords({
        appToken,
        tableId,
        pageToken,
        pageSize: Math.min(500, rowLimit - rows.length),
      });
      const items = this.normalizeBitableRecords(response);
      rows.push(...items.slice(0, rowLimit - rows.length));

      pageToken =
        response?.data?.page_token ??
        response?.data?.next_page_token ??
        response?.data?.pageToken ??
        undefined;
      const hasMore = Boolean(
        response?.data?.has_more ??
          response?.data?.hasMore ??
          (pageToken ? true : false),
      );
      if (!hasMore) {
        pageToken = undefined;
      }
      if (!pageToken) {
        break;
      }
    }

    return {
      ...this.calculateTaskStats(rows, hints),
      fields,
      recentRows: rows.slice(0, 50),
    };
  }

  private normalizeDriveEntries(payload: any, parentToken: string): DriveEntry[] {
    const rawEntries =
      payload?.data?.files ??
      payload?.data?.items ??
      payload?.data?.list ??
      [];
    if (!Array.isArray(rawEntries)) {
      return [];
    }

    const entries = rawEntries.map((item): DriveEntry | null => {
      const token =
        item?.token ??
        item?.file_token ??
        item?.document_id ??
        item?.obj_token ??
        item?.id;
      const type =
        item?.type ??
        item?.file_type ??
        item?.obj_type ??
        item?.mime_type ??
        'unknown';
      const title =
        item?.name ??
        item?.title ??
        item?.file_name ??
        item?.obj_name ??
        String(token ?? '');
      if (!token || !title) {
        return null;
      }
      return {
        token: String(token),
        title: String(title),
        type: String(type),
        parentToken: item?.parent_token ?? parentToken,
        url: item?.url ?? item?.web_url ?? null,
        updatedAt: this.normalizeTimestamp(
          item?.edit_time ??
            item?.updated_time ??
            item?.modified_time ??
            item?.create_time,
        ),
      };
    });

    return entries.filter((item): item is DriveEntry => item !== null);
  }

  private normalizeBitableFields(payload: any): BitableSnapshot['fields'] {
    const rawFields =
      payload?.data?.items ??
      payload?.data?.fields ??
      [];
    if (!Array.isArray(rawFields)) {
      return [];
    }

    return rawFields
      .map((field) => {
        const fieldName = field?.field_name ?? field?.name;
        if (!fieldName) {
          return null;
        }
        return {
          fieldId: field?.field_id ?? field?.id,
          fieldName: String(fieldName),
          type: field?.type,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }

  private normalizeBitableRecords(payload: any): BitableRecordSnapshot[] {
    const rawRecords =
      payload?.data?.items ??
      payload?.data?.records ??
      [];
    if (!Array.isArray(rawRecords)) {
      return [];
    }

    return rawRecords
      .map((record) => {
        const recordId = record?.record_id ?? record?.id;
        const fields = record?.fields;
        if (!recordId || !fields || typeof fields !== 'object' || Array.isArray(fields)) {
          return null;
        }
        return {
          recordId: String(recordId),
          fields: fields as Record<string, unknown>,
        };
      })
      .filter((item): item is BitableRecordSnapshot => item !== null);
  }

  private calculateTaskStats(rows: BitableRecordSnapshot[], hints: TaskFieldHints) {
    const now = new Date();
    let openTasks = 0;
    let blockedTasks = 0;
    let overdueTasks = 0;
    let unassignedTasks = 0;

    for (const row of rows) {
      const status = this.stringifyField(this.getFieldValue(row.fields, hints.statusField)).toLowerCase();
      const assignee = this.stringifyField(this.getFieldValue(row.fields, hints.assigneeField));
      const dueDate = this.parseDateHint(this.stringifyField(this.getFieldValue(row.fields, hints.dueDateField)));

      const isDone = /完成|done|closed|关闭|已完成|cancel|取消/.test(status);
      const isBlocked = /阻塞|blocked|risk|风险/.test(status);

      if (!isDone) {
        openTasks += 1;
      }
      if (isBlocked) {
        blockedTasks += 1;
      }
      if (!assignee) {
        unassignedTasks += 1;
      }
      if (!isDone && dueDate && dueDate.getTime() < now.getTime()) {
        overdueTasks += 1;
      }
    }

    return {
      totalTasks: rows.length,
      openTasks,
      blockedTasks,
      overdueTasks,
      unassignedTasks,
    };
  }

  private resolveTaskFieldHints(fields: BitableSnapshot['fields']): TaskFieldHints {
    const names = fields.map((field) => field.fieldName);
    return {
      statusField: this.findFieldName(names, [/状态/i, /\bstatus\b/i, /progress/i]),
      assigneeField: this.findFieldName(names, [/负责人/i, /assignee/i, /owner/i, /处理人/i]),
      dueDateField: this.findFieldName(names, [/截止/i, /due/i, /deadline/i, /日期/i]),
    };
  }

  private findFieldName(candidates: string[], matchers: RegExp[]) {
    return candidates.find((name) => matchers.some((matcher) => matcher.test(name)));
  }

  private getFieldValue(fields: Record<string, unknown>, preferredKey?: string) {
    if (preferredKey && preferredKey in fields) {
      return fields[preferredKey];
    }
    return undefined;
  }

  private stringifyField(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'string') {
      return value.trim();
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    if (Array.isArray(value)) {
      return value
        .map((item) => this.stringifyField(item))
        .filter(Boolean)
        .join(', ');
    }
    if (typeof value === 'object') {
      const named = value as Record<string, unknown>;
      return this.stringifyField(
        named.text ??
          named.name ??
          named.title ??
          named.value ??
          JSON.stringify(value),
      );
    }
    return String(value);
  }

  private parseDateHint(input: string) {
    if (!input) {
      return null;
    }

    const normalized = input.trim();
    const parsed = Date.parse(normalized);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed);
    }

    const match = normalized.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (!match) {
      return null;
    }

    return new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      23,
      59,
      59,
      999,
    );
  }

  private isReadableDocument(type: string) {
    return ['docx', 'doc'].includes(type.toLowerCase());
  }

  private async resolveDocumentToken(
    tokenOrTitle?: string | null,
    title?: string | null,
    folderToken?: string | null,
  ) {
    const normalizedIdentifier = tokenOrTitle?.trim();
    if (normalizedIdentifier && this.looksLikeDocumentToken(normalizedIdentifier)) {
      return normalizedIdentifier;
    }

    const targetTitle = (title?.trim() || normalizedIdentifier || '').trim();
    if (!folderToken || !targetTitle) {
      return null;
    }

    const match = await this.findDocumentEntry(folderToken, normalizedIdentifier ?? null, targetTitle);
    return match?.token ?? null;
  }

  private async findDocumentEntry(
    folderToken: string,
    tokenOrTitle?: string | null,
    title?: string | null,
  ): Promise<FeishuFolderEntrySnapshot | null> {
    const folder = await this.scanProjectFolder(folderToken, { includeDocumentContents: false });
    const normalizedIdentifier = tokenOrTitle?.trim().toLowerCase();
    const normalizedTitle = title?.trim().toLowerCase();
    return (
      folder.entries.find((entry) => {
        if (!this.isReadableDocument(entry.type)) {
          return false;
        }
        const tokenMatched = normalizedIdentifier ? entry.token.toLowerCase() === normalizedIdentifier : false;
        const titleMatched = normalizedTitle ? entry.title.trim().toLowerCase() === normalizedTitle : false;
        return tokenMatched || titleMatched;
      }) ?? null
    );
  }

  private looksLikeDocumentToken(value: string) {
    return /^[A-Za-z0-9_-]{3,}$/.test(value.trim());
  }

  private withDocumentOverrides(
    snapshot: FeishuDocumentSnapshot,
    title?: string | null,
    maxContentLength?: number,
  ): FeishuDocumentSnapshot {
    const rawContent = typeof snapshot.rawContent === 'string'
      ? snapshot.rawContent.slice(0, maxContentLength ?? snapshot.rawContent.length)
      : snapshot.rawContent;
    return {
      ...snapshot,
      title: title?.trim() || snapshot.title,
      rawContent,
    };
  }

  private getFreshFolderCache(cacheKey: string) {
    const cached = this.folderCache.get(cacheKey);
    if (!cached) {
      return null;
    }
    if (cached.expiresAt <= Date.now()) {
      this.folderCache.delete(cacheKey);
      return null;
    }
    return cached.value;
  }

  private setFolderCache(cacheKey: string, value: FolderScanResult) {
    const ttlMs = this.config.get<number>('FEISHU_PROJECT_FOLDER_CACHE_TTL_MS') ?? 30_000;
    this.folderCache.set(cacheKey, {
      expiresAt: Date.now() + ttlMs,
      value,
    });
  }

  private getCachedDocument(token: string) {
    const cached = this.documentCache.get(token);
    if (!cached) {
      return null;
    }
    if (cached.expiresAt <= Date.now()) {
      this.documentCache.delete(token);
      return null;
    }
    return cached.value;
  }

  private getStaleDocument(token: string) {
    return this.documentCache.get(token)?.value ?? null;
  }

  private setDocumentCache(token: string, value: FeishuDocumentSnapshot | null) {
    const ttlMs = this.config.get<number>('FEISHU_PROJECT_DOC_CACHE_TTL_MS') ?? 120_000;
    this.documentCache.set(token, {
      expiresAt: Date.now() + ttlMs,
      value,
    });
  }

  private isRateLimitError(error: unknown) {
    if (!(error instanceof Error)) {
      return false;
    }
    return /request trigger frequency limit/i.test(error.message);
  }

  private summarize(rawContent: string) {
    const normalized = rawContent.replace(/\s+/g, ' ').trim();
    return normalized ? normalized.slice(0, 500) : null;
  }

  private normalizeTimestamp(value: unknown) {
    if (typeof value === 'number') {
      const date = value > 1_000_000_000_000 ? new Date(value) : new Date(value * 1000);
      return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Date.parse(value);
      return Number.isNaN(parsed) ? value : new Date(parsed).toISOString();
    }
    return null;
  }
}
