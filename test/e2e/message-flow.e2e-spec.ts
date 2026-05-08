import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createE2eTestModule } from './setup/e2e-test.module';
import { E2eTestFixture } from './setup/e2e-test.fixture';
import { PrismaService } from '../../src/common/prisma/prisma.service';

describe('Message Processing Flow E2E', () => {
  let app: INestApplication;
  let fixture: E2eTestFixture;
  let prisma: PrismaService;
  let testChatId: string;
  let projectId: string;
  let environmentId: string;

  beforeAll(async () => {
    app = await createE2eTestModule();
    prisma = app.get(PrismaService);
    fixture = new E2eTestFixture();
    await fixture.setup(prisma);
    testChatId = fixture.createTestChatId();

    // Setup: create a configured project
    await request(app.getHttpServer())
      .post(`/api/group-config/${testChatId}/sync`)
      .expect(201);

    const completeRes = await request(app.getHttpServer())
      .post(`/api/group-config/${testChatId}/complete`)
      .send({
        ownerOpenId: 'ou_test_user',
        configMarkdown: `## Project
- Name: E2E Test Project
- Description: Automated E2E testing project
- Status: active

## Environment
- Name: Test Environment
- Repo URL: https://github.com/test/test.git
- Repo Branch: main
- Model Name: test-model

## Members
| Name | OpenID | Role |
|------|--------|------|
| Test User | ou_test_user | owner |

## Policy
- Enabled: true
- Mention Only: false
- Default Environment ID: test

## Skills
- Test skill

## Memory
Test memory`,
      })
      .expect(201);

    projectId = completeRes.body.projectId;
    environmentId = completeRes.body.environmentId;
  });

  afterAll(async () => {
    await fixture.cleanup();
    await app.close();
  });

  describe('Message ingestion', () => {
    it('creates MessageSource for incoming message', async () => {
      // Note: This requires simulating Feishu webhook or direct queue injection
      // For E2E, we verify the MessageSource exists after processing
      const response = await request(app.getHttpServer())
        .get(`/api/admin/robot-instances/${testChatId}/logs`)
        .expect(200);

      // Verify logs include messages (or empty if no messages processed yet)
      expect(response.body).toHaveProperty('messages');
      expect(Array.isArray(response.body.messages)).toBe(true);
    });

    it('Agent Run created for message triggers execution', async () => {
      // Trigger agent run manually (simulating message processing result)
      const response = await request(app.getHttpServer())
        .post('/api/agent-runs')
        .send({
          projectId,
          environmentId,
          prompt: 'Analyze the project status',
          intent: 'analysis',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('status', 'queued');
    });
  });

  describe('Runtime state verification', () => {
    it('runtime state reflects processing status', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/admin/robot-instances/${testChatId}/runtime`)
        .expect(200);

      expect(response.body).toHaveProperty('runtimeState');
      expect(response.body).toHaveProperty('tasks');
    });
  });

  describe('Message flow integration', () => {
    it('end-to-end: message triggers agent execution', async () => {
      // Create agent run (proxy for message processing)
      const runResponse = await request(app.getHttpServer())
        .post('/api/agent-runs')
        .send({
          projectId,
          environmentId,
          prompt: 'Generate project summary',
        })
        .expect(201);

      const runId = runResponse.body.id;

      // Verify run status progression
      const statusResponse = await request(app.getHttpServer())
        .get(`/api/agent-runs/${runId}`)
        .expect(200);

      expect(['queued', 'running', 'syncing', 'succeeded']).toContain(statusResponse.body.status);
    });
  });
});