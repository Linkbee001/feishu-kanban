import { Processor, WorkerHost } from '@nestjs/bullmq';
import { ConfirmationStatus } from '@prisma/client';
import { Job } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ConversationService } from '../../modules/conversation/conversation.service';
import { CLEANUP_QUEUE } from '../queue.constants';

@Processor(CLEANUP_QUEUE)
export class CleanupProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly conversations: ConversationService,
  ) {
    super();
  }

  async process(_job: Job) {
    await this.prisma.confirmationRequest.updateMany({
      where: { status: ConfirmationStatus.pending, expiresAt: { lt: new Date() } },
      data: { status: ConfirmationStatus.expired, decidedAt: new Date() },
    });
    await this.conversations.cleanupExpired();
  }
}
