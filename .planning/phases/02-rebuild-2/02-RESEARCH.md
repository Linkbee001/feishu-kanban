# Phase 02: Configuration Management - Research

**Researched:** 2026-05-03
**Domain:** Configuration management, Feishu document API, NestJS service/controller patterns
**Confidence:** HIGH

## Summary

This phase replaces the conversational bootstrap flow with explicit backend configuration management. The current implementation uses Pi SDK to conversationally collect project initialization info, then creates 7 skeleton documents. The new approach uses a single `PROJECT-CONFIG.md` document and fixed response for uninitialized groups, removing Pi SDK dependency from the initialization flow entirely.

**Primary recommendation:** Create `GroupConfigService` with document CRUD and parsing capabilities. Add `GroupSessionMode.pending_config` enum value. Remove conversational bootstrap logic from `feishu-event.service.ts`. Fixed response pattern already exists for disabled groups - replicate for uninitialized groups.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
1. Config File Format — Markdown (PROJECT-CONFIG.md)
2. Backend Configuration Approach — Dedicated GroupConfigService module (no UI)
3. Initialization Flow — Fixed response + backend completion (no conversational bootstrap)
4. Config File Structure — Single document with Project, Environment, Members, Policy, Skills, Memory sections
5. Auto-Sync Scope — Manual first, auto later (deferred)
6. Migration Strategy — Defer to post-phase (new groups only)

### Claude's Discretion
- Implementation details of ProjectConfigParser (regex-based vs AST-based)
- Error handling strategies for malformed config documents
- Test coverage scope for new services

### Deferred Ideas (OUT OF SCOPE)
- Admin console UI for configuration management
- Auto-sync on bot added event + periodic sync
- Migration script for existing groups
- Config schema validation (JSON fallback)
- Config versioning/history
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-01 | Define config doc structure | Section: Config File Structure - markdown template with 6 sections |
| REQ-02 | Create GroupConfigService | Sections: Existing Service Patterns, Feishu Document API |
| REQ-03 | Create GroupConfigController | Section: Existing Controller Patterns |
| REQ-04 | Remove conversational bootstrap | Section: Current Bootstrap Implementation |
| REQ-05 | Simplify initFromChat | Section: Current Project Creation Flow |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Configuration CRUD | API/Backend | — | Backend owns config state, not client |
| Config document storage | Feishu Drive (External) | — | User edits in Feishu docs UI |
| Config parsing | API/Backend | — | Parser extracts structured data from markdown |
| Session mode management | API/Backend | — | GroupAgentSessionService manages mode transitions |
| Fixed response routing | API/Backend | — | FeishuEventService handles uninitialized groups |
| Project creation | API/Backend | Feishu API | ProjectService orchestrates resource creation |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| NestJS | 11.1.9 | Backend framework | Existing codebase standard [VERIFIED: package.json] |
| Prisma | 6.18.0 | Database ORM | Existing codebase standard [VERIFIED: package.json] |
| Jest | 30.2.0 | Testing framework | Existing test infrastructure [VERIFIED: package.json] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| class-validator | 0.14.2 | DTO validation | Controller request validation [VERIFIED: package.json] |
| Joi | 18.0.1 | Schema validation | Config schema validation if needed [VERIFIED: package.json] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom markdown parser | marked.js library | marked.js adds dependency; simple regex sufficient for structured sections |
| JSON config format | YAML format | User chose Markdown for Feishu-native editing experience |

