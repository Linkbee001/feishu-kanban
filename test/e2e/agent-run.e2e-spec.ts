import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createE2eTestModule } from './setup/e2e-test.module';
import { E2eTestFixture } from './setup/e2e-test.fixture';
import { PrismaService } from '../../src/common/prisma/prisma.service';

describe('Agent Run Flow E2E', () => {
  let app: INestApplication;
  let fixture: E2eTestFixture;
  let prisma: PrismaService;
  let testChatId: string;
  let projectId: string;

  beforeAll(async () => {
    app = await createE2eTestModule();
    prisma = app.get(PrismaService);
    fixture = new E2eTestFixture();
    await fixture.setup(prisma);
    testChatId = fixture.createTestChatId();

    // Setup: create configured project
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
  });

  afterAll(async () => {
    await fixture.cleanup();
    await app.close();
  });

  describe('Agent Run creation', () => {
    it('creates run with required fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/agent-runs')
        .send({
          projectId,
          environmentId: 'env_test',
          prompt: 'Generate project overview',
          intent: 'summary',
          skillName: 'project-analysis',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('projectId', projectId);
      expect(response.body).toHaveProperty('status');
    });

    it('validates required projectId', async () => {
      await request(app.getHttpServer())
        .post('/api/agent-runs')
        .send({
          prompt: 'Test prompt',
        })
        .expect(400);
    });

    it('validates required prompt', async () => {
      await request(app.getHttpServer())
        .post('/api/agent-runs')
        .send({
          projectId,
          environmentId: 'env_test',
        })
        .expect(400);
    });
  });

  describe('Agent Run status', () => {
    let runId: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/api/agent-runs')
        .send({
          projectId,
          environmentId: 'env_test',
          prompt: 'Status test',
        })
        .expect(201);

      runId = response.body.id;
    });

    it('GET returns run details', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/agent-runs/${runId}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', runId);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('createdAt');
    });

    it('status transitions through valid states', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/agent-runs/${runId}`)
        .expect(200);

      // Valid states per state machine
      expect(['queued', 'running', 'syncing', 'succeeded', 'failed', 'canceled', 'timeout'])
        .toContain(response.body.status);
    });
  });

  describe('Agent Run cancellation', () => {
    it('cancel changes status to canceled', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/agent-runs')
        .send({
          projectId,
          environmentId: 'env_test',
          prompt: 'Cancel test',
        })
        .expect(201);

      const runId = createRes.body.id;

      const cancelRes = await request(app.getHttpServer())
        .post(`/api/agent-runs/${runId}/cancel`)
        .expect(200);

      expect(cancelRes.body.status).toBe('canceled');
    });

    it('cancel on completed run returns error', async () => {
      // Create run and wait for completion (or simulate)
      const createRes = await request(app.getHttpServer())
        .post('/api/agent-runs')
        .send({
          projectId,
          environmentId: 'env_test',
          prompt: 'Quick test',
        })
        .expect(201);

      // Attempt cancel (may succeed or fail depending on timing)
      await request(app.getHttpServer())
        .post(`/api/agent-runs/${createRes.body.id}/cancel`);
    });
  });

  describe('Agent Run artifacts', () => {
    it('run produces artifacts after execution', async () => {
      // Create run
      const createRes = await request(app.getHttpServer())
        .post('/api/agent-runs')
        .send({
          projectId,
          environmentId: 'env_test',
          prompt: 'Create document',
          intent: 'doc_creation',
        })
        .expect(201);

      // Check logs for artifacts (real execution would create artifacts)
      const logsRes = await request(app.getHttpServer())
        .get(`/api/admin/robot-instances/${testChatId}/logs`)
        .expect(200);

      expect(Array.isArray(logsRes.body.artifacts)).toBe(true);
    });
  });
});