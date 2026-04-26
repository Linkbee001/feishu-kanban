export const AGENT_OUTPUT_SCHEMA = {
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
  },
} as const;

export const MANAGER_INTERACTIVE_DECISION_SCHEMA = {
  type: 'object',
  required: ['action', 'confidence', 'reason', 'reply', 'intent'],
  properties: {
    action: { enum: ['ask_followup', 'request_confirmation', 'execute'] },
    confidence: { enum: ['low', 'medium', 'high'] },
    reason: { type: 'string' },
    reply: { type: 'string' },
    intent: {
      enum: [
        'project_init',
        'document_generate',
        'task_breakdown',
        'code_analysis',
        'progress_summary',
        'environment_switch',
        'weekly_report',
        'meeting_minutes',
        'requirement_analysis',
        'risk_review',
        'stale_project_review',
      ],
    },
    executionGoal: { type: 'string' },
    executionPrompt: { type: 'string' },
    outputMode: { enum: ['summary', 'document', 'task', 'file', 'mixed'] },
    targetChannels: {
      type: 'array',
      items: { enum: ['group_message', 'feishu_doc', 'bitable', 'internal_digest'] },
    },
    skillHint: { type: 'string' },
    metadata: { type: 'object' },
  },
  additionalProperties: false,
} as const;
