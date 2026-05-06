import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FeishuProjectReader } from '../feishu/feishu-project-reader.service';
import { PiOutputProcessor } from './pi-output-processor.service';
import {
  AgentOutput,
  GroupRuntimeTodoWriteAction,
  GroupRuntimeConfirmationAction,
  GroupRuntimeTaskSnapshot,
  ManagerInteractiveDecision,
} from './agent.types';
import { MANAGER_INTERACTIVE_DECISION_SCHEMA } from './agent.schemas';

/**
 * Tool registry service for Pi SDK custom tools.
 * Extracted from pi-mono.adapter.ts lines 1149-1588.
 *
 * Responsibility domain: Custom tool definitions for agent sessions.
 * D-01: Single responsibility - tool creation and execution.
 * D-02: Pi prefix - extracted from PiMonoAdapter.
 * D-04: Centralized tool registry - all 11 tools in single service.
 */
@Injectable()
export class PiToolRegistry {
  private readonly logger = new Logger(PiToolRegistry.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly feishuReader: FeishuProjectReader,
    private readonly outputProcessor: PiOutputProcessor,
    private readonly config: ConfigService,
  ) {}

  /**
   * Creates all 11 custom tools for agent session.
   * @param state - Session runtime state with execution context
   * @returns Array of custom tool definitions
   */
  createAllTools(state: SessionRuntimeState): CustomTool[] {
    return [
      this.createEmitOutputsTool(state),
      this.createEmitDecisionTool(state),
      this.createListProjectFolderTool(state),
      this.createReadProjectDocTool(state),
      this.createSearchProjectDocsTool(state),
      this.createReadProjectBitableTool(state),
      this.createListRecentProjectArtifactsTool(state),
      this.createTodoListTool(state),
      this.createTodoWriteTool(state),
      this.createReplyGroupTool(state),
      this.createRequestGroupConfirmationTool(state),
    ];
  }

  // ==========================================
  // Emit outputs tool
  // ==========================================

  private createEmitOutputsTool(state: SessionRuntimeState) {
    return {
      name: 'emit_outputs',
      label: 'emit_outputs',
      description: 'Emit the final structured AgentOutput array for the Feishu backend.',
      promptSnippet: 'emit_outputs({ outputs }): send structured outputs to backend.',
      promptGuidelines: [
        'Call emit_outputs exactly once after generating outputs.',
        'Each output requires type (document/task/file/log/summary) and title.',
        'Use content for text, filePath for files, tasks for task lists.',
        'If you emit tasks for the formal task board, include metadata.persist=true and targetChannels=["bitable"].',
      ],
      parameters: {
        type: 'object',
        properties: {
          outputs: {
            type: 'array',
            items: {
              type: 'object',
              required: ['type', 'title'],
              properties: {
                type: { enum: ['document', 'task', 'file', 'log', 'summary'] },
                title: { type: 'string' },
                content: { type: 'string' },
                contentFormat: { enum: ['markdown', 'json', 'text'] },
                filePath: { type: 'string' },
                mimeType: { type: 'string' },
                tasks: { type: 'array' },
                metadata: { type: 'object' },
              },
              additionalProperties: true,
            },
          },
        },
        required: ['outputs'],
        additionalProperties: false,
      } as any,
      execute: async (_toolCallId: string, params: EmitOutputsArgs) => {
        const activeExecution = state.activeExecution;
        if (!activeExecution) {
          throw new Error('emit_outputs called outside an active execution');
        }
        if (!['outputs', 'group_runtime'].includes(activeExecution.mode)) {
          this.logger.warn(`emit_outputs ignored outside supported mode: session=${state.runtimeSessionKey} mode=${activeExecution.mode}`);
          return {
            content: [{ type: 'text', text: 'emit_outputs is not available in this run mode.' }],
          };
        }

        const outputs = this.outputProcessor.normalizeOutputs(params.outputs, activeExecution.mode);
        if (!outputs.length) {
          throw new Error('emit_outputs requires at least one valid AgentOutput');
        }

        activeExecution.outputs = outputs;
        activeExecution.emitted = true;
        this.logger.log(`emit_outputs captured: session=${state.runtimeSessionKey} outputs=${outputs.length}`);
        return {
          content: [{ type: 'text', text: `Captured ${outputs.length} structured outputs.` }],
        };
      },
    } as any;
  }

  // ==========================================
  // Emit decision tool
  // ==========================================

