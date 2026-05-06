import { Injectable } from '@nestjs/common';
import {
  AgentOutput,
  AgentOutputType,
  GroupRuntimeTodoWriteAction,
  GroupRuntimeConfirmationAction,
  ManagerInteractiveDecision,
  ManagerInteractiveAction,
  ManagerInteractiveOutputMode,
  DigestTargetChannel,
  GroupRuntimeToolActionType,
  ManagerConfirmationPayload,
} from './agent.types';

/**
 * Pure function service for output normalization.
 * Extracted from pi-mono.adapter.ts lines 1600-1791.
 *
 * Responsibility domain: Output validation and normalization for all execution modes.
 * D-01: Single responsibility - output processing only.
 * D-02: Pi prefix - extracted from PiMonoAdapter.
 */
@Injectable()
export class PiOutputProcessor {
  /**
   * Normalizes outputs array, filtering invalid entries and applying delivery defaults.
   * @param value - Raw output value from agent execution
   * @param mode - Execution mode for delivery defaults
   * @returns Validated and normalized AgentOutput array
   */
  normalizeOutputs(
    value: unknown,
    mode?: 'outputs' | 'decision' | 'group_runtime',
  ): AgentOutput[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((item) => this.isAgentOutput(item))
      .map((item) => this.applyOutputDeliveryDefaults(item, mode));
  }

  /**
   * Applies delivery defaults for document/task outputs in group_runtime mode.
   * Sets persist=true and targetChannels=['feishu_doc'/'bitable'] when not specified.
   * @param output - AgentOutput to enhance
   * @param mode - Execution mode
   * @returns Output with delivery defaults applied
   */
  applyOutputDeliveryDefaults(
    output: AgentOutput,
    mode?: 'outputs' | 'decision' | 'group_runtime',
  ): AgentOutput {
    if (mode !== 'group_runtime') {
      return output;
    }

    if (!['document', 'task'].includes(output.type)) {
      return output;
    }

    const metadata =
      output.metadata && typeof output.metadata === 'object' && !Array.isArray(output.metadata)
        ? { ...output.metadata }
        : {};
    const channels = Array.isArray(metadata.targetChannels)
      ? metadata.targetChannels.map((channel) => String(channel))
      : [];

    if (metadata.persist === false) {
      return {
        ...output,
        metadata,
      };
    }

    if (output.type === 'document') {
      metadata.persist ??= true;
      if (!channels.length) {
        metadata.targetChannels = ['feishu_doc'];
      }
    }

    if (output.type === 'task') {
      metadata.persist ??= true;
      if (!channels.length) {
        metadata.targetChannels = ['bitable'];
      }
    }

    return {
      ...output,
      metadata,
    };
  }