**Installation:** No new dependencies required for core implementation. All needed packages already in package.json.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Entry Points                                 │
├──────────────────────────┬──────────────────────────────────────────┤
│   Feishu Webhook         │         Admin API                        │
│   (im.chat.member.bot)   │   /api/group-config/:chatId              │
└──────────────────────────┴──────────────────────────────────────────┤
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Configuration Flow (NEW)                          │
├─────────────────────────────────────────────────────────────────────┤
│  handleBotAddedEvent()                                               │
│      ↓                                                               │
│  GroupConfigService.syncGroupInfo() ← Manual trigger (deferred)     │
│      ↓                                                               │
│  Create GroupAgentSession (sessionMode: 'pending_config')           │
│      ↓                                                               │
│  First @mention → Fixed response (no Pi SDK)                        │
│      ↓                                                               │
│  Admin calls /api/group-config/:chatId/complete                     │
│      ↓                                                               │
│  GroupConfigService.completeConfig()                                │
│      ↓                                                               │
│  Create PROJECT-CONFIG.md (single doc)                              │
│      ↓                                                               │
│  ProjectService.initFromChat() → Project + Environment              │
│      ↓                                                               │
│  GroupAgentSession.bindProjectSession() → mode: 'active'            │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Bootstrap Flow (REMOVE)                           │
├─────────────────────────────────────────────────────────────────────┤
│  handleUninitializedGroup() ← DELETE                                │
│  collectProjectInitInfo() ← DELETE (Pi SDK conversational)          │
│  fallbackProjectInitInfo() ← DELETE                                 │
│  buildProjectInitPrompt() ← DELETE                                  │
│  parseProjectInitOutputs() ← DELETE                                 │
│  7 skeleton docs ← REPLACE with single PROJECT-CONFIG.md            │
└─────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
src/modules/
├── config/                     # NEW module for configuration management
│   ├── config.module.ts        # Module definition
│   ├── group-config.service.ts # Configuration CRUD + parsing
│   ├── group-config.controller.ts # /api/group-config endpoints
│   ├── project-config.parser.ts   # Markdown parser for PROJECT-CONFIG.md
│   └── config.types.ts         # Config DTOs and interfaces
├── project/
│   ├── project.service.ts      # Simplified initFromChat()
│   └── project.module.ts       # Import ConfigModule
├── feishu/
│   ├── feishu-event.service.ts # Remove bootstrap logic, add fixed response
│   └── feishu.service.ts       # Existing document API (no changes)
├── agent/
│   ├── group-agent-session.service.ts # Add pending_config mode handling
│   └── agent.types.ts          # Update GroupSessionMode enum
```

### Pattern 1: NestJS Service with Prisma

**What:** Injectable service with PrismaService dependency for database operations
**When to use:** All new services that need database persistence
**Example:**
```typescript
// Source: src/modules/agent/session-state.service.ts [VERIFIED: codebase]
@Injectable()
export class SessionStateService {
  private readonly logger = new Logger(SessionStateService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getState(sessionId: string): Promise<RuntimeState> {
    const session = await this.prisma.groupAgentSession.findUnique({
      where: { id: sessionId },
      select: { runtimeStateJson: true },
    });
    return this.parseRuntimeStateJson(session?.runtimeStateJson);
  }
}
```

### Pattern 2: Admin Controller with Guard

**What:** Controller with AdminAuthGuard for protected admin endpoints
**When to use:** All admin API endpoints that require authentication
**Example:**
```typescript
// Source: src/modules/project/project.controller.ts [VERIFIED: codebase]
@UseGuards(AdminAuthGuard)
@Controller('api/projects')
export class ProjectController {
  constructor(private readonly projects: ProjectService) {}

  @Post('init-from-chat')
  init(@Body() body: any) {
    return this.projects.initFromChat(body);
  }

