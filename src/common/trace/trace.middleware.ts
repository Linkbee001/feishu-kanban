import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { customAlphabet } from 'nanoid';

const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 12);

export type RequestWithTrace = Request & { traceId?: string };

@Injectable()
export class TraceMiddleware implements NestMiddleware {
  use(req: RequestWithTrace, res: Response, next: NextFunction) {
    const incoming = req.header('x-trace-id');
    req.traceId = incoming || `tr_${nanoid()}`;
    res.setHeader('x-trace-id', req.traceId);
    next();
  }
}
