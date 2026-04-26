import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import FormData from 'form-data';

interface TenantToken {
  token: string;
  expiresAt: number;
}

@Injectable()
export class FeishuService {
  private readonly logger = new Logger(FeishuService.name);
  private tenantToken?: TenantToken;

  constructor(private readonly config: ConfigService) {}

  verifyEventToken(token?: string) {
    const expected = this.config.get<string>('FEISHU_VERIFICATION_TOKEN');
    return !expected || token === expected;
  }

  verifySignature(timestamp?: string, nonce?: string, signature?: string, rawBody?: string) {
    const encryptKey = this.config.get<string>('FEISHU_ENCRYPT_KEY');
    if (!encryptKey || !signature) return true;
    const base = `${timestamp ?? ''}${nonce ?? ''}${encryptKey}${rawBody ?? ''}`;
    const calculated = crypto.createHash('sha256').update(base).digest('hex');
    return calculated === signature;
  }

  decryptEvent(encrypt?: string) {
    const encryptKey = this.config.get<string>('FEISHU_ENCRYPT_KEY');
    if (!encrypt) return null;
    if (!encryptKey) {
      throw new BadGatewayException('Encrypted Feishu event received but FEISHU_ENCRYPT_KEY is empty');
    }
    const key = crypto.createHash('sha256').update(encryptKey).digest();
    const encrypted = Buffer.from(encrypt, 'base64');
    const iv = encrypted.subarray(0, 16);
    const payload = encrypted.subarray(16);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    const decrypted = Buffer.concat([decipher.update(payload), decipher.final()]).toString('utf8');
    return JSON.parse(decrypted);
  }

  async sendTextMessage(receiveIdType: string, receiveId: string, text: string) {
    return this.request('/im/v1/messages', {
      method: 'POST',
      query: { receive_id_type: receiveIdType },
      body: {
        receive_id: receiveId,
        msg_type: 'text',
        content: JSON.stringify({ text }),
      },
    });
  }

  async sendCard(receiveIdType: string, receiveId: string, card: unknown) {
    return this.request('/im/v1/messages', {
      method: 'POST',
      query: { receive_id_type: receiveIdType },
      body: {
        receive_id: receiveId,
        msg_type: 'interactive',
        content: JSON.stringify(card),
      },
    });
  }

  async createProjectFolder(projectName: string): Promise<{ token: string; url?: string }> {
    const title = `${projectName}-项目文档`;
    const data = await this.request<any>('/drive/v1/files/create_folder', {
      method: 'POST',
      body: { name: title, folder_token: '' },
    });
    return { token: data?.data?.token ?? data?.data?.folder_token ?? title, url: data?.data?.url };
  }

  async createDocument(
    title: string,
    folderToken?: string,
    markdown?: string,
  ): Promise<{ token: string; url?: string }> {
    const data = await this.request<any>('/docx/v1/documents', {
      method: 'POST',
      body: { title, folder_token: folderToken },
    });
    const token = data?.data?.document?.document_id ?? data?.data?.document_id ?? data?.document_id;
    if (token && markdown?.trim()) {
      await this.writeDocumentBlocks(token, markdown);
    }
    return {
      token,
      url: data?.data?.document?.url ?? data?.data?.url ?? (token ? this.documentUrl(token) : undefined),
    };
  }

  async writeDocumentBlocks(documentId: string, markdown: string) {
    if (!markdown.trim()) {
      return null;
    }

    const converted = await this.request<any>('/docx/v1/documents/blocks/convert', {
      method: 'POST',
      body: {
        content: markdown,
        content_type: 'markdown',
      },
    });
    const children = converted?.data?.first_level_block_ids ?? [];
    const descendants = (converted?.data?.blocks ?? []).map((block: Record<string, any>) =>
      this.sanitizeConvertedBlock(block),
    );

    if (!children.length || !descendants.length) {
      return null;
    }

    return this.request(`/docx/v1/documents/${encodeURIComponent(documentId)}/blocks/${encodeURIComponent(documentId)}/descendant`, {
      method: 'POST',
      body: {
        children_id: children,
        descendants,
        index: -1,
      },
    });
  }

  async createTaskBitable(projectName: string): Promise<{ appToken: string; tableId: string; url?: string }> {
    const app = await this.request<any>('/bitable/v1/apps', {
      method: 'POST',
      body: { name: `${projectName}-任务表` },
    });
    const appToken = app?.data?.app?.app_token ?? app?.data?.app_token;
    const table = await this.request<any>(`/bitable/v1/apps/${encodeURIComponent(appToken)}/tables`, {
      method: 'POST',
      body: { table: { name: '任务看板' } },
    });
    const tableId = table?.data?.table_id ?? table?.data?.table?.table_id;
    await this.ensureTaskFields(appToken, tableId);
    return { appToken, tableId, url: app?.data?.app?.url ?? dataUrlFromAppToken(appToken) };
  }

