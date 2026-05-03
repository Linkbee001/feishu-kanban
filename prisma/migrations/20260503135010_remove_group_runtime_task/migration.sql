/*
  Warnings:

  - You are about to drop the column `group_runtime_task_id` on the `agent_runs` table. All the data in the column will be lost.
  - You are about to drop the column `group_runtime_task_id` on the `artifacts` table. All the data in the column will be lost.
  - You are about to drop the column `group_runtime_task_id` on the `confirmation_requests` table. All the data in the column will be lost.
  - You are about to drop the column `current_runtime_task_id` on the `group_agent_sessions` table. All the data in the column will be lost.
  - You are about to drop the `group_runtime_tasks` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "agent_runs" DROP CONSTRAINT "agent_runs_group_runtime_task_id_fkey";

-- DropForeignKey
ALTER TABLE "artifacts" DROP CONSTRAINT "artifacts_group_runtime_task_id_fkey";

-- DropForeignKey
ALTER TABLE "confirmation_requests" DROP CONSTRAINT "confirmation_requests_group_runtime_task_id_fkey";

-- DropForeignKey
ALTER TABLE "group_agent_sessions" DROP CONSTRAINT "group_agent_sessions_current_runtime_task_id_fkey";

-- DropForeignKey
ALTER TABLE "group_runtime_tasks" DROP CONSTRAINT "group_runtime_tasks_environment_id_fkey";

-- DropForeignKey
ALTER TABLE "group_runtime_tasks" DROP CONSTRAINT "group_runtime_tasks_group_session_id_fkey";

-- DropForeignKey
ALTER TABLE "group_runtime_tasks" DROP CONSTRAINT "group_runtime_tasks_message_source_id_fkey";

-- DropForeignKey
ALTER TABLE "group_runtime_tasks" DROP CONSTRAINT "group_runtime_tasks_project_id_fkey";

-- DropIndex
DROP INDEX "group_agent_sessions_current_runtime_task_id_key";

-- AlterTable
ALTER TABLE "agent_runs" DROP COLUMN "group_runtime_task_id";

-- AlterTable
ALTER TABLE "artifacts" DROP COLUMN "group_runtime_task_id";

-- AlterTable
ALTER TABLE "confirmation_requests" DROP COLUMN "group_runtime_task_id";

-- AlterTable
ALTER TABLE "group_agent_sessions" DROP COLUMN "current_runtime_task_id",
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "group_policies" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "project_member_profiles" ALTER COLUMN "updated_at" DROP DEFAULT;

-- DropTable
DROP TABLE "group_runtime_tasks";

-- DropEnum
DROP TYPE "GroupRuntimeTaskStatus";
