import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FEISHU_EVENT_QUEUE } from '../../queues/queue.constants';
import { AgentOutput } from '../agent/agent.types';
import { AgentService } from '../agent/agent.service';
import { GroupAgentSessionService } from '../agent/group-agent-session.service';
import { IntentMapperService } from '../agent/intent-mapper.service';
import { PiMonoAdapter } from '../agent/pi-mono.adapter';
import { ConfirmationService } from '../confirmation/confirmation.service';
import { ConversationService } from '../conversation/conversation.service';
import { EnvironmentService } from '../environment/environment.service';
import { ProjectService } from '../project/project.service';
import { FeishuService } from './feishu.service';

type ProjectInitDraft = {
  name?: string;
  description?: string;
  repoUrl?: string;
  repoBranch?: string;
  modelEndpoint?: string;
  modelName?: string;
};

type ProjectInitAssistantResponse = {
  reply: string;
  ready: boolean;
  project?: ProjectInitDraft;
  missingFields?: string[];
};

@Injectable()
export class FeishuEventService {
  private readonly logger = new Logger(FeishuEventService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly agent: AgentService,
    private readonly groupSessions: GroupAgentSessionService,
    private readonly environments: EnvironmentService,
    private readonly intentMapper: IntentMapperService,
    private readonly piMono: PiMonoAdapter,
    private readonly projects: ProjectService,
    private readonly conversations: ConversationService,
    private readonly confirmations: ConfirmationService,
    private readonly feishu: FeishuService,
    @InjectQueue(FEISHU_EVENT_QUEUE) private readonly queue: Queue,
  ) {}

  async enqueue(payload: any, traceId?: string) {
    const eventId = payload?.header?.event_id ?? payload?.uuid ?? payload?.event?.event_id;
    const jobId = eventId ? String(eventId).replace(/:/g, '-') : undefined;
    await this.queue.add('handle', { payload, traceId }, { jobId });
  }

  async handle(payload: any, traceId = `tr_${Date.now()}`) {
    const eventId = payload?.header?.event_id ?? payload?.uuid ?? payload?.event?.event_id ?? traceId;
    const message = payload?.event?.message;
    const chatId = message?.chat_id ?? payload?.event?.operator?.open_id;
    const messageId = message?.message_id ?? eventId;
    const senderOpenId =
      payload?.event?.sender?.sender_id?.open_id ?? payload?.event?.operator?.open_id ?? 'unknown';
    const rawText = this.extractText(message);

    const created = await this.prisma.feishuEventDedup
      .create({
        data: { eventId, messageId, traceId },
      })
      .catch(() => null);
    if (!created) {
      this.logger.log(`duplicate Feishu event skipped: ${eventId}`);
      return;
    }

    if (payload?.event?.action?.value?.confirmationId) {
      await this.confirmations.decideFromCard(
        payload.event.action.value.confirmationId,
        senderOpenId,
        payload.event.action.value.decision,
      );
      return;
    }

    if (!message || !chatId) return;

    const sourceType = message.chat_type === 'p2p' ? 'private' : 'group';
    const replyTarget =
      sourceType === 'group'
        ? { receiveIdType: 'chat_id', receiveId: chatId }
        : { receiveIdType: 'open_id', receiveId: senderOpenId };
    const intent = this.intentMapper.detect(rawText);

    if (sourceType === 'private') {
      const selection = await this.trySelectProjectFromPrivateChat(chatId, senderOpenId, rawText);
      if (selection.handled) {
        if (selection.message) {
          await this.feishu.sendTextMessage(replyTarget.receiveIdType, replyTarget.receiveId, selection.message);
        }
        return;
      }
    }

    const context =
      sourceType === 'private'
        ? await this.conversations.getActiveContext({
            sourceType,
            feishuChatId: chatId,
            userOpenId: senderOpenId,
          })
        : null;
    const project =
      sourceType === 'group'
        ? await this.prisma.project.findUnique({ where: { feishuChatId: chatId } })
        : context?.projectId
          ? await this.prisma.project.findUnique({ where: { id: context.projectId } })
          : null;

    if (!project) {
      if (sourceType === 'group') {
        await this.handleUninitializedGroup(chatId, senderOpenId, rawText);
      } else {
        await this.feishu.sendTextMessage(
          replyTarget.receiveIdType,
          replyTarget.receiveId,
          await this.buildPrivateProjectPrompt(senderOpenId),
        );
      }
      return;
    }

    const environment = await this.environments.getEffectiveEnvironment(project.id, chatId, senderOpenId);
    const session = await this.groupSessions.getOrCreateSession(chatId, {
      projectId: project.id,
      environmentId: environment.id,
      feishuChatId: chatId,
      sessionMode: 'active',
    });
    const source = await this.prisma.messageSource.create({
      data: {
        projectId: project.id,
        environmentId: environment.id,
        sourceType,
        feishuEventId: eventId,
        feishuChatId: chatId,
        feishuMessageId: messageId,
        senderOpenId,
        rawText,
        traceId,
      },
    });

    if (this.intentMapper.requiresConfirmation(intent)) {
      await this.confirmations.create({
        projectId: project.id,
        environmentId: environment.id,
        messageSourceId: source.id,
        actionType: intent,
        payload: { prompt: rawText, intent },
        chatId,
      });
      return;
    }

    const submission = await this.agent.submitGroupMessage({
      sessionId: session.id,
      projectId: project.id,
      environmentId: environment.id,
      feishuChatId: chatId,
      messageSourceId: source.id,
      prompt: rawText,
      intent,
    });

    if (submission.status === 'rejected_busy') {
      await this.feishu.sendTextMessage(replyTarget.receiveIdType, replyTarget.receiveId, this.buildBusyReply());
      return;
    }

    if (submission.status === 'failed' || !submission.runId) {
      await this.feishu.sendTextMessage(
        replyTarget.receiveIdType,
        replyTarget.receiveId,
        '当前群会话启动失败，请稍后重试。',
      );
      return;
    }

    await this.feishu.sendTextMessage(
      replyTarget.receiveIdType,
      replyTarget.receiveId,
      [
        `已开始执行：${intent}`,
        `环境：${environment.name}`,
        `仓库：${environment.repoUrl ?? '未配置'}`,
        `分支：${environment.repoBranch ?? '未配置'}`,
        `执行ID：${submission.runId}`,
      ].join('\n'),
    );
  }