  async createBitableRecord(appToken: string, tableId: string, fields: Record<string, unknown>) {
    return this.request<any>(
      `/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}/records`,
      {
        method: 'POST',
        body: { fields },
      },
    );
  }

  async createChatTabs(
    chatId: string,
    tabs: Array<{
      tabName: string;
      url: string;
      iconKey?: string;
    }>,
  ) {
    const data = await this.request<any>(`/im/v1/chats/${encodeURIComponent(chatId)}/chat_tabs`, {
      method: 'POST',
      body: {
        chat_tabs: tabs.map((tab) => ({
          tab_name: tab.tabName,
          tab_type: 'url',
          tab_content: {
            url: tab.url,
          },
          tab_config: {
            icon_key: tab.iconKey,
          },
        })),
      },
    });
    return {
      raw: data,
      tabs: this.extractChatTabs(data),
    };
  }

  async listChatTabs(chatId: string) {
    return this.request<any>(`/im/v1/chats/${encodeURIComponent(chatId)}/chat_tabs`, {
      method: 'GET',
    });
  }

  async deleteChatTab(chatId: string, chatTabId: string) {
    return this.request<any>(`/im/v1/chats/${encodeURIComponent(chatId)}/chat_tabs/${encodeURIComponent(chatTabId)}`, {
      method: 'DELETE',
    });
  }

