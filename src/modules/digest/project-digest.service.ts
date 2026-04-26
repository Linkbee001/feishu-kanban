import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GroupAgentSession } from '@prisma/client';
import {
  AgentOutput,
  AgentWakeMode,
  DigestTargetChannel,
  DigestType,
  ManagerDecision,
  ProjectContextBundle,
  SummaryPolicy,
} from '../agent/agent.types';

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
};

type ScheduledDigestJob = {
  digestType: DigestType;
  periodKey: string;
  targetChannels: DigestTargetChannel[];
};

@Injectable()
export class ProjectDigestService {
  constructor(private readonly config: ConfigService) {}

  getScheduledDigestJobs(
    session: Pick<GroupAgentSession, 'lastDigestAt' | 'lastDigestType' | 'summaryPolicyJson'>,
    now = new Date(),
  ): ScheduledDigestJob[] {
    const policy = this.resolveSummaryPolicy(session.summaryPolicyJson);
    if (!policy.enabled) {
      return [];
    }

    const jobs: ScheduledDigestJob[] = [];
    const dailyCron = this.config.get<string>('DIGEST_DAILY_CRON') ?? '0 10 * * 1-5';
    const weeklyCron = this.config.get<string>('DIGEST_WEEKLY_CRON') ?? '0 17 * * 5';

    if (
      policy.dailyStatus &&
      this.matchesCron(dailyCron, now, policy.timezone) &&
      !this.didRunForCurrentDay(session.lastDigestAt, session.lastDigestType, 'daily_status', policy.timezone, now)
    ) {
      jobs.push({
        digestType: 'daily_status',
        periodKey: `${this.getLocalDateKey(now, policy.timezone)}:daily_status`,
        targetChannels: this.resolveTargetChannels('daily_status', policy),
      });
    }

    if (
      policy.weeklyDraft &&
      this.matchesCron(weeklyCron, now, policy.timezone) &&
      !this.didRunForCurrentDay(
        session.lastDigestAt,
        session.lastDigestType,
        'weekly_report_draft',
        policy.timezone,
        now,
      )
    ) {
      jobs.push({
        digestType: 'weekly_report_draft',
        periodKey: `${this.getLocalDateKey(now, policy.timezone)}:weekly_report_draft`,
        targetChannels: this.resolveTargetChannels('weekly_report_draft', policy),
      });
    }

    return jobs;
  }

  resolveSummaryPolicy(value: unknown): SummaryPolicy {
    const defaults: SummaryPolicy = {
      enabled: true,
      internalOnly: true,
      dailyStatus: true,
      weeklyDraft: true,
      timezone: this.config.get<string>('DIGEST_TIMEZONE') ?? 'Asia/Shanghai',
      dailyStatusChannel: 'internal_digest',
      weeklyDraftChannel: 'internal_digest',
    };
    const input =
      value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};

    return {
      enabled: input.enabled === false ? false : defaults.enabled,
      internalOnly: input.internalOnly === false ? false : defaults.internalOnly,
      dailyStatus: input.dailyStatus === false ? false : defaults.dailyStatus,
      weeklyDraft: input.weeklyDraft === false ? false : defaults.weeklyDraft,
      timezone: typeof input.timezone === 'string' && input.timezone.trim() ? input.timezone : defaults.timezone,
      dailyStatusChannel:
        input.dailyStatusChannel === 'group_message' || input.dailyStatusChannel === 'internal_digest'
          ? (input.dailyStatusChannel as SummaryPolicy['dailyStatusChannel'])
          : defaults.dailyStatusChannel,
      weeklyDraftChannel:
        input.weeklyDraftChannel === 'group_message' ||
        input.weeklyDraftChannel === 'internal_digest' ||
        input.weeklyDraftChannel === 'feishu_doc'
          ? (input.weeklyDraftChannel as SummaryPolicy['weeklyDraftChannel'])
          : defaults.weeklyDraftChannel,
    };
  }

  buildDigestSessionKey(chatId: string, digestType: DigestType) {
    const scope =
      digestType === 'daily_status'
        ? 'daily'
        : digestType === 'weekly_report_draft'
          ? 'weekly'
          : digestType;
    return `chat:${chatId}:manager:digest:${scope}`;
  }

  buildPrompt(input: {
    digestType: DigestType;
    wakeMode: AgentWakeMode;
    targetChannels: DigestTargetChannel[];
    internalOnly: boolean;
    context: ProjectContextBundle;
  }) {
    return [
      'You are the manager agent for a Feishu project collaboration workspace.',
      `Wake mode: ${input.wakeMode}`,
      `Digest type: ${input.digestType}`,
      `Target channels: ${input.targetChannels.join(', ')}`,
      `Internal only: ${input.internalOnly ? 'true' : 'false'}`,
      '',
      'Standing orders:',
      '1. Maintain an accurate project state summary rather than only answering the latest user message.',
      '2. Reuse existing documents, task board signals, and previous summaries before inferring new conclusions.',
      '3. Do not hallucinate project facts. If evidence is missing or conflicting, say so explicitly.',
      '4. Produce exactly one AgentOutput item of type summary.',
      '5. summary.content must be Markdown and must cover current phase, recent completions, blockers/risks, task anomalies, documentation gaps, and suggested next actions.',
      '',
      'Project context bundle (JSON):',
      JSON.stringify(input.context),
    ].join('\n');
  }

  buildOutputSchema() {
    return {
      type: 'array',
      minItems: 1,
      maxItems: 1,
      items: {
        type: 'object',
        required: ['type', 'title', 'content'],
        properties: {
          type: { enum: ['summary'] },
          title: { type: 'string' },
          content: { type: 'string' },
          contentFormat: { enum: ['markdown', 'text'] },
          metadata: { type: 'object' },
        },
      },
    };
  }

  normalizeSummaryOutput(input: {
    projectId: string;
    digestType: DigestType;
    targetChannels: DigestTargetChannel[];
    internalOnly: boolean;
    context: ProjectContextBundle;
    output?: AgentOutput;
  }) {
    const content =
      input.output?.content?.trim() ||
      this.buildFallbackSummary(input.context, input.digestType);
    const digestHash = this.hashDigest(content, input.digestType, input.projectId);
    const decision: ManagerDecision = {
      wakeMode: 'scheduled_digest',
      intent: input.digestType === 'weekly_report_draft' ? 'weekly_report' : 'progress_summary',
      targetChannels: input.targetChannels,
      shouldNotifyGroup: input.targetChannels.includes('group_message') && !input.internalOnly,
      shouldWriteDoc: input.targetChannels.includes('feishu_doc') && !input.internalOnly,
      confidence: input.context.sourceErrors ? 'medium' : 'high',
      reason: `Scheduled ${input.digestType} digest assembled from project state and Feishu resources.`,
    };

    const title = input.digestType === 'weekly_report_draft' ? '项目周报草案' : '项目现状摘要';

    return {
      output: {
        type: 'summary',
        title,
        content,
        contentFormat: 'markdown',
        metadata: {
          ...(input.output?.metadata ?? {}),
          wakeMode: 'scheduled_digest',
          digestType: input.digestType,
          triggerType: 'scheduled',
          internalOnly: input.internalOnly,
          digestHash,
          targetChannels: input.targetChannels,
          decision,
        },
      } satisfies AgentOutput,
      digestHash,
      decision,
    };
  }

  getLocalDateKey(date: Date, timezone: string) {
    const parts = this.getZonedParts(date, timezone);
    return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
  }

  private resolveTargetChannels(digestType: DigestType, policy: SummaryPolicy): DigestTargetChannel[] {
    if (policy.internalOnly) {
      return ['internal_digest'];
    }

    if (digestType === 'daily_status') {
      return policy.dailyStatusChannel === 'group_message' ? ['group_message'] : ['internal_digest'];
    }

    if (policy.weeklyDraftChannel === 'internal_digest') {
      return ['internal_digest'];
    }
    if (policy.weeklyDraftChannel === 'feishu_doc') {
      return ['feishu_doc'];
    }
    return ['group_message', 'feishu_doc'];
  }

  private didRunForCurrentDay(
    lastDigestAt: Date | null,
    lastDigestType: string | null,
    digestType: DigestType,
    timezone: string,
    now: Date,
  ) {
    if (!lastDigestAt || lastDigestType !== digestType) {
      return false;
    }
    return this.getLocalDateKey(lastDigestAt, timezone) === this.getLocalDateKey(now, timezone);
  }

  private matchesCron(cron: string, date: Date, timezone: string) {
    const parts = this.getZonedParts(date, timezone);
    const [minute, hour, day, month, weekday] = cron.trim().split(/\s+/);
    if (!weekday) {
      return false;
    }
    return (
      this.matchField(minute, parts.minute, 0, 59) &&
      this.matchField(hour, parts.hour, 0, 23) &&
      this.matchField(day, parts.day, 1, 31) &&
      this.matchField(month, parts.month, 1, 12) &&
      this.matchField(weekday, parts.weekday, 0, 6)
    );
  }

  private matchField(expression: string, value: number, min: number, max: number) {
    return expression.split(',').some((token) => this.matchToken(token.trim(), value, min, max));
  }

  private matchToken(token: string, value: number, min: number, max: number): boolean {
    if (!token || token === '*') {
      return true;
    }

    const [base, stepValue] = token.split('/');
    const step = stepValue ? Number(stepValue) : null;
    if (step !== null && (!Number.isFinite(step) || step <= 0)) {
      return false;
    }

    let start = min;
    let end = max;
    if (base && base !== '*') {
      if (base.includes('-')) {
        const [rawStart, rawEnd] = base.split('-').map(Number);
        start = rawStart;
        end = rawEnd;
      } else {
        const exact = Number(base);
        if (step === null) {
          return value === exact;
        }
        start = exact;
        end = max;
      }
    }

    if (value < start || value > end) {
      return false;
    }
    if (step === null) {
      return true;
    }
    return (value - start) % step === 0;
  }

  private getZonedParts(date: Date, timezone: string): ZonedParts {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      weekday: 'short',
    }).formatToParts(date);

    const map = new Map(parts.map((part) => [part.type, part.value]));
    const weekdayText = map.get('weekday') ?? 'Sun';
    const weekdayMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };

    return {
      year: Number(map.get('year') ?? '0'),
      month: Number(map.get('month') ?? '0'),
      day: Number(map.get('day') ?? '0'),
      hour: Number(map.get('hour') ?? '0'),
      minute: Number(map.get('minute') ?? '0'),
      weekday: weekdayMap[weekdayText] ?? 0,
    };
  }

  private buildFallbackSummary(context: ProjectContextBundle, digestType: DigestType) {
    const heading = digestType === 'weekly_report_draft' ? '# 项目周报草案' : '# 项目现状摘要';
    const blockers = context.bitableSnapshot?.blockedTasks ?? 0;
    const overdue = context.bitableSnapshot?.overdueTasks ?? 0;
    const docGap = context.docSnapshots.length
      ? 'Recent project documents are available for reuse.'
      : 'Recent project documentation is still missing.';

    return [
      heading,
      '',
      `- Project: ${context.project.name}`,
      `- Latest run summary: ${context.recentRuns[0]?.outputSummary ?? 'No recent run summary'}`,
      `- Blocked tasks: ${blockers}`,
      `- Overdue tasks: ${overdue}`,
      `- Documentation status: ${docGap}`,
      '- Suggested next step: unblock risks first, then backfill the missing documentation trail.',
    ].join('\n');
  }

  private hashDigest(content: string, digestType: DigestType, projectId: string) {
    return createHash('sha256')
      .update(`${content}\n${digestType}\n${projectId}`)
      .digest('hex');
  }
}