  private async handleUninitializedGroup(chatId: string, senderOpenId: string, rawText: string) {
    const trimmed = rawText.trim();
    const session = await this.groupSessions.getOrCreateSession(chatId, {
      feishuChatId: chatId,
      sessionMode: 'bootstrap',
    });
    const lockToken = `bootstrap-lock:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`;
    const acquired = await this.groupSessions.tryAcquireLock(chatId, lockToken);
    if (!acquired) {
      await this.feishu.sendTextMessage('chat_id', chatId, this.buildBusyReply());
      return;
    }

    try {
      const existingDraft = this.groupSessions.getBootstrapDraft(session);

      if (/^(取消初始化|结束初始化|cancel init)$/i.test(trimmed)) {
        await this.groupSessions.updateBootstrapState(session.id, { draft: {}, summary: null, error: null });
        await this.feishu.sendTextMessage(
          'chat_id',
          chatId,
          '已取消本群的项目初始化引导。你之后再次发消息时，我会重新开始收集信息。',
        );
        return;
      }

      const response = await this.collectProjectInitInfo(session.runtimeSessionKey, trimmed, existingDraft);
      await this.syncSdkSessionState(session.id, session.runtimeSessionKey);
      const mergedDraft = this.mergeProjectDraft(existingDraft, response.project ?? {});

      if (response.ready && mergedDraft.name) {
        const project = await this.projects.initFromChat({
          name: mergedDraft.name,
          description: mergedDraft.description,
          ownerOpenId: senderOpenId,
          feishuChatId: chatId,
          createdBy: senderOpenId,
          repoUrl: mergedDraft.repoUrl,
          repoBranch: mergedDraft.repoBranch,
          modelEndpoint: mergedDraft.modelEndpoint,
          modelName: mergedDraft.modelName,
        });
        await this.groupSessions.bindProjectSession({
          sessionId: session.id,
          feishuChatId: chatId,
          projectId: project.id,
          environmentId: project.defaultEnvironmentId,
        });
        await this.feishu.sendTextMessage(
          'chat_id',
          chatId,
          '项目资源已初始化完成。你现在可以继续直接提问；如果你希望我继续处理刚才那条需求，请再发一次。',
        );
        return;
      }

      await this.groupSessions.updateBootstrapState(session.id, {
        draft: mergedDraft,
        summary: response.reply,
        error: null,
      });
      await this.feishu.sendTextMessage('chat_id', chatId, this.composeInitReply(response.reply, mergedDraft));
    } finally {
      await this.groupSessions.releaseBootstrapLock(chatId, lockToken);
    }
  }

