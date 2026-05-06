import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createE2eTestModule } from './setup/e2e-test.module';
import { E2eTestFixture } from './setup/e2e-test.fixture';
import { PrismaService } from '../../src/common/prisma/prisma.service';

describe('Admin API E2E', () => {
  let app: INestApplication;
  let fixture: E2eTestFixture;
  let prisma: PrismaService;
  let testChatId: string;

  beforeAll(async () => {
    app = await createE2eTestModule();
    prisma = app.get(PrismaService);
    fixture = new E2eTestFixture();
    await fixture.setup(prisma);
    testChatId = fixture.createTestChatId();
  });

  afterAll(async () => {
    await fixture.cleanup();
    await app.close();
  });

  describe('GET /api/admin/robot-instances', () => {
    it('returns array of instances', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/admin/robot-instances')
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
    });

    it('each instance has required fields', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/admin/robot-instances')
        .expect(200);

      if (response.body.length > 0) {
        const instance = response.body[0];
        expect(instance).toHaveProperty('chatId');
        expect(instance).toHaveProperty('robotName');
        expect(instance).toHaveProperty('projectName');
        expect(instance).toHaveProperty('sessionStatus');
      }
    });
  });

  describe('GET /api/admin/robot-instances/:chatId', () => {
    it('returns 404 for non-existent instance', async () => {
      await request(app.getHttpServer())
        .get(`/api/admin/robot-instances/${testChatId}`)
        .expect(404);
    });
  });

  describe('PATCH /api/admin/robot-instances/:chatId/policy', () => {
    it('returns 404 for non-existent instance', async () => {
      await request(app.getHttpServer())
        .patch(`/api/admin/robot-instances/${testChatId}/policy`)
        .send({ mentionOnly: true })
        .expect(404);
    });
  });

  describe('Auth bypass', () => {
    it('does not require JWT token in test environment', async () => {
      // No Authorization header - should not return 401
      await request(app.getHttpServer())
        .get('/api/admin/robot-instances')
        .expect(200); // Not 401
    });
  });
});