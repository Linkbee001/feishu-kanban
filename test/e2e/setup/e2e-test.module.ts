import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { AdminAuthGuard } from '../../../src/common/auth/admin-auth.guard';
import { HttpExceptionFilter } from '../../../src/common/errors/http-exception.filter';
import { FeishuService } from '../../../src/modules/feishu/feishu.service';

/**
 * Mock FeishuService for E2E tests.
 * Returns fake tokens and success responses to bypass real API calls.
 */
const mockFeishuService = {
  createProjectFolder: jest.fn().mockImplementation((name: string) => {
    const token = 'mock_folder_' + Date.now();
    return Promise.resolve({
      token,
      url: `https://feishu.cn/drive/folders/${token}`,
    });
  }),
  createDocument: jest.fn().mockImplementation((folderToken: string, title: string, content: string) => {
    const token = 'mock_doc_' + Date.now();
    return Promise.resolve({
      token,
      url: `https://feishu.cn/docx/${token}`,
    });
  }),
  createTaskBitable: jest.fn().mockImplementation((projectName: string) => {
    const appToken = 'mock_bitable_' + Date.now();
    const tableId = 'mock_table_' + Date.now();
    return Promise.resolve({
      appToken,
      tableId,
      url: `https://feishu.cn/bitable/${appToken}`,
    });
  }),
  grantDrivePermission: jest.fn().mockResolvedValue({ success: true }),
  createChatTabs: jest.fn().mockImplementation((chatId: string, tabs: Array<{ tabName: string; url: string }> ) => {
    return Promise.resolve({
      raw: {},
      tabs: tabs.map((tab, i) => ({ id: `mock_tab_${i}`, name: tab.tabName, url: tab.url })),
    });
  }),
  sendTextMessage: jest.fn().mockResolvedValue({ message_id: 'mock_msg_id' }),
  folderUrl: jest.fn().mockImplementation((token: string) => {
    return `https://feishu.cn/drive/folders/${token}`;
  }),
  bitableUrl: jest.fn().mockImplementation((appToken: string, tableId?: string) => {
    return `https://feishu.cn/bitable/${appToken}`;
  }),
  listChatMembers: jest.fn().mockResolvedValue([
    { openId: 'ou_test_user', displayName: 'Test User', groupNickname: 'Test User', metadata: {} },
  ]),
  documentUrl: jest.fn().mockImplementation((token: string) => {
    return `https://feishu.cn/docx/${token}`;
  }),
  getDocument: jest.fn().mockResolvedValue({
    content: 'Mock document content',
  }),
  updateDocument: jest.fn().mockResolvedValue({ success: true }),
  sendMessage: jest.fn().mockResolvedValue({ message_id: 'mock_msg_id' }),
  getChatMembers: jest.fn().mockResolvedValue([
    { open_id: 'ou_test_user', name: 'Test User' },
  ]),
  addChatMembers: jest.fn().mockResolvedValue({ success: true }),
  removeChatMembers: jest.fn().mockResolvedValue({ success: true }),
  createChatTab: jest.fn().mockResolvedValue({ tab_id: 'mock_tab_id' }),
  addPermissionMembers: jest.fn().mockResolvedValue({ success: true }),
  getFileToken: jest.fn().mockResolvedValue('mock_file_token'),
};

/**
 * Creates an E2E test NestJS application with auth bypass and Feishu API mock.
 *
 * This module:
 * 1. Imports the root AppModule (full application stack)
 * 2. Overrides AdminAuthGuard with bypass (all requests authenticated in tests)
 * 3. Overrides FeishuService with mock (bypass real Feishu API calls)
 * 4. Applies same global pipes and filters as main.ts (ValidationPipe, HttpExceptionFilter)
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
    .overrideProvider(FeishuService)
    .useValue(mockFeishuService)
    .compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();
  return app;
}