import { BadRequestException, Inject, Injectable, NotFoundException, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConfirmationStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { assertConfirmationTransition } from '../../common/state/state-machine';
import { AgentService } from '../agent/agent.service';
import { GroupAgentSessionService } from '../agent/group-agent-session.service';
import { FeishuService } from '../feishu/feishu.service';

@Injectable()
export class ConfirmationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly agent: AgentService,
    private readonly groupSessions: GroupAgentSessionService,
    @Inject(forwardRef(() => FeishuService)) private readonly feishu: FeishuService,
  ) {}

  async create(input: {
    projectId?: string;
    environmentId?: string;
    messageSourceId: string;
    actionType: string;
    payload: unknown;
    chatId: string;
  }) {
    const ttl = this.config.get<number>('CONFIRMATION_TTL_MINUTES') ?? 30;
    const expiresAt = new Date(Date.now() + ttl * 60_000);
    const confirmation = await this.prisma.confirmationRequest.create({
      data: {
        projectId: input.projectId,
        environmentId: input.environmentId,
        messageSourceId: input.messageSourceId,
        actionType: input.actionType,
        payload: input.payload as any,
        expiresAt,
      },
    });
    const card = this.buildCard(confirmation.id, input.actionType, expiresAt);
    const sent = await this.feishu.sendCard('chat_id', input.chatId, card);
    const cardMessageId = (sent as any)?.data?.message_id;
    return this.prisma.confirmationRequest.update({
      where: { id: confirmation.id },
      data: { cardMessageId },
    });
  }

  async find(id: string) {
    const confirmation = await this.prisma.confirmationRequest.findUnique({
      where: { id },
      include: { messageSource: true },
    });
    if (!confirmation) throw new NotFoundException('Confirmation not found');
    return confirmation;
  }

  async confirm(id: string, confirmedBy = 'admin') {
    const confirmation = await this.find(id);
    if (confirmation.expiresAt < new Date()) return this.expire(id);
    assertConfirmationTransition(confirmation.status, ConfirmationStatus.confirmed);
    const updated = await this.prisma.confirmationRequest.update({
      where: { id },
      data: {
        status: ConfirmationStatus.confirmed,
        confirmedBy,
        decidedAt: new Date(),
      },
    });

    if (confirmation.projectId && confirmation.environmentId) {
      const payload = confirmation.payload as any;
      if (confirmation.messageSource.sourceType === 'group') {
        const session = await this.groupSessions.getOrCreateSession(confirmation.messageSource.feishuChatId, {
          projectId: confirmation.projectId,
          environmentId: confirmation.environmentId,
          feishuChatId: confirmation.messageSource.feishuChatId,
          sessionMode: 'active',
        });
        await this.agent.submitGroupMessage({
          sessionId: session.id,
          projectId: confirmation.projectId,
          environmentId: confirmation.environmentId,
          feishuChatId: confirmation.messageSource.feishuChatId,
          messageSourceId: confirmation.messageSourceId,
          prompt: payload.prompt ?? confirmation.messageSource.rawText,
          intent: payload.intent ?? confirmation.actionType,
        });
      } else {
        await this.agent.createRun({
          projectId: confirmation.projectId,
          environmentId: confirmation.environmentId,
          messageSourceId: confirmation.messageSourceId,
          prompt: payload.prompt ?? confirmation.messageSource.rawText,
          intent: payload.intent ?? confirmation.actionType,
        });
      }
    }

    return updated;
  }

  async reject(id: string, confirmedBy = 'admin') {
    const confirmation = await this.find(id);
    assertConfirmationTransition(confirmation.status, ConfirmationStatus.rejected);
    return this.prisma.confirmationRequest.update({
      where: { id },
      data: {
        status: ConfirmationStatus.rejected,
        confirmedBy,
        decidedAt: new Date(),
      },
    });
  }

  async expire(id: string) {
    const confirmation = await this.find(id);
    assertConfirmationTransition(confirmation.status, ConfirmationStatus.expired);
    return this.prisma.confirmationRequest.update({
      where: { id },
      data: {
        status: ConfirmationStatus.expired,
        decidedAt: new Date(),
      },
    });
  }

  async decideFromCard(id: string, openId: string, decision?: string) {
    if (decision === 'reject') return this.reject(id, openId);
    if (decision === 'confirm') return this.confirm(id, openId);
    throw new BadRequestException('Unknown confirmation card decision');
  }

  private buildCard(id: string, actionType: string, expiresAt: Date) {
    return {
      config: { wide_screen_mode: true },
      header: { title: { tag: 'plain_text', content: '需要确认' }, template: 'orange' },
      elements: [
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `动作：${actionType}\n过期时间：${expiresAt.toISOString()}`,
          },
        },
        {
          tag: 'action',
          actions: [
            {
              tag: 'button',
              text: { tag: 'plain_text', content: '确认' },
              type: 'primary',
              value: { confirmationId: id, decision: 'confirm' },
            },
            {
              tag: 'button',
              text: { tag: 'plain_text', content: '拒绝' },
              type: 'danger',
              value: { confirmationId: id, decision: 'reject' },
            },
          ],
        },
      ],
    };
  }
}
