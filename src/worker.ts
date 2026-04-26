import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  process.env.APP_PROCESS = process.env.APP_PROCESS ?? 'worker';
  await NestFactory.createApplicationContext(WorkerModule);
  Logger.log('Worker started', 'Bootstrap');
}

void bootstrap();
