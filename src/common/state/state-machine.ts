import { BadRequestException } from '@nestjs/common';
import { AgentRunStatus, ArtifactStatus, ConfirmationStatus } from '@prisma/client';

const agentRunTransitions: Record<AgentRunStatus, AgentRunStatus[]> = {
  queued: ['running', 'canceled', 'failed', 'timeout'],
  running: ['syncing', 'failed', 'timeout', 'canceled'],
  syncing: ['succeeded', 'failed', 'timeout'],
  succeeded: [],
  failed: [],
  canceled: [],
  timeout: [],
};

const artifactTransitions: Record<ArtifactStatus, ArtifactStatus[]> = {
  pending: ['synced', 'failed', 'skipped'],
  failed: ['synced', 'failed', 'skipped'],
  synced: [],
  skipped: [],
};

const confirmationTransitions: Record<ConfirmationStatus, ConfirmationStatus[]> = {
  pending: ['confirmed', 'rejected', 'expired'],
  confirmed: [],
  rejected: [],
  expired: [],
};

export function assertAgentRunTransition(from: AgentRunStatus, to: AgentRunStatus) {
  assertTransition('agent_run', from, to, agentRunTransitions);
}

export function assertArtifactTransition(from: ArtifactStatus, to: ArtifactStatus) {
  assertTransition('artifact', from, to, artifactTransitions);
}

export function assertConfirmationTransition(from: ConfirmationStatus, to: ConfirmationStatus) {
  assertTransition('confirmation', from, to, confirmationTransitions);
}

function assertTransition<T extends string>(name: string, from: T, to: T, transitions: Record<T, T[]>) {
  if (from === to) {
    return;
  }
  if (!transitions[from]?.includes(to)) {
    throw new BadRequestException(`Invalid ${name} status transition: ${from} -> ${to}`);
  }
}