  private createEmitDecisionTool(state: SessionRuntimeState) {
    return {
      name: 'emit_decision',
      label: 'emit_decision',
      description: 'Emit the structured manager interaction decision for the Feishu backend.',
      promptSnippet: 'emit_decision(decision): send the final manager interaction decision to the backend.',
      promptGuidelines: [
        'Call emit_decision exactly once after deciding whether to ask a follow-up question, request confirmation, or execute.',
        'Use ask_followup instead of guessing when the request is ambiguous or missing key constraints.',
      ],
      parameters: {
        type: 'object',
        properties: {
          decision: MANAGER_INTERACTIVE_DECISION_SCHEMA,
        },
        required: ['decision'],
        additionalProperties: false,
      } as any,
      execute: async (_toolCallId: string, params: EmitDecisionArgs) => {
        const activeExecution = state.activeExecution;
        if (!activeExecution) {
          throw new Error('emit_decision called outside an active execution');
        }
        if (activeExecution.mode !== 'decision') {
          this.logger.warn(`emit_decision ignored outside decision mode: session=${state.runtimeSessionKey} mode=${activeExecution.mode}`);
          return {
            content: [{ type: 'text', text: 'emit_decision is only available during manager decision runs.' }],
          };
        }

        const decision = this.outputProcessor.normalizeDecision(params.decision);
        if (!decision) {
          throw new Error('emit_decision requires a valid ManagerInteractiveDecision');
        }

        activeExecution.decision = decision;
        activeExecution.emitted = true;
        this.logger.log(`emit_decision captured: session=${state.runtimeSessionKey} action=${decision.action}`);
        return {
          content: [{ type: 'text', text: `Captured decision: ${decision.action}` }],
        };
      },
    } as any;
  }

  // ==========================================
  // List project folder tool
  // ==========================================

