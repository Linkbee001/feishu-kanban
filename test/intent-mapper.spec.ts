import { IntentMapperService } from '../src/modules/agent/intent-mapper.service';

describe('IntentMapperService', () => {
  const mapper = new IntentMapperService();

  it('maps task breakdown to gstack skill', () => {
    const intent = mapper.detect('根据这份方案拆任务');
    expect(intent).toBe('task_breakdown');
    expect(mapper.skillFor(intent)).toBe('task_breakdown');
    expect(mapper.requiresConfirmation(intent)).toBe(true);
  });

  it('maps code analysis and document generation', () => {
    expect(mapper.detect('分析支付模块代码')).toBe('code_analysis');
    expect(mapper.detect('生成 PRD 文档')).toBe('document_generate');
  });
});