  private async collectProjectInitInfo(
    runtimeSessionKey: string,
    rawText: string,
    draft: ProjectInitDraft,
  ): Promise<ProjectInitAssistantResponse> {
    try {
      const outputs = await this.piMono.runPrompt({
        sessionKey: runtimeSessionKey,
        intent: 'project_init',
        skillName: 'project_init',
        projectName: 'Feishu Group Bootstrap',
        prompt: this.buildProjectInitPrompt(rawText, draft),
        timeoutMs: 15_000,
      });
      const parsed = this.parseProjectInitOutputs(outputs);
      if (parsed) {
        return parsed;
      }
    } catch (error) {
      this.logger.warn(`pi mono bootstrap init fallback: ${error instanceof Error ? error.message : String(error)}`);
    }

    return this.fallbackProjectInitInfo(rawText, draft);
  }

  private async syncSdkSessionState(sessionId: string, runtimeSessionKey: string) {
    const snapshot = this.piMono.getSessionSnapshot(runtimeSessionKey);
    if (!snapshot) {
      return;
    }

    await this.groupSessions.syncRuntimeSessionState({
      sessionId,
      piSessionId: snapshot.piSessionId,
      sessionStoreDriver: snapshot.sessionStoreDriver,
      sessionStoreRef: snapshot.sessionStoreRef ?? null,
      memorySummary: snapshot.memorySummary ?? null,
      lastError: null,
      touchMessageAt: true,
      touchRunAt: true,
    });
  }

  private buildProjectInitPrompt(rawText: string, draft: ProjectInitDraft) {
    return [
      '你是飞书项目初始化助手。',
      '当前群还没有绑定项目资源，你的任务是帮助用户完成初始化信息收集。',
      '你需要尽可能从最新消息里提取项目名称、项目简介、仓库地址、仓库分支、模型地址、模型名称。',
      '项目名称是唯一必填项；其他字段都可以缺省。',
      '如果信息不足，请直接输出一句中文追问，引导用户补充下一项最关键的信息。',
      '如果项目名称已经明确，可以将 ready 设为 true。',
      `当前已收集草稿：${JSON.stringify(draft)}`,
      `用户最新消息：${rawText}`,
      '请只返回一个 AgentOutput 数组，数组中只允许一个 summary 项。',
      'summary.content 必须是 JSON 字符串，结构如下：',
      JSON.stringify({
        reply: '给用户看的中文回复',
        ready: false,
        project: {
          name: '',
          description: '',
          repoUrl: '',
          repoBranch: '',
          modelEndpoint: '',
          modelName: '',
        },
        missingFields: ['name'],
      }),
    ].join('\n');
  }

  private parseProjectInitOutputs(outputs: AgentOutput[]) {
    for (const output of outputs) {
      if (output.type !== 'summary' || !output.content) continue;
      try {
        const parsed = JSON.parse(output.content) as ProjectInitAssistantResponse;
        if (parsed && typeof parsed.reply === 'string' && typeof parsed.ready === 'boolean') {
          return parsed;
        }
      } catch {
        // Ignore invalid bootstrap output.
      }
    }
    return null;
  }

  private fallbackProjectInitInfo(rawText: string, draft: ProjectInitDraft): ProjectInitAssistantResponse {
    const nextDraft = this.mergeProjectDraft(draft, this.extractProjectDraftFromText(rawText));
    if (nextDraft.name) {
      return {
        reply: '我已经拿到这个群的项目名称了，接下来会为你初始化项目资源。',
        ready: true,
        project: nextDraft,
        missingFields: [],
      };
    }

    return {
      reply: [
        '这个群还没有初始化项目资源，我先帮你完成初始化。',
        '请先告诉我项目名称；如果方便，也可以一起补充项目简介、仓库地址和默认分支。',
        '示例：初始化项目 支付中台，仓库 https://git.example.com/pay.git，分支 main。',
      ].join('\n'),
      ready: false,
      project: nextDraft,
      missingFields: ['name'],
    };
  }

  private extractProjectDraftFromText(rawText: string): ProjectInitDraft {
    const draft: ProjectInitDraft = {};
    const repoUrlMatch = rawText.match(/https?:\/\/\S+/i);
    const branchMatch = rawText.match(/(?:分支|branch)[:：]?\s*([A-Za-z0-9/_-]+)/i);
    const projectNameMatch = rawText.match(
      /(?:初始化项目|创建项目|项目名称|项目叫做|项目是)\s*[:：]?\s*([^\n，,。]+)/i,
    );

    if (repoUrlMatch) {
      draft.repoUrl = repoUrlMatch[0];
    }
    if (branchMatch) {
      draft.repoBranch = branchMatch[1];
    }
    if (projectNameMatch) {
      draft.name = projectNameMatch[1].trim();
    }

    return draft;
  }

  private mergeProjectDraft(base: ProjectInitDraft, next: ProjectInitDraft): ProjectInitDraft {
    return {
      name: next.name || base.name,
      description: next.description || base.description,
      repoUrl: next.repoUrl || base.repoUrl,
      repoBranch: next.repoBranch || base.repoBranch,
      modelEndpoint: next.modelEndpoint || base.modelEndpoint,
      modelName: next.modelName || base.modelName,
    };
  }

  private composeInitReply(reply: string, draft: ProjectInitDraft) {
    const snapshot = [
      draft.name ? `项目名称：${draft.name}` : null,
      draft.description ? `项目简介：${draft.description}` : null,
      draft.repoUrl ? `仓库地址：${draft.repoUrl}` : null,
      draft.repoBranch ? `默认分支：${draft.repoBranch}` : null,
      draft.modelEndpoint ? `模型地址：${draft.modelEndpoint}` : null,
      draft.modelName ? `模型名称：${draft.modelName}` : null,
    ].filter(Boolean);

    if (!snapshot.length) {
      return reply;
    }

    return [reply, '', '当前已收集信息：', ...snapshot].join('\n');
  }

  private async trySelectProjectFromPrivateChat(chatId: string, senderOpenId: string, rawText: string) {
    const match = rawText.trim().match(/^(?:选择项目|切换项目|use project)\s+(.+)$/i);
    if (!match) {
      return { handled: false as const };
    }

    const keyword = match[1].trim();
    const available = await this.projects.listAvailableForUser(senderOpenId);
    const selected = available.find(
      (project) => project.id === keyword || project.name.toLowerCase() === keyword.toLowerCase(),
    );
    if (!selected) {
      return {
        handled: true as const,
        message: `没有找到项目“${keyword}”。\n${await this.buildPrivateProjectPrompt(senderOpenId)}`,
      };
    }

    await this.conversations.selectProject({
      sourceType: 'private',
      feishuChatId: chatId,
      userOpenId: senderOpenId,
      projectId: selected.id,
      environmentId: selected.defaultEnvironmentId,
    });

    const environment = selected.defaultEnvironmentId
      ? await this.environments.find(selected.defaultEnvironmentId)
      : null;
    return {
      handled: true as const,
      message: [
        `已切换到项目：${selected.name}`,
        `默认环境：${environment?.name ?? '未配置'}`,
        `仓库：${environment?.repoUrl ?? '未配置'}`,
        `分支：${environment?.repoBranch ?? '未配置'}`,
      ].join('\n'),
    };
  }

  private async buildPrivateProjectPrompt(senderOpenId: string) {
    const projects = await this.projects.listAvailableForUser(senderOpenId);

    if (!projects.length) {
      return '私聊模式不会自动绑定最近项目。你当前没有可用项目，请先在群里初始化项目。';
    }

    return [
      '私聊模式不会自动绑定最近项目，请先选择项目。',
      '发送“选择项目 项目名”或“选择项目 项目ID”。',
      '可用项目：',
      ...projects.map((project) => `- ${project.name} (${project.id})`),
    ].join('\n');
  }

  private extractText(message: any) {
    if (!message?.content) return '';
    try {
      const content = JSON.parse(message.content);
      return content.text ?? content.title ?? JSON.stringify(content);
    } catch {
      return String(message.content);
    }
  }

  private buildBusyReply() {
    return '当前群正在处理上一条任务。为了避免上下文混乱，这条消息暂不进入当前会话，请稍后再发一次。';
  }
}