  private createListProjectFolderTool(state: SessionRuntimeState) {
    return {
      name: 'list_project_folder',
      label: 'list_project_folder',
      description: 'List the Feishu project folder structure and recent readable documents metadata.',
      promptSnippet: 'list_project_folder(): inspect project folder entries and recent doc metadata from Feishu.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      } as any,
      execute: async () => {
        const project = await this.getProjectRuntimeResource(state);
        const cacheKey = `folder:${project.docFolderToken ?? 'none'}`;
        const result = await this.getOrLoadCachedToolResult(state, cacheKey, async () =>
          this.feishuReader.listProjectFolder(project.docFolderToken),
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(result) }],
        };
      },
    } as any;
  }

  // ==========================================
  // Read project doc tool
  // ==========================================

  private createReadProjectDocTool(_state: SessionRuntimeState) {
    return {
      name: 'read_project_doc',
      label: 'read_project_doc',
      description: 'Read a Feishu project document by token and return raw content summary.',
      promptSnippet: 'read_project_doc({ token, title }): fetch a specific project document.',
      parameters: {
        type: 'object',
        properties: {
          token: { type: 'string' },
          title: { type: 'string' },
        },
        required: ['token'],
        additionalProperties: false,
      } as any,
      execute: async (_toolCallId: string, params: ReadProjectDocArgs) => {
        const project = await this.getProjectRuntimeResource(_state);
        const doc = await this.feishuReader.readProjectDocument(params.token, params.title, {
          folderToken: project.docFolderToken,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(doc) }],
        };
      },
    } as any;
  }

  // ==========================================
  // Search project docs tool
  // ==========================================

  private createSearchProjectDocsTool(state: SessionRuntimeState) {
    return {
      name: 'search_project_docs',
      label: 'search_project_docs',
      description: 'Search recent Feishu project documents by title and cached summaries. Use read_project_doc for full content.',
      promptSnippet: 'search_project_docs({ query }): search recent project docs by metadata, then use read_project_doc on relevant tokens.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
        },
        required: ['query'],
        additionalProperties: false,
      } as any,
      execute: async (_toolCallId: string, params: SearchProjectDocsArgs) => {
        const project = await this.getProjectRuntimeResource(state);
        const result = await this.feishuReader.searchProjectDocuments(
          project.docFolderToken,
          params.query,
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(result) }],
        };
      },
    } as any;
  }

  // ==========================================
  // Read project bitable tool
  // ==========================================

  private createReadProjectBitableTool(state: SessionRuntimeState) {
    return {
      name: 'read_project_bitable',
      label: 'read_project_bitable',
      description: 'Read the project bitable snapshot from Feishu.',
      promptSnippet: 'read_project_bitable(): fetch current task board snapshot from Feishu.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      } as any,
      execute: async () => {
        const project = await this.getProjectRuntimeResource(state);
        const cacheKey = `bitable:${project.bitableAppToken ?? 'none'}:${project.bitableTableId ?? 'none'}`;
        const result = await this.getOrLoadCachedToolResult(state, cacheKey, async () =>
          this.feishuReader.readBitableSnapshot(
            project.bitableAppToken,
            project.bitableTableId,
          ),
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(result) }],
        };
      },
    } as any;
  }

  // ==========================================
  // List recent project artifacts tool
  // ==========================================

  private createListRecentProjectArtifactsTool(state: SessionRuntimeState) {
    return {
      name: 'list_recent_project_artifacts',
      label: 'list_recent_project_artifacts',
      description: 'List recent persisted artifacts for the current project.',
      promptSnippet: 'list_recent_project_artifacts({ limit }): inspect recent project outputs.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number' },
        },
        additionalProperties: false,
      } as any,
      execute: async (_toolCallId: string, params: ListRecentArtifactsArgs) => {
        const context = this.requireContextBinding(state);
        const limit = Math.min(Math.max(Number(params.limit ?? 10), 1), 20);
        const result = await this.prisma.artifact.findMany({
          where: { projectId: context.projectId },
          orderBy: { createdAt: 'desc' },
          take: limit,
          select: {
            id: true,
            type: true,
            title: true,
            status: true,
            createdAt: true,
            feishuUrl: true,
            metadata: true,
          },
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                result.map((item) => ({
                  ...item,
                  createdAt: item.createdAt.toISOString(),
                })),
              ),
            },
          ],
        };
      },
    } as any;
  }

  // ==========================================
  // Todo list tool
  // ==========================================

  private createTodoListTool(state: SessionRuntimeState) {
    return {
      name: 'todo_list',
      label: 'todo_list',
      description: 'List the persisted runtime todo queue for the current group session.',
      promptSnippet: 'todo_list(): inspect the current runtime todo queue before choosing what to execute next.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      } as any,
      execute: async (_toolCallId: string, _params: TodoListArgs) => {
        return {
          content: [{ type: 'text', text: JSON.stringify(state.runtimeTaskSnapshots ?? []) }],
        };
      },
    } as any;
  }

  // ==========================================
  // Todo write tool
  // ==========================================

  private createTodoWriteTool(state: SessionRuntimeState) {
    return {
      name: 'todo_write',
      label: 'todo_write',
      description: 'Write changes to the persisted runtime todo queue.',
      promptSnippet:
        'todo_write({ action, ... }): create, update, start, complete, fail, cancel, or block a persisted runtime todo.',
      parameters: {
        type: 'object',
        properties: {
          action: { enum: ['create', 'update', 'start', 'complete', 'fail', 'cancel', 'block'] },
          taskId: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          intent: { type: 'string' },
          skillHint: { type: 'string' },
          outputMode: { type: 'string' },
          taskPayload: { type: 'object' },
          resultSummary: { type: 'string' },
          errorMessage: { type: 'string' },
        },
        required: ['action'],
        additionalProperties: false,
      } as any,
      execute: async (_toolCallId: string, params: TodoWriteArgs) => {
        const activeExecution = state.activeExecution;
        if (!activeExecution || activeExecution.mode !== 'group_runtime') {
          throw new Error('todo_write is only available during group runtime turns');
        }
        const action = this.outputProcessor.normalizeTodoWriteAction(params);
        if (!action) {
          throw new Error('todo_write requires a valid action payload');
        }
        const snapshot = this.transitionRuntimeTask(state, action);
        if (snapshot && !action.taskId) {
          action.taskId = snapshot.id;
        }
        activeExecution.actions ??= [];
        activeExecution.actions.push(action);
        this.logger.log(
          `todo_write captured: session=${state.runtimeSessionKey} action=${action.action} task=${action.taskId ?? 'unknown'}`,
        );
        return {
          content: [{ type: 'text', text: `Queued todo action: ${action.action}` }],
        };
      },
    } as any;
  }

  // ==========================================
  // Reply group tool
  // ==========================================

  private createReplyGroupTool(state: SessionRuntimeState) {
    return {
      name: 'reply_group',
      label: 'reply_group',
      description: 'Reply to the current group chat as part of the runtime turn.',
      promptSnippet: 'reply_group({ text }): send a concise group-facing reply.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string' },
        },
        required: ['text'],
        additionalProperties: false,
      } as any,
      execute: async (_toolCallId: string, params: ReplyGroupArgs) => {
        const activeExecution = state.activeExecution;
        if (!activeExecution || activeExecution.mode !== 'group_runtime') {
          throw new Error('reply_group is only available during group runtime turns');
        }
        const text = typeof params.text === 'string' ? params.text.trim() : '';
        if (!text) {
          throw new Error('reply_group requires non-empty text');
        }
        activeExecution.actions ??= [];
        activeExecution.actions.push({ type: 'reply_group', text });
        this.logger.log(`reply_group captured: session=${state.runtimeSessionKey} length=${text.length}`);
        return {
          content: [{ type: 'text', text: 'Queued one group reply.' }],
        };
      },
    } as any;
  }

  // ==========================================
  // Request group confirmation tool
  // ==========================================

  private createRequestGroupConfirmationTool(state: SessionRuntimeState) {
    return {
      name: 'request_group_confirmation',
      label: 'request_group_confirmation',
      description: 'Pause the current runtime task and request a human confirmation in the group.',
      promptSnippet:
        'request_group_confirmation({ taskId, actionType, summary, detail, payload }): create a confirmation request and stop the blocked task.',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string' },
          actionType: { type: 'string' },
          summary: { type: 'string' },
          detail: { type: 'string' },
          payload: { type: 'object' },
        },
        required: ['actionType', 'summary', 'payload'],
        additionalProperties: false,
      } as any,
      execute: async (_toolCallId: string, params: RequestGroupConfirmationArgs) => {
        const activeExecution = state.activeExecution;
        if (!activeExecution || activeExecution.mode !== 'group_runtime') {
          throw new Error('request_group_confirmation is only available during group runtime turns');
        }
        const action = this.outputProcessor.normalizeRuntimeConfirmationAction(params);
        if (!action) {
          throw new Error('request_group_confirmation requires a valid payload');
        }
        activeExecution.actions ??= [];
        activeExecution.actions.push(action);
        this.logger.log(
          `request_group_confirmation captured: session=${state.runtimeSessionKey} task=${action.taskId ?? 'none'} action=${action.actionType}`,
        );
        return {
          content: [{ type: 'text', text: `Queued confirmation request for ${action.actionType}.` }],
        };
      },
    } as any;
  }

  // ==========================================
  // Private helpers
  // ==========================================

  private requireContextBinding(state: SessionRuntimeState): SimplifiedContextBinding {
    if (!state.currentContext) {
      throw new Error('Feishu project tools require a runtime context binding');
    }

    return state.currentContext;
  }

  private async getProjectRuntimeResource(state: SessionRuntimeState): Promise<ProjectRuntimeResource> {
    const context = this.requireContextBinding(state);
    return this.getOrLoadCachedToolResult(state, `project:${context.projectId}`, async () => {
      const project = await this.prisma.project.findUniqueOrThrow({
        where: { id: context.projectId },
        select: {
          id: true,
          docFolderToken: true,
          bitableAppToken: true,
          bitableTableId: true,
        },
      });
      return {
        projectId: project.id,
        docFolderToken: project.docFolderToken,
        bitableAppToken: project.bitableAppToken,
        bitableTableId: project.bitableTableId,
      };
    });
  }

  private async getOrLoadCachedToolResult<T>(state: SessionRuntimeState, key: string, loader: () => Promise<T>): Promise<T> {
    if (state.toolCache.has(key)) {
      return state.toolCache.get(key) as T;
    }

    const value = await loader();
    state.toolCache.set(key, value);
    return value;
  }

  // ==========================================
  // Runtime task state transitions
  // ==========================================

  private transitionRuntimeTask(state: SessionRuntimeState, action: GroupRuntimeTodoWriteAction): GroupRuntimeTaskSnapshot | null {
    if (action.action === 'create') {
      const requestedTaskId = typeof action.taskId === 'string' && action.taskId.trim() ? action.taskId.trim() : null;
      const internalTaskId = requestedTaskId && this.isUuid(requestedTaskId) ? requestedTaskId : randomUUID();
      const runtimeRef = requestedTaskId && !this.isUuid(requestedTaskId) ? requestedTaskId : null;
      const snapshot: GroupRuntimeTaskSnapshot = {
        id: internalTaskId,
        runtimeRef,
        title: action.title ?? 'Untitled runtime task',
        description: action.description ?? null,
        intent: action.intent ?? 'requirement_analysis',
        skillHint: action.skillHint ?? null,
        outputMode: action.outputMode ?? null,
        orderIndex: (state.runtimeTaskSnapshots[state.runtimeTaskSnapshots.length - 1]?.orderIndex ?? -1) + 1,
        status: 'queued',
        taskPayloadJson: this.withRuntimeTaskRef(action.taskPayload, runtimeRef),
        resultSummary: action.resultSummary ?? null,
        lastError: action.errorMessage ?? null,
      };
      state.runtimeTaskSnapshots.push(snapshot);
      return snapshot;
    }

    const snapshot = action.taskId ? this.findRuntimeTaskSnapshot(state, action.taskId) : null;
    if (!snapshot) {
      return null;
    }

    if (action.title !== undefined) snapshot.title = action.title;
    if (action.description !== undefined) snapshot.description = action.description;
    if (action.intent !== undefined) snapshot.intent = action.intent;
    if (action.skillHint !== undefined) snapshot.skillHint = action.skillHint ?? null;
    if (action.outputMode !== undefined) snapshot.outputMode = action.outputMode ?? null;
    if (action.taskPayload !== undefined) {
      snapshot.taskPayloadJson = this.withRuntimeTaskRef(action.taskPayload, snapshot.runtimeRef ?? null);
    }
    if (action.resultSummary !== undefined) snapshot.resultSummary = action.resultSummary;
    if (action.errorMessage !== undefined) snapshot.lastError = action.errorMessage;

    switch (action.action) {
      case 'update':
        break;
      case 'start':
        snapshot.status = 'running';
        snapshot.blockedReason = null;
        snapshot.lastError = null;
        break;
      case 'complete':
        snapshot.status = 'completed';
        break;
      case 'fail':
        snapshot.status = 'failed';
        break;
      case 'cancel':
        snapshot.status = 'canceled';
        break;
      case 'block':
        snapshot.status = 'blocked';
        snapshot.blockedReason = action.resultSummary ?? 'Task blocked';
        break;
    }

    return snapshot;
  }

  private findRuntimeTaskSnapshot(state: SessionRuntimeState, taskId: string): GroupRuntimeTaskSnapshot | null {
    const normalizedTaskId = taskId.trim();
    return (
      state.runtimeTaskSnapshots.find(
        (task) => task.id === normalizedTaskId || (task.runtimeRef != null && task.runtimeRef === normalizedTaskId),
      ) ?? null
    );
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
  }

  private withRuntimeTaskRef(
    payload: Record<string, unknown> | null | undefined,
    runtimeRef: string | null,
  ): Record<string, unknown> | null {
    const base =
      payload && typeof payload === 'object' && !Array.isArray(payload)
        ? { ...payload }
        : payload === null
          ? null
          : {};
    if (!base) {
      return runtimeRef ? { __runtimeRef: runtimeRef } : null;
    }
    if (runtimeRef) {
      base.__runtimeRef = runtimeRef;
    }
    return base;
  }
}

