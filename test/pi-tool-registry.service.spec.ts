import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PiToolRegistry } from '../src/modules/agent/pi-tool-registry.service';
import { PiOutputProcessor } from '../src/modules/agent/pi-output-processor.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { FeishuProjectReader } from '../src/modules/feishu/feishu-project-reader.service';
import {
  AgentOutput,
  GroupRuntimeTodoWriteAction,
  GroupRuntimeConfirmationAction,
  GroupRuntimeTaskSnapshot,
} from '../src/modules/agent/agent.types';

// SessionRuntimeState type (simplified for testing)
type SessionRuntimeState = {
  runtimeSessionKey: string;
  activeExecution?: {
    runId?: string;
    mode: 'outputs' | 'decision' | 'group_runtime';
    outputs: AgentOutput[];
    decision?: any;
    actions?: any[];
    emitted: boolean;
    canceled: boolean;
    timedOut: boolean;
  };
  currentContext?: {
    projectId: string;
    environmentId: string;
    feishuChatId: string;
    groupSessionId?: string | null;
  };
  runtimeTaskSnapshots: GroupRuntimeTaskSnapshot[];
  toolCache: Map<string, unknown>;
};

describe('PiToolRegistry', () => {
  let service: PiToolRegistry;
  let outputProcessor: PiOutputProcessor;
  let prisma: PrismaService;
  let feishuReader: FeishuProjectReader;

  const createMockState = (overrides?: Partial<SessionRuntimeState>): SessionRuntimeState => ({
    runtimeSessionKey: 'test-session',
    runtimeTaskSnapshots: [],
    toolCache: new Map(),
    ...overrides,
  });

  beforeEach(async () => {
    outputProcessor = {
      normalizeOutputs: jest.fn((value) => Array.isArray(value) ? value : []),
      normalizeDecision: jest.fn((value) => value),
      normalizeTodoWriteAction: jest.fn((value) => ({
        type: 'todo_write',
        action: value.action,
        taskId: value.taskId,
        title: value.title,
      })),
      normalizeRuntimeConfirmationAction: jest.fn((value) => {
        if (!value.actionType?.trim() || !value.summary?.trim()) return null;
        return {
          type: 'request_group_confirmation',
          actionType: value.actionType,
          summary: value.summary,
          payload: value.payload,
        };
      }),
    } as any;

    prisma = {
      artifact: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      project: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'test-project',
          docFolderToken: 'folder-token',
          bitableAppToken: 'bitable-token',
          bitableTableId: 'table-id',
        }),
      },
    } as any;

    feishuReader = {
      listProjectFolder: jest.fn().mockResolvedValue([]),
      readProjectDocument: jest.fn().mockResolvedValue({ content: 'doc content' }),
      searchProjectDocuments: jest.fn().mockResolvedValue([]),
      readBitableSnapshot: jest.fn().mockResolvedValue({ fields: [], recentRows: [] }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PiToolRegistry,
        { provide: PiOutputProcessor, useValue: outputProcessor },
        { provide: PrismaService, useValue: prisma },
        { provide: FeishuProjectReader, useValue: feishuReader },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue('test-value'),
            get: jest.fn().mockReturnValue('test-default'),
          },
        },
      ],
    }).compile();

    service = module.get<PiToolRegistry>(PiToolRegistry);
  });

  describe('createAllTools', () => {
    it('should return array of 11 tools', () => {
      const state = createMockState();
      const tools = service.createAllTools(state);

      expect(tools).toHaveLength(11);
    });

    it('should return tools with correct names', () => {
      const state = createMockState();
      const tools = service.createAllTools(state);

      const expectedNames = [
        'emit_outputs',
        'emit_decision',
        'list_project_folder',
        'read_project_doc',
        'search_project_docs',
        'read_project_bitable',
        'list_recent_project_artifacts',
        'todo_list',
        'todo_write',
        'reply_group',
        'request_group_confirmation',
      ];

      expect(tools.map((t) => t.name)).toEqual(expectedNames);
    });

    it('should return tools with name, label, description, parameters, execute', () => {
      const state = createMockState();
      const tools = service.createAllTools(state);

      for (const tool of tools) {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('label');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('parameters');
        expect(tool).toHaveProperty('execute');
        expect(typeof tool.execute).toBe('function');
      }
    });
  });

  describe('emit_outputs tool', () => {
    it('should capture outputs in ActiveExecutionState', async () => {
      const state = createMockState({
        activeExecution: {
          mode: 'outputs',
          outputs: [],
          emitted: false,
          canceled: false,
          timedOut: false,
        },
      });

      const tools = service.createAllTools(state);
      const emitOutputsTool = tools.find((t) => t.name === 'emit_outputs')!;

      const result = await emitOutputsTool.execute('tool-call-1', {
        outputs: [{ type: 'summary', title: 'test-output' }],
      });

      expect(state.activeExecution!.outputs).toHaveLength(1);
      expect(state.activeExecution!.emitted).toBe(true);
      expect(result.content[0].type).toBe('text');
    });

    it('should throw error when called outside active execution', async () => {
      const state = createMockState();

      const tools = service.createAllTools(state);
      const emitOutputsTool = tools.find((t) => t.name === 'emit_outputs')!;

      await expect(
        emitOutputsTool.execute('tool-call-1', { outputs: [] }),
      ).rejects.toThrow('emit_outputs called outside an active execution');
    });
  });

  describe('emit_decision tool', () => {
    it('should capture decision in ActiveExecutionState', async () => {
      const state = createMockState({
        activeExecution: {
          mode: 'decision',
          outputs: [],
          emitted: false,
          canceled: false,
          timedOut: false,
        },
      });

      const tools = service.createAllTools(state);
      const emitDecisionTool = tools.find((t) => t.name === 'emit_decision')!;

      const decision = {
        action: 'execute',
        confidence: 'high',
        reason: 'test reason',
        reply: 'test reply',
        intent: 'test intent',
      };

      const result = await emitDecisionTool.execute('tool-call-1', { decision });

      expect(state.activeExecution!.decision).toBeDefined();
      expect(state.activeExecution!.emitted).toBe(true);
      expect(result.content[0].type).toBe('text');
    });

    it('should throw error when called outside decision mode', async () => {
      const state = createMockState({
        activeExecution: {
          mode: 'outputs',
          outputs: [],
          emitted: false,
          canceled: false,
          timedOut: false,
        },
      });

      const tools = service.createAllTools(state);
      const emitDecisionTool = tools.find((t) => t.name === 'emit_decision')!;

      const result = await emitDecisionTool.execute('tool-call-1', { decision: {} });

      expect(result.content[0].text).toContain('emit_decision is only available during manager decision runs');
    });
  });

  describe('list_project_folder tool', () => {
    it('should return folder entries from FeishuReader', async () => {
      const state = createMockState({
        currentContext: {
          projectId: 'test-project',
          environmentId: 'test-env',
          feishuChatId: 'test-chat',
        },
      });

      feishuReader.listProjectFolder = jest.fn().mockResolvedValue([
        { name: 'doc1', token: 'token1' },
        { name: 'doc2', token: 'token2' },
      ]);

      const tools = service.createAllTools(state);
      const listFolderTool = tools.find((t) => t.name === 'list_project_folder')!;

      const result = await listFolderTool.execute('tool-call-1', {});

      expect(feishuReader.listProjectFolder).toHaveBeenCalled();
      expect(JSON.parse(result.content[0].text)).toHaveLength(2);
    });

    it('should throw error when context binding missing', async () => {
      const state = createMockState();

      const tools = service.createAllTools(state);
      const listFolderTool = tools.find((t) => t.name === 'list_project_folder')!;

      await expect(listFolderTool.execute('tool-call-1', {})).rejects.toThrow(
        'Feishu project tools require a runtime context binding',
      );
    });
  });

  describe('read_project_doc tool', () => {
    it('should return document content', async () => {
      const state = createMockState({
        currentContext: {
          projectId: 'test-project',
          environmentId: 'test-env',
          feishuChatId: 'test-chat',
        },
      });

      feishuReader.readProjectDocument = jest.fn().mockResolvedValue({
        token: 'doc-token',
        title: 'test-doc',
        content: 'document content',
      });

      const tools = service.createAllTools(state);
      const readDocTool = tools.find((t) => t.name === 'read_project_doc')!;

      const result = await readDocTool.execute('tool-call-1', {
        token: 'doc-token',
        title: 'test-doc',
      });

      expect(feishuReader.readProjectDocument).toHaveBeenCalledWith('doc-token', 'test-doc', expect.any(Object));
      expect(JSON.parse(result.content[0].text).content).toBe('document content');
    });
  });

  describe('search_project_docs tool', () => {
    it('should return search results', async () => {
      const state = createMockState({
        currentContext: {
          projectId: 'test-project',
          environmentId: 'test-env',
          feishuChatId: 'test-chat',
        },
      });

      feishuReader.searchProjectDocuments = jest.fn().mockResolvedValue([
        { token: 'doc1', title: 'matching doc', snippet: 'test query match' },
      ]);

      const tools = service.createAllTools(state);
      const searchTool = tools.find((t) => t.name === 'search_project_docs')!;

      const result = await searchTool.execute('tool-call-1', { query: 'test' });

      expect(feishuReader.searchProjectDocuments).toHaveBeenCalledWith('folder-token', 'test');
      expect(JSON.parse(result.content[0].text)).toHaveLength(1);
    });
  });

  describe('read_project_bitable tool', () => {
    it('should return bitable snapshot', async () => {
      const state = createMockState({
        currentContext: {
          projectId: 'test-project',
          environmentId: 'test-env',
          feishuChatId: 'test-chat',
        },
      });

      feishuReader.readBitableSnapshot = jest.fn().mockResolvedValue({
        fields: [{ name: 'field1' }],
        recentRows: [{ values: {} }],
      });

      const tools = service.createAllTools(state);
      const bitableTool = tools.find((t) => t.name === 'read_project_bitable')!;

      const result = await bitableTool.execute('tool-call-1', {});

      expect(feishuReader.readBitableSnapshot).toHaveBeenCalled();
      expect(JSON.parse(result.content[0].text).fields).toHaveLength(1);
    });
  });

  describe('list_recent_project_artifacts tool', () => {
    it('should return artifact list from Prisma', async () => {
      const state = createMockState({
        currentContext: {
          projectId: 'test-project',
          environmentId: 'test-env',
          feishuChatId: 'test-chat',
        },
      });

      prisma.artifact.findMany = jest.fn().mockResolvedValue([
        { id: 'artifact-1', type: 'document', title: 'Artifact 1', createdAt: new Date() },
        { id: 'artifact-2', type: 'summary', title: 'Artifact 2', createdAt: new Date() },
      ]);

      const tools = service.createAllTools(state);
      const artifactsTool = tools.find((t) => t.name === 'list_recent_project_artifacts')!;

      const result = await artifactsTool.execute('tool-call-1', { limit: 10 });

      expect(prisma.artifact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: 'test-project' },
          take: 10,
        }),
      );
      expect(JSON.parse(result.content[0].text)).toHaveLength(2);
    });

    it('should clamp limit between 1 and 20', async () => {
      const state = createMockState({
        currentContext: {
          projectId: 'test-project',
          environmentId: 'test-env',
          feishuChatId: 'test-chat',
        },
      });

      const tools = service.createAllTools(state);
      const artifactsTool = tools.find((t) => t.name === 'list_recent_project_artifacts')!;

      await artifactsTool.execute('tool-call-1', { limit: 100 });

      expect(prisma.artifact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20 }),
      );
    });
  });

  describe('todo_list tool', () => {
    it('should return runtimeTaskSnapshots JSON', async () => {
      const state = createMockState({
        runtimeTaskSnapshots: [
          { id: 'task-1', title: 'Task 1', status: 'queued', orderIndex: 0, intent: 'test_intent' },
          { id: 'task-2', title: 'Task 2', status: 'running', orderIndex: 1, intent: 'test_intent' },
        ],
      });

      const tools = service.createAllTools(state);
      const todoListTool = tools.find((t) => t.name === 'todo_list')!;

      const result = await todoListTool.execute('tool-call-1', {});

      expect(JSON.parse(result.content[0].text)).toHaveLength(2);
    });
  });

  describe('todo_write tool', () => {
    it('should queue action and update snapshot for create', async () => {
      const state = createMockState({
        activeExecution: {
          mode: 'group_runtime',
          outputs: [],
          emitted: false,
          canceled: false,
          timedOut: false,
          actions: [],
        },
      });

      const tools = service.createAllTools(state);
      const todoWriteTool = tools.find((t) => t.name === 'todo_write')!;

      const result = await todoWriteTool.execute('tool-call-1', {
        action: 'create',
        title: 'New Task',
      });

      expect(state.runtimeTaskSnapshots).toHaveLength(1);
      expect(state.runtimeTaskSnapshots[0].title).toBe('New Task');
      expect(state.activeExecution!.actions).toHaveLength(1);
      expect(result.content[0].text).toContain('Queued todo action: create');
    });

    it('should throw error when called outside group_runtime mode', async () => {
      const state = createMockState({
        activeExecution: {
          mode: 'outputs',
          outputs: [],
          emitted: false,
          canceled: false,
          timedOut: false,
        },
      });

      const tools = service.createAllTools(state);
      const todoWriteTool = tools.find((t) => t.name === 'todo_write')!;

      await expect(
        todoWriteTool.execute('tool-call-1', { action: 'create' }),
      ).rejects.toThrow('todo_write is only available during group runtime turns');
    });
  });

  describe('reply_group tool', () => {
    it('should queue reply text', async () => {
      const state = createMockState({
        activeExecution: {
          mode: 'group_runtime',
          outputs: [],
          emitted: false,
          canceled: false,
          timedOut: false,
          actions: [],
        },
      });

      const tools = service.createAllTools(state);
      const replyGroupTool = tools.find((t) => t.name === 'reply_group')!;

      const result = await replyGroupTool.execute('tool-call-1', { text: 'Hello group!' });

      expect(state.activeExecution!.actions).toHaveLength(1);
      expect(state.activeExecution!.actions![0]).toEqual({
        type: 'reply_group',
        text: 'Hello group!',
      });
      expect(result.content[0].text).toContain('Queued one group reply');
    });

    it('should throw error for empty text', async () => {
      const state = createMockState({
        activeExecution: {
          mode: 'group_runtime',
          outputs: [],
          emitted: false,
          canceled: false,
          timedOut: false,
        },
      });

      const tools = service.createAllTools(state);
      const replyGroupTool = tools.find((t) => t.name === 'reply_group')!;

      await expect(
        replyGroupTool.execute('tool-call-1', { text: '' }),
      ).rejects.toThrow('reply_group requires non-empty text');
    });
  });

  describe('request_group_confirmation tool', () => {
    it('should queue confirmation action', async () => {
      const state = createMockState({
        activeExecution: {
          mode: 'group_runtime',
          outputs: [],
          emitted: false,
          canceled: false,
          timedOut: false,
          actions: [],
        },
      });

      const tools = service.createAllTools(state);
      const confirmationTool = tools.find((t) => t.name === 'request_group_confirmation')!;

      const result = await confirmationTool.execute('tool-call-1', {
        actionType: 'document_publish',
        summary: 'Publish document?',
        payload: { documentId: 'doc-1' },
      });

      expect(state.activeExecution!.actions).toHaveLength(1);
      expect(state.activeExecution!.actions![0].type).toBe('request_group_confirmation');
      expect(result.content[0].text).toContain('Queued confirmation request');
    });

    it('should throw error for invalid payload', async () => {
      const state = createMockState({
        activeExecution: {
          mode: 'group_runtime',
          outputs: [],
          emitted: false,
          canceled: false,
          timedOut: false,
        },
      });

      const tools = service.createAllTools(state);
      const confirmationTool = tools.find((t) => t.name === 'request_group_confirmation')!;

      await expect(
        confirmationTool.execute('tool-call-1', { actionType: '', summary: 'test', payload: {} }),
      ).rejects.toThrow();
    });
  });
});