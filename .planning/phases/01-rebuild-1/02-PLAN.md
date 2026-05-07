---
wave: 2
depends_on:
  - 01
files_modified:
  - src/modules/agent/session-state.service.ts
  - src/modules/agent/agent.module.ts
requirements_addressed:
  - D-01
autonomous: true
---

# Plan 02: Create Session State Service

<objective>
Create a centralized SessionStateService to manage runtime state transitions, replacing the distributed state management currently spread across GroupAgentSessionService, GroupRuntimeService, and PiMonoAdapter.
</objective>

<read_first>
- src/modules/agent/session-context.types.ts — New type definitions created in Plan 01
- src/modules/agent/group-agent-session.service.ts — Current state management via syncGroupRuntimeState, syncRuntimeSessionState
- src/modules/agent/pi-mono.adapter.ts (lines 60-95) — SessionRuntimeState internal type with activeExecution, currentTurn, waitingReason, queue, eventSequence
- .planning/phases/01-rebuild-1/01-CONTEXT.md — State management decisions (three-state enum, centralized management)
</read_first>

<acceptance_criteria>
- src/modules/agent/session-state.service.ts exists and contains:
  - `@Injectable()` decorator
  - `SessionStateService` class with methods:
    - `getState(sessionId: string): Promise<RuntimeState>`
    - `transitionTo(sessionId: string, newState: RuntimeState, reason?: string): Promise<void>`
    - `setWaitingConfirmation(sessionId: string, confirmationRequestId: string, reason: string): Promise<void>`
    - `clearWaiting(sessionId: string): Promise<void>`
    - `getRuntimeStateJson(sessionId: string): Promise<Record<string, unknown>>`
    - `updateRuntimeStateJson(sessionId: string, updates: Record<string, unknown>): Promise<void>`
  - State transitions enforce valid transitions: idle → running, running → idle, running → waiting_confirmation, waiting_confirmation → idle
  - Invalid transitions throw BadRequestException
- src/modules/agent/agent.module.ts modified:
  - SessionStateService added to providers array
  - SessionStateService added to exports array
</acceptance_criteria>

<action>
**Step 1: Create new file `src/modules/agent/session-state.service.ts`**

```typescript
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RuntimeState } from './session-context.types';

/**
 * Valid state transitions for RuntimeState.
 * idle → running (start execution)
 * running → idle (complete execution)
 * running → waiting_confirmation (high-risk action)
 * waiting_confirmation → idle (confirmation resolved)
 */
const VALID_TRANSITIONS: Record<RuntimeState, RuntimeState[]> = {
  idle: ['running'],
  running: ['idle', 'waiting_confirmation'],
  waiting_confirmation: ['idle'],
};

@Injectable()
export class SessionStateService {
  private readonly logger = new Logger(SessionStateService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get current runtime state from GroupAgentSession.runtimeStateJson.
   */
  async getState(sessionId: string): Promise<RuntimeState> {
    const session = await this.prisma.groupAgentSession.findUnique({
      where: { id: sessionId },
      select: { runtimeStateJson: true },
    });
    const stateJson = this.parseRuntimeStateJson(session?.runtimeStateJson);
    return stateJson.runtimeState ?? 'idle';
  }

  /**
   * Transition to a new state. Throws BadRequestException for invalid transitions.
   */
  async transitionTo(
    sessionId: string,
    newState: RuntimeState,
    reason?: string,
  ): Promise<void> {
    const currentState = await this.getState(sessionId);
    if (!VALID_TRANSITIONS[currentState].includes(newState)) {
      throw new BadRequestException(
        `Invalid state transition: ${currentState} → ${newState}`,
      );
    }

    this.logger.log(
      `Session state transition: ${sessionId} ${currentState} → ${newState}${reason ? ` (${reason})` : ''}`,
    );

    await this.updateRuntimeStateJson(sessionId, {
      runtimeState: newState,
      ...(reason ? { stateChangeReason: reason } : {}),
    });

    // Record state change event
    await this.prisma.runtimeEvent.create({
      data: {
        runtimeSessionKey: await this.getRuntimeSessionKey(sessionId),
        groupSessionId: sessionId,
        eventType: 'session_state_changed',
        sequence: await this.getNextSequence(sessionId),
        payload: {
          previousState: currentState,
          newState,
          reason: reason ?? null,
        },
      },
    });
  }

  /**
   * Set session to waiting_confirmation state with confirmation details.
   */
  async setWaitingConfirmation(
    sessionId: string,
    confirmationRequestId: string,
    reason: string,
  ): Promise<void> {
    await this.transitionTo(sessionId, 'waiting_confirmation', reason);
    await this.updateRuntimeStateJson(sessionId, {
      waitingReason: reason,
      confirmationRequestId,
    });
  }

  /**
   * Clear waiting state and return to idle.
   */
  async clearWaiting(sessionId: string): Promise<void> {
    await this.transitionTo(sessionId, 'idle', 'Confirmation resolved');
    const current = await this.getRuntimeStateJson(sessionId);
    delete current.waitingReason;
    delete current.confirmationRequestId;
    await this.prisma.groupAgentSession.update({
      where: { id: sessionId },
      data: { runtimeStateJson: current },
    });
  }

  /**
   * Get full runtimeStateJson object.
   */
  async getRuntimeStateJson(
    sessionId: string,
  ): Promise<Record<string, unknown>> {
    const session = await this.prisma.groupAgentSession.findUnique({
      where: { id: sessionId },
      select: { runtimeStateJson: true },
    });
    return this.parseRuntimeStateJson(session?.runtimeStateJson);
  }

  /**
   * Update runtimeStateJson with partial updates.
   */
  async updateRuntimeStateJson(
    sessionId: string,
    updates: Record<string, unknown>,
  ): Promise<void> {
    const current = await this.getRuntimeStateJson(sessionId);
    await this.prisma.groupAgentSession.update({
      where: { id: sessionId },
      data: {
        runtimeStateJson: { ...current, ...updates },
        lastRuntimeTurnAt: new Date(),
      },
    });
  }

  private parseRuntimeStateJson(
    value: unknown,
  ): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private async getRuntimeSessionKey(
    sessionId: string,
  ): Promise<string> {
    const session = await this.prisma.groupAgentSession.findUnique({
      where: { id: sessionId },
      select: { runtimeSessionKey: true },
    });
    return session?.runtimeSessionKey ?? '';
  }

  private async getNextSequence(sessionId: string): Promise<number> {
    const lastEvent = await this.prisma.runtimeEvent.findFirst({
      where: { groupSessionId: sessionId },
      orderBy: { sequence: 'desc' },
      select: { sequence: true },
    });
    return (lastEvent?.sequence ?? 0) + 1;
  }
}
```

**Step 2: Modify `src/modules/agent/agent.module.ts`**

Add SessionStateService to providers and exports:

```typescript
import { SessionStateService } from './session-state.service';

@Module({
  // ... existing imports
  providers: [
    // ... existing providers
    SessionStateService,
  ],
  exports: [
    // ... existing exports
    SessionStateService,
  ],
})
export class AgentModule {}
```
</action>

<verification>
1. TypeScript compilation passes:
```bash
npm run build
```

2. Unit test for state transitions (create test file):
```bash
# Verify service can be instantiated
npm run test -- --testPathPattern=session-state.service
```
</verification>