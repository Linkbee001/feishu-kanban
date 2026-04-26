import { ProjectDigestService } from '../src/modules/digest/project-digest.service';

describe('ProjectDigestService', () => {
  function createService(overrides: Record<string, unknown> = {}) {
    const config = {
      get: jest.fn((key: string) => {
        const values: Record<string, unknown> = {
          DIGEST_TIMEZONE: 'Asia/Shanghai',
          DIGEST_DAILY_CRON: '0 10 * * 1-5',
          DIGEST_WEEKLY_CRON: '0 17 * * 5',
          ...overrides,
        };
        return values[key];
      }),
    };

    return new ProjectDigestService(config as any);
  }

  it('schedules a daily digest on matching workday cron and skips duplicates on the same local day', () => {
    const service = createService();
    const now = new Date('2026-04-27T02:00:00.000Z');

    const firstRun = service.getScheduledDigestJobs(
      {
        lastDigestAt: null,
        lastDigestType: null,
        summaryPolicyJson: {
          enabled: true,
          internalOnly: true,
          dailyStatus: true,
          weeklyDraft: false,
          timezone: 'Asia/Shanghai',
          dailyStatusChannel: 'internal_digest',
          weeklyDraftChannel: 'internal_digest',
        },
      } as any,
      now,
    );

    expect(firstRun).toEqual([
      {
        digestType: 'daily_status',
        periodKey: '2026-04-27:daily_status',
        targetChannels: ['internal_digest'],
      },
    ]);

    const duplicateRun = service.getScheduledDigestJobs(
      {
        lastDigestAt: new Date('2026-04-27T01:30:00.000Z'),
        lastDigestType: 'daily_status',
        summaryPolicyJson: {
          enabled: true,
          internalOnly: true,
          dailyStatus: true,
          weeklyDraft: false,
          timezone: 'Asia/Shanghai',
          dailyStatusChannel: 'internal_digest',
          weeklyDraftChannel: 'internal_digest',
        },
      } as any,
      now,
    );

    expect(duplicateRun).toEqual([]);
  });

  it('uses phase2 weekly channels when weekly digests are externally visible', () => {
    const service = createService();
    const now = new Date('2026-04-24T09:00:00.000Z');

    const jobs = service.getScheduledDigestJobs(
      {
        lastDigestAt: null,
        lastDigestType: null,
        summaryPolicyJson: {
          enabled: true,
          internalOnly: false,
          dailyStatus: false,
          weeklyDraft: true,
          timezone: 'Asia/Shanghai',
          dailyStatusChannel: 'group_message',
          weeklyDraftChannel: 'group_message',
        },
      } as any,
      now,
    );

    expect(jobs).toEqual([
      {
        digestType: 'weekly_report_draft',
        periodKey: '2026-04-24:weekly_report_draft',
        targetChannels: ['group_message', 'feishu_doc'],
      },
    ]);
  });

  it('normalizes summary outputs with digest metadata and decision hints', () => {
    const service = createService();
    const normalized = service.normalizeSummaryOutput({
      projectId: 'project_1',
      digestType: 'daily_status',
      targetChannels: ['internal_digest'],
      internalOnly: true,
      context: {
        project: {
          id: 'project_1',
          name: 'Alpha',
          feishuChatId: 'chat_1',
        },
        environment: {
          id: 'env_1',
          name: 'Default',
        },
        session: {
          runtimeSessionKey: 'chat:chat_1:manager',
          sessionMode: 'active',
          status: 'idle',
        },
        recentMessages: [],
        recentRuns: [],
        recentArtifacts: [],
        folderEntries: [],
        folderEntriesTruncated: false,
        docSnapshots: [],
        bitableSnapshot: null,
      },
      output: {
        type: 'summary',
        title: 'ignored',
        content: '# Digest\nAll good.',
      },
    });

    expect(normalized.output.type).toBe('summary');
    expect(normalized.output.title).toBe('项目现状摘要');
    expect(normalized.output.metadata).toEqual(
      expect.objectContaining({
        wakeMode: 'scheduled_digest',
        digestType: 'daily_status',
        triggerType: 'scheduled',
        internalOnly: true,
        targetChannels: ['internal_digest'],
        digestHash: expect.any(String),
        decision: expect.objectContaining({
          wakeMode: 'scheduled_digest',
          intent: 'progress_summary',
          shouldNotifyGroup: false,
          shouldWriteDoc: false,
          confidence: 'high',
        }),
      }),
    );
  });
});
