import { Body, Controller, ForbiddenException, Get, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { AdminAuthGuard } from '../../common/auth/admin-auth.guard';
import { DevService } from './dev.service';
import { renderProjectBindingToolPage } from './project-binding-tool.page';

@Controller('api/dev')
export class DevController {
  constructor(
    private readonly config: ConfigService,
    private readonly dev: DevService,
  ) {}

  @Get('project-binding-tool')
  projectBindingTool(@Res() res: Response) {
    if (this.config.get<string>('NODE_ENV') === 'production') {
      throw new ForbiddenException('Dev pages are disabled in production');
    }
    res.type('html').send(renderProjectBindingToolPage());
  }

  @UseGuards(AdminAuthGuard)
  @Get('monitor')
  monitor(@Query() query: any) {
    if (this.config.get<string>('NODE_ENV') === 'production') {
      throw new ForbiddenException('Dev endpoints are disabled in production');
    }
    return this.dev.monitorSnapshot(query ?? {});
  }

  @UseGuards(AdminAuthGuard)
  @Post('seed-project')
  seedProject(@Body() body: any) {
    if (this.config.get<string>('NODE_ENV') === 'production') {
      throw new ForbiddenException('Dev endpoints are disabled in production');
    }
    return this.dev.seedProject(body ?? {});
  }

  @UseGuards(AdminAuthGuard)
  @Post('cleanup-resource')
  cleanupResource(@Body() body: any) {
    if (this.config.get<string>('NODE_ENV') === 'production') {
      throw new ForbiddenException('Dev endpoints are disabled in production');
    }
    return this.dev.cleanupResource(body ?? {});
  }
}
