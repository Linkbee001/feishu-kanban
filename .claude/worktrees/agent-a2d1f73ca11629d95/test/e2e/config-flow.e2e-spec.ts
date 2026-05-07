import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createE2eTestModule } from './setup/e2e-test.module';
import { E2eTestFixture } from './setup/e2e-test.fixture';
import { PrismaService } from '../../src/common/prisma/prisma.service';

describe('Config Management Flow E2E', () => {
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

  describe('Config flow', () => {
    it('returns session status for non-existent chat (bootstrap mode)', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/group-config/${testChatId}`)
        .expect(200);

      expect(response.body).toHaveProperty('sessionMode');
      expect(response.body).toHaveProperty('hasProject', false);
    });

    it('sync creates pending_config session', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/group-config/${testChatId}/sync`)
        .expect(201);

      expect(response.body).toHaveProperty('sessionId');
      expect(response.body).toHaveProperty('sessionMode');
    });

    it('complete validates ownerOpenId is required', async () => {
      // Controller throws plain Error, which becomes 500 via HttpExceptionFilter
      await request(app.getHttpServer())
        .post(`/api/group-config/${testChatId}/complete`)
        .send({ configMarkdown: '# Test' })
        .expect(500);
    });

    it('complete validates configMarkdown is required', async () => {
      // Controller throws plain Error, which becomes 500 via HttpExceptionFilter
      await request(app.getHttpServer())
        .post(`/api/group-config/${testChatId}/complete`)
        .send({ ownerOpenId: 'ou_test' })
        .expect(500);
    });

    // Note: This test requires Feishu API mock for full flow
    // The complete endpoint calls Feishu to create folder and document
    // In real E2E, this would need mock setup
    it('complete validates session must be pending_config', async () => {
      // Create a new chat ID for this test
      const newChatId = fixture.createTestChatId();

      // Try to complete without sync (no session exists)
      await request(app.getHttpServer())
        .post(`/api/group-config/${newChatId}/complete`)
        .send({
          ownerOpenId: 'ou_test_user',
          configMarkdown: '# PROJECT-CONFIG\nTest configuration',
        })
        .expect(400); // Should fail - session not in pending_config
    });
  });
});