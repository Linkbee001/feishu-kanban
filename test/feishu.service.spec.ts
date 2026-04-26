import { FeishuService } from '../src/modules/feishu/feishu.service';

describe('FeishuService', () => {
  const originalFetch = global.fetch;

  const createResponse = (body: unknown, status = 200) =>
    ({
      ok: status >= 200 && status < 300,
      status,
      text: jest.fn().mockResolvedValue(typeof body === 'string' ? body : JSON.stringify(body)),
    }) as any;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('creates documents with a deterministic URL and writes markdown through convert + descendant APIs', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(createResponse({ tenant_access_token: 'tenant_token', expire: 7200 }))
      .mockResolvedValueOnce(
        createResponse({
          code: 0,
          data: {
            document: {
              document_id: 'doc_1',
              title: 'README',
            },
          },
          msg: 'success',
        }),
      )
      .mockResolvedValueOnce(
        createResponse({
          code: 0,
          data: {
            first_level_block_ids: ['block_1'],
            blocks: [{ block_id: 'block_1', block_type: 2, text: { elements: [{ text_run: { content: 'Hello' } }] } }],
          },
          msg: 'success',
        }),
      )
      .mockResolvedValueOnce(createResponse({ code: 0, data: {}, msg: 'success' }));

    global.fetch = fetchMock as any;

    const config = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          FEISHU_APP_ID: 'app_id',
          FEISHU_APP_SECRET: 'app_secret',
          FEISHU_BASE_URL: 'https://open.feishu.cn/open-apis',
        };
        return values[key];
      }),
    };

    const service = new FeishuService(config as any);
    const result = await service.createDocument('README', 'folder_1', '# Hello');

    expect(result).toEqual({
      token: 'doc_1',
      url: 'https://feishu.cn/docx/doc_1',
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(String(fetchMock.mock.calls[2][0])).toContain('/docx/v1/documents/blocks/convert');
    expect(JSON.parse(fetchMock.mock.calls[2][1].body as string)).toEqual({
      content: '# Hello',
      content_type: 'markdown',
    });
    expect(String(fetchMock.mock.calls[3][0])).toContain('/docx/v1/documents/doc_1/blocks/doc_1/descendant');
  });
});
