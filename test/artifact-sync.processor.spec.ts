import { AgentRunStatus, ArtifactStatus } from '@prisma/client';
import { ArtifactSyncProcessor } from '../src/queues/processors/artifact-sync.processor';

describe('ArtifactSyncProcessor', () => {
  it('marks the run as failed and reports sync failures instead of sending a fake title link', async () => {
    const prisma = {
      agentRun: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'run_1',
          intent: 'document_generate',
          rawOutputs: [
            {
              type: 'document',
              title: '项目说明文档 - README.md',
              content: '# Hello',
            },
          ],
          environment: { name: '默认主环境' },
          messageSource: { feishuChatId: 'chat_1' },
        }),
      },
    };
    const artifacts = {
      createFromOutput: jest.fn().mockResolvedValue({ id: 'artifact_1' }),
      syncArtifact: jest.fn().mockResolvedValue({
        id: 'artifact_1',
        title: '项目说明文档 - README.md',
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
      expect.stringContaining('同步失败'),
    );
    expect(feishu.sendTextMessage).not.toHaveBeenCalledWith(
      'chat_id',
      'chat_1',
      expect.stringContaining('http://README.md'),
    );
  });
});
