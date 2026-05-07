/**
 * Frontend test fixture providing mock API responses for E2E tests.
 *
 * Mock data matches backend API response shapes from AdminService and AgentService.
 * Used in Playwright tests for consistent UI behavior verification.
 */

// TypeScript types matching backend return shapes
export interface MockRobotInstance {
  chatId: string;
  projectName: string;
  sessionMode: 'bootstrap' | 'pending_config' | 'active';
  lastActiveAt: string; // ISO date string
  runtimeStatus: 'queued' | 'running' | 'syncing' | 'succeeded' | 'failed' | null;
}

export interface MockAgentRun {
  id: string;
  status: 'queued' | 'running' | 'syncing' | 'succeeded' | 'failed';
  prompt: string;
  createdAt: string; // ISO date string
}

/**
 * Mock robot instances data for testing.
 * Includes 3 sample instances to test various session modes and runtime statuses.
 */
export const mockRobotInstances: MockRobotInstance[] = [
  {
    chatId: 'oc_test_instance_001',
    projectName: 'Production Monitoring System',
    sessionMode: 'active',
    lastActiveAt: '2026-05-07T10:30:00.000Z',
    runtimeStatus: 'running',
  },
  {
    chatId: 'oc_test_instance_002',
    projectName: 'Development Sandbox',
    sessionMode: 'pending_config',
    lastActiveAt: '2026-05-06T15:45:00.000Z',
    runtimeStatus: 'queued',
  },
  {
    chatId: 'oc_test_instance_003',
    projectName: 'Testing Environment',
    sessionMode: 'bootstrap',
    lastActiveAt: '2026-05-05T08:20:00.000Z',
    runtimeStatus: 'succeeded',
  },
];

/**
 * Mock agent runs data for testing.
 * Includes 5 sample runs to test pagination (D-08) and various statuses.
 */
export const mockAgentRuns: MockAgentRun[] = [
  {
    id: 'run_001',
    status: 'running',
    prompt: 'Generate a monitoring dashboard for the production system with real-time metrics',
    createdAt: '2026-05-07T10:35:00.000Z',
  },
  {
    id: 'run_002',
    status: 'succeeded',
    prompt: 'Create unit tests for the authentication module',
    createdAt: '2026-05-07T09:20:00.000Z',
  },
  {
    id: 'run_003',
    status: 'queued',
    prompt: 'Analyze codebase structure and suggest refactoring opportunities',
    createdAt: '2026-05-07T08:15:00.000Z',
  },
  {
    id: 'run_004',
    status: 'failed',
    prompt: 'Deploy to staging environment and run integration tests',
    createdAt: '2026-05-06T18:30:00.000Z',
  },
  {
    id: 'run_005',
    status: 'syncing',
    prompt: 'Update dependencies to latest versions and verify compatibility',
    createdAt: '2026-05-06T14:00:00.000Z',
  },
];

/**
 * Combined mock API responses object for easy import.
 */
export const mockApiResponses = {
  robotInstances: mockRobotInstances,
  agentRuns: mockAgentRuns,
};