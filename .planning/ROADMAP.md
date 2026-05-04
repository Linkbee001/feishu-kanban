# Project Roadmap

**Project:** feishu-kanban
**Status:** Complete
**Last Updated:** 2026-05-04

---

## Milestone: Rebuild

**Goal:** Simplify group runtime architecture and initialization flow by removing redundant state management, queue mechanisms, and conversational bootstrap.

**Status:** Complete ✓

---

### Phase: rebuild-1 — Group Runtime Refactor ✓

**Goal:** Simplify the group runtime message scheduling mechanism by leveraging Pi SDK's built-in capabilities rather than maintaining redundant custom implementations.

**Status:** Complete ✓ (2026-05-03)

**Scope:**
- State Management: Replace four overlapping state variables with a three-state enum ✓
- Queue Mechanism: Remove dual queue (ActorQueue + BullMQ) and use SDK's steer/followUp ✓
- Persistence Strategy: Simplify RuntimeEvent types from 16 to 4, remove GroupRuntimeTask table ✓
- Context Objects: Consolidate multiple context interfaces into single SessionContext ✓

**Files modified:**
- Removed: `group-runtime-task.service.ts`, GroupRuntimeTask table ✓
- Simplified: `pi-mono.adapter.ts`, `group-runtime.service.ts`, `agent.types.ts`, `group-agent-session.service.ts` ✓
- Added: `session-context.types.ts`, `session-state.service.ts` ✓

**Cross-cutting constraints:**
- RuntimeState enum must be single source of truth for session state ✓
- SDK's isStreaming used as runtime check, not persisted state ✓
- Memory queue for confirmation wait is acceptable trade-off (not persisted) ✓

---

**Wave 1** ✓ *(foundation - no blockers)*
- Plan 01: Define New Type System ✓ — Created SessionContext, RuntimeState enum, simplify RuntimeEventType

**Wave 2** ✓ *(blocked on Wave 1 completion)*
- Plan 02: Create Session State Service ✓ — Centralized state management with valid transition enforcement

**Wave 3** ✓ *(blocked on Wave 2 completion)*
- Plan 03: Simplify PiMonoAdapter ✓ — Remove ActorQueue, use steer/followUp directly

**Wave 4** ✓ *(blocked on Wave 3 completion)*
- Plan 04: Simplify GroupRuntimeService ✓ — Use SessionContext, remove queueMode logic
- Plan 05: Simplify GroupAgentSessionService ✓ — Remove syncGroupRuntimeState, use SessionStateService

**Wave 5** ✓ *(blocked on Wave 4 completion)*
- Plan 06: Remove GroupRuntimeTask Infrastructure ✓ — Delete service, table, and all references

**Wave 6** ✓ *(blocked on Wave 5 completion - manual intervention)*
- Plan 07: Database Migration ✓ — Prisma migrate to remove GroupRuntimeTask table

---

### Phase: rebuild-2 — Configuration Management ✓

**Goal:** Replace conversational bootstrap with explicit backend configuration management. Single config file instead of 7 skeleton documents. Fixed response for uninitialized groups.

**Status:** Complete ✓ (2026-05-04)

**Scope:**
- Config File: Single `PROJECT-CONFIG.md` replacing 7 skeleton docs ✓
- Initialization Flow: Fixed response + backend completion (no conversational bootstrap) ✓
- Backend Module: `GroupConfigService` for configuration CRUD ✓
- Session Mode: New `pending_config` mode replacing `bootstrap` ✓
- API Endpoints: `/api/group-config/:chatId` for manual completion ✓

**Files modified:**
- Added: `config.types.ts`, `project-config.parser.ts`, `group-config.service.ts`, `group-config.controller.ts`, `config.module.ts` ✓
- Modified: `prisma/schema.prisma` (pending_config enum, configDocToken field) ✓
- Modified: `feishu-event.service.ts` (removed bootstrap logic, added fixed response) ✓
- Modified: `project.service.ts` (removed createWorkspaceSkeleton) ✓

**Cross-cutting constraints:**
- No UI in this phase — Backend API only ✓
- Manual sync first — Auto-sync deferred ✓
- No migration — New groups only ✓
- Config doc in Feishu Drive (not local file) ✓
- Fixed response — No Pi SDK calls for uninitialized groups ✓

---

**Wave 1** ✓ *(foundation)*
- Plan 01: Define Config Doc Structure ✓ — Added pending_config enum, created config.types.ts

**Wave 2** ✓ *(blocked on Wave 1)*
- Plan 02: Create GroupConfigService ✓ — Parser and configuration CRUD service

**Wave 3** ✓ *(blocked on Wave 2)*
- Plan 03: Create GroupConfigController ✓ — Admin API endpoints

**Wave 4** ✓ *(blocked on Wave 3)*
- Plan 04: Remove Conversational Bootstrap ✓ — Fixed response for uninitialized groups

**Wave 5** ✓ *(blocked on Wave 4)*
- Plan 05: Simplify initFromChat ✓ — Removed 7 skeleton docs creation

---

*Generated: 2026-05-04*