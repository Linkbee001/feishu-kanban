---
phase: 02-rebuild-2
plan: 01
status: complete
completed: 2026-05-04
commit: 4d48875
---

# Summary: Define Config Doc Structure

## Objective
Define the configuration document structure and add 'pending_config' session mode to replace 'bootstrap'.

## Tasks Completed

| Task | Description | Status |
|------|-------------|--------|
| Task 1 | Add pending_config to GroupSessionMode enum | ✓ Complete |
| Task 2 | Create config.types.ts with ProjectConfig interface | ✓ Complete |
| Task 3 | Add configDocToken field to Project model | ✓ Complete |

## Key Changes

### Prisma Schema (prisma/schema.prisma)
- Added `pending_config` value to `GroupSessionMode` enum (before `bootstrap`)
- Added `configDocToken` field to `Project` model for storing PROJECT-CONFIG.md document reference

### TypeScript Types (src/modules/agent/agent.types.ts)
- Added `'pending_config'` to `RuntimeSessionMode` type

### Config Types (src/modules/config/config.types.ts) - NEW FILE
Created configuration type system with:
- `ProjectConfigProject` interface (name, description, status)
- `ProjectConfigEnvironment` interface (name, repoUrl, repoBranch, modelName)
- `ProjectConfigMember` interface (name, openId, role, responsibilities)
- `ProjectConfigPolicy` interface (enabled, mentionOnly, defaultEnvironmentId)
- `ProjectConfig` interface (6 sections: project, environment, members, policy, skills, memory)
- `ProjectConfigParser` and `ProjectConfigParseResult` interfaces

### Type Compatibility Fixes
- Updated `sessionMode` parameter type in `pi-mono.adapter.ts:runManagerDecision()`
- Updated `sessionMode` parameter type in `project-runtime-context.service.ts:assemble()`

## Verification

```bash
npx prisma generate  # ✓ Success
npx tsc --noEmit     # ✓ Source compiles (test files have pre-existing errors)
```

## Artifacts Created

| File | Purpose |
|------|---------|
| src/modules/config/config.types.ts | Type definitions for configuration management |

## Deviations
None. All tasks executed as planned.

## Next Wave
Wave 2 (Plan 02-02) will create GroupConfigService and MarkdownProjectConfigParser using these type definitions.