# Project State

**Project:** feishu-kanban
**Status:** In Progress — Phase rebuild-3
**Current Phase:** rebuild-3 — PiMono Adapter Refactor
**Last Activity:** 2026-05-06

---

## Project Overview

**Type:** NestJS Backend Application
**Primary Integration:** Feishu (Lark) collaboration platform
**AI Runtime:** Pi SDK (PiMono adapter)

**Tech Stack:**
- Node.js 20+ / TypeScript 5.9
- NestJS 11 + Express
- PostgreSQL (Prisma ORM)
- BullMQ + Redis (queue processing)
- @mariozechner/pi-coding-agent (AI agent SDK)

---

## Milestones

| Milestone | Status | Phases | Progress |
|-----------|--------|--------|----------|
| v1.0.0 Rebuild | ✅ Complete | 2 | 100% — See [MILESTONES.md](MILESTONES.md) |
| v1.1.0 Architecture Refactor | 🔄 In Progress | 1 | Context gathered |

---

## Current Position

**Status:** Phase rebuild-3 context gathered
**Next Step:** Run `/gsd-plan-phase rebuild-3` to plan implementation

**Resume File:** `.planning/phases/03-rebuild-3/03-CONTEXT.md`

---

## Architecture (Current)

```
Feishu WebSocket → BullMQ → FeishuEventService (fire-and-forget)
                          ↓
                    GroupRuntimeService
                          ↓
                    SessionContext (identity + config + state)
                          ↓
                    PiMonoAdapter.steer() / followUp()
                          ↓
                    Pi SDK Session (handles queue internally)

Uninitialized Groups → handlePendingConfigGroup → Fixed response (no Pi SDK)
                                          ↓
                                    Admin calls /api/group-config/:chatId/complete
                                          ↓
                                    PROJECT-CONFIG.md (single doc)
                                          ↓
                                    initFromChat (no skeleton docs)
```

**Key Simplifications:**
1. RuntimeState enum replaces 4 overlapping state variables
2. Pi SDK's steer/followUp replace custom ActorQueue + queueMode logic
3. RuntimeEvent reduced to 4 types, GroupRuntimeTask table removed
4. SessionContext consolidates multiple context interfaces
5. Fixed response + backend config replaces Pi SDK conversational bootstrap
6. Single PROJECT-CONFIG.md replaces 7 skeleton documents

---

## History

| Date | Event |
|------|-------|
| 2026-05-02 | Codebase mapped |
| 2026-05-03 | Phase rebuild-1 planned and executed |
| 2026-05-04 | Phase rebuild-2 planned and executed |
| 2026-05-04 | Milestone v1.0.0 completed and archived |
| 2026-05-06 | Phase rebuild-3 context gathered |

---

*Last updated: 2026-05-06 after rebuild-3 context gathered*