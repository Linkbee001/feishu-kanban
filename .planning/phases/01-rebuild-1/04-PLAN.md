---
wave: 4
depends_on:
  - 03
files_modified:
  - src/modules/agent/group-runtime.service.ts
  - src/modules/agent/session-context.types.ts
requirements_addressed:
  - D-02
  - D-04
autonomous: true
---

# Plan 04: Simplify GroupRuntimeService

<objective>
Refactor GroupRuntimeService to use the simplified PiMonoAdapter steer/followUp methods and SessionContext instead of the complex RuntimeSubmitMessageInput with queueMode.
</objective>

<read_first>
- src/modules/agent/group-runtime.service.ts — Current implementation with resolveQueueMode, handleMentionMessage, resumeFromConfirmation
- src/modules/agent/session-context.types.ts — New SessionContext interface
- src/modules/agent/session-state.service.ts — Centralized state management
- .planning/phases/01-rebuild-1/01-CONTEXT.md — Call simplification examples
</read_first>

<acceptance_criteria>
- src/modules/agent/group-runtime.service.ts modified:
  - `resolveQueueMode` method removed entirely
  - `handleMentionMessage` method refactored to:
    - Build SessionContext instead of RuntimeSubmitMessageInput
    - Call `piMono.steer(sessionId, message, environment)` directly
    - Use SessionStateService for state transitions
  - `resumeFromConfirmation` method refactored to:
    - Build SessionContext
    - Call `piMono.followUp(sessionId, event, environment)` directly
    - Use SessionStateService.clearWaiting() for state transition
  - No references to RuntimeQueueMode, RuntimeSubmitMessageInput, RuntimeResumeInput
  - No references to GroupRuntimeTaskService (runtimeTasks dependency removed)
- Message flow simplified to: submit → steer → execute → confirm (if needed) → followUp
</acceptance_criteria>

<action>
**Step 1: Remove imports for deprecated types and services**

Remove from imports:
- `RuntimeQueueMode` import
- `RuntimeSubmitMessageInput` import (if present)
- `RuntimeResumeInput` import
- `GroupRuntimeTaskService` import and constructor injection

Add imports:
- `SessionContext`, `RuntimeState`, `SessionEnvironment` from './session-context.types'
- `SessionStateService`

**Step 2: Remove `resolveQueueMode` method**

Delete the entire method (lines 403-459). Message handling no longer needs queue mode detection.

**Step 3: Refactor `handleMentionMessage`**

Replace the current implementation:

```typescript
async handleMentionMessage(input: {
  projectId: string;
  environmentId: string;
  feishuChatId: string;
  messageSourceId: string;
  feishuMessageId?: string | null;
  prompt: string;
  senderOpenId?: string | null;
  traceId?: string | null;
}): Promise<{ status: string; runtimeSessionKey: string }> {
  // Get or create session
  const session = await this.groupSessions.getOrCreateSession(input.feishuChatId, {
    projectId: input.projectId,
    environmentId: input.environmentId,
    feishuChatId: input.feishuChatId,
    agentRole: AgentRole.manager,
    sessionMode: 'active',
  });

  // Build SessionContext
  const environment = await this.prisma.projectEnvironment.findUniqueOrThrow({
    where: { id: input.environmentId },
  });
  const project = await this.prisma.project.findUniqueOrThrow({
    where: { id: input.projectId },
  });
  const groupPolicy = await this.prisma.groupPolicy.findFirst({
    where: { projectId: input.projectId, feishuChatId: input.feishuChatId, archivedAt: null },
  });

  const context: SessionContext = {
    projectId: input.projectId,
    feishuChatId: input.feishuChatId,
    sessionId: session.id,
    environment: {
      repoPath: environment.projectPath,
      modelName: environment.modelName ?? 'kimi-k2.5',
      skillSet: environment.skillSet,
    },
    groupPolicy: {
      mentionOnly: groupPolicy?.mentionOnly ?? true,
      allowDocWrite: groupPolicy?.allowDocWrite ?? true,
      allowTaskBoardWrite: groupPolicy?.allowTaskBoardWrite ?? true,
    },
    runtimeState: await this.sessionState.getState(session.id),
  };

  // Direct steer call
  const result = await this.piMono.steer(session.runtimeSessionKey, input.prompt, context.environment);

  // Update state if starting execution
  if (context.runtimeState === 'idle') {
    await this.sessionState.transitionTo(session.id, 'running', 'Message submitted');
  }

  // Sync runtime session state
  await this.syncRuntimeSessionState(session.id, session.runtimeSessionKey);

  return {
    status: result.action,
    runtimeSessionKey: session.runtimeSessionKey,
  };
}
```

**Step 4: Refactor `resumeFromConfirmation`**

Replace with simplified implementation:

```typescript
async resumeFromConfirmation(confirmationId: string, input: { eventText: string }): Promise<{ accepted: boolean }> {
  const confirmation = await this.prisma.confirmationRequest.findUnique({
    where: { id: confirmationId },
    include: { messageSource: true },
  });
  if (!confirmation?.projectId || !confirmation?.environmentId) {
    return { accepted: false };
  }

  const session = await this.groupSessions.getOrCreateSession(
    confirmation.messageSource.feishuChatId,
    {
      projectId: confirmation.projectId,
      environmentId: confirmation.environmentId,
      feishuChatId: confirmation.messageSource.feishuChatId,
      agentRole: AgentRole.manager,
      sessionMode: 'active',
    },
  );

  // Build SessionContext
  const context = await this.buildSessionContext(session, confirmation.projectId, confirmation.environmentId);

  // Clear waiting state
  await this.sessionState.clearWaiting(session.id);

  // Resume with followUp
  const result = await this.piMono.followUp(
    session.runtimeSessionKey,
    { type: 'confirmation_resolved', text: input.eventText },
    context.environment,
  );

  return { accepted: result.accepted };
}
```

**Step 5: Add helper method `buildSessionContext`**

```typescript
private async buildSessionContext(
  session: GroupAgentSession,
  projectId: string,
  environmentId: string,
): Promise<SessionContext> {
  const environment = await this.prisma.projectEnvironment.findUniqueOrThrow({
    where: { id: environmentId },
  });
  const groupPolicy = await this.prisma.groupPolicy.findFirst({
    where: { projectId, feishuChatId: session.feishuChatId, archivedAt: null },
  });

  return {
    projectId,
    feishuChatId: session.feishuChatId,
    sessionId: session.id,
    environment: {
      repoPath: environment.projectPath,
      modelName: environment.modelName ?? 'kimi-k2.5',
      skillSet: environment.skillSet,
    },
    groupPolicy: {
      mentionOnly: groupPolicy?.mentionOnly ?? true,
      allowDocWrite: groupPolicy?.allowDocWrite ?? true,
      allowTaskBoardWrite: groupPolicy?.allowTaskBoardWrite ?? true,
    },
    runtimeState: await this.sessionState.getState(session.id),
  };
}
```

**Step 6: Remove runtimeTasks usage**

Remove all calls to `this.runtimeTasks` throughout the file. Task tracking will be handled by RuntimeState enum.
</action>

<verification>
1. TypeScript compilation passes:
```bash
npm run build
```

2. Verify no references to removed code:
```bash
grep -n "resolveQueueMode\|RuntimeQueueMode\|runtimeTasks\|GroupRuntimeTaskService" src/modules/agent/group-runtime.service.ts
```
Expected: No matches (or only commented-out legacy code)
</verification>