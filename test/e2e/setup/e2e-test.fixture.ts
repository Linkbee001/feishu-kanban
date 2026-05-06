import { PrismaService } from '../../src/common/prisma/prisma.service';

/**
 * E2E test fixture providing setup/teardown lifecycle and test data helpers.
 *
 * Usage:
 * ```typescript
 * describe('E2E Test', () => {
 *   let fixture: E2eTestFixture;
 *   let prisma: PrismaService;
 *
 *   beforeAll(async () => {
 *     const app = await createE2eTestModule();
 *     prisma = app.get(PrismaService);
 *     fixture = new E2eTestFixture();
 *     await fixture.setup(prisma);
 *   });
 *
 *   afterAll(async () => {
 *     await fixture.cleanup();
 *     await app.close();
 *   });
 *
 *   it('test case', async () => {
 *     const chatId = fixture.createTestChatId();
 *     // ... test using chatId
 *   });
 * });
 * ```
 */
export class E2eTestFixture {
  private prisma!: PrismaService;
  private testChatIds: string[] = [];

  /**
   * Setup fixture with PrismaService instance.
   * Must be called before using createTestChatId or cleanup.
   */
  async setup(prisma: PrismaService): Promise<void> {
    this.prisma = prisma;
  }

  /**
   * Create a unique test chat ID.
   * Format: `oc_e2e_test_{timestamp}_{random_suffix}`
   * All created IDs are tracked for cleanup.
   */
  createTestChatId(): string {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).slice(2);
    const chatId = `oc_e2e_test_${timestamp}_${randomSuffix}`;
    this.testChatIds.push(chatId);
    return chatId;
  }

  /**
   * Cleanup all test data created during the test session.
   * Deletes all data associated with tracked test chat IDs.
   * Must be called in afterAll hook.
   */
  async cleanup(): Promise<void> {
    for (const chatId of this.testChatIds) {
      await this.cleanupByChatId(chatId);
    }
    this.testChatIds = [];
  }

  /**
   * Cleanup all data for a specific chat ID.
   * Respects foreign key constraints by deleting in correct order.
   *
   * Order (bottom-up dependency resolution):
   * 1. RuntimeEvent (depends on groupSessionId, projectId)
   * 2. AgentRun (depends on projectId)
   * 3. MessageSource (has feishuChatId, depends on projectId)
   * 4. GroupAgentSession (has feishuChatId)
   * 5. ProjectEnvironment (cascade from Project)
   * 6. Project (root entity with feishuChatId)
   *
   * This matches D-10 quick delete requirement.
   */
  private async cleanupByChatId(chatId: string): Promise<void> {
    // 1. Delete RuntimeEvents (find by runtimeSessionKey pattern or projectId)
    const runtimeSessionKeyPattern = `chat:${chatId}:*`;
    await this.prisma.runtimeEvent.deleteMany({
      where: {
        OR: [
          { runtimeSessionKey: { startsWith: `chat:${chatId}` } },
          { project: { feishuChatId: chatId } },
        ],
      },
    });

    // 2. Find project ID for this chat (if exists)
    const project = await this.prisma.project.findFirst({
      where: { feishuChatId: chatId },
      select: { id: true },
    });

    if (project) {
      // 3. Delete AgentRuns (cascade would handle, but explicit for safety)
      await this.prisma.agentRun.deleteMany({
        where: { projectId: project.id },
      });

      // 4. Delete MessageSources
      await this.prisma.messageSource.deleteMany({
        where: { feishuChatId: chatId },
      });

      // 5. Delete GroupAgentSessions
      await this.prisma.groupAgentSession.deleteMany({
        where: { feishuChatId: chatId },
      });

      // 6. Delete Project (cascade deletes ProjectEnvironment, etc.)
      await this.prisma.project.delete({
        where: { id: project.id },
      });
    } else {
      // No project, just cleanup orphan data by chatId
      await this.prisma.messageSource.deleteMany({
        where: { feishuChatId: chatId },
      });
      await this.prisma.groupAgentSession.deleteMany({
        where: { feishuChatId: chatId },
      });
    }
  }
}

/**
 * Helper function to create a unique test chat ID without fixture.
 * Use this for simple one-off tests without full fixture lifecycle.
 */
export function createTestChatId(): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).slice(2);
  return `oc_e2e_test_${timestamp}_${randomSuffix}`;
}

/**
 * Helper function to cleanup test data by chat ID without fixture.
 * Use this for simple one-off cleanup in standalone tests.
 *
 * @param prisma - PrismaService instance
 * @param chatId - Test chat ID to cleanup
 */
export async function cleanupTestData(prisma: PrismaService, chatId: string): Promise<void> {
  // Delete in correct order respecting foreign key constraints
  await prisma.runtimeEvent.deleteMany({
    where: {
      OR: [
        { runtimeSessionKey: { startsWith: `chat:${chatId}` } },
        { project: { feishuChatId: chatId } },
      ],
    },
  });

  const project = await prisma.project.findFirst({
    where: { feishuChatId: chatId },
    select: { id: true },
  });

  if (project) {
    await prisma.agentRun.deleteMany({ where: { projectId: project.id } });
    await prisma.messageSource.deleteMany({ where: { feishuChatId: chatId } });
    await prisma.groupAgentSession.deleteMany({ where: { feishuChatId: chatId } });
    await prisma.project.delete({ where: { id: project.id } });
  } else {
    await prisma.messageSource.deleteMany({ where: { feishuChatId: chatId } });
    await prisma.groupAgentSession.deleteMany({ where: { feishuChatId: chatId } });
  }
}