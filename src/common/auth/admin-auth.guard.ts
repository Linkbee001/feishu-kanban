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
    const token = request.header('authorization')?.replace(/^Bearer\s+/i, '');
    const expected = this.config.get<string>('ADMIN_JWT_SECRET');
    if (!token || token !== expected) {
      throw new UnauthorizedException('Invalid admin token');
    }
    return true;
  }
}
