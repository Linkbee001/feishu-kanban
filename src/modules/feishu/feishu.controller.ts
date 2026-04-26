import { Body, Controller, Headers, Post, Req, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { FeishuEventService } from './feishu-event.service';
import { FeishuService } from './feishu.service';

@Controller('webhooks/feishu')
export class FeishuController {
  constructor(
    private readonly feishu: FeishuService,
    private readonly events: FeishuEventService,
  ) {}

  @Post('events')
  async receive(
    @Body() body: any,
    @Req() req: Request,
    @Headers('x-lark-request-timestamp') timestamp?: string,
    @Headers('x-lark-request-nonce') nonce?: string,
    @Headers('x-lark-signature') signature?: string,
  ) {
    const rawBody = JSON.stringify(body);
    if (!this.feishu.verifySignature(timestamp, nonce, signature, rawBody)) {
      throw new UnauthorizedException('Invalid Feishu signature');
    }
    const payload = body.encrypt ? this.feishu.decryptEvent(body.encrypt) : body;
    if (payload?.type === 'url_verification') {
      if (!this.feishu.verifyEventToken(payload.token)) throw new UnauthorizedException('Invalid verification token');
      return { challenge: payload.challenge };
    }
    await this.events.enqueue(payload, (req as any).traceId);
    return { code: 0, msg: 'ok' };
  }
}
