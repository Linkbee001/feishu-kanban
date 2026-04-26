import { Injectable } from '@nestjs/common';

export type AssistantIntent =
  | 'project_init'
  | 'document_generate'
  | 'task_breakdown'
  | 'code_analysis'
  | 'progress_summary'
  | 'environment_switch'
  | 'weekly_report'
  | 'meeting_minutes'
  | 'requirement_analysis';

const skillByIntent: Record<AssistantIntent, string | null> = {
  project_init: null,
  document_generate: 'document_generate',
  task_breakdown: 'task_breakdown',
  code_analysis: 'code_analysis',
  progress_summary: 'progress_summary',
  environment_switch: null,
  weekly_report: 'weekly_report',
  meeting_minutes: 'meeting_minutes',
  requirement_analysis: 'requirement_analysis',
};

@Injectable()
export class IntentMapperService {
  detect(rawText: string): AssistantIntent {
    const text = rawText.toLowerCase();
    if (/初始化|init project|init/.test(text)) return 'project_init';
    if (/切换.*环境|环境切换|switch.*env/.test(text)) return 'environment_switch';
    if (/进展|进度|阻塞|progress|status/.test(text)) return 'progress_summary';
    if (/拆.*任务|任务拆解|task/.test(text)) return 'task_breakdown';
    if (/代码|仓库|repo|code|架构|模块/.test(text)) return 'code_analysis';
    if (/周报|weekly/.test(text)) return 'weekly_report';
    if (/会议|纪要|minutes/.test(text)) return 'meeting_minutes';
    if (/prd|文档|方案|document|doc/.test(text)) return 'document_generate';
    return 'requirement_analysis';
  }

  skillFor(intent: AssistantIntent): string | null {
    return skillByIntent[intent];
  }

  requiresConfirmation(intent: AssistantIntent): boolean {
    return ['task_breakdown', 'environment_switch'].includes(intent);
  }

  outputSchema() {
    return {
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
    };
  }
}