  @Get('by-chat/:chatId')
  findByChat(@Param('chatId') chatId: string) {
    return this.projects.findByChat(chatId);
  }
}
```

### Pattern 3: Feishu Document Creation

**What:** Create document with markdown content via Feishu API
**When to use:** Creating PROJECT-CONFIG.md or any Feishu document
**Example:**
```typescript
// Source: src/modules/feishu/feishu.service.ts [VERIFIED: codebase]
async createDocument(
  title: string,
  folderToken?: string,
  markdown?: string,
): Promise<{ token: string; url?: string }> {
  const data = await this.request<any>('/docx/v1/documents', {
    method: 'POST',
    body: { title, folder_token: folderToken },
  });
  const token = data?.data?.document?.document_id;
  if (token && markdown?.trim()) {
    await this.writeDocumentBlocks(token, markdown);
  }
  return { token, url: this.documentUrl(token) };
}

async writeDocumentBlocks(documentId: string, markdown: string) {
  const converted = await this.request<any>('/docx/v1/documents/blocks/convert', {
    method: 'POST',
    body: { content: markdown, content_type: 'markdown' },
  });
  // ... write blocks to document
}
```

### Anti-Patterns to Avoid

- **Calling Pi SDK for bootstrap:** Pi SDK should only be used for active agent runs, not initialization [CITED: CONTEXT.md Decision 3]
- **Creating 7 skeleton documents:** Single PROJECT-CONFIG.md replaces all 7 docs [CITED: CONTEXT.md Decision 4]
- **Conversational extraction:** Fixed response replaces conversation flow [CITED: CONTEXT.md Decision 3]
- **Auto-sync on bot added:** Manual trigger only for this phase [CITED: CONTEXT.md Decision 5]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Feishu document creation | Custom API client | `FeishuService.createDocument()` | Existing tested implementation |
| Feishu document writing | Raw HTTP calls | `FeishuService.writeDocumentBlocks()` | Handles markdown conversion |
| Session mode transitions | Custom state machine | `GroupAgentSessionService.getOrCreateSession()` | Existing pattern handles mode updates |
| Fixed response for uninitialized | New Pi SDK flow | Fixed message pattern from disabled groups | Simpler, no Pi SDK dependency |

**Key insight:** The fixed response pattern already exists for disabled groups in `feishu-event.service.ts:165-170`. Replicate this pattern for `pending_config` mode.

## Runtime State Inventory

> This phase does not involve rename/refactor/migration of existing data. New groups only.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — new groups only | No migration |
| Live service config | None — new endpoints | Add GroupConfigController |
| OS-registered state | None | — |
| Secrets/env vars | None — uses existing Feishu credentials | — |
| Build artifacts | None — TypeScript compilation only | — |

## Current Bootstrap Implementation (to be removed)

### handleUninitializedGroup (lines 285-388)
**What:** Handles @mention in group without project binding
**Flow:**
1. Creates session with `sessionMode: 'bootstrap'`
2. Acquires lock to prevent concurrent bootstrap
3. Gets existing draft from session state
4. Calls `collectProjectInitInfo()` to extract info via Pi SDK
5. Merges draft with extracted info
6. If ready → calls `projects.initFromChat()` → binds project
7. If not ready → updates bootstrap state → asks user for more info

**Problems:**
- Pi SDK dependency for simple info collection
- Conversational flow may miss required fields
- No modification mechanism after initialization
- 7 skeleton documents created

### collectProjectInitInfo (lines 390-412)
**What:** Uses Pi SDK to conversationally extract project info
**Flow:**
1. Builds prompt with current draft and user message
2. Calls `piMono.runPrompt()` with intent 'project_init'
3. Parses JSON response from AgentOutput
4. Falls back to `fallbackProjectInitInfo()` if Pi SDK fails

### fallbackProjectInitInfo (lines 475-496)
**What:** Regex-based fallback when Pi SDK fails
**Extracts:**
- `repoUrl` via `https?://\S+` pattern
- `repoBranch` via `(分支|branch)[:：]?\s*([A-Za-z0-9/_-]+)`
- `name` via `(初始化项目|创建项目|项目名称)\s*[:：]?\s*([^\n，,。]+)`

**Note:** This fallback pattern can be reused in ProjectConfigParser for simple extraction.

### createWorkspaceSkeleton (project.service.ts lines 377-432)
**What:** Creates 7 skeleton documents
**Documents:**
1. PROJECT.md — project name and description
2. MEMBERS.md — member roles placeholder
3. RULES.md — default rules
4. MEMORY.md — long-term context placeholder
5. SKILLS.md — skills placeholder
6. ENV.md — environment config
7. TASKS.md — task governance

**Replace with:** Single PROJECT-CONFIG.md with all sections.

## Current Project Creation Flow (to be simplified)

### initFromChat (project.service.ts lines 21-183)
**What:** Creates complete project infrastructure
**Steps:**
1. Validates input (name, ownerOpenId, feishuChatId required)
2. Creates Feishu folder via `feishu.createProjectFolder()`
3. Creates Bitable via `feishu.createTaskBitable()`
4. Grants permissions to owner
5. Creates Project record in database
6. Creates Environment via `environments.create()`
7. Updates Project with defaultEnvironmentId
8. Binds session via `groupSessions.bindProjectSession()`
9. Creates default policy via `policies.ensureDefaultPolicy()`
10. Syncs members via `memberProfiles.syncChatMembers()`
11. Creates workspace skeleton (7 docs) ← **Replace with PROJECT-CONFIG.md**
12. Creates chat tabs
13. Sends confirmation message

**Simplification:** Replace step 11 with `GroupConfigService.createConfigDocument()`.

## Feishu Document API Capabilities

| Method | Purpose | Parameters |
|--------|---------|------------|
| `createDocument(title, folderToken?, markdown?)` | Create new document | title, optional folder, optional initial content |
| `writeDocumentBlocks(documentId, markdown)` | Write markdown content | document ID, markdown string |
| `getDocument(documentId)` | Get document metadata | document ID |
| `getDocumentRawContent(documentId)` | Get raw content | document ID |
| `createProjectFolder(name)` | Create folder | folder name |
| `listDriveFiles(folderToken)` | List folder contents | folder token |

**Document URL format:** `https://feishu.cn/docx/{documentId}`

**Conversion API:** `/docx/v1/documents/blocks/convert` converts markdown to Feishu block structure.

## Config File Structure

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

**Parsing approach:** Regex-based section extraction. Each section header (`## SectionName`) demarcates content. Extract key-value pairs with `- Key: Value` pattern. Extract table rows for Members section.

## Common Pitfalls

### Pitfall 1: Enum Migration Requires Database Change
**What goes wrong:** Adding `pending_config` to `GroupSessionMode` enum requires Prisma migration
**Why it happens:** Prisma enums are database-level in PostgreSQL
**How to avoid:** Create migration first before code changes
**Warning signs:** Type errors in `GroupAgentSessionService.getOrCreateSession()`

### Pitfall 2: Feishu Document Conversion API Limitations
**What goes wrong:** Complex markdown may not convert correctly to Feishu blocks
**Why it happens:** Feishu's markdown conversion has limitations (tables, code blocks)
**How to avoid:** Test conversion with actual config template before production
**Warning signs:** Missing content in created documents

### Pitfall 3: Fixed Response Without Pi SDK State Cleanup
**What goes wrong:** Session may have stale Pi SDK state from previous bootstrap attempts
**Why it happens:** Removing bootstrap logic doesn't clean up existing Pi sessions
**How to avoid:** Clear `runtimeSessionKey` and Pi state when transitioning to `pending_config`
**Warning signs:** Pi SDK errors on first mention after mode change

### Pitfall 4: Missing Config Doc Token Storage
**What goes wrong:** Config document created but token not stored anywhere
**Why it happens:** Need new field on Project or GroupAgentSession to store config doc reference
**How to avoid:** Add `configDocToken` field to Project model or store in session state
**Warning signs:** Config doc URL not available for updates

## Code Examples

### Fixed Response for Uninitialized Group (Pattern to Replicate)

```typescript
// Source: src/modules/feishu/feishu-event.service.ts:165-170 [VERIFIED: codebase]
const groupPolicy = sourceType === 'group' ? await this.policies.findByChat(chatId) : null;
if (sourceType === 'group' && groupPolicy && !groupPolicy.enabled) {
  if (parsedMessage.isBotMentioned) {
    await this.feishu.sendTextMessage('chat_id', chatId, '当前群机器人实例已被停用，请先在控制台重新启用。');
  }
  return;
}
```

**New pattern for uninitialized groups:**
```typescript
// Pattern to implement
const session = await this.groupSessions.getOrCreateSession(chatId, {
  feishuChatId: chatId,
  sessionMode: 'pending_config', // NEW mode
});
if (session.sessionMode === 'pending_config') {
  if (parsedMessage.isBotMentioned) {
    await this.feishu.sendTextMessage(
      'chat_id',
      chatId,
      '本群未完成项目配置，请先在后台完成初始化。配置地址：/api/group-config/{chatId}',
    );
  }
  return;
}
```

### Markdown Section Parser (Recommended Approach)

```typescript
// Pattern to implement in ProjectConfigParser
export class ProjectConfigParser {
  parse(markdown: string): ProjectConfig {
    const sections = this.extractSections(markdown);
    return {
      project: this.parseProjectSection(sections['Project'] ?? ''),
      environment: this.parseEnvironmentSection(sections['Environment'] ?? ''),
      members: this.parseMembersSection(sections['Members'] ?? ''),
      policy: this.parsePolicySection(sections['Policy'] ?? ''),
      skills: this.parseSkillsSection(sections['Skills'] ?? ''),
      memory: sections['Memory'] ?? '',
    };
  }

  private extractSections(markdown: string): Record<string, string> {
    const result: Record<string, string> = {};
    const sectionRegex = /^##\s+(\w+)\n([\s\S]*?)(?=\n##\s+\w+|\n*$)/gm;
    let match;
    while ((match = sectionRegex.exec(markdown)) !== null) {
      result[match[1]] = match[2].trim();
    }
    return result;
  }

  private parseProjectSection(content: string): ProjectConfigProject {
    const nameMatch = content.match(/^-\s+Name:\s*(.+)$/m);
    const descMatch = content.match(/^-\s+Description:\s*(.+)$/m);
    const statusMatch = content.match(/^-\s+Status:\s*(.+)$/m);
    return {
      name: nameMatch?.[1]?.trim() ?? '',
      description: descMatch?.[1]?.trim() ?? '',
      status: statusMatch?.[1]?.trim() ?? 'pending',
    };
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Conversational bootstrap | Fixed response + backend config | This phase | Removes Pi SDK from initialization |
| 7 skeleton docs | Single PROJECT-CONFIG.md | This phase | Simplifies document management |
| Pi SDK `requestKind: 'bootstrap'` | No Pi SDK call | This phase | Cleaner separation of concerns |

**Deprecated/outdated:**
- `GroupSessionMode.bootstrap`: Will be replaced by `pending_config`
- `handleUninitializedGroup()`: Entire function to be removed
- `collectProjectInitInfo()`: Pi SDK conversational extraction removed
- `createWorkspaceSkeleton()`: 7 docs creation replaced by single config doc

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Regex parsing sufficient for config markdown | Config File Structure | May need marked.js for complex cases |
| A2 | No new database fields needed for config doc storage | Common Pitfalls | May need configDocToken field on Project |

**Validation needed:** Test Feishu markdown conversion API with actual config template before finalizing parser implementation.

## Open Questions (RESOLVED)

1. **configDocToken storage location** — RESOLVED: Store on Project model as new field `configDocToken`. This provides durability and aligns with existing `docFolderToken` pattern. Plan 02-01 Task 1 adds this field via Prisma migration.

2. **GroupConfigService module location** — RESOLVED: New ConfigModule for separation of concerns. ConfigModule imports FeishuModule for document API, PrismaModule for database access. Imported by AdminModule for controller registration.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL | Config storage | ✓ | Prisma 6.18 | — |
| Redis | Session locking | ✓ | ioredis 5.8 | — |
| Feishu API | Document CRUD | ✓ | @larksuiteoapi 1.61 | — |
| Jest | Test framework | ✓ | 30.2.0 | — |

**Missing dependencies with no fallback:** None — all dependencies available.

**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 30.2.0 [VERIFIED: package.json] |
| Config file | jest.config.ts [VERIFIED: codebase] |
| Quick run command | `npm run test` |
| Full suite command | `npm run test:group-runtime` (for feishu-event tests) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-01 | Config doc structure defined | unit | `jest test/group-config.service.spec.ts` | ❌ Wave 0 |
| REQ-02 | GroupConfigService CRUD works | unit | `jest test/group-config.service.spec.ts` | ❌ Wave 0 |
| REQ-03 | GroupConfigController endpoints work | unit | `jest test/group-config.controller.spec.ts` | ❌ Wave 0 |
| REQ-04 | Bootstrap logic removed | unit | `jest test/feishu-event.service.spec.ts` | ✅ Existing |
| REQ-05 | initFromChat simplified | unit | `jest test/project.service.spec.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test` (quick subset)
- **Per wave merge:** `npm run test:group-runtime`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `test/group-config.service.spec.ts` — covers REQ-01, REQ-02
- [ ] `test/group-config.controller.spec.ts` — covers REQ-03
- [ ] `test/project-config.parser.spec.ts` — covers parser logic
- [ ] `test/project.service.spec.ts` — covers REQ-05 (simplified initFromChat)
- [ ] Prisma migration for `pending_config` enum value

## Security Domain

> Phase involves admin API endpoints for configuration management.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | AdminAuthGuard on controller endpoints |
| V3 Session Management | no | — |
| V4 Access Control | yes | AdminAuthGuard restricts to admin users |
| V5 Input Validation | yes | class-validator DTOs on controller |
| V6 Cryptography | no | — |

### Known Threat Patterns for NestJS Admin API

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthorized config modification | Tampering | AdminAuthGuard validates admin token |
| Invalid config data injection | Tampering | class-validator DTO validation |
| Config doc URL enumeration | Information Disclosure | Use document ID, not predictable names |

## Sources

### Primary (HIGH confidence)
- src/modules/feishu/feishu-event.service.ts — bootstrap flow implementation [VERIFIED: codebase]
- src/modules/project/project.service.ts — initFromChat and createWorkspaceSkeleton [VERIFIED: codebase]
- src/modules/feishu/feishu.service.ts — document API methods [VERIFIED: codebase]
- src/modules/agent/group-agent-session.service.ts — session mode management [VERIFIED: codebase]
- prisma/schema.prisma — GroupSessionMode enum [VERIFIED: codebase]
- test/feishu-event.service.spec.ts — existing test patterns [VERIFIED: codebase]

### Secondary (MEDIUM confidence)
- CONTEXT.md decisions locked — user constraints [CITED: planning context]

### Tertiary (LOW confidence)
- None — all findings verified from codebase or cited from context

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all from verified codebase
- Architecture: HIGH — patterns from existing codebase
- Pitfalls: MEDIUM — some based on assumed migration complexity

**Research date:** 2026-05-03
**Valid until:** 30 days — stable NestJS/Prisma patterns