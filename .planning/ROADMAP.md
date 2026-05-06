# Project Roadmap

**Project:** feishu-kanban
**Status:** In Progress — Phase rebuild-3
**Last Updated:** 2026-05-06

---

## Milestones

- ✅ **v1.0.0 — Rebuild** — Phases rebuild-1, rebuild-2 (shipped 2026-05-04) — [Archive](milestones/v1.0-ROADMAP.md)
- 🔄 **v1.1.0 — Architecture Refactor** — Phase rebuild-3 (in progress)

---

## Current Phase

### rebuild-3 — PiMono Adapter Refactor

**Goal:** Refactor the 2834-line pi-mono.adapter.ts into 6 focused services with clear responsibilities, maintaining PiMonoAdapter as coordinator.

**Requirements:** [REQ-01, REQ-02, REQ-03, REQ-04, REQ-05]

**Context:** [.planning/phases/03-rebuild-3/03-CONTEXT.md](phases/03-rebuild-3/03-CONTEXT.md)

**Progress:**
- [x] Context gathered
- [x] Research complete
- [x] Planning complete
- [ ] Execution
- [ ] Verification

**Plans:** 6 plans in 5 waves

Plans:
- [ ] 03-01-PLAN.md — Wave 0: Test fixtures, PiSessionStateService, PiSessionManager
- [ ] 03-02-PLAN.md — Wave 1: PiPromptBuilder (pure functions)
- [ ] 03-03-PLAN.md — Wave 1: PiOutputProcessor (pure functions)
- [ ] 03-04-PLAN.md — Wave 2: PiExecutor + coordinator delegation
- [ ] 03-05-PLAN.md — Wave 3: PiEventRecorder
- [ ] 03-06-PLAN.md — Wave 4: PiToolRegistry + final integration

**Service Decomposition:**

| Service | Responsibility | Target Lines |
|---------|----------------|--------------|
| PiSessionStateService | Shared state management | ~50 |
| PiSessionManager | Session lifecycle | ~150 |
| PiPromptBuilder | Prompt assembly | ~200 |
| PiOutputProcessor | Output normalization | ~200 |
| PiExecutor | Execution core | ~250 |
| PiEventRecorder | Event recording | ~200 |
| PiToolRegistry | Tool definitions (11 tools) | ~400 |
| PiMonoAdapter (coordinator) | Delegation facade | ~300 |

---

## Upcoming Phases

None defined yet. Run `/gsd-progress` after rebuild-3 completion to plan next milestone.