// ==========================================
// Type definitions (internal)
// ==========================================

type SimplifiedContextBinding = {
  projectId: string;
  environmentId: string;
  feishuChatId: string;
  groupSessionId?: string | null;
};

type ProjectRuntimeResource = {
  projectId: string;
  docFolderToken: string | null;
  bitableAppToken: string | null;
  bitableTableId: string | null;
};

type SessionRuntimeState = {
  runtimeSessionKey: string;
  activeExecution?: ActiveExecutionState;
  currentContext?: SimplifiedContextBinding;
  runtimeTaskSnapshots: GroupRuntimeTaskSnapshot[];
  toolCache: Map<string, unknown>;
};

type ActiveExecutionState = {
  runId?: string;
  mode: 'outputs' | 'decision' | 'group_runtime';
  outputs: AgentOutput[];
  decision?: ManagerInteractiveDecision;
  actions?: GroupRuntimeAction[];
  emitted: boolean;
  canceled: boolean;
  timedOut: boolean;
};

type GroupRuntimeAction = GroupRuntimeTodoWriteAction | GroupRuntimeConfirmationAction | { type: 'reply_group'; text: string };

type EmitOutputsArgs = {
  outputs?: unknown;
};

type EmitDecisionArgs = {
  decision?: unknown;
};

type ReadProjectDocArgs = {
  token?: string;
  title?: string;
};

type SearchProjectDocsArgs = {
  query?: string;
};

type ListRecentArtifactsArgs = {
  limit?: number;
};

type TodoListArgs = Record<string, never>;

type TodoWriteArgs = {
  action?: string;
  taskId?: string;
  title?: string;
  description?: string;
  intent?: string;
  skillHint?: string;
  outputMode?: string;
  taskPayload?: Record<string, unknown>;
  resultSummary?: string;
  errorMessage?: string;
};

type ReplyGroupArgs = {
  text?: unknown;
};

type RequestGroupConfirmationArgs = {
  taskId?: string;
  actionType?: string;
  summary?: string;
  detail?: string;
  payload?: unknown;
};

type CustomTool = {
  name: string;
  label: string;
  description: string;
  promptSnippet?: string;
  promptGuidelines?: string[];
  parameters: any;
  execute: (toolCallId: string, params: any) => Promise<any>;
};