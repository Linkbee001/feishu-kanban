import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { FEISHU_EVENT_QUEUE } from '../queue.constants';
import { FeishuEventService } from '../../modules/feishu/feishu-event.service';

@Processor(FEISHU_EVENT_QUEUE)
export class FeishuEventProcessor extends WorkerHost {
  constructor(private readonly events: FeishuEventService) {
    super();
  }

  process(job: Job<{ payload: unknown; traceId?: string }>) {
    return this.events.handle(job.data.payload, job.data.traceId);
  }
}
