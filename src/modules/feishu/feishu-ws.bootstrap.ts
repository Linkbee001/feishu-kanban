import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { FeishuWsService } from './feishu-ws.service';

@Injectable()
export class FeishuWsBootstrap implements OnModuleInit {
  private readonly logger = new Logger(FeishuWsBootstrap.name);

  constructor(private readonly ws: FeishuWsService) {}

  async onModuleInit() {
    try {
      await this.ws.startIfEnabled();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to start Feishu WebSocket client: ${message}`, error instanceof Error ? error.stack : undefined);
    }
  }
}
