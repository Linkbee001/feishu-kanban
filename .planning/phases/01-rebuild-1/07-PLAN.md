---
wave: 6
depends_on:
  - 06
files_modified:
  - prisma/schema.prisma
  - prisma/migrations/
requirements_addressed:
  - D-03
autonomous: false
---

# Plan 07: Database Migration

<objective>
Create and execute Prisma migration to remove GroupRuntimeTask table and update schema according to the simplified architecture.
</objective>

<read_first>
- prisma/schema.prisma — Updated schema from Plan 06
- .planning/phases/01-rebuild-1/01-CONTEXT.md — Data model changes summary
</read_first>

<acceptance_criteria>
- New migration file created in prisma/migrations/
- Migration removes:
  - `group_runtime_tasks` table
  - `GroupRuntimeTaskStatus` enum
  - `current_runtime_task_id` column from `group_agent_sessions`
  - Relations between GroupRuntimeTask and other tables
- Migration preserves existing data:
  - GroupAgentSession records kept, currentRuntimeTaskId set to null
  - RuntimeEvent records preserved
- `npx prisma migrate dev` executes successfully
- `npx prisma generate` executes successfully
- Application starts without errors after migration
</acceptance_criteria>

<action>
**Step 1: Generate migration**

After schema changes from Plan 06:

```bash
npx prisma migrate dev --name remove_group_runtime_task
```

This will:
- Create a new migration file
- Apply the migration to the database
- Regenerate Prisma Client

**Step 2: Review migration SQL**

Check the generated migration file in `prisma/migrations/*/migration.sql`:

Expected operations:
- `ALTER TABLE "group_agent_sessions" DROP COLUMN "current_runtime_task_id"`
- `ALTER TABLE "confirmation_requests" DROP COLUMN "group_runtime_task_id"` (or keep as nullable)
- `DROP TABLE "group_runtime_tasks"`
- `DROP TYPE "GroupRuntimeTaskStatus"` (Postgres enum)

**Step 3: Handle foreign key constraints**

If migration fails due to foreign key constraints:

```sql
-- Manual step: Remove constraints before dropping table
ALTER TABLE "agent_runs" DROP CONSTRAINT IF EXISTS "agent_runs_runtime_task_id_fkey";
ALTER TABLE "artifacts" DROP CONSTRAINT IF EXISTS "artifacts_runtime_task_id_fkey";
ALTER TABLE "confirmation_requests" DROP CONSTRAINT IF EXISTS "confirmation_requests_group_runtime_task_id_fkey";
ALTER TABLE "group_agent_sessions" DROP CONSTRAINT IF EXISTS "group_agent_sessions_current_runtime_task_id_fkey";
```

**Step 4: Run migration in transaction**

```bash
npx prisma migrate dev --name remove_group_runtime_task --create-only
# Review SQL, then apply:
npx prisma migrate deploy
```

**Step 5: Regenerate Prisma Client**

```bash
npx prisma generate
```

**Step 6: Verify application starts**

```bash
npm run start
# Or for dev:
npm run start:dev
```

**Step 7: Clean up orphaned data (optional)**

If there are orphaned RuntimeEvent records referencing removed tasks:

```sql
-- Optional: Clean up orphaned events
DELETE FROM "runtime_events" 
WHERE "event_type" IN ('message_queued', 'message_collected', 'message_steered', 'message_interrupted', 'turn_started', 'turn_failed', 'todo_changed', 'reply_emitted', 'outputs_emitted', 'session_waiting', 'session_resumed');
```
</action>

<verification>
1. Migration applied successfully:
```bash
npx prisma migrate status
```
Expected: All migrations applied

2. Prisma Client generated:
```bash
npm run build
```
Expected: No TypeScript errors

3. Application starts:
```bash
npm run start:dev
# Wait for startup, check logs
```
Expected: No database connection errors

4. Verify table removed:
```sql
-- In database:
SELECT table_name FROM information_schema.tables WHERE table_name = 'group_runtime_tasks';
```
Expected: No rows (table removed)
</verification>

<rollback>
If migration fails, rollback:

```bash
npx prisma migrate resolve --rolled-back remove_group_runtime_task
```

Restore schema from previous state and regenerate:
```bash
git checkout prisma/schema.prisma
npx prisma generate
```
</rollback>