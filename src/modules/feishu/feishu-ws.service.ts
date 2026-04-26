import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Lark from '@larksuiteoapi/node-sdk';
import { FeishuEventService } from './feishu-event.service';

@Injectable()
export class FeishuWsService implements OnModuleDestroy {
  private readonly logger = new Logger(FeishuWsService.name);
  private client?: Lark.WSClient;
  private started = false;

  constructor(
    private readonly config: ConfigService,
    private readonly events: FeishuEventService,
  ) {}

  async startIfEnabled() {
    if (this.started) return;
    if (this.config.get<string>('APP_PROCESS') !== 'worker') return;
    if (this.config.get<string>('FEISHU_EVENT_MODE') !== 'ws') {
      this.logger.log('Feishu WebSocket event mode disabled; using webhook mode');
      return;
    }

    const appId = this.config.get<string>('FEISHU_APP_ID');
    const appSecret = this.config.get<string>('FEISHU_APP_SECRET');
    if (!appId || !appSecret) {
      this.logger.warn('FEISHU_EVENT_MODE=ws but FEISHU_APP_ID or FEISHU_APP_SECRET is empty; WebSocket client not started');
      return;
    }

    const eventDispatcher = new Lark.EventDispatcher({}).register(this.buildHandlers() as Lark.EventHandles);
    this.client = new Lark.WSClient({
      appId,
      appSecret,
      loggerLevel: Lark.LoggerLevel.info,
    });

    await this.client.start({ eventDispatcher });
    this.started = true;
    this.logger.log(`Feishu WebSocket client started for events: ${this.eventTypes().join(', ')}`);
  }

  onModuleDestroy() {
    this.client?.close();
  }

  private buildHandlers() {
    return this.eventTypes().reduce<Record<string, (data: any) => Promise<void>>>((handlers, eventType) => {
      handlers[eventType] = (data) => this.enqueueSdkEvent(eventType, data);
      return handlers;
    }, {});
  }

  private async enqueueSdkEvent(eventType: string, data: any) {
    const eventId = data?.event_id ?? data?.uuid ?? `ws_${Date.now()}`;
    const payload = {
      schema: '2.0',
      header: {
        event_id: eventId,
        event_type: data?.event_type ?? eventType,
        create_time: data?.create_time,
        token: data?.token,
        app_id: data?.app_id,
        tenant_key: data?.tenant_key,
      },
      event: this.toEventBody(eventType, data),
    };
    await this.events.enqueue(payload, `ws_${eventId}`);
  }

  private toEventBody(eventType: string, data: any) {
    if (eventType === 'im.message.receive_v1') {
      return {
        sender: data.sender,
        message: data.message,
      };
    }

    if (eventType === 'card.action.trigger') {
      return {
        operator: { open_id: data.open_id, user_id: data.user_id },
        action: data.action,
        open_message_id: data.open_message_id,
        tenant_key: data.tenant_key,
      };
    }

    return data;
  }

  private eventTypes() {
    const configured = this.config.get<string>('FEISHU_WS_EVENT_TYPES') ?? '';
    return configured
      .split(',')
      .map((eventType) => eventType.trim())
      .filter(Boolean);
  }
}
