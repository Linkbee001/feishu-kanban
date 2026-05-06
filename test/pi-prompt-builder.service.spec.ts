import { PiPromptBuilder } from '../src/modules/agent/pi-prompt-builder.service';
import { createConfigMock } from './conftest';
import { PiMonoCreateRunRequest } from '../src/modules/agent/agent.types';

describe('PiPromptBuilder', () => {
  let promptBuilder: PiPromptBuilder;

  beforeEach(() => {
    promptBuilder = new PiPromptBuilder(createConfigMock() as any);
  });

  describe('buildPrompt', () => {
    function createPayload(overrides: Partial<PiMonoCreateRunRequest> = {}): PiMonoCreateRunRequest {
      return {
        runtimeSessionKey: 'chat:test_session:manager',
        project: {
          id: 'project_1',
          name: 'Test Project',
          feishuChatId: 'chat_test',
        },
        environment: {
          id: 'env_1',
          name: 'Default',
          repoUrl: null,
          repoBranch: null,
          repoMirrorPath: null,
          repoSyncStatus: 'unknown',
        },
        source: {
          messageSourceId: 'source_1',
        },
        intent: 'progress_summary',
        prompt: 'Test prompt',
        outputSchema: {},
        ...overrides,
      };
    }

    it('buildPrompt for formal_execution includes "This turn is a formal execution run"', () => {
      const payload = createPayload({ requestKind: 'formal_execution' });
      const prompt = promptBuilder.buildPrompt(payload);
      expect(prompt).toContain('This turn is a formal execution run that may produce persisted artifacts');
    });

    it('buildPrompt for interactive_decision includes "emit_decision exactly once"', () => {
      const payload = createPayload({ requestKind: 'interactive_decision' });
      const prompt = promptBuilder.buildPrompt(payload);
      expect(prompt).toContain('Call emit_decision exactly once with the final structured decision');
    });

    it('buildPrompt for group_runtime includes "This turn is a group runtime turn"', () => {
      const payload = createPayload({
        requestKind: 'group_runtime',
        projectContextBundle: {
          project: {
            id: 'project_1',
            name: 'Test Project',
            feishuChatId: 'chat_test',
          },
          environment: {
            id: 'env_1',
            name: 'Default',
          },
          session: {
            runtimeSessionKey: 'chat:test_session:manager',
            sessionMode: 'active',
            status: 'idle',
          },
          groupPolicy: {
            enabled: true,
            mentionOnly: true,
            allowedSkills: [],
            allowAutoTaskCreation: true,
            allowDocWrite: true,
            allowTaskBoardWrite: false,
            highRiskActionsRequireConfirmation: true,
          },
          memberProfiles: [],
          recentMessages: [],
          recentRuns: [],
          recentArtifacts: [],
          workspaceDocsSummary: [],
          folderEntries: [],
          folderEntriesTruncated: false,
          docSnapshots: [],
          bitableSnapshot: null,
        },
      });
      const prompt = promptBuilder.buildPrompt(payload);
      expect(prompt).toContain('This turn is a group runtime turn, not a formal execution run');
    });

    it('buildPrompt includes "## Execution Bias" section', () => {
      const payload = createPayload();
      const prompt = promptBuilder.buildPrompt(payload);
      expect(prompt).toContain('## Execution Bias');
    });

    it('buildPrompt includes "## Tooling" section', () => {
      const payload = createPayload();
      const prompt = promptBuilder.buildPrompt(payload);
      expect(prompt).toContain('## Tooling');
    });

    it('buildPrompt includes "## Runtime Policy" section', () => {
      const payload = createPayload();
      const prompt = promptBuilder.buildPrompt(payload);
      expect(prompt).toContain('## Runtime Policy');
    });
  });

  describe('buildExecutionBiasLines', () => {
    it('buildExecutionBiasLines for formal_execution includes "Final execution needs evidence"', () => {
      const lines = (promptBuilder as any).buildExecutionBiasLines('formal_execution');
      expect(lines).toContain('- Final execution needs evidence: emitted outputs, verified file inspection, repo inspection, or a named blocker.');
    });

    it('buildExecutionBiasLines for interactive_decision includes decision turn guidance', () => {
      const lines = (promptBuilder as any).buildExecutionBiasLines('interactive_decision');
      expect(lines).toContain('- This is a decision turn: end with exactly one emit_decision call, not emit_outputs.');
    });

    it('buildExecutionBiasLines for group_runtime includes runtime turn guidance', () => {
      const lines = (promptBuilder as any).buildExecutionBiasLines('group_runtime');
      expect(lines).toContain('- A successful runtime turn must include a group-facing reply.');
    });
  });

  describe('buildToolingLines', () => {
    it('buildToolingLines includes "Built-in local tools: read, grep, find, ls"', () => {
      const payload = {
        environment: {
          repoMirrorPath: null,
          repoSyncStatus: 'unknown',
        },
      } as any;
      const lines = (promptBuilder as any).buildToolingLines(payload, false);
      expect(lines).toContain('- Built-in local tools: read, grep, find, ls.');
    });

    it('buildToolingLines for group_runtime includes runtime tools', () => {
      const payload = {
        environment: {
          repoMirrorPath: null,
          repoSyncStatus: 'unknown',
        },
      } as any;
      const lines = (promptBuilder as any).buildToolingLines(payload, true);
      expect(lines).toContain('- Runtime tools: todo_list, todo_write, reply_group, request_group_confirmation, emit_outputs.');
    });

    it('buildToolingLines for non-group_runtime excludes runtime tools', () => {
      const payload = {
        environment: {
          repoMirrorPath: null,
          repoSyncStatus: 'unknown',
        },
      } as any;
      const lines = (promptBuilder as any).buildToolingLines(payload, false);
      expect(lines).toContain('- Runtime tools for queue and group replies are not available in this request kind.');
    });
  });

  describe('buildRuntimePolicyLines', () => {
    it('buildRuntimePolicyLines for group_runtime includes "Human confirmation must go through request_group_confirmation"', () => {
      const payload = {
        projectContextBundle: {
          groupPolicy: {
            allowDocWrite: true,
            allowTaskBoardWrite: false,
          },
        },
      } as any;
      const lines = (promptBuilder as any).buildRuntimePolicyLines(payload, 'group_runtime', 'repo_unconfigured');
      expect(lines).toContain('- Human confirmation must go through request_group_confirmation and then stop the blocked task in waiting_confirmation.');
    });

    it('buildRuntimePolicyLines for formal_execution includes emit_outputs guidance', () => {
      const lines = (promptBuilder as any).buildRuntimePolicyLines({} as any, 'formal_execution', 'repo_unconfigured');
      expect(lines).toContain('- Formal execution should finish with emit_outputs exactly once when the result is ready.');
    });

    it('buildRuntimePolicyLines for interactive_decision includes decision-only guidance', () => {
      const lines = (promptBuilder as any).buildRuntimePolicyLines({} as any, 'interactive_decision', 'repo_unconfigured');
      expect(lines).toContain('- Do not start formal execution in a decision turn; decide only the next safe interaction step.');
    });
  });

  describe('describeRepoCapabilityState', () => {
    it('describeRepoCapabilityState returns "repo_unconfigured" when no repoUrl', () => {
      const payload = {
        environment: {
          repoUrl: null,
          repoSyncStatus: null,
        },
      } as any;
      const state = (promptBuilder as any).describeRepoCapabilityState(payload);
      expect(state).toBe('repo_unconfigured');
    });

    it('describeRepoCapabilityState returns "repo_ready" when repoSyncStatus is ready', () => {
      const payload = {
        environment: {
          repoUrl: 'https://github.com/test/repo',
          repoSyncStatus: 'ready',
        },
      } as any;
      const state = (promptBuilder as any).describeRepoCapabilityState(payload);
      expect(state).toBe('repo_ready');
    });

    it('describeRepoCapabilityState returns "repo_error" when repoSyncStatus is error', () => {
      const payload = {
        environment: {
          repoUrl: 'https://github.com/test/repo',
          repoSyncStatus: 'error',
        },
      } as any;
      const state = (promptBuilder as any).describeRepoCapabilityState(payload);
      expect(state).toBe('repo_error');
    });

    it('describeRepoCapabilityState returns "repo_initializing" when repoUrl but not ready', () => {
      const payload = {
        environment: {
          repoUrl: 'https://github.com/test/repo',
          repoSyncStatus: 'pending',
        },
      } as any;
      const state = (promptBuilder as any).describeRepoCapabilityState(payload);
      expect(state).toBe('repo_initializing');
    });
  });

  describe('describeRecentDocs', () => {
    it('describeRecentDocs returns "none" when no workspaceDocsSummary', () => {
      const payload = {
        projectContextBundle: null,
      } as any;
      const description = (promptBuilder as any).describeRecentDocs(payload);
      expect(description).toBe('none');
    });

    it('describeRecentDocs formats doc titles with dates', () => {
      const payload = {
        projectContextBundle: {
          workspaceDocsSummary: [
            { title: 'PRD', updatedAt: '2026-04-30T00:00:00.000Z' },
            { title: 'Design Doc', updatedAt: '2026-04-29T00:00:00.000Z' },
          ],
        },
      } as any;
      const description = (promptBuilder as any).describeRecentDocs(payload);
      expect(description).toBe('PRD (2026-04-30T00:00:00.000Z); Design Doc (2026-04-29T00:00:00.000Z)');
    });

    it('describeRecentDocs formats doc titles without dates', () => {
      const payload = {
        projectContextBundle: {
          workspaceDocsSummary: [
            { title: 'PRD', updatedAt: null },
          ],
        },
      } as any;
      const description = (promptBuilder as any).describeRecentDocs(payload);
      expect(description).toBe('PRD');
    });
  });

  describe('describeTaskBoardSummary', () => {
    it('describeTaskBoardSummary returns "none" when no bitableSnapshot', () => {
      const payload = {
        projectContextBundle: null,
      } as any;
      const description = (promptBuilder as any).describeTaskBoardSummary(payload);
      expect(description).toBe('none');
    });

    it('describeTaskBoardSummary formats task board counts', () => {
      const payload = {
        projectContextBundle: {
          bitableSnapshot: {
            totalTasks: 10,
            openTasks: 5,
            blockedTasks: 2,
            overdueTasks: 1,
          },
        },
      } as any;
      const description = (promptBuilder as any).describeTaskBoardSummary(payload);
      expect(description).toBe('total=10, open=5, blocked=2, overdue=1');
    });
  });

  describe('describeRecentArtifacts', () => {
    it('describeRecentArtifacts returns "none" when no recentArtifacts', () => {
      const payload = {
        projectContextBundle: null,
      } as any;
      const description = (promptBuilder as any).describeRecentArtifacts(payload);
      expect(description).toBe('none');
    });

    it('describeRecentArtifacts formats artifact type and title', () => {
      const payload = {
        projectContextBundle: {
          recentArtifacts: [
            { type: 'document', title: 'Kickoff Notes' },
            { type: 'task', title: 'Setup Task' },
          ],
        },
      } as any;
      const description = (promptBuilder as any).describeRecentArtifacts(payload);
      expect(description).toBe('document:Kickoff Notes; task:Setup Task');
    });
  });
});