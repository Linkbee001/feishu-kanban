import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.config.get('NODE_ENV') === 'test') {
      return true;
    }
    const request = context.switchToHttp().getRequest();
    if (this.isLocalDevBypassAllowed(request)) {
      return true;
    }
    const token = request.header('authorization')?.replace(/^Bearer\s+/i, '');
    const expected = this.config.get<string>('ADMIN_JWT_SECRET');
    if (!token || token !== expected) {
      throw new UnauthorizedException('Invalid admin token');
    }
    return true;
  }

  private isLocalDevBypassAllowed(request: {
    hostname?: string;
    ip?: string;
    socket?: { remoteAddress?: string };
    header(name: string): string | undefined;
  }) {
    if (this.config.get('NODE_ENV') !== 'development') {
      return false;
    }

    const host = request.header('host')?.split(':')[0]?.toLowerCase();
    const hostname = request.hostname?.toLowerCase();
    const remoteAddress = request.ip ?? request.socket?.remoteAddress ?? '';
    const localHosts = new Set(['localhost', '127.0.0.1', '::1']);

    return (
      (host && localHosts.has(host)) ||
      (hostname && localHosts.has(hostname)) ||
      remoteAddress === '127.0.0.1' ||
      remoteAddress === '::1' ||
      remoteAddress === '::ffff:127.0.0.1'
    );
  }
}
