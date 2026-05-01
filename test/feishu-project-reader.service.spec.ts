import { FeishuProjectReader } from '../src/modules/feishu/feishu-project-reader.service';

describe('FeishuProjectReader', () => {
  function createReader(overrides: Record<string, unknown> = {}) {
    const config = {
      get: jest.fn((key: string) => {
        const values: Record<string, unknown> = {
          DIGEST_FOLDER_SCAN_LIMIT: 500,
          DIGEST_DOC_CONTENT_LIMIT: 20,
          DIGEST_BITABLE_ROW_LIMIT: 2000,
          ...overrides,
        };
        return values[key];
      }),
    };
    const feishu = {
      listDriveFiles: jest.fn(),
      getDocumentRawContent: jest.fn(),
      documentUrl: jest.fn((token: string) => `https://feishu.example/${token}`),
      listBitableFields: jest.fn(),
      listBitableRecords: jest.fn(),
    };

    return {
      reader: new FeishuProjectReader(feishu as any, config as any),
      feishu,
    };
  }

  it('recursively scans the project folder and reads only the newest document contents up to the configured limit', async () => {
    const { reader, feishu } = createReader({
      DIGEST_DOC_CONTENT_LIMIT: 1,
    });

    feishu.listDriveFiles.mockImplementation(async ({ folderToken }: { folderToken: string }) => {
      if (folderToken === 'root') {
        return {
          data: {
            files: [
              {
                token: 'sub_1',
                type: 'folder',
                name: 'Sub Folder',
                edit_time: '2026-04-20T00:00:00.000Z',
              },
              {
                token: 'doc_old',
                type: 'docx',
                name: 'Old Doc',
                edit_time: '2026-04-20T00:00:00.000Z',
              },
            ],
            has_more: false,
          },
        };
      }

      return {
        data: {
          files: [
            {
              token: 'doc_new',
              type: 'docx',
              name: 'New Doc',
              edit_time: '2026-04-25T00:00:00.000Z',
            },
          ],
          has_more: false,
        },
      };
    });
    feishu.getDocumentRawContent.mockResolvedValue({
      data: {
        content: 'Latest document body',
      },
    });

    const result = await reader.scanProjectFolder('root');

    expect(result.truncated).toBe(false);
    expect(result.entries.map((item) => item.token)).toEqual(['sub_1', 'doc_old', 'doc_new']);
    expect(result.documents).toHaveLength(1);
    expect(result.documents[0]).toEqual(
      expect.objectContaining({
        token: 'doc_new',
        summary: 'Latest document body',
      }),
    );
    expect(feishu.getDocumentRawContent).toHaveBeenCalledTimes(1);
    expect(feishu.getDocumentRawContent).toHaveBeenCalledWith('doc_new');
  });

  it('computes bitable task stats from existing field names', async () => {
    const { reader, feishu } = createReader();

    feishu.listBitableFields.mockResolvedValue({
      data: {
        items: [
          { field_id: 'fld_status', field_name: '状态' },
          { field_id: 'fld_owner', field_name: '负责人' },
          { field_id: 'fld_due', field_name: '截止日期' },
        ],
      },
    });
    feishu.listBitableRecords.mockResolvedValue({
      data: {
        items: [
          {
            record_id: 'rec_1',
            fields: {
              状态: '进行中',
              负责人: 'Alice',
              截止日期: '2099-01-01',
            },
          },
          {
            record_id: 'rec_2',
            fields: {
              状态: '阻塞',
              负责人: '',
              截止日期: '2000-01-01',
            },
          },
          {
            record_id: 'rec_3',
            fields: {
              状态: '已完成',
              负责人: 'Bob',
              截止日期: '2000-01-01',
            },
          },
        ],
        has_more: false,
      },
    });

    const snapshot = await reader.readBitableSnapshot('app_1', 'tbl_1');

    expect(snapshot).toEqual(
      expect.objectContaining({
        totalTasks: 3,
        openTasks: 2,
        blockedTasks: 1,
        overdueTasks: 1,
        unassignedTasks: 1,
      }),
    );
    expect(snapshot?.recentRows).toHaveLength(3);
  });

  it('searches recent documents by metadata without pulling raw content for every candidate', async () => {
    const { reader, feishu } = createReader();

    feishu.listDriveFiles.mockResolvedValue({
      data: {
        files: [
          {
            token: 'doc_1',
            type: 'docx',
            name: 'Risk Register',
            edit_time: '2026-04-25T00:00:00.000Z',
          },
        ],
        has_more: false,
      },
    });

    const search = await reader.searchProjectDocuments('root', 'risk');

    expect(search).toHaveLength(1);
    expect(search[0]).toEqual(expect.objectContaining({ token: 'doc_1', rawContent: null }));
    expect(feishu.getDocumentRawContent).not.toHaveBeenCalled();
  });

  it('reuses cached content and degrades gracefully when Feishu raw_content is rate limited', async () => {
    const { reader, feishu } = createReader();

    feishu.getDocumentRawContent
      .mockResolvedValueOnce({
        data: {
          content: 'Project risk and delivery notes',
        },
      })
      .mockRejectedValueOnce(new Error('request trigger frequency limit'));

    const first = await reader.readProjectDocument('doc_1', 'Risk Register');
    const second = await reader.readProjectDocument('doc_1', 'Risk Register');

    expect(first).toEqual(expect.objectContaining({ summary: 'Project risk and delivery notes' }));
    expect(second).toEqual(expect.objectContaining({ summary: 'Project risk and delivery notes' }));
    expect(feishu.getDocumentRawContent).toHaveBeenCalledTimes(1);
  });

  it('returns a placeholder snapshot when Feishu raw_content is rate limited before any cache exists', async () => {
    const { reader, feishu } = createReader();

    feishu.getDocumentRawContent.mockRejectedValueOnce(new Error('request trigger frequency limit'));

    const doc = await reader.readProjectDocument('doc_rate_limited', 'Rate Limited Doc');

    expect(doc).toEqual(
      expect.objectContaining({
        token: 'doc_rate_limited',
        rawContent: null,
        summary: expect.stringContaining('rate limited'),
      }),
    );
  });

  it('resolves a document title to a real token before requesting raw content', async () => {
    const { reader, feishu } = createReader();

    feishu.listDriveFiles.mockResolvedValue({
      data: {
        files: [
          {
            token: 'doxcn1234567890123456789012',
            type: 'docx',
            name: '项目说明文档 - README.md',
            edit_time: '2026-04-30T00:00:00.000Z',
          },
        ],
        has_more: false,
      },
    });
    feishu.getDocumentRawContent.mockResolvedValue({
      data: {
        content: 'README body',
      },
    });

    const doc = await reader.readProjectDocument('项目说明文档 - README.md', '项目说明文档 - README.md', {
      folderToken: 'root',
    });

    expect(feishu.getDocumentRawContent).toHaveBeenCalledWith('doxcn1234567890123456789012');
    expect(doc).toEqual(
      expect.objectContaining({
        token: 'doxcn1234567890123456789012',
        title: '项目说明文档 - README.md',
        summary: 'README body',
      }),
    );
  });
});
