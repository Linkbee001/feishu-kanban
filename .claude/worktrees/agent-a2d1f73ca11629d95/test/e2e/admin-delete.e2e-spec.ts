import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { AdminAuthGuard } from '../../src/common/auth/admin-auth.guard';
import { HttpExceptionFilter } from '../../src/common/errors/http-exception.filter';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { cleanupTestData, createTestChatId } from './setup/e2e-test.fixture';

/**
 * E2E tests for Quick Delete endpoint (D-10).
 *
 * DELETE /api/admin/robot-instances/:chatId
 * - Removes all data for a chatId: RuntimeEvents, AgentRuns, Artifacts,
 *   MessageSources, ConfirmationRequests, GroupAgentSession, Project
 * - Returns deletion summary with counts
 */
describe('Admin API - Quick Delete (D-10)', () => {
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

  describe('DELETE /api/admin/robot-instances/:chatId', () => {
    let testChatId: string;

    beforeEach(async () => {
      testChatId = createTestChatId();
    });

    afterEach(async () => {
      // Cleanup any remaining test data
      await cleanupTestData(prisma, testChatId);
    });

    it('returns 200 with deletion summary', async () => {
      // Create test data first
      const project = await prisma.project.create({
        data: {
          name: 'Test Project for Delete',
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

      // Create some runtime events
      await prisma.runtimeEvent.create({
        data: {
          projectId: project.id,
          runtimeSessionKey: `chat:${testChatId}:manager`,
          eventType: 'test_event',
          payload: {},
          sequence: 1,
        },
      });

      // Now delete
      const response = await request(app.getHttpServer())
        .delete(`/api/admin/robot-instances/${testChatId}`)
        .expect(200);

      expect(response.body).toHaveProperty('chatId', testChatId);
      expect(response.body).toHaveProperty('projectId');
      expect(response.body).toHaveProperty('deleted');
      expect(response.body.deleted).toHaveProperty('runtimeEvents');
      expect(response.body.deleted).toHaveProperty('agentRuns');
      expect(response.body.deleted).toHaveProperty('artifacts');
      expect(response.body.deleted).toHaveProperty('messageSources');
      expect(response.body.deleted).toHaveProperty('confirmationRequests');
      expect(response.body.deleted).toHaveProperty('groupAgentSession');
      expect(response.body.deleted).toHaveProperty('project');
      expect(response.body.deleted.runtimeEvents).toBeGreaterThanOrEqual(1);
      expect(response.body.deleted.groupAgentSession).toBe(1);
      expect(response.body.deleted.project).toBe(1);
    });

    it('returns 404 when robot instance not found', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/api/admin/robot-instances/${testChatId}`)
        .expect(404);

      expect(response.body.statusCode).toBe(404);
    });

    it('removes RuntimeEvents, AgentRuns, MessageSources, GroupAgentSession, Project', async () => {
      // Create test data with all entities
      const project = await prisma.project.create({
        data: {
          name: 'Test Project Full Delete',
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

      // Create runtime events
      await prisma.runtimeEvent.createMany({
        data: [
          {
            projectId: project.id,
            runtimeSessionKey: `chat:${testChatId}:manager`,
            eventType: 'event_1',
            payload: {},
            sequence: 1,
          },
          {
            projectId: project.id,
            runtimeSessionKey: `chat:${testChatId}:manager`,
            eventType: 'event_2',
            payload: {},
            sequence: 2,
          },
        ],
      });

      // Create message source
      await prisma.messageSource.create({
        data: {
          feishuChatId: testChatId,
          feishuEventId: 'test_event',
          feishuMessageId: 'test_msg',
          senderOpenId: 'test_sender',
          sourceType: 'group',
          rawText: 'test message',
          traceId: 'test_trace',
        },
      });

      // Delete
      await request(app.getHttpServer())
        .delete(`/api/admin/robot-instances/${testChatId}`)
        .expect(200);

      // Verify all deleted
      const deletedProject = await prisma.project.findUnique({
        where: { feishuChatId: testChatId },
      });
      expect(deletedProject).toBeNull();

      const deletedSession = await prisma.groupAgentSession.findUnique({
        where: {
          feishuChatId_agentRole: {
            feishuChatId: testChatId,
            agentRole: 'manager',
          },
        },
      });
      expect(deletedSession).toBeNull();

      const remainingEvents = await prisma.runtimeEvent.findMany({
        where: { projectId: project.id },
      });
      expect(remainingEvents).toHaveLength(0);

      const remainingMessages = await prisma.messageSource.findMany({
        where: { feishuChatId: testChatId },
      });
      expect(remainingMessages).toHaveLength(0);
    });
  });
});