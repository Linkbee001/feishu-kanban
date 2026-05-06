import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { AdminAuthGuard } from '../../src/common/auth/admin-auth.guard';
import { HttpExceptionFilter } from '../../src/common/errors/http-exception.filter';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { cleanupTestData, createTestChatId } from './setup/e2e-test.fixture';

/**
 * E2E tests for Reset Config endpoint (D-11).
 *
 * POST /api/admin/robot-instances/:chatId/reset-config
 * - Resets session to pending_config state
 * - Clears projectId, runtimeStateJson, activeEnvironmentId
 * - Deletes associated project data
 * - Returns reset summary
 */
describe('Admin API - Reset Config (D-11)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(AdminAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/admin/robot-instances/:chatId/reset-config', () => {
    let testChatId: string;

    beforeEach(async () => {
      testChatId = createTestChatId();
    });

    afterEach(async () => {
      // Cleanup any remaining test data
      await cleanupTestData(prisma, testChatId);
    });

    it('returns 200 with reset summary', async () => {
      // Create test data first
      const project = await prisma.project.create({
        data: {
          name: 'Test Project for Reset',
          ownerOpenId: 'test_owner',
          feishuChatId: testChatId,
          status: 'active',
          createdBy: 'test_user',
        },
      });

      const session = await prisma.groupAgentSession.create({
        data: {
          feishuChatId: testChatId,
          agentRole: 'manager',
          projectId: project.id,
          agentScopeKey: `scope:${testChatId}`,
          runtimeSessionKey: `chat:${testChatId}:manager`,
          sessionMode: 'active',
          status: 'idle',
        },
      });

      // Now reset
      const response = await request(app.getHttpServer())
        .post(`/api/admin/robot-instances/${testChatId}/reset-config`)
        .expect(200);

      expect(response.body).toHaveProperty('chatId', testChatId);
      expect(response.body).toHaveProperty('previousProjectId', project.id);
      expect(response.body).toHaveProperty('session');
      expect(response.body.session).toHaveProperty('status');
      expect(response.body.session).toHaveProperty('projectId');
    });

    it('returns 404 when robot instance not found', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/admin/robot-instances/${testChatId}/reset-config`)
        .expect(404);

      expect(response.body.statusCode).toBe(404);
    });

    it('sets session.sessionMode to pending_config', async () => {
      // Create test data
      const project = await prisma.project.create({
        data: {
          name: 'Test Project Reset Status',
          ownerOpenId: 'test_owner',
          feishuChatId: testChatId,
          status: 'active',
          createdBy: 'test_user',
        },
      });

      const session = await prisma.groupAgentSession.create({
        data: {
          feishuChatId: testChatId,
          agentRole: 'manager',
          projectId: project.id,
          agentScopeKey: `scope:${testChatId}`,
          runtimeSessionKey: `chat:${testChatId}:manager`,
          sessionMode: 'active',
          status: 'idle',
        },
      });

      // Reset
      const response = await request(app.getHttpServer())
        .post(`/api/admin/robot-instances/${testChatId}/reset-config`)
        .expect(200);

      expect(response.body.session.sessionMode).toBe('pending_config');
      expect(response.body.session.status).toBe('idle');
    });

    it('sets projectId to null after reset', async () => {
      // Create test data
      const project = await prisma.project.create({
        data: {
          name: 'Test Project Reset Null',
          ownerOpenId: 'test_owner',
          feishuChatId: testChatId,
          status: 'active',
          createdBy: 'test_user',
        },
      });

      const session = await prisma.groupAgentSession.create({
        data: {
          feishuChatId: testChatId,
          agentRole: 'manager',
          projectId: project.id,
          agentScopeKey: `scope:${testChatId}`,
          runtimeSessionKey: `chat:${testChatId}:manager`,
          sessionMode: 'active',
          status: 'idle',
        },
      });

      // Reset
      const response = await request(app.getHttpServer())
        .post(`/api/admin/robot-instances/${testChatId}/reset-config`)
        .expect(200);

      expect(response.body.session.projectId).toBeNull();

      // Verify session in database
      const updatedSession = await prisma.groupAgentSession.findUnique({
        where: {
          feishuChatId_agentRole: {
            feishuChatId: testChatId,
            agentRole: 'manager',
          },
        },
      });
      expect(updatedSession?.projectId).toBeNull();
      expect(updatedSession?.sessionMode).toBe('pending_config');
    });

    it('deletes associated project after reset', async () => {
      // Create test data
      const project = await prisma.project.create({
        data: {
          name: 'Test Project Delete After Reset',
          ownerOpenId: 'test_owner',
          feishuChatId: testChatId,
          status: 'active',
          createdBy: 'test_user',
        },
      });

      const session = await prisma.groupAgentSession.create({
        data: {
          feishuChatId: testChatId,
          agentRole: 'manager',
          projectId: project.id,
          agentScopeKey: `scope:${testChatId}`,
          runtimeSessionKey: `chat:${testChatId}:manager`,
          sessionMode: 'active',
          status: 'idle',
        },
      });

      // Reset
      await request(app.getHttpServer())
        .post(`/api/admin/robot-instances/${testChatId}/reset-config`)
        .expect(200);

      // Verify project deleted
      const deletedProject = await prisma.project.findUnique({
        where: { feishuChatId: testChatId },
      });
      expect(deletedProject).toBeNull();
    });
  });
});