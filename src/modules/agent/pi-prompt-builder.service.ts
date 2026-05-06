import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PiMonoCreateRunRequest } from './agent.types';

/**
 * Pure function service for prompt assembly.
 * Extracted from pi-mono.adapter.ts for responsibility decomposition (D-01, D-02).
 * Builds prompts for all request kinds: formal_execution, interactive_decision, group_runtime, bootstrap.
 */
@Injectable()
export class PiPromptBuilder {
  constructor(private readonly config: ConfigService) {}

  /**
   * Build the complete prompt for a PiMono run request.
   * Assembles prompt guidance, execution bias, tooling lines, runtime policy, and runtime context.
   * @param payload The run request payload
   * @returns The assembled prompt string
   */
  buildPrompt(payload: PiMonoCreateRunRequest): string {
    const requestKind = payload.requestKind ?? 'formal_execution';
    const decisionMode = requestKind === 'interactive_decision';
    const groupRuntimeMode = requestKind === 'group_runtime';
    const repoCapabilityState = this.describeRepoCapabilityState(payload);
    const promptGuidance = decisionMode
      ? [
          'You are the manager agent for a Feishu project collaboration workspace.',
          'Your job in this turn is to decide the next interaction step before any formal execution happens.',
          'If the request is ambiguous, missing key constraints, or you are not confident, ask exactly one concise follow-up question.',
          'If the request is clear but risky or likely to cause unwanted side effects, request confirmation.',
          'If the request is clear enough to proceed, choose execute and provide an executionGoal and executionPrompt.',
          'Call emit_decision exactly once with the final structured decision.',
          'Do not call emit_outputs during manager decision runs.',
        ]
      : groupRuntimeMode
        ? [
            'You are the long-running manager for a Feishu project group.',
            'This turn is a group runtime turn, not a formal execution run.',
            'You are a group project administrator, not a generic chat assistant and not a backend workflow engine.',
            'Every completed group runtime turn must end with a user-facing group reply.',
            'Treat the latest group message as a trigger signal, not as the only source of project context.',
            'Prefer concise group replies, runtime todo updates, and lightweight progress over large formal deliverables.',
            'Feishu docs are the formal knowledge base, and the bound Feishu task board is the formal follow-up board.',
            'Runtime todos are internal scratchpad state and are not the source of truth for official project tasks.',
            'Only call emit_outputs if a durable formal artifact is explicitly needed in this turn.',
            'Do not generate a large formal document by default during group runtime turns.',
          ]
      : [
          'You are running as PiMono for the Feishu project collaboration backend.',
          'This turn is a formal execution run that may produce persisted artifacts.',
          'When you are ready to produce the final formal result, call emit_outputs exactly once.',
          'Do not return raw JSON in assistant text.',
          'If no formal document, task, file, or log is needed, emit one summary output.',
        ];
    const groupRuntimeGuidance = groupRuntimeMode
      ? [
          'You are managing a long-running group runtime for a Feishu project workspace.',
          'Only act on explicit @bot requests and the persisted runtime todo queue.',
          'First decide whether the latest message creates new internal todos or updates existing ones.',
          'Maintain the persisted todo queue with todo_list and todo_write.',
          'At most one todo may be in running state at any time.',
          'You must call reply_group at least once in every completed turn, even if it is only a short acknowledgment or summary.',
          'If human confirmation is required, use request_group_confirmation and stop the blocked todo in waiting_confirmation.',
          'Use reply_group for concise user-facing updates.',
          'Read bound project resources on demand before relying on chat memory alone.',
          'Internal todos are not the official Feishu task board unless you explicitly emit a formal task output with persistence intent.',
          'When you are ready to persist formal deliverables, call emit_outputs exactly once and only for explicitly durable outputs.',
        ]
      : [];

    return [
      ...promptGuidance,
      ...groupRuntimeGuidance,
      '',
      '## Execution Bias',
      ...this.buildExecutionBiasLines(requestKind),
      '',
      '## Tooling',
      ...this.buildToolingLines(payload, groupRuntimeMode),
      '',
      '## Runtime Policy',
      ...this.buildRuntimePolicyLines(payload, requestKind, repoCapabilityState),
      '',
      '## Runtime Context',
      `Runtime session: ${payload.runtimeSessionKey}`,
      `Agent scope: ${payload.agentScopeKey ?? 'not configured'}`,
      `Session mode: ${payload.sessionMode ?? 'active'}`,
      `Request kind: ${requestKind}`,
      `Wake mode: ${payload.wakeMode ?? 'interactive'}`,
      `Digest type: ${payload.digestType ?? 'none'}`,
      `Project: ${payload.project.name} (${payload.project.id})`,
      `Environment: ${payload.environment.name} (${payload.environment.id})`,
      `Repository: ${payload.environment.repoUrl ?? 'not configured'}`,
      `Branch: ${payload.environment.repoBranch ?? 'not configured'}`,
      `Repo capability state: ${repoCapabilityState}`,
      `Repo mirror path: ${payload.environment.repoMirrorPath ?? 'not prepared'}`,
      `Repo sync status: ${payload.environment.repoSyncStatus ?? 'unknown'}`,
      `Repo head: ${payload.environment.repoHeadRef ?? 'unknown'}`,
      `Intent: ${payload.intent}`,
      groupRuntimeMode ? `Runtime task snapshot count: ${payload.runtimeTasks?.length ?? 0}` : undefined,
      payload.projectContextBundle?.session?.memorySummary
        ? `Session memory summary: ${payload.projectContextBundle.session.memorySummary}`
        : 'Session memory summary: none',
      groupRuntimeMode
        ? `Group policy: mentionOnly=${payload.projectContextBundle?.groupPolicy?.mentionOnly ?? 'unknown'}, allowDocWrite=${payload.projectContextBundle?.groupPolicy?.allowDocWrite ?? 'unknown'}, allowTaskBoardWrite=${payload.projectContextBundle?.groupPolicy?.allowTaskBoardWrite ?? 'unknown'}, highRiskConfirmation=${payload.projectContextBundle?.groupPolicy?.highRiskActionsRequireConfirmation ?? 'unknown'}`
        : undefined,
      groupRuntimeMode
        ? `Project resources: docFolder=${payload.projectContextBundle?.folderEntries?.length ? 'bound' : 'unbound'}, taskBoard=${payload.projectContextBundle?.bitableSnapshot ? 'bound' : 'unbound'}`
        : undefined,
      groupRuntimeMode
        ? `Recent project docs: ${this.describeRecentDocs(payload)}`
        : undefined,
      groupRuntimeMode
        ? `Task board summary: ${this.describeTaskBoardSummary(payload)}`
        : undefined,
      groupRuntimeMode
        ? `Recent formal artifacts: ${this.describeRecentArtifacts(payload)}`
        : undefined,
      payload.environment.repoSyncError ? `Latest repo sync error: ${payload.environment.repoSyncError}` : 'Latest repo sync error: none',
      payload.roleProfile ? 'A compiled role profile context file is attached below.' : 'No role profile is attached.',
      `Target output schema: ${JSON.stringify(payload.outputSchema)}`,
      '',
      ...(payload.roleProfile ? ['Compiled AGENTS.md (virtual):', payload.roleProfile.compiledContextFile, ''] : []),
      'User request:',
      payload.prompt,
    ].join('\n');
  }

  /**
   * Build execution bias lines based on request kind.
   * @param requestKind The type of request
   * @returns Array of bias lines
   */
  private buildExecutionBiasLines(requestKind: PiMonoCreateRunRequest['requestKind']) {
    const base = [
      '- Actionable request: act in this turn.',
      '- Continue until done or genuinely blocked; do not stop at a plan when tools can advance the work.',
      '- Weak or empty tool results: vary the query, path, or source before concluding.',
      '- Mutable facts require live verification through the tools available in this runtime.',
    ];

    if (requestKind === 'interactive_decision') {
      return [
        ...base,
        '- This is a decision turn: end with exactly one emit_decision call, not emit_outputs.',
        '- Ask for only the one missing decision that genuinely blocks safe execution.',
      ];
    }

    if (requestKind === 'group_runtime') {
      return [
        ...base,
        '- Prefer advancing the runtime queue and current todo state in this turn.',
        '- For longer work, send concise user-facing progress only when it materially helps; otherwise keep progress in runtime events and todo state.',
        '- A successful runtime turn must include a group-facing reply.',
        '- Final runtime completion should be backed by tool effects, runtime state changes, or emitted outputs.',
      ];
    }

    return [
      ...base,
      '- Final execution needs evidence: emitted outputs, verified file inspection, repo inspection, or a named blocker.',
      '- If no formal document, task, file, or log is needed, still emit one summary output with concrete evidence.',
    ];
  }

