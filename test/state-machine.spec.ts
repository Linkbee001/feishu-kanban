import { BadRequestException } from '@nestjs/common';
import { AgentRunStatus, ArtifactStatus, ConfirmationStatus } from '@prisma/client';
import { assertAgentRunTransition, assertArtifactTransition, assertConfirmationTransition } from '../src/common/state/state-machine';

describe('state machines', () => {
  it('allows planned transitions', () => {
    expect(() => assertAgentRunTransition(AgentRunStatus.queued, AgentRunStatus.running)).not.toThrow();
    expect(() => assertArtifactTransition(ArtifactStatus.failed, ArtifactStatus.synced)).not.toThrow();
    expect(() => assertConfirmationTransition(ConfirmationStatus.pending, ConfirmationStatus.confirmed)).not.toThrow();
  });

  it('rejects invalid transitions', () => {
    expect(() => assertAgentRunTransition(AgentRunStatus.succeeded, AgentRunStatus.running)).toThrow(BadRequestException);
    expect(() => assertConfirmationTransition(ConfirmationStatus.rejected, ConfirmationStatus.confirmed)).toThrow(BadRequestException);
  });
});