  /**
   * Validates that a value is a valid AgentOutput.
   * Checks type (document/task/file/log/summary), title (required string), and optional fields.
   * @param value - Value to validate
   * @returns True if value is a valid AgentOutput
   */
  isAgentOutput(value: unknown): value is AgentOutput {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const item = value as Record<string, unknown>;
    if (!['document', 'task', 'file', 'log', 'summary'].includes(String(item.type))) {
      return false;
    }
    if (typeof item.title !== 'string' || !item.title.trim()) {
      return false;
    }
    if (item.content !== undefined && typeof item.content !== 'string') {
      return false;
    }
    if (item.contentFormat !== undefined && !['markdown', 'json', 'text'].includes(String(item.contentFormat))) {
      return false;
    }
    if (item.filePath !== undefined && typeof item.filePath !== 'string') {
      return false;
    }
    if (item.mimeType !== undefined && typeof item.mimeType !== 'string') {
      return false;
    }
    if (item.tasks !== undefined) {
      if (!Array.isArray(item.tasks)) {
        return false;
      }
      for (const task of item.tasks) {
        if (!task || typeof task !== 'object' || typeof (task as { title?: unknown }).title !== 'string') {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Normalizes a decision value to ManagerInteractiveDecision or null.
   * @param value - Value to normalize
   * @returns Valid decision or null
   */
  normalizeDecision(value: unknown): ManagerInteractiveDecision | null {
    return this.isManagerInteractiveDecision(value) ? value : null;
  }

  /**
   * Normalizes TodoWriteArgs to GroupRuntimeTodoWriteAction.
   * Validates action enum and trims string fields.
   * @param value - TodoWriteArgs from agent
   * @returns Normalized action or null if invalid
   */
  normalizeTodoWriteAction(value: {
    action?: string;
    taskId?: string;
    title?: string;
    description?: string;
    intent?: string;
    skillHint?: string;
    outputMode?: string;
    resultSummary?: string;
    errorMessage?: string;
    taskPayload?: Record<string, unknown>;
  }): GroupRuntimeTodoWriteAction | null {
    const action = String(value.action ?? '').trim();
    if (!['create', 'update', 'start', 'complete', 'fail', 'cancel', 'block'].includes(action)) {
      return null;
    }
    const normalized: GroupRuntimeTodoWriteAction = {
      type: 'todo_write',
      action: action as GroupRuntimeToolActionType,
    };
    if (typeof value.taskId === 'string' && value.taskId.trim()) normalized.taskId = value.taskId.trim();
    if (typeof value.title === 'string' && value.title.trim()) normalized.title = value.title.trim();
    if (typeof value.description === 'string') normalized.description = value.description.trim();
    if (typeof value.intent === 'string' && value.intent.trim()) normalized.intent = value.intent.trim();
    if (typeof value.skillHint === 'string') normalized.skillHint = value.skillHint.trim();
    if (typeof value.outputMode === 'string') normalized.outputMode = value.outputMode.trim();
    if (typeof value.resultSummary === 'string') normalized.resultSummary = value.resultSummary.trim();
    if (typeof value.errorMessage === 'string') normalized.errorMessage = value.errorMessage.trim();
    if (value.taskPayload && typeof value.taskPayload === 'object' && !Array.isArray(value.taskPayload)) {
      normalized.taskPayload = value.taskPayload as Record<string, unknown>;
    }
    return normalized;
  }

  /**
   * Normalizes RequestGroupConfirmationArgs to GroupRuntimeConfirmationAction.
   * Validates actionType, summary, payload as required fields.
   * @param value - Confirmation request args
   * @returns Normalized action or null if invalid
   */
  normalizeRuntimeConfirmationAction(value: {
    taskId?: string;
    actionType?: string;
    summary?: string;
    detail?: string;
    payload?: unknown;
  }): GroupRuntimeConfirmationAction | null {
    if (typeof value.actionType !== 'string' || !value.actionType.trim()) {
      return null;
    }
    if (typeof value.summary !== 'string' || !value.summary.trim()) {
      return null;
    }
    if (!value.payload || typeof value.payload !== 'object' || Array.isArray(value.payload)) {
      return null;
    }
    return {
      type: 'request_group_confirmation',
      taskId: typeof value.taskId === 'string' && value.taskId.trim() ? value.taskId.trim() : undefined,
      actionType: value.actionType.trim(),
      summary: value.summary.trim(),
      detail: typeof value.detail === 'string' ? value.detail.trim() : undefined,
      payload: value.payload as ManagerConfirmationPayload,
    };
  }

  /**
   * Validates that a value is a valid ManagerInteractiveDecision.
   * Checks action, confidence, reason, reply, intent as required fields.
   * Validates optional fields with correct types.
   * @param value - Value to validate
   * @returns True if value is a valid ManagerInteractiveDecision
   */
  isManagerInteractiveDecision(value: unknown): value is ManagerInteractiveDecision {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const item = value as Record<string, unknown>;
    if (!['ask_followup', 'request_confirmation', 'execute'].includes(String(item.action))) {
      return false;
    }
    if (!['low', 'medium', 'high'].includes(String(item.confidence))) {
      return false;
    }
    if (typeof item.reason !== 'string' || !item.reason.trim()) {
      return false;
    }
    if (typeof item.reply !== 'string' || !item.reply.trim()) {
      return false;
    }
    if (typeof item.intent !== 'string' || !item.intent.trim()) {
      return false;
    }
    if (item.executionGoal !== undefined && typeof item.executionGoal !== 'string') {
      return false;
    }
    if (item.executionPrompt !== undefined && typeof item.executionPrompt !== 'string') {
      return false;
    }
    if (item.outputMode !== undefined && !['summary', 'document', 'task', 'file', 'mixed'].includes(String(item.outputMode))) {
      return false;
    }
    if (item.targetChannels !== undefined) {
      if (!Array.isArray(item.targetChannels)) {
        return false;
      }
      for (const channel of item.targetChannels) {
        if (!['group_message', 'feishu_doc', 'bitable', 'internal_digest'].includes(String(channel))) {
          return false;
        }
      }
    }
    if (item.skillHint !== undefined && item.skillHint !== null && typeof item.skillHint !== 'string') {
      return false;
    }
    if (item.metadata !== undefined && (!item.metadata || typeof item.metadata !== 'object' || Array.isArray(item.metadata))) {
      return false;
    }
    return true;
  }
}