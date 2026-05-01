import { AgentRunStatus, ArtifactStatus } from '@prisma/client';
import { ArtifactSyncProcessor } from '../src/queues/processors/artifact-sync.processor';

describe('ArtifactSyncProcessor', () => {
  it('marks the run as failed and reports sync failures', async () => {
    const prisma = {
      agentRun: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'run_1',
          projectId: 'project_1',
          messageSourceId: 'source_1',
          startedAt: new Date('2026-04-30T15:00:00.000Z'),
          intent: 'document_generate',
          rawOutputs: [
            {
              type: 'document',
              title: 'README.md',
              content: '# Hello',
            },
          ],
          project: { feishuChatId: 'chat_project' },
          environment: { name: 'Default Environment' },
          messageSource: { feishuChatId: 'chat_1' },
        }),
      },
      runtimeEvent: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const artifacts = {
      createFromOutput: jest.fn().mockResolvedValue({ id: 'artifact_1' }),
      syncArtifact: jest.fn().mockResolvedValue({
        id: 'artifact_1',
        title: 'README.md',
        status: ArtifactStatus.failed,
        metadata: {
          syncError: 'Feishu non-JSON response: 404 page not found',
        },
      }),
    };
    const agent = {
      transition: jest.fn().mockResolvedValue(undefined),
    };
    const feishu = {
      sendTextMessage: jest.fn().mockResolvedValue(undefined),
    };

    const processor = new ArtifactSyncProcessor(prisma as any, artifacts as any, agent as any, feishu as any);
    await processor.process({ data: { agentRunId: 'run_1' } } as any);

    expect(agent.transition).toHaveBeenCalledWith(
      'run_1',
      AgentRunStatus.failed,
      expect.objectContaining({
        errorCode: 'ARTIFACT_SYNC_FAILED',
        errorMessage: expect.stringContaining('Feishu non-JSON response'),
      }),
    );
    expect(feishu.sendTextMessage).toHaveBeenCalledWith(
      'chat_id',
      'chat_1',
      expect.stringContaining('sync failed'),
    );
  });

  it('sends scheduled digest summaries to the project group when configured for group delivery', async () => {
    const prisma = {
      agentRun: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'run_digest',
          projectId: 'project_1',
          messageSourceId: null,
          intent: 'progress_summary',
          rawOutputs: [
            {
              type: 'summary',
              title: '项目现状摘要',
              content: '# Digest\nEverything is healthy.',
              metadata: {
                internalOnly: false,
                targetChannels: ['group_message'],
              },
            },
          ],
          project: { feishuChatId: 'chat_project' },
          environment: { name: 'Default Environment' },
          messageSource: null,
        }),
      },
      runtimeEvent: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const artifacts = {
      createFromOutput: jest.fn().mockResolvedValue({ id: 'artifact_1' }),
      syncArtifact: jest.fn().mockResolvedValue({
        id: 'artifact_1',
        title: '项目现状摘要',
        status: ArtifactStatus.synced,
      }),
    };
    const agent = {
      transition: jest.fn().mockResolvedValue(undefined),
    };
    const feishu = {
      sendTextMessage: jest.fn().mockResolvedValue(undefined),
    };

    const processor = new ArtifactSyncProcessor(prisma as any, artifacts as any, agent as any, feishu as any);
    await processor.process({ data: { agentRunId: 'run_digest' } } as any);

    expect(agent.transition).toHaveBeenCalledWith(
      'run_digest',
      AgentRunStatus.succeeded,
      expect.objectContaining({ progress: 100 }),
    );
    expect(feishu.sendTextMessage).toHaveBeenCalledWith(
      'chat_id',
      'chat_project',
      '# Digest\nEverything is healthy.',
    );
  });

  it('sends a short auto reply after successful formal sync when no explicit group reply exists', async () => {
    const prisma = {
      agentRun: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'run_success',
          projectId: 'project_1',
          messageSourceId: 'source_1',
          startedAt: new Date('2026-04-30T15:00:00.000Z'),
          intent: 'document_generate',
          rawOutputs: [
            {
              type: 'document',
              title: 'Implementation Plan',
              content: '# Plan',
              metadata: {
                persist: true,
                targetChannels: ['feishu_doc'],
              },
            },
          ],
          project: { feishuChatId: 'chat_project' },
          environment: { name: 'Default Environment' },
          messageSource: { feishuChatId: 'chat_1' },
        }),
      },
      runtimeEvent: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const artifacts = {
      createFromOutput: jest.fn().mockResolvedValue({ id: 'artifact_1' }),
      syncArtifact: jest.fn().mockResolvedValue({
        id: 'artifact_1',
        type: ArtifactStatus.synced,
        title: 'Implementation Plan',
        status: ArtifactStatus.synced,
        feishuUrl: 'https://example.com/doc',
        metadata: {
          type: 'document',
        },
      }),
    };
    const agent = {
      transition: jest.fn().mockResolvedValue(undefined),
    };
    const feishu = {
      sendTextMessage: jest.fn().mockResolvedValue(undefined),
    };

    const processor = new ArtifactSyncProcessor(prisma as any, artifacts as any, agent as any, feishu as any);
    await processor.process({ data: { agentRunId: 'run_success' } } as any);

    expect(agent.transition).toHaveBeenCalledWith(
      'run_success',
      AgentRunStatus.succeeded,
      expect.objectContaining({ progress: 100 }),
    );
    expect(feishu.sendTextMessage).toHaveBeenCalledWith(
      'chat_id',
      'chat_1',
      '已生成《Implementation Plan》，并已沉淀到项目文档：https://example.com/doc',
    );
  });

  it('does not send an auto reply when the runtime already emitted a group reply', async () => {
    const prisma = {
      agentRun: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'run_success',
          projectId: 'project_1',
          messageSourceId: 'source_1',
          startedAt: new Date('2026-04-30T15:00:00.000Z'),
          intent: 'document_generate',
          rawOutputs: [
            {
              type: 'document',
              title: 'Implementation Plan',
              content: '# Plan',
              metadata: {
                persist: true,
                targetChannels: ['feishu_doc'],
              },
            },
          ],
          project: { feishuChatId: 'chat_project' },
          environment: { name: 'Default Environment' },
          messageSource: { feishuChatId: 'chat_1' },
        }),
      },
      runtimeEvent: {
        findMany: jest.fn().mockResolvedValue([
          {
            payload: {
              messageSourceId: 'source_1',
            },
          },
        ]),
      },
    };
    const artifacts = {
      createFromOutput: jest.fn().mockResolvedValue({ id: 'artifact_1' }),
      syncArtifact: jest.fn().mockResolvedValue({
        id: 'artifact_1',
        title: 'Implementation Plan',
        status: ArtifactStatus.synced,
        feishuUrl: 'https://example.com/doc',
        metadata: {
          type: 'document',
        },
      }),
    };
    const agent = {
      transition: jest.fn().mockResolvedValue(undefined),
    };
    const feishu = {
      sendTextMessage: jest.fn().mockResolvedValue(undefined),
    };

    const processor = new ArtifactSyncProcessor(prisma as any, artifacts as any, agent as any, feishu as any);
    await processor.process({ data: { agentRunId: 'run_success' } } as any);

    expect(feishu.sendTextMessage).not.toHaveBeenCalled();
  });
});