  /**
   * Build tooling lines based on payload and runtime mode.
   * @param payload The run request payload
   * @param groupRuntimeMode Whether this is a group runtime turn
   * @returns Array of tooling lines
   */
  private buildToolingLines(payload: PiMonoCreateRunRequest, groupRuntimeMode: boolean) {
    return [
      '- Built-in local tools: read, grep, find, ls.',
      '- Feishu tools are on-demand only: list_project_folder, read_project_doc, search_project_docs, read_project_bitable, list_recent_project_artifacts.',
      groupRuntimeMode
        ? '- Runtime tools: todo_list, todo_write, reply_group, request_group_confirmation, emit_outputs.'
        : '- Runtime tools for queue and group replies are not available in this request kind.',
      payload.environment.repoMirrorPath && payload.environment.repoSyncStatus === 'ready'
        ? '- Repo inspection is available through the ready local repo mirror; use it as the source of truth for code facts.'
        : '- Repo inspection is not currently available from a ready local mirror; do not assume repository contents.',
      '- Feishu project materials are only summarized lightly in prompt context; retrieve them on demand when you need real details.',
    ];
  }

  /**
   * Build runtime policy lines based on payload and request kind.
   * @param payload The run request payload
   * @param requestKind The type of request
   * @param repoCapabilityState The repo capability state description
   * @returns Array of policy lines
   */
  private buildRuntimePolicyLines(
    payload: PiMonoCreateRunRequest,
    requestKind: PiMonoCreateRunRequest['requestKind'],
    repoCapabilityState: string,
  ) {
    const lines = [
      `- Repo capability state is ${repoCapabilityState}; align your behavior to it instead of assuming code access.`,
      '- Do not fabricate code, files, or external project facts that were not verified in this turn.',
      '- Respect tool boundaries: use on-demand retrieval instead of asking for bulk context by default.',
    ];

    if (requestKind === 'group_runtime') {
      lines.push('- Human confirmation must go through request_group_confirmation and then stop the blocked task in waiting_confirmation.');
      lines.push('- Keep at most one runtime todo in running state at a time.');
      lines.push('- reply_group is mandatory for every completed turn and should stay concise and user-facing.');
      lines.push(
        `- Respect group policy boundaries: doc writes are ${
          payload.projectContextBundle?.groupPolicy?.allowDocWrite === false ? 'disabled' : 'allowed when explicitly requested'
        }, task board writes are ${
          payload.projectContextBundle?.groupPolicy?.allowTaskBoardWrite === false ? 'disabled' : 'allowed when explicitly requested'
        }.`,
      );
      lines.push('- Only durable outputs with explicit persistence intent should be considered for formal sync.');
    }

    if (requestKind === 'interactive_decision') {
      lines.push('- Do not start formal execution in a decision turn; decide only the next safe interaction step.');
    }

    if (requestKind === 'formal_execution') {
      lines.push('- Formal execution should finish with emit_outputs exactly once when the result is ready.');
    }

    return lines;
  }

  /**
   * Describe the repository capability state.
   * @param payload The run request payload
   * @returns The repo capability state description
   */
  private describeRepoCapabilityState(payload: PiMonoCreateRunRequest) {
    if (!payload.environment.repoUrl?.trim()) {
      return 'repo_unconfigured';
    }
    if (payload.environment.repoSyncStatus === 'ready') {
      return 'repo_ready';
    }
    if (payload.environment.repoSyncStatus === 'error') {
      return 'repo_error';
    }
    return 'repo_initializing';
  }

  /**
   * Describe recent project docs.
   * @param payload The run request payload
   * @returns The recent docs description
   */
  private describeRecentDocs(payload: PiMonoCreateRunRequest) {
    const docs = payload.projectContextBundle?.workspaceDocsSummary ?? [];
    if (!docs.length) {
      return 'none';
    }
    return docs
      .map((doc) => `${doc.title}${doc.updatedAt ? ` (${doc.updatedAt})` : ''}`)
      .join('; ');
  }

  /**
   * Describe the task board summary.
   * @param payload The run request payload
   * @returns The task board summary description
   */
  private describeTaskBoardSummary(payload: PiMonoCreateRunRequest) {
    const bitableSnapshot = payload.projectContextBundle?.bitableSnapshot;
    if (!bitableSnapshot) {
      return 'none';
    }
    return `total=${bitableSnapshot.totalTasks}, open=${bitableSnapshot.openTasks}, blocked=${bitableSnapshot.blockedTasks}, overdue=${bitableSnapshot.overdueTasks}`;
  }

  /**
   * Describe recent formal artifacts.
   * @param payload The run request payload
   * @returns The recent artifacts description
   */
  private describeRecentArtifacts(payload: PiMonoCreateRunRequest) {
    const artifacts = payload.projectContextBundle?.recentArtifacts ?? [];
    if (!artifacts.length) {
      return 'none';
    }
    return artifacts.map((artifact) => `${artifact.type}:${artifact.title}`).join('; ');
  }
}