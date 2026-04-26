import { AgentRunStatus } from '@prisma/client';
import { AgentService } from '../src/modules/agent/agent.service';

describe('AgentService', () => {
  function createService(runStatus: AgentRunStatus) {
    const run = {
      id: 'run_1',
      status: runStatus,
      artifacts: [],
    };
    const prisma = {
      project: {
        findUnique: jest.fn(),
      },
      projectEnvironment: {
        findUnique: jest.fn(),
      },
      agentRun: {
        create: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(run),
        update: jest.fn().mockImplementation(async ({ data }: any) => ({ ...run, ...data })),
      },
      groupAgentSession: {
        findUnique: jest.fn(),
      },
    };
    const intentMapper = {
      detect: jest.fn(),
      skillFor: jest.fn(),
    };
    const groupSessions = {
      tryAcquireLock: jest.fn(),
      getBusyReason: jest.fn(),
      markRunQueued: jest.fn(),
      releaseLock: jest.fn(),
      handleRunStatusTransition: jest.fn().mockResolvedValue(undefined),
    };
    const piMono = {
      cancelRun: jest.fn().mockResolvedValue(undefined),
    };
    const runQueueJob = {
      remove: jest.fn().mockResolvedValue(undefined),
    };
    const agentRunQueue = {
      add: jest.fn(),
      getJob: jest.fn().mockResolvedValue(runQueueJob),
    };
    const artifactSyncQueue = {
      add: jest.fn(),
    };

    return {
      service: new AgentService(
        prisma as any,
        intentMapper as any,
        groupSessions as any,
        piMono as any,
        agentRunQueue as any,
        artifactSyncQueue as any,
      ),
      prisma,
      groupSessions,
      piMono,
      agentRunQueue,
      runQueueJob,
    };
  }

  it('cancels queued runs immediately and releases the group session state', async () => {
    const { service, piMono, agentRunQueue, runQueueJob, groupSessions } = createService(AgentRunStatus.queued);

    const updated = await service.cancelRun('run_1');

    expect(agentRunQueue.getJob).toHaveBeenCalledWith('run_1');
    expect(runQueueJob.remove).toHaveBeenCalled();
    expect(piMono.cancelRun).not.toHaveBeenCalled();
    expect(groupSessions.handleRunStatusTransition).toHaveBeenCalledWith('run_1', AgentRunStatus.canceled);
    expect(updated).toEqual(expect.objectContaining({ status: AgentRunStatus.canceled }));
  });

  it('requests SDK cancellation for running runs without releasing the group session early', async () => {
    const { service, piMono, agentRunQueue, groupSessions } = createService(AgentRunStatus.running);

    const updated = await service.cancelRun('run_1');

    expect(piMono.cancelRun).toHaveBeenCalledWith('run_1');
    expect(agentRunQueue.getJob).not.toHaveBeenCalled();
    expect(groupSessions.handleRunStatusTransition).not.toHaveBeenCalled();
    expect(updated).toEqual(expect.objectContaining({ status: AgentRunStatus.canceled }));
  });
});
