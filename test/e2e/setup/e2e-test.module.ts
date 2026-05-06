import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { AdminAuthGuard } from '../../src/common/auth/admin-auth.guard';
import { HttpExceptionFilter } from '../../src/common/errors/http-exception.filter';

/**
 * Creates an E2E test NestJS application with auth bypass.
 *
 * This module:
 * 1. Imports the root AppModule (full application stack)
 * 2. Overrides AdminAuthGuard with bypass (all requests authenticated in tests)
 * 3. Applies same global pipes and filters as main.ts (ValidationPipe, HttpExceptionFilter)
 *
 * Usage:
 * ```typescript
 * const app = await createE2eTestModule();
 * const response = await request(app.getHttpServer())
 *   .get('/api/admin/robot-instances')
 *   .expect(200);
 * await app.close();
 * ```
 */
export async function createE2eTestModule(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideGuard(AdminAuthGuard)
    .useValue({ canActivate: () => true })
    .compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();
  return app;
}