  async removeProjectChatTabs(
    chatId: string,
    match: {
      tabIds?: string[];
      names?: string[];
      urls?: string[];
    },
  ) {
    const data = await this.listChatTabs(chatId).catch((error) => {
      this.logger.warn(`list chat tabs skipped for ${chatId}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    });
    const tabs = this.extractChatTabs(data);
    if (!tabs.length) {
      return { inspected: 0, matched: 0, deleted: 0, deletedTabIds: [] as string[] };
    }

    const normalizedTabIds = new Set((match.tabIds ?? []).map((item) => item.trim()).filter(Boolean));
    const normalizedNames = new Set((match.names ?? []).map((item) => item.trim()).filter(Boolean));
    const normalizedUrls = new Set((match.urls ?? []).map((item) => this.normalizeUrl(item)).filter(Boolean));
    const candidates = tabs.filter((tab) => {
      const idMatched = tab.id ? normalizedTabIds.has(tab.id.trim()) : false;
      const nameMatched = tab.name ? normalizedNames.has(tab.name.trim()) : false;
      const urlMatched = tab.url ? normalizedUrls.has(this.normalizeUrl(tab.url)) : false;
      return idMatched || nameMatched || urlMatched;
    });

    const deletedTabIds: string[] = [];
    for (const tab of candidates) {
      if (!tab.id) continue;
      try {
        await this.deleteChatTab(chatId, tab.id);
        deletedTabIds.push(tab.id);
      } catch (error) {
        this.logger.warn(`delete chat tab skipped for ${chatId}/${tab.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return {
      inspected: tabs.length,
      matched: candidates.length,
      deleted: deletedTabIds.length,
      deletedTabIds,
    };
  }

  async deleteDriveFile(token: string, type: 'folder' | 'bitable' | 'doc' | 'docx' | 'sheet' | 'file' | 'wiki') {
    return this.request<any>(`/drive/v1/files/${encodeURIComponent(token)}`, {
      method: 'DELETE',
      query: { type },
    });
  }

  async deleteBitableTable(appToken: string, tableId: string) {
    return this.request<any>(`/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}`, {
      method: 'DELETE',
    });
  }

  async grantDrivePermission(
    token: string,
    type: 'folder' | 'bitable' | 'doc' | 'docx' | 'sheet' | 'file' | 'wiki',
    memberOpenId: string,
    perm: 'view' | 'edit' | 'full_access' = 'full_access',
  ) {
    return this.request<any>(`/drive/v1/permissions/${encodeURIComponent(token)}/members`, {
      method: 'POST',
      query: { type },
      body: {
        member_type: 'openid',
        member_id: memberOpenId,
        perm,
      },
    });
  }

  folderUrl(folderToken: string) {
    return `https://feishu.cn/drive/folder/${folderToken}`;
  }

  documentUrl(documentId: string) {
    return `https://feishu.cn/docx/${documentId}`;
  }

  bitableUrl(appToken: string, tableId?: string) {
    const url = new URL(`https://feishu.cn/base/${appToken}`);
    if (tableId) {
      url.searchParams.set('table', tableId);
    }
    return url.toString();
  }

  async uploadFile(fileName: string, bytes: Buffer, mimeType = 'application/octet-stream') {
    const form = new FormData();
    form.append('file_type', 'stream');
    form.append('file_name', fileName);
    form.append('file', bytes, { filename: fileName, contentType: mimeType });
    return this.request<any>('/im/v1/files', { method: 'POST', form });
  }

  private async ensureTaskFields(appToken: string, tableId: string) {
    const fields = [
      '任务标题',
      '任务描述',
      '任务类型',
      '优先级',
      '状态',
      '负责人提示',
      '截止日期提示',
      'AI建议',
      '来源环境',
      '执行记录',
    ];

    for (const field of fields) {
      await this.request(
        `/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}/fields`,
        {
          method: 'POST',
          body: { field_name: field, type: 1 },
        },
      ).catch((error) => this.logger.warn(`create bitable field skipped: ${field} ${error.message}`));
    }
  }

  private sanitizeConvertedBlock(block: Record<string, any>) {
    if (block?.block_type !== 31 || !block?.table?.property?.merge_info) {
      return block;
    }

    const sanitized = JSON.parse(JSON.stringify(block));
    delete sanitized.table.property.merge_info;
    return sanitized;
  }

  private extractChatTabs(payload: any): Array<{ id?: string; name?: string; url?: string }> {
    const rawTabs = payload?.data?.chat_tabs ?? payload?.data?.items ?? payload?.data?.tabs ?? [];
    if (!Array.isArray(rawTabs)) return [];
    return rawTabs.map((tab) => ({
      id: tab?.chat_tab_id ?? tab?.tab_id ?? tab?.id,
      name: tab?.tab_name ?? tab?.name,
      url: tab?.tab_content?.url ?? tab?.url,
    }));
  }

  private normalizeUrl(value?: string | null) {
    if (!value) return '';
    try {
      const url = new URL(value);
      url.hash = '';
      return url.toString();
    } catch {
      return value.trim();
    }
  }

  private async getTenantToken() {
    if (this.tenantToken && this.tenantToken.expiresAt > Date.now() + 60_000) {
      return this.tenantToken.token;
    }
    const appId = this.config.get<string>('FEISHU_APP_ID');
    const appSecret = this.config.get<string>('FEISHU_APP_SECRET');
    const data = await this.rawRequest<any>('/auth/v3/tenant_access_token/internal', {
      method: 'POST',
      body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
      headers: { 'content-type': 'application/json' },
    });
    const token = data.tenant_access_token;
    if (!token) throw new BadGatewayException('Feishu tenant token response missing tenant_access_token');
    this.tenantToken = { token, expiresAt: Date.now() + (data.expire ?? 7200) * 1000 };
    return token;
  }

  private async request<T>(
    path: string,
    options: {
      method?: string;
      query?: Record<string, string>;
      body?: unknown;
      form?: FormData;
    } = {},
  ) {
    const token = await this.getTenantToken();
    const headers: Record<string, string> = { authorization: `Bearer ${token}` };
    let body: BodyInit | undefined;

    if (options.form) {
      body = options.form as unknown as BodyInit;
      Object.assign(headers, options.form.getHeaders());
    } else if (options.body !== undefined) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(options.body);
    }

    return this.rawRequest<T>(path, {
      method: options.method,
      query: options.query,
      headers,
      body,
    });
  }

  private async rawRequest<T>(
    path: string,
    options: {
      method?: string;
      query?: Record<string, string>;
      headers?: Record<string, string>;
      body?: BodyInit;
    } = {},
  ) {
    const base = this.config.get<string>('FEISHU_BASE_URL') ?? 'https://open.feishu.cn/open-apis';
    const url = new URL(`${base}${path}`);
    Object.entries(options.query ?? {}).forEach(([key, value]) => url.searchParams.set(key, value));

    const response = await fetch(url, {
      method: options.method ?? 'GET',
      headers: options.headers,
      body: options.body,
    });
    const text = await response.text();
    let data: any = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        this.logger.error({ path, status: response.status, text: text.slice(0, 500) }, 'Feishu response parse failed');
        throw new BadGatewayException(`Feishu non-JSON response: ${response.status} ${text.slice(0, 120)}`);
      }
    }

    if (!response.ok || (typeof data.code === 'number' && data.code !== 0)) {
      this.logger.error({ path, status: response.status, data }, 'Feishu request failed');
      throw new BadGatewayException(data.msg ?? `Feishu request failed: ${response.status}`);
    }

    return data as T;
  }
}

function dataUrlFromAppToken(appToken: string) {
  return `https://feishu.cn/base/${appToken}`;
}
