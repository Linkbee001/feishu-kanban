# Project Roadmap

**Project:** feishu-kanban
**Status:** Active
**Last Updated:** 2026-05-03

---

## Milestone: Rebuild

**Goal:** Simplify group runtime architecture by removing redundant state management, queue mechanisms, and context objects.

---

### Phase: rebuild-1 — Group Runtime Refactor

**Goal:** Simplify the group runtime message scheduling mechanism by leveraging Pi SDK's built-in capabilities rather than maintaining redundant custom implementations.

**Status:** Ready to execute

**Scope:**
- State Management: Replace four overlapping state variables with a three-state enum
- Queue Mechanism: Remove dual queue (ActorQueue + BullMQ) and use SDK's steer/followUp
- Persistence Strategy: Simplify RuntimeEvent types from 16 to 4, remove GroupRuntimeTask table
- Context Objects: Consolidate multiple context interfaces into single SessionContext

**Files to modify:**
- Remove: `group-runtime-task.service.ts`, GroupRuntimeTask table
- Simplify: `pi-mono.adapter.ts`, `group-runtime.service.ts`, `agent.types.ts`, `group-agent-session.service.ts`
- Add: `session-context.types.ts`, `session-state.service.ts`

**Cross-cutting constraints:**
- RuntimeState enum must be single source of truth for session state
- SDK's isStreaming used as runtime check, not persisted state
- Memory queue for confirmation wait is acceptable trade-off (not persisted)

---

**Wave 1 *(foundation - no blockers)***
- Plan 01: Define New Type System — Create SessionContext, RuntimeState enum, simplify RuntimeEventType

**Wave 2 *(blocked on Wave 1 completion)***
- Plan 02: Create Session State Service — Centralized state management with valid transition enforcement

**Wave 3 *(blocked on Wave 2 completion)***
- Plan 03: Simplify PiMonoAdapter — Remove ActorQueue, use steer/followUp directly

**Wave 4 *(blocked on Wave 3 completion - COMPLETE)***
- Plan 04: Simplify GroupRuntimeService — Use SessionContext, remove queueMode logic (COMPLETE)
- Plan 05: Simplify GroupAgentSessionService — Remove syncGroupRuntimeState, use SessionStateService (COMPLETE)

**Wave 5 *(blocked on Wave 4 completion)***
- Plan 06: Remove GroupRuntimeTask Infrastructure — Delete service, table, and all references

**Wave 6 *(blocked on Wave 5 completion - requires manual intervention)***
- Plan 07: Database Migration — Prisma migrate to remove GroupRuntimeTask table

---

*Generated: 2026-05-03*