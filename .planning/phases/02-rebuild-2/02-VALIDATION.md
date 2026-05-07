---
phase: 02-rebuild-2
padded_phase: 02
date: 2026-05-03
---

# Validation Strategy — Configuration Management

## Test Coverage Map

| Plan | Unit Tests | Integration Tests | E2E Tests |
|------|------------|-------------------|-----------|
| 02-01 | Prisma schema migration test | Enum migration verification | — |
| 02-02 | ProjectConfigParser.parse(), GroupConfigService CRUD | Config doc creation with Feishu API mock | — |
| 02-03 | Controller endpoint validation | Admin API request/response tests | — |
| 02-04 | Fixed response for pending_config mode | FeishuEventService.handle() integration | — |
| 02-05 | initFromChat simplified doc creation | Project creation integration | — |

## Key Test Cases

### Plan 01 — Config Doc Structure
- `test/prisma/schema.test.ts` — Verify `pending_config` enum value exists
- `test/modules/config/config.types.spec.ts` — Verify ConfigSection types match expected structure

### Plan 02 — GroupConfigService
- `test/modules/config/project-config-parser.spec.ts` — Parse markdown sections correctly
- `test/modules/config/group-config.service.spec.ts` — syncGroupInfo, completeConfig, updateConfig methods
- Mock FeishuService.createDocument/writeDocumentBlocks for config doc creation

### Plan 03 — GroupConfigController
- `test/modules/config/group-config.controller.spec.ts` — GET/POST endpoint validation
- Request body validation with class-validator

### Plan 04 — Remove Conversational Bootstrap
- `test/modules/feishu/feishu-event.service.spec.ts` — Verify fixed response for uninitialized groups
- Verify `handleUninitializedGroup` and conversational methods removed

### Plan 05 — Simplify initFromChat
- `test/modules/project/project.service.spec.ts` — Verify single PROJECT-CONFIG.md created
- Verify `createWorkspaceSkeleton` removed

## Validation Dimensions

| Dimension | Coverage | Notes |
|-----------|----------|-------|
| Type correctness | Unit | TypeScript compilation + Prisma generate |
| API contracts | Integration | Controller endpoint tests |
| Config doc parsing | Unit | Parser edge cases (missing sections, malformed) |
| Fixed response | Integration | Feishu event handling test |
| Doc creation | Integration | Feishu API mock |

## Mock Strategy

- **FeishuService:** Mock createDocument, writeDocumentBlocks, createProjectFolder
- **PrismaService:** Mock database operations for service tests
- **Redis:** Not needed for config module (no queue involvement)

---

*Generated: 2026-05-03*