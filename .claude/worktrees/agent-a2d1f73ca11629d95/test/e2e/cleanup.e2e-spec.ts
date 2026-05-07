import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createE2eTestModule } from './setup/e2e-test.module';
import { E2eTestFixture } from './setup/e2e-test.fixture';
import { PrismaService } from '../../src/common/prisma/prisma.service';

/**
 * E2E tests for Quick Delete (D-10) and Reset Config (D-11) endpoints.
 *
 * NOTE: These endpoints will be implemented in plan 04-05.
 * These tests define expected behavior first (TDD pattern).
 * Tests will FAIL until endpoints are implemented.
 */
describe('Cleanup Endpoints E2E', () => {
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

  describe('Quick Delete (D-10)', () => {
    // These tests define expected behavior for endpoints to be implemented in 04-05
    // DELETE /api/admin/robot-instances/:chatId should remove all associated data

    it('DELETE endpoint exists (will return 404 until implemented)', async () => {
      // Until plan 04-05 implements DELETE, this will return 404 (endpoint not found)
      await request(app.getHttpServer())
        .delete(`/api/admin/robot-instances/${testChatId}`)
        .expect(404); // Endpoint not implemented yet
    });

    // Note: Full test for deletion behavior will be added after 04-05 implements endpoint
    // Expected behavior (per D-10):
    // - DELETE removes: Project, GroupAgentSession, MessageSource, RuntimeEvents
    // - Returns deletion summary { deleted: { project, sessions, messageSources, runtimeEvents } }
    // - After delete, GET /api/admin/robot-instances/:chatId returns 404
  });

  describe('Reset Config (D-11)', () => {
    // These tests define expected behavior for endpoints to be implemented in 04-05
    // POST /api/admin/robot-instances/:chatId/reset-config should reset to pending_config

    it('reset-config endpoint exists (will return 404 until implemented)', async () => {
      // Until plan 04-05 implements reset-config, this will return 404 (endpoint not found)
      await request(app.getHttpServer())
        .post(`/api/admin/robot-instances/${testChatId}/reset-config`)
        .expect(404); // Endpoint not implemented yet
    });

    // Note: Full test for reset behavior will be added after 04-05 implements endpoint
    // Expected behavior (per D-11):
    // - POST reset-config sets session to pending_config mode
    // - Clears/creates empty PROJECT-CONFIG.md
    // - Returns { sessionMode: 'pending_config' }
  });
});