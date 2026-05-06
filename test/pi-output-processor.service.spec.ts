import { PiOutputProcessor } from '../src/modules/agent/pi-output-processor.service';
import { AgentOutput, GroupRuntimeTodoWriteAction, GroupRuntimeConfirmationAction, ManagerInteractiveDecision } from '../src/modules/agent/agent.types';

describe('PiOutputProcessor', () => {
  let processor: PiOutputProcessor;

  beforeEach(() => {
    processor = new PiOutputProcessor();
  });

  describe('normalizeOutputs', () => {
    it('returns empty array for non-array input', () => {
      expect(processor.normalizeOutputs(null, 'group_runtime')).toEqual([]);
      expect(processor.normalizeOutputs(undefined, 'group_runtime')).toEqual([]);
      expect(processor.normalizeOutputs('string', 'group_runtime')).toEqual([]);
      expect(processor.normalizeOutputs({}, 'group_runtime')).toEqual([]);
      expect(processor.normalizeOutputs(123, 'group_runtime')).toEqual([]);
    });

    it('filters invalid outputs (missing type or title)', () => {
      const outputs = [
        { type: 'document', title: 'Valid Doc' },
        { type: 'summary' }, // missing title - invalid
        { title: 'Untitled' }, // missing type - invalid
        { type: 'invalid_type', title: 'Invalid Type' }, // invalid type value
        { type: 'task', title: 'Valid Task' },
      ];

      const result = processor.normalizeOutputs(outputs, 'outputs');

      expect(result.length).toBe(2);
      expect(result[0].type).toBe('document');
      expect(result[1].type).toBe('task');
    });

    it('applies delivery defaults for document outputs in group_runtime mode', () => {
      const outputs = [
        { type: 'document', title: 'Test Doc', content: '# Content' },
      ];

      const result = processor.normalizeOutputs(outputs, 'group_runtime');

      expect(result[0]).toEqual({
        type: 'document',
        title: 'Test Doc',
        content: '# Content',
        metadata: expect.objectContaining({
          persist: true,
          targetChannels: ['feishu_doc'],
        }),
      });
    });

    it('applies delivery defaults for task outputs in group_runtime mode', () => {
      const outputs = [
        { type: 'task', title: 'Test Task' },
      ];

      const result = processor.normalizeOutputs(outputs, 'group_runtime');

      expect(result[0]).toEqual({
        type: 'task',
        title: 'Test Task',
        metadata: expect.objectContaining({
          persist: true,
          targetChannels: ['bitable'],
        }),
      });
    });
  });

  describe('applyOutputDeliveryDefaults', () => {
    it('returns output unchanged for outputs mode', () => {
      const output: AgentOutput = { type: 'document', title: 'Doc' };
      const result = processor.applyOutputDeliveryDefaults(output, 'outputs');

      expect(result).toEqual({ type: 'document', title: 'Doc' });
    });

    it('returns output unchanged for decision mode', () => {
      const output: AgentOutput = { type: 'document', title: 'Doc' };
      const result = processor.applyOutputDeliveryDefaults(output, 'decision');

      expect(result).toEqual({ type: 'document', title: 'Doc' });
    });

    it('returns output unchanged when mode is undefined', () => {
      const output: AgentOutput = { type: 'document', title: 'Doc' };
      const result = processor.applyOutputDeliveryDefaults(output, undefined);

      expect(result).toEqual({ type: 'document', title: 'Doc' });
    });

    it('returns non-document/task outputs unchanged in group_runtime mode', () => {
      const summaryOutput: AgentOutput = { type: 'summary', title: 'Summary' };
      const fileOutput: AgentOutput = { type: 'file', title: 'File', filePath: '/path' };

      expect(processor.applyOutputDeliveryDefaults(summaryOutput, 'group_runtime')).toEqual(summaryOutput);
      expect(processor.applyOutputDeliveryDefaults(fileOutput, 'group_runtime')).toEqual(fileOutput);
    });

    it('sets persist=true and targetChannels=[feishu_doc] for document in group_runtime', () => {
      const output: AgentOutput = { type: 'document', title: 'Doc' };
      const result = processor.applyOutputDeliveryDefaults(output, 'group_runtime');

      expect(result.metadata).toEqual({
        persist: true,
        targetChannels: ['feishu_doc'],
      });
    });

    it('sets persist=true and targetChannels=[bitable] for task in group_runtime', () => {
      const output: AgentOutput = { type: 'task', title: 'Task' };
      const result = processor.applyOutputDeliveryDefaults(output, 'group_runtime');

      expect(result.metadata).toEqual({
        persist: true,
        targetChannels: ['bitable'],
      });
    });

    it('preserves existing metadata and appends defaults', () => {
      const output: AgentOutput = {
        type: 'document',
        title: 'Doc',
        metadata: { custom: 'value' },
      };
      const result = processor.applyOutputDeliveryDefaults(output, 'group_runtime');

      expect(result.metadata).toEqual({
        custom: 'value',
        persist: true,
        targetChannels: ['feishu_doc'],
      });
    });

    it('does not override persist=false when explicitly set', () => {
      const output: AgentOutput = {
        type: 'document',
        title: 'Doc',
        metadata: { persist: false },
      };
      const result = processor.applyOutputDeliveryDefaults(output, 'group_runtime');

      expect(result.metadata).toEqual({
        persist: false,
      });
    });

    it('preserves existing targetChannels when set', () => {
      const output: AgentOutput = {
        type: 'document',
        title: 'Doc',
        metadata: { targetChannels: ['internal_digest'] },
      };
      const result = processor.applyOutputDeliveryDefaults(output, 'group_runtime');

      expect(result.metadata).toEqual({
        targetChannels: ['internal_digest'],
        persist: true,
      });
    });

    it('preserves existing targetChannels as array', () => {
      const output: AgentOutput = {
        type: 'task',
        title: 'Task',
        metadata: { targetChannels: ['group_message', 'bitable'] },
      };
      const result = processor.applyOutputDeliveryDefaults(output, 'group_runtime');

      expect(result.metadata).toEqual({
        targetChannels: ['group_message', 'bitable'],
        persist: true,
      });
    });
  });

  describe('isAgentOutput', () => {
    it('validates type and title as required fields', () => {
      expect(processor.isAgentOutput({ type: 'document', title: 'Doc' })).toBe(true);
      expect(processor.isAgentOutput({ type: 'task', title: 'Task' })).toBe(true);
      expect(processor.isAgentOutput({ type: 'file', title: 'File' })).toBe(true);
      expect(processor.isAgentOutput({ type: 'log', title: 'Log' })).toBe(true);
      expect(processor.isAgentOutput({ type: 'summary', title: 'Summary' })).toBe(true);
    });

    it('rejects missing type', () => {
      expect(processor.isAgentOutput({ title: 'Untitled' })).toBe(false);
    });

    it('rejects missing title', () => {
      expect(processor.isAgentOutput({ type: 'document' })).toBe(false);
    });

    it('rejects empty or whitespace-only title', () => {
      expect(processor.isAgentOutput({ type: 'document', title: '' })).toBe(false);
      expect(processor.isAgentOutput({ type: 'document', title: '   ' })).toBe(false);
    });

    it('rejects invalid type values', () => {
      expect(processor.isAgentOutput({ type: 'invalid', title: 'Test' })).toBe(false);
      expect(processor.isAgentOutput({ type: 'report', title: 'Test' })).toBe(false);
    });

    it('rejects non-object values', () => {
      expect(processor.isAgentOutput(null)).toBe(false);
      expect(processor.isAgentOutput(undefined)).toBe(false);
      expect(processor.isAgentOutput('string')).toBe(false);
      expect(processor.isAgentOutput(123)).toBe(false);
    });

    it('validates optional content field', () => {
      expect(processor.isAgentOutput({ type: 'document', title: 'Doc', content: 'text' })).toBe(true);
      expect(processor.isAgentOutput({ type: 'document', title: 'Doc', content: '' })).toBe(true);
      expect(processor.isAgentOutput({ type: 'document', title: 'Doc', content: 123 })).toBe(false);
    });

    it('validates optional contentFormat field', () => {
      expect(processor.isAgentOutput({ type: 'document', title: 'Doc', contentFormat: 'markdown' })).toBe(true);
      expect(processor.isAgentOutput({ type: 'document', title: 'Doc', contentFormat: 'json' })).toBe(true);
      expect(processor.isAgentOutput({ type: 'document', title: 'Doc', contentFormat: 'text' })).toBe(true);
      expect(processor.isAgentOutput({ type: 'document', title: 'Doc', contentFormat: 'invalid' })).toBe(false);
    });

    it('validates optional filePath field', () => {
      expect(processor.isAgentOutput({ type: 'file', title: 'File', filePath: '/path' })).toBe(true);
      expect(processor.isAgentOutput({ type: 'file', title: 'File', filePath: 123 })).toBe(false);
    });

    it('validates optional mimeType field', () => {
      expect(processor.isAgentOutput({ type: 'file', title: 'File', mimeType: 'text/plain' })).toBe(true);
      expect(processor.isAgentOutput({ type: 'file', title: 'File', mimeType: 123 })).toBe(false);
    });

    it('validates optional tasks array', () => {
      expect(processor.isAgentOutput({ type: 'document', title: 'Doc', tasks: [{ title: 'Task 1' }] })).toBe(true);
      expect(processor.isAgentOutput({ type: 'document', title: 'Doc', tasks: [] })).toBe(true);
      expect(processor.isAgentOutput({ type: 'document', title: 'Doc', tasks: 'not-array' })).toBe(false);
      expect(processor.isAgentOutput({ type: 'document', title: 'Doc', tasks: [{}] })).toBe(false);
      expect(processor.isAgentOutput({ type: 'document', title: 'Doc', tasks: [{ title: 123 }] })).toBe(false);
    });
  });

  describe('normalizeTodoWriteAction', () => {
    it('validates action enum values', () => {
      const validActions = ['create', 'update', 'start', 'complete', 'fail', 'cancel', 'block'];

      for (const action of validActions) {
        const result = processor.normalizeTodoWriteAction({ action });
        expect(result).not.toBeNull();
        expect(result!.action).toBe(action);
      }
    });

    it('returns null for invalid action', () => {
      expect(processor.normalizeTodoWriteAction({ action: 'invalid' })).toBeNull();
      expect(processor.normalizeTodoWriteAction({ action: '' })).toBeNull();
      expect(processor.normalizeTodoWriteAction({})).toBeNull();
    });

    it('normalizes valid action with all optional fields', () => {
      const input = {
        action: 'create',
        taskId: 'task_1',
        title: 'Test Task',
        description: 'Description',
        intent: 'progress_summary',
        skillHint: 'skill-1',
        outputMode: 'summary',
        resultSummary: 'Result',
        errorMessage: 'Error',
        taskPayload: { key: 'value' },
      };

      const result = processor.normalizeTodoWriteAction(input);

      expect(result).toEqual({
        type: 'todo_write',
        action: 'create',
        taskId: 'task_1',
        title: 'Test Task',
        description: 'Description',
        intent: 'progress_summary',
        skillHint: 'skill-1',
        outputMode: 'summary',
        resultSummary: 'Result',
        errorMessage: 'Error',
        taskPayload: { key: 'value' },
      });
    });

    it('trims string fields', () => {
      const input = {
        action: '  create  ',
        taskId: '  task_1  ',
        title: '  Test Task  ',
        description: '  Description  ',
      };

      const result = processor.normalizeTodoWriteAction(input);

      expect(result!.action).toBe('create');
      expect(result!.taskId).toBe('task_1');
      expect(result!.title).toBe('Test Task');
      expect(result!.description).toBe('Description');
    });

    it('excludes empty/whitespace-only optional fields', () => {
      const input = {
        action: 'create',
        taskId: '',
        title: '   ',
      };

      const result = processor.normalizeTodoWriteAction(input);

      expect(result!.taskId).toBeUndefined();
      expect(result!.title).toBeUndefined();
    });
  });

  describe('normalizeRuntimeConfirmationAction', () => {
    it('validates actionType, summary, payload as required', () => {
      const input = {
        actionType: 'document_publish',
        summary: 'Need approval',
        payload: { reply: 'Reply', intent: 'document_generate' },
      };

      const result = processor.normalizeRuntimeConfirmationAction(input);

      expect(result).toEqual({
        type: 'request_group_confirmation',
        actionType: 'document_publish',
        summary: 'Need approval',
        payload: { reply: 'Reply', intent: 'document_generate' },
      });
    });

    it('returns null for missing actionType', () => {
      expect(processor.normalizeRuntimeConfirmationAction({
        summary: 'Summary',
        payload: {},
      })).toBeNull();
    });

    it('returns null for missing summary', () => {
      expect(processor.normalizeRuntimeConfirmationAction({
        actionType: 'action',
        payload: {},
      })).toBeNull();
    });

    it('returns null for missing or invalid payload', () => {
      expect(processor.normalizeRuntimeConfirmationAction({
        actionType: 'action',
        summary: 'Summary',
      })).toBeNull();
      expect(processor.normalizeRuntimeConfirmationAction({
        actionType: 'action',
        summary: 'Summary',
        payload: 'not-object',
      })).toBeNull();
      expect(processor.normalizeRuntimeConfirmationAction({
        actionType: 'action',
        summary: 'Summary',
        payload: [],
      })).toBeNull();
    });

    it('includes optional taskId and detail fields', () => {
      const input = {
        taskId: 'task_1',
        actionType: 'document_publish',
        summary: 'Need approval',
        detail: 'Please confirm',
        payload: { key: 'value' },
      };

      const result = processor.normalizeRuntimeConfirmationAction(input);

      expect(result!.taskId).toBe('task_1');
      expect(result!.detail).toBe('Please confirm');
    });

    it('trims string fields', () => {
      const input = {
        actionType: '  action  ',
        summary: '  Summary  ',
        detail: '  Detail  ',
        payload: {},
      };

      const result = processor.normalizeRuntimeConfirmationAction(input);

      expect(result!.actionType).toBe('action');
      expect(result!.summary).toBe('Summary');
      expect(result!.detail).toBe('Detail');
    });

    it('excludes empty/whitespace-only taskId', () => {
      const input = {
        taskId: '   ',
        actionType: 'action',
        summary: 'Summary',
        payload: {},
      };

      const result = processor.normalizeRuntimeConfirmationAction(input);

      expect(result!.taskId).toBeUndefined();
    });
  });

  describe('normalizeDecision', () => {
    it('returns valid decision unchanged', () => {
      const decision: ManagerInteractiveDecision = {
        action: 'execute',
        confidence: 'high',
        reason: 'Valid reason',
        reply: 'Reply text',
        intent: 'progress_summary',
      };

      const result = processor.normalizeDecision(decision);

      expect(result).toEqual(decision);
    });

    it('returns null for invalid decision', () => {
      expect(processor.normalizeDecision(null)).toBeNull();
      expect(processor.normalizeDecision(undefined)).toBeNull();
      expect(processor.normalizeDecision({})).toBeNull();
      expect(processor.normalizeDecision({ action: 'invalid' })).toBeNull();
    });
  });

  describe('isManagerInteractiveDecision', () => {
    it('validates action, confidence, reason, reply, intent as required', () => {
      const valid = {
        action: 'execute',
        confidence: 'high',
        reason: 'Valid reason',
        reply: 'Reply text',
        intent: 'progress_summary',
      };

      expect(processor.isManagerInteractiveDecision(valid)).toBe(true);
    });

    it('validates all action enum values', () => {
      const actions = ['ask_followup', 'request_confirmation', 'execute'];

      for (const action of actions) {
        const decision = {
          action,
          confidence: 'high',
          reason: 'Reason',
          reply: 'Reply',
          intent: 'progress_summary',
        };
        expect(processor.isManagerInteractiveDecision(decision)).toBe(true);
      }
    });

    it('validates all confidence enum values', () => {
      const confidences = ['low', 'medium', 'high'];

      for (const confidence of confidences) {
        const decision = {
          action: 'execute',
          confidence,
          reason: 'Reason',
          reply: 'Reply',
          intent: 'progress_summary',
        };
        expect(processor.isManagerInteractiveDecision(decision)).toBe(true);
      }
    });

    it('rejects invalid action values', () => {
      const decision = {
        action: 'invalid',
        confidence: 'high',
        reason: 'Reason',
        reply: 'Reply',
        intent: 'progress_summary',
      };

      expect(processor.isManagerInteractiveDecision(decision)).toBe(false);
    });

    it('rejects invalid confidence values', () => {
      const decision = {
        action: 'execute',
        confidence: 'invalid',
        reason: 'Reason',
        reply: 'Reply',
        intent: 'progress_summary',
      };

      expect(processor.isManagerInteractiveDecision(decision)).toBe(false);
    });

    it('rejects missing or empty reason', () => {
      expect(processor.isManagerInteractiveDecision({
        action: 'execute',
        confidence: 'high',
        reply: 'Reply',
        intent: 'progress_summary',
      })).toBe(false);

      expect(processor.isManagerInteractiveDecision({
        action: 'execute',
        confidence: 'high',
        reason: '',
        reply: 'Reply',
        intent: 'progress_summary',
      })).toBe(false);

      expect(processor.isManagerInteractiveDecision({
        action: 'execute',
        confidence: 'high',
        reason: '   ',
        reply: 'Reply',
        intent: 'progress_summary',
      })).toBe(false);
    });

    it('rejects missing or empty reply', () => {
      expect(processor.isManagerInteractiveDecision({
        action: 'execute',
        confidence: 'high',
        reason: 'Reason',
        intent: 'progress_summary',
      })).toBe(false);

      expect(processor.isManagerInteractiveDecision({
        action: 'execute',
        confidence: 'high',
        reason: 'Reason',
        reply: '',
        intent: 'progress_summary',
      })).toBe(false);
    });

    it('rejects missing or empty intent', () => {
      expect(processor.isManagerInteractiveDecision({
        action: 'execute',
        confidence: 'high',
        reason: 'Reason',
        reply: 'Reply',
      })).toBe(false);

      expect(processor.isManagerInteractiveDecision({
        action: 'execute',
        confidence: 'high',
        reason: 'Reason',
        reply: 'Reply',
        intent: '',
      })).toBe(false);
    });

    it('validates optional outputMode field', () => {
      const modes = ['summary', 'document', 'task', 'file', 'mixed'];

      for (const mode of modes) {
        const decision = {
          action: 'execute',
          confidence: 'high',
          reason: 'Reason',
          reply: 'Reply',
          intent: 'progress_summary',
          outputMode: mode,
        };
        expect(processor.isManagerInteractiveDecision(decision)).toBe(true);
      }

      const invalid = {
        action: 'execute',
        confidence: 'high',
        reason: 'Reason',
        reply: 'Reply',
        intent: 'progress_summary',
        outputMode: 'invalid',
      };
      expect(processor.isManagerInteractiveDecision(invalid)).toBe(false);
    });

    it('validates optional targetChannels array', () => {
      const validChannels = ['group_message', 'feishu_doc', 'bitable', 'internal_digest'];

      for (const channel of validChannels) {
        const decision = {
          action: 'execute',
          confidence: 'high',
          reason: 'Reason',
          reply: 'Reply',
          intent: 'progress_summary',
          targetChannels: [channel],
        };
        expect(processor.isManagerInteractiveDecision(decision)).toBe(true);
      }

      const invalid = {
        action: 'execute',
        confidence: 'high',
        reason: 'Reason',
        reply: 'Reply',
        intent: 'progress_summary',
        targetChannels: ['invalid'],
      };
      expect(processor.isManagerInteractiveDecision(invalid)).toBe(false);

      const notArray = {
        action: 'execute',
        confidence: 'high',
        reason: 'Reason',
        reply: 'Reply',
        intent: 'progress_summary',
        targetChannels: 'not-array',
      };
      expect(processor.isManagerInteractiveDecision(notArray)).toBe(false);
    });

    it('validates optional fields with correct types', () => {
      const decision = {
        action: 'execute',
        confidence: 'high',
        reason: 'Reason',
        reply: 'Reply',
        intent: 'progress_summary',
        executionGoal: 'Goal',
        executionPrompt: 'Prompt',
        skillHint: 'skill-1',
        metadata: { key: 'value' },
      };

      expect(processor.isManagerInteractiveDecision(decision)).toBe(true);
    });

    it('rejects optional fields with wrong types', () => {
      const base = {
        action: 'execute',
        confidence: 'high',
        reason: 'Reason',
        reply: 'Reply',
        intent: 'progress_summary',
      };

      expect(processor.isManagerInteractiveDecision({ ...base, executionGoal: 123 })).toBe(false);
      expect(processor.isManagerInteractiveDecision({ ...base, executionPrompt: 123 })).toBe(false);
      expect(processor.isManagerInteractiveDecision({ ...base, skillHint: 123 })).toBe(false);
      expect(processor.isManagerInteractiveDecision({ ...base, metadata: 'string' })).toBe(false);
      expect(processor.isManagerInteractiveDecision({ ...base, metadata: [] })).toBe(false);
    });

    it('rejects non-object values', () => {
      expect(processor.isManagerInteractiveDecision(null)).toBe(false);
      expect(processor.isManagerInteractiveDecision(undefined)).toBe(false);
      expect(processor.isManagerInteractiveDecision('string')).toBe(false);
      expect(processor.isManagerInteractiveDecision(123)).toBe(false);
    });
  });
});