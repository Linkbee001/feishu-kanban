---
name: rebuild-2-CONTEXT
description: Configuration management phase decisions
type: project
---

# Phase: rebuild-2 — Configuration Management

**Goal:** Replace conversational bootstrap with explicit backend configuration management. Simplify agent flow outside Pi SDK, reduce branches, improve control.

**Why:** Current conversational bootstrap is too "smart" — users may omit critical info, lack modification mechanisms, and Pi SDK external flow has too many branches. Configuration management puts control back in user's hands and limits smart agent problems to within Pi SDK.

---

## Current Bootstrap Flow (to be removed)

```
Bot enters group → handleBotAddedEvent() → session binding (uninitialized)
     ↓
First @mention in uninitialized group → handleUninitializedGroup()
     ↓
collectProjectInitInfo() → Pi SDK conversational extraction
     ↓ (if incomplete)
Ask user for missing fields → repeat until ready
     ↓ (when ready)
initFromChat() → creates Project + Environment + 7 skeleton docs + Bitable + Policy + Members + Tabs
```

**Problems:**
1. Conversational extraction may miss fields
2. No modification mechanism after initialization
3. 7 skeleton documents (PROJECT.md, MEMBERS.md, RULES.md, MEMORY.md, SKILLS.md, ENV.md, TASKS.md) — too many
4. Pi SDK external flow has bootstrap-specific branches

---

## Decisions

### 1. Config File Format — Markdown

**Decision:** Use Markdown format for the unified config file.

**Why:**
- Human-editable in Feishu docs UI
- Natural place for long-form context (project description, member responsibilities)
- JSON better for schema validation, but user wants Feishu-native editing experience
- Can embed structured data as fenced code blocks if needed

**File name:** `PROJECT-CONFIG.md`

**How to apply:**
- Create single document instead of 7 skeleton docs
- Structure: sections for project, environment, members, policy, skills
- Backend reads/writes via Feishu API (existing `feishu.writeDocumentBlocks`)

---

### 2. Backend Configuration Approach — Dedicated Module

**Decision:** Create a dedicated `GroupConfigService` module for configuration management, not admin console UI.

**Why:**
- Admin console would require new frontend (currently NestJS backend only)
- Dedicated module keeps scope bounded to backend refactor
- Can be consumed by future admin console or existing Feishu flows
- Aligns with rebuild goal: simplify backend, not add frontend complexity

**How to apply:**
- New service: `GroupConfigService` with methods: `syncGroupInfo`, `completeConfig`, `updateConfig`
- Controller: `/api/group-config/:chatId` endpoints for manual completion
- No UI in this phase — backend API only

---

### 3. Initialization Flow — Fixed Response + Backend Completion

**Decision:** When bot receives @mention in uninitialized group, return fixed message directing to backend. No conversational bootstrap.

**Why:**
- User explicitly stated: "固定返回未初始化，用户请到后台配置"
- Removes Pi SDK bootstrap branches entirely
- Backend is single source of truth for config state

**Flow:**
```
Bot enters group → handleBotAddedEvent() → GroupConfigService.syncGroupInfo()
     ↓ (auto-sync group metadata, create pending config)
First @mention → check GroupAgentSession.sessionMode === 'pending_config'
     ↓
Fixed reply: "本群未完成项目配置，请先在后台完成初始化。配置地址：/api/group-config/{chatId}"
```

**How to apply:**
- Add new sessionMode: `pending_config` (replaces 'bootstrap')
- Remove `collectProjectInitInfo`, `fallbackProjectInitInfo`, `handleUninitializedGroup` conversational logic
- Remove Pi SDK bootstrap request kind
- Fixed response in `FeishuEventService.handle()` when project not found

---

### 4. Config File Structure

**Decision:** Single `PROJECT-CONFIG.md` with structured sections.

**Why:**
- Consolidates 7 documents into one authoritative config
- Clear schema for backend parsing
- Sections map to existing concepts (Project, Environment, Members, Policy)

**Structure:**
```markdown
# Project Configuration

## Project
- Name: {name}
- Description: {description}
- Status: {active|initializing|pending}

## Environment
- Name: {env_name}
- Repo URL: {repo_url}
- Branch: {branch}
- Model: {model_name}

## Members
<!-- Member list synced from Feishu group -->
| Name | Open ID | Role | Responsibilities |
|------|---------|------|------------------|
| {name} | {open_id} | {role} | {responsibility} |

## Policy
- Enabled: {true|false}
- Mention Only: {true|false}
- Default Environment: {env_id}

## Skills
<!-- Allowed skills list -->
- {skill_1}
- {skill_2}

## Memory
<!-- Long-term project context -->
{memory_content}
```

**How to apply:**
- Backend reads this document to build `ProjectContextBundle`
- Backend writes updates to relevant sections
- Parser extracts structured data from markdown tables/lists

---

### 5. Auto-Sync Scope — Manual First, Auto Later

**Decision:** Phase rebuild-2 implements manual sync only. Auto-sync deferred to future phase.

**Why:**
- User stated: "这个阶段我们先做成用户手动同步，确保流程可debug"
- Manual sync validates API endpoints and config structure first
- Auto-sync adds webhook complexity — out of scope for this refactor

**How to apply:**
- `syncGroupInfo` method exists but not called automatically in `handleBotAddedEvent`
- User manually triggers via `/api/group-config/:chatId/sync` endpoint
- Config completion also manual via `/api/group-config/:chatId/complete`

---

### 6. Migration Strategy — Defer to Post-Phase

**Decision:** Migration of existing groups deferred. Focus on new groups first.

**Why:**
- Migration requires backfilling config docs for existing projects
- Data transformation complexity (7 docs → 1 config)
- Better to validate new flow on new groups first

**How to apply:**
- New groups use config-based flow
- Existing groups continue using current flow (no changes)
- Migration phase added to ROADMAP after rebuild-2

---

## Files to Modify

### Remove
- `handleUninitializedGroup()` conversational logic (feishu-event.service.ts:285-388)
- `collectProjectInitInfo()`, `fallbackProjectInitInfo()` (feishu-event.service.ts:390-496)
- `buildProjectInitPrompt()`, `parseProjectInitOutputs()` (feishu-event.service.ts:432-473)
- Pi SDK bootstrap request kind (`requestKind: 'bootstrap'`)

### Simplify
- `handleBotAddedEvent()` → call `GroupConfigService.syncGroupInfo()` (manual trigger for now)
- `handle()` → fixed response for uninitialized groups (remove conversational branch)
- `initFromChat()` → create single config doc instead of 7 skeleton docs

### Add
- `GroupConfigService` — configuration CRUD, config doc parser
- `GroupConfigController` — `/api/group-config/:chatId` endpoints
- `ProjectConfigParser` — extract structured data from `PROJECT-CONFIG.md`

---

## Constraints

1. **No UI in this phase** — Backend API only, no admin console
2. **No auto-sync** — Manual trigger via API endpoint
3. **No migration** — New groups only, existing groups untouched
4. **Config doc in Feishu Drive** — Not local file, uses existing Feishu document API
5. **Fixed response** — No Pi SDK calls for uninitialized groups

---

## Deferred Ideas

- Admin console UI for configuration management
- Auto-sync on bot added event + periodic sync
- Migration script for existing groups
- Config schema validation (JSON fallback)
- Config versioning/history

---

*Generated: 2026-05-03*