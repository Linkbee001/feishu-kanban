import { AgentRunStatus, GroupSessionMode, GroupSessionStatus } from '@prisma/client';
import { ProjectDigestProcessor } from '../src/queues/processors/project-digest.processor';

describe('ProjectDigestProcessor', () => {
  function createProcessor() {
    const prisma = {
      groupAgentSession: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      agentRun: {
        create: jest.fn(),
      },
    };
    const agent = {
      transition: jest.fn().mockResolvedValue(undefined),
    };
    const piMono = {
      executeRun: jest.fn(),
      closeSession: jest.fn().mockResolvedValue(undefined),
    };
    const groupSessions = {};
    const assembler = {
      assembleForSession: jest.fn(),
    };
    const digests = {
      getScheduledDigestJobs: jest.fn(),
      buildPrompt: jest.fn(),
      buildDigestSessionKey: jest.fn(),
      buildOutputSchema: jest.fn(),
      normalizeSummaryOutput: jest.fn(),
    };
    const digestQueue = {
      add: jest.fn().mockResolvedValue(undefined),
    };
    const artifactQueue = {
      add: jest.fn().mockResolvedValue(undefined),
    };

    const processor = new ProjectDigestProcessor(
      prisma as any,
      agent as any,
      piMono as any,
      groupSessions as any,
      assembler as any,
      digests as any,
      digestQueue as any,
      artifactQueue as any,
    );

    return {
      processor,
      prisma,
      agent,
      piMono,
      assembler,
      digests,
      digestQueue,
      artifactQueue,
    };
  }

  it('enqueues due digest jobs during the scan pass', async () => {
    const { processor, prisma, digests, digestQueue } = createProcessor();

    prisma.groupAgentSession.findMany.mockResolvedValue([
      {
        id: 'session_1',
        projectId: 'project_1',
        status: GroupSessionStatus.idle,
        sessionMode: GroupSessionMode.active,
      },
    ]);
    digests.getScheduledDigestJobs.mockReturnValue([
      {
        digestType: 'daily_status',
        periodKey: '2026-04-27:daily_status',
        targetChannels: ['internal_digest'],
      },
    ]);

    await processor.process({ name: 'scan', data: {} } as any);

    expect(digests.getScheduledDigestJobs).toHaveBeenCalledWith(expect.objectContaining({ id: 'session_1' }));
    expect(digestQueue.add).toHaveBeenCalledWith(
      'digest',
      expect.objectContaining({
        sessionId: 'session_1',
        digestType: 'daily_status',
        internalOnly: true,
      }),
      { jobId: 'session_1:2026-04-27:daily_status' },
    );
  });

  it('creates and syncs a digest run with internal summary metadata', async () => {
    const { processor, prisma, agent, piMono, assembler, digests, artifactQueue } = createProcessor();

    prisma.groupAgentSession.findUnique.mockResolvedValue({
      id: 'session_1',
      projectId: 'project_1',
      feishuChatId: 'chat_1',
      sessionMode: GroupSessionMode.active,
      agentScopeKey: 'project:project_1:manager',
      activeEnvironmentId: 'env_1',
    });
    assembler.assembleForSession.mockResolvedValue({
      project: {
        id: 'project_1',
        name: 'Alpha',
        feishuChatId: 'chat_1',
      },
      environment: {
        id: 'env_1',
        name: 'Default',
        projectPath: 'c:/workspace/project',
      },
      session: {
        runtimeSessionKey: 'chat:chat_1:manager',
        sessionMode: 'active',
        status: 'idle',
      },
      recentMessages: [],
      recentRuns: [],
      recentArtifacts: [],
      folderEntries: [],
      folderEntriesTruncated: false,
      docSnapshots: [],
      bitableSnapshot: null,
    });
    prisma.agentRun.create.mockResolvedValue({
      id: 'run_1',
      intent: 'progress_summary',
      skillName: 'progress_summary',
      prompt: 'digest prompt',
    });
    digests.buildPrompt.mockReturnValue('digest prompt');
    digests.buildDigestSessionKey.mockReturnValue('chat:chat_1:manager:digest:daily');
    digests.buildOutputSchema.mockReturnValue({ type: 'array' });
    piMono.executeRun.mockResolvedValue({
      status: 'succeeded',
      outputs: [{ type: 'summary', title: 'summary', content: '# Digest' }],
    });
    digests.normalizeSummaryOutput.mockReturnValue({
      output: {
        type: 'summary',
        title: '项目现状摘要',
        content: '# Digest',
        metadata: {
          targetChannels: ['internal_digest'],
        },
      },
      digestHash: 'hash_1',
      decision: {
        wakeMode: 'scheduled_digest',
        intent: 'progress_summary',
        targetChannels: ['internal_digest'],
        shouldNotifyGroup: false,
        shouldWriteDoc: false,
        confidence: 'high',
        reason: 'ok',
      },
    });

    await processor.process({
      name: 'digest',
      data: {
        sessionId: 'session_1',
        digestType: 'daily_status',
        targetChannels: ['internal_digest'],
        triggerType: 'scheduled',
        internalOnly: true,
        periodKey: '2026-04-27:daily_status',
      },
    } as any);

    expect(prisma.agentRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: 'project_1',
          environmentId: 'env_1',
          messageSourceId: null,
          intent: 'progress_summary',
          skillName: 'progress_summary',
        }),
      }),
    );
    expect(agent.transition).toHaveBeenNthCalledWith(
      1,
      'run_1',
      AgentRunStatus.running,
      expect.objectContaining({ progress: 5 }),
    );
    expect(agent.transition).toHaveBeenNthCalledWith(
      2,
      'run_1',
      AgentRunStatus.syncing,
      expect.objectContaining({
        progress: 95,
        outputSummary: '项目现状摘要',
      }),
    );
    expect(prisma.groupAgentSession.update).toHaveBeenCalledWith({
      where: { id: 'session_1' },
      data: expect.objectContaining({
        lastDigestType: 'daily_status',
        lastDigestHash: 'hash_1',
        lastDigestRunId: 'run_1',
      }),
    });
    expect(artifactQueue.add).toHaveBeenCalledWith('sync-run', { agentRunId: 'run_1' }, { jobId: 'run_1-sync' });
    expect(piMono.closeSession).toHaveBeenCalledWith('chat:chat_1:manager:digest:daily');
  });
});
