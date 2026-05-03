---
plan: 07
phase: rebuild-1
status: complete
wave: 6
depends_on: [06]
files_modified:
  - prisma/migrations/20260503135010_remove_group_runtime_task/migration.sql
---

# Plan 07: Database Migration

## Objective

Create and execute Prisma migration to remove GroupRuntimeTask table and update schema according to the simplified architecture.

## Execution Summary

### Database Setup

Created PostgreSQL database from scratch:
- User: `feishu` (SUPERUSER)
- Database: `feishu_kanban`
- Applied 9 existing migrations to initialize the database

### Migration Created

Migration `20260503135010_remove_group_runtime_task`:
- Dropped `group_runtime_tasks` table
- Dropped `GroupRuntimeTaskStatus` enum
- Removed `current_runtime_task_id` column from `group_agent_sessions`
- Removed `group_runtime_task_id` columns from:
  - `agent_runs`
  - `artifacts`
  - `confirmation_requests`
- Removed all foreign key constraints referencing the removed table

### Verification

- `npx prisma migrate deploy` — All migrations applied successfully
- `npx prisma generate` — Prisma Client regenerated
- `npm run build` — TypeScript compilation passed

## Deviations

None - the database was created fresh so no data loss occurred.

## Key Files Created

- `prisma/migrations/20260503135010_remove_group_runtime_task/migration.sql` — 62-line migration removing the infrastructure

## Next Steps

Phase rebuild-1 is now complete. All 7 plans executed:
- Wave 1: Type system defined
- Wave 2: Session state service created
- Wave 3: PiMonoAdapter simplified
- Wave 4: GroupRuntimeService and GroupAgentSessionService simplified
- Wave 5: GroupRuntimeTask infrastructure removed
- Wave 6: Database migrated

The group runtime now uses the simplified three-state enum (`RuntimeState`) and Pi SDK's built-in steer/followUp methods instead of the complex custom queue mechanisms.