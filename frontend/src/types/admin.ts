/**
 * Admin UI TypeScript types
 * Types for RobotInstance and AgentRun data from backend API
 */

import { ColumnDef } from '@tanstack/react-table';

/**
 * Status values for runtime and agent runs
 * Matches backend AgentRunStatus enum
 */
export type Status = 'queued' | 'running' | 'syncing' | 'succeeded' | 'failed';

/**
 * Session mode values for robot instances
 * Matches backend SessionMode enum
 */
export type SessionMode = 'bootstrap' | 'pending_config' | 'active';

/**
 * Robot instance data from backend API
 * Returned by /api/admin/robot-instances endpoint
 */
export interface RobotInstance {
  chatId: string;
  projectName: string;
  sessionMode: SessionMode;
  lastActiveAt: string; // ISO date string
  runtimeStatus: Status | null;
}

/**
 * Agent run data from backend API
 * Returned by /api/agent-runs endpoint
 */
export interface AgentRun {
  id: string;
  status: Status;
  prompt: string;
  createdAt: string; // ISO date string
}

/**
 * Column definition type alias for RobotInstance table
 * Used by TanStack Table in RobotInstanceTable component
 */
export type RobotInstanceColumns = ColumnDef<RobotInstance>[];