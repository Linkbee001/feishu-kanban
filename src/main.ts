import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import * as express from 'express';
import * as path from 'path';
import { HttpExceptionFilter } from './common/errors/http-exception.filter';
import { AppModule } from './app.module';

async function bootstrap() {
  process.env.APP_PROCESS = process.env.APP_PROCESS ?? 'api';
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());

  // Serve frontend static assets at /admin route
  // Use process.cwd() to get project root, which works in both dev and compiled mode
  const frontendPath = path.join(process.cwd(), 'frontend', 'dist');

  // Serve assets at root level for script/stylesheet URLs (e.g., /assets/index.js)
  // Add CORS headers for crossorigin attribute support
  app.use('/assets', express.static(path.join(frontendPath, 'assets'), {
    setHeaders: (res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
  }));

  // Serve remaining frontend files at /admin route
  app.use('/admin', express.static(frontendPath));

  // SPA fallback - serve index.html for all /admin/* routes
  app.use(/\/admin\/.*/, (req, res, next) => {
    // Skip if it's an API request (shouldn't happen but safeguard)
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(frontendPath, 'index.html'));
  });

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT') ?? 3000;
  await app.listen(port);
  Logger.log(`API listening on ${port}`, 'Bootstrap');
  Logger.log(`Admin dashboard at http://localhost:${port}/admin`, 'Bootstrap');
}

void bootstrap();
