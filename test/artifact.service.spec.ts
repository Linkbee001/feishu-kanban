import { ArtifactStatus, ArtifactType } from '@prisma/client';
import { ArtifactService } from '../src/modules/artifact/artifact.service';

describe('ArtifactService', () => {
  const baseArtifact = {
    id: 'artifact_1',
    projectId: 'project_1',
    environmentId: 'env_1',
    agentRunId: 'run_1',
    status: ArtifactStatus.pending,
    title: 'Artifact',
    type: ArtifactType.document,
    metadata: {},
    project: {
      id: 'project_1',
      feishuChatId: 'chat_project',
      docFolderToken: 'folder_1',
      bitableAppToken: 'bitable_app_1',
      bitableTableId: 'table_1',
    },
    environment: {
      id: 'env_1',
      name: 'Default',
    },
    agentRun: {
      id: 'run_1',
      messageSource: {
        feishuChatId: 'chat_1',
      },
    },
  };

  function createPrisma(overrides: Record<string, unknown> = {}) {
    return {
      artifact: {
        findMany: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(baseArtifact),
        update: jest.fn(async ({ data }: any) => ({
          ...baseArtifact,
          ...data,
        })),
      },
      agentRun: {
        findUnique: jest.fn(),
      },
      groupPolicy: {
        findFirst: jest.fn().mockResolvedValue({
          allowDocWrite: true,
          allowTaskBoardWrite: true,
        }),
      },
      ...overrides,
    };
  }

  function createFeishu() {
    return {
      createDocument: jest.fn().mockResolvedValue({
        token: 'doc_token',
        url: 'https://example.com/doc',
      }),
      createBitableRecord: jest.fn().mockResolvedValue({
        data: { record: { record_id: 'record_1' } },
      }),
      uploadFile: jest.fn().mockResolvedValue({
        data: { file_key: 'file_1' },
      }),
    };
  }

  it('syncs a document only when persist=true and feishu_doc is targeted', async () => {
    const prisma = createPrisma({
      artifact: {
        findUnique: jest.fn().mockResolvedValue({
          ...baseArtifact,
          type: ArtifactType.document,
          title: 'Plan',
          metadata: {
            type: 'document',
            title: 'Plan',
            content: '# Plan',
            metadata: {
              persist: true,
              targetChannels: ['feishu_doc'],
            },
          },
        }),
        update: jest.fn(async ({ data }: any) => data),
      },
    });
    const feishu = createFeishu();
    const service = new ArtifactService(prisma as any, feishu as any);

    const result = await service.syncArtifact('artifact_1');

    expect(feishu.createDocument).toHaveBeenCalledWith('Plan', 'folder_1', '# Plan');
    expect(result.status).toBe(ArtifactStatus.synced);
  });

  it('skips a document when durable persistence was not requested', async () => {
    const prisma = createPrisma({
      artifact: {
        findUnique: jest.fn().mockResolvedValue({
          ...baseArtifact,
          type: ArtifactType.document,
          title: 'Plan',
          metadata: {
            type: 'document',
            title: 'Plan',
            content: '# Plan',
            metadata: {
              targetChannels: ['feishu_doc'],
            },
          },
        }),
        update: jest.fn(async ({ data }: any) => data),
      },
    });
    const feishu = createFeishu();
    const service = new ArtifactService(prisma as any, feishu as any);

    const result = await service.syncArtifact('artifact_1');

    expect(feishu.createDocument).not.toHaveBeenCalled();
    expect(result.status).toBe(ArtifactStatus.skipped);
    expect((result.metadata as Record<string, unknown>).syncSkipReason).toContain('Durable persistence');
  });

  it('skips a task when bitable was not explicitly targeted', async () => {
    const prisma = createPrisma({
      artifact: {
        findUnique: jest.fn().mockResolvedValue({
          ...baseArtifact,
          type: ArtifactType.task,
          title: 'Tasks',
          metadata: {
            type: 'task',
            title: 'Tasks',
            tasks: [{ title: 'A task' }],
            metadata: {
              persist: true,
              targetChannels: ['feishu_doc'],
            },
          },
        }),
        update: jest.fn(async ({ data }: any) => data),
      },
    });
    const feishu = createFeishu();
    const service = new ArtifactService(prisma as any, feishu as any);

    const result = await service.syncArtifact('artifact_1');

    expect(feishu.createBitableRecord).not.toHaveBeenCalled();
    expect(result.status).toBe(ArtifactStatus.skipped);
    expect((result.metadata as Record<string, unknown>).syncSkipReason).toContain('bitable');
  });

  it('skips a document when group policy disables doc writes', async () => {
    const prisma = createPrisma({
      artifact: {
        findUnique: jest.fn().mockResolvedValue({
          ...baseArtifact,
          type: ArtifactType.document,
          title: 'Plan',
          metadata: {
            type: 'document',
            title: 'Plan',
            content: '# Plan',
            metadata: {
              persist: true,
              targetChannels: ['feishu_doc'],
            },
          },
        }),
        update: jest.fn(async ({ data }: any) => data),
      },
      groupPolicy: {
        findFirst: jest.fn().mockResolvedValue({
          allowDocWrite: false,
          allowTaskBoardWrite: true,
        }),
      },
    });
    const feishu = createFeishu();
    const service = new ArtifactService(prisma as any, feishu as any);

    const result = await service.syncArtifact('artifact_1');

    expect(feishu.createDocument).not.toHaveBeenCalled();
    expect(result.status).toBe(ArtifactStatus.skipped);
    expect((result.metadata as Record<string, unknown>).syncSkipReason).toContain('Group policy');
  });
});
