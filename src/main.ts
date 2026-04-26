import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { HttpExceptionFilter } from './common/errors/http-exception.filter';
import { AppModule } from './app.module';

async function bootstrap() {
  process.env.APP_PROCESS = process.env.APP_PROCESS ?? 'api';
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT') ?? 3000;
  await app.listen(port);
  Logger.log(`API listening on ${port}`, 'Bootstrap');
}

void bootstrap();
