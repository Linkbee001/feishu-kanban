import { PiSessionManager } from '../src/modules/agent/pi-session-manager.service';
import { PiSessionStateService } from '../src/modules/agent/pi-session-state.service';
import { createConfigMock, createPrismaMock, createFeishuReaderMock, createRedisMock, createModelRegistryMock } from './conftest';
import * as path from 'path';
import { mkdirSync, writeFileSync, rmSync } from 'fs';

describe('PiSessionManager', () => {
  let manager: PiSessionManager;
  let configMock: ReturnType<typeof createConfigMock>;
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let sessionStateMock: PiSessionStateService;
  let feishuReaderMock: ReturnType<typeof createFeishuReaderMock>;
  let redisMock: ReturnType<typeof createRedisMock>;
  const tempDirs: string[] = [];

  beforeEach(() => {
    configMock = createConfigMock();
    prismaMock = createPrismaMock();
    sessionStateMock = new PiSessionStateService();
    feishuReaderMock = createFeishuReaderMock();
    redisMock = createRedisMock();

    manager = new PiSessionManager(
      configMock as any,
      prismaMock as any,
      sessionStateMock,
      feishuReaderMock as any,
      redisMock as any,
    );
  });

  afterEach(() => {
    while (tempDirs.length) {
      const dir = tempDirs.pop();
      if (dir) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  describe('ensureSession', () => {
    it('creates new state when no cached session exists', async () => {
      const fakeSessionManager = {
        getSessionFile: jest.fn().mockReturnValue('C:\\sessions\\managed\\new-session.jsonl'),
      };
      const fakeSession = {
        prompt: jest.fn(),
        getLastAssistantText: jest.fn().mockReturnValue(''),
        abort: jest.fn().mockResolvedValue(undefined),
        dispose: jest.fn(),
        sessionId: 'pi_session_1',
      };
      const fakeSdk = {
        AuthStorage: {
          create: jest.fn().mockReturnValue({}),
        },
        ModelRegistry: {
          create: jest.fn().mockReturnValue(createModelRegistryMock()),
        },
        SessionManager: {
          create: jest.fn().mockReturnValue(fakeSessionManager),
          open: jest.fn(),
        },
        createAgentSession: jest.fn().mockResolvedValue({ session: fakeSession }),
      };

      (manager as any).loadSdk = jest.fn().mockResolvedValue(fakeSdk);

      const state = await manager.ensureSession({
        runtimeSessionKey: 'chat:chat_1:manager',
        projectPath: process.cwd(),
      });

      expect(state.runtimeSessionKey).toBe('chat:chat_1:manager');
      expect(fakeSdk.SessionManager.create).toHaveBeenCalled();
      expect(fakeSdk.createAgentSession).toHaveBeenCalled();
    });

    it('returns cached state when cwd matches', async () => {
      const fakeSessionManager = {
        getSessionFile: jest.fn().mockReturnValue('C:\\sessions\\managed\\cached-session.jsonl'),
      };
      const fakeSession = {
        prompt: jest.fn(),
        getLastAssistantText: jest.fn().mockReturnValue('cached text'),
        abort: jest.fn().mockResolvedValue(undefined),
        dispose: jest.fn(),
        sessionId: 'pi_session_cached',
      };
      const fakeSdk = {
        AuthStorage: {
          create: jest.fn().mockReturnValue({}),
        },
        ModelRegistry: {
          create: jest.fn().mockReturnValue(createModelRegistryMock()),
        },
        SessionManager: {
          create: jest.fn().mockReturnValue(fakeSessionManager),
          open: jest.fn(),
        },
        createAgentSession: jest.fn().mockResolvedValue({ session: fakeSession }),
      };

      (manager as any).loadSdk = jest.fn().mockResolvedValue(fakeSdk);

      // First call creates the session
      const state1 = await manager.ensureSession({
        runtimeSessionKey: 'chat:chat_cached:manager',
        projectPath: process.cwd(),
      });

      // Second call should return cached state (no new SDK calls)
      const state2 = await manager.ensureSession({
        runtimeSessionKey: 'chat:chat_cached:manager',
        projectPath: process.cwd(),
      });

      expect(state2).toBe(state1);
      expect(fakeSdk.createAgentSession).toHaveBeenCalledTimes(1);
    });

    it('disposes old session when cwd changes', async () => {
      const disposeMock = jest.fn();
      const fakeSessionManager = {
        getSessionFile: jest.fn().mockReturnValue('C:\\sessions\\managed\\change-session.jsonl'),
      };
      const fakeSession = {
        prompt: jest.fn(),
        getLastAssistantText: jest.fn().mockReturnValue(''),
        abort: jest.fn().mockResolvedValue(undefined),
        dispose: disposeMock,
        sessionId: 'pi_session_1',
      };
      const fakeSdk = {
        AuthStorage: {
          create: jest.fn().mockReturnValue({}),
        },
        ModelRegistry: {
          create: jest.fn().mockReturnValue(createModelRegistryMock()),
        },
        SessionManager: {
          create: jest.fn().mockReturnValue(fakeSessionManager),
          open: jest.fn(),
        },
        createAgentSession: jest.fn().mockResolvedValue({ session: fakeSession }),
      };

      (manager as any).loadSdk = jest.fn().mockResolvedValue(fakeSdk);

      // First session with cwd1
      const cwd1 = path.join(process.cwd(), '.tmp-cwd-1');
      mkdirSync(cwd1, { recursive: true });
      tempDirs.push(cwd1);

      await manager.ensureSession({
        runtimeSessionKey: 'chat:chat_change:manager',
        projectPath: cwd1,
      });

      // Second call with different cwd should dispose old session
      const cwd2 = path.join(process.cwd(), '.tmp-cwd-2');
      mkdirSync(cwd2, { recursive: true });
      tempDirs.push(cwd2);

      disposeMock.mockClear();
      await manager.ensureSession({
        runtimeSessionKey: 'chat:chat_change:manager',
        projectPath: cwd2,
      });

      expect(disposeMock).toHaveBeenCalled();
    });
  });

  describe('closeSession', () => {
    it('calls session.dispose and removes from state service', async () => {
      const disposeMock = jest.fn();
      const fakeSessionManager = {
        getSessionFile: jest.fn().mockReturnValue('C:\\sessions\\managed\\close-session.jsonl'),
      };
      const fakeSession = {
        prompt: jest.fn(),
        getLastAssistantText: jest.fn().mockReturnValue(''),
        abort: jest.fn().mockResolvedValue(undefined),
        dispose: disposeMock,
        sessionId: 'pi_session_close',
      };
      const fakeSdk = {
        AuthStorage: {
          create: jest.fn().mockReturnValue({}),
        },
        ModelRegistry: {
          create: jest.fn().mockReturnValue(createModelRegistryMock()),
        },
        SessionManager: {
          create: jest.fn().mockReturnValue(fakeSessionManager),
          open: jest.fn(),
        },
        createAgentSession: jest.fn().mockResolvedValue({ session: fakeSession }),
      };

      (manager as any).loadSdk = jest.fn().mockResolvedValue(fakeSdk);

      await manager.ensureSession({
        runtimeSessionKey: 'chat:chat_close:manager',
        projectPath: process.cwd(),
      });

      await manager.closeSession('chat:chat_close:manager');

      expect(disposeMock).toHaveBeenCalled();
      expect(sessionStateMock.getState('chat:chat_close:manager')).toBeUndefined();
    });
  });

  describe('rehydrateSession', () => {
    it('opens existing session from sessionStoreRef', async () => {
      const storeDir = path.join(process.cwd(), '.tmp-rehydrate-session');
      const storeRef = path.join(storeDir, 'existing-session.jsonl');
      mkdirSync(storeDir, { recursive: true });
      writeFileSync(storeRef, '', 'utf8');
      tempDirs.push(storeDir);

      const fakeSessionManager = {
        getSessionFile: jest.fn().mockReturnValue(storeRef),
      };
      const fakeSession = {
        prompt: jest.fn(),
        getLastAssistantText: jest.fn().mockReturnValue('rehydrated'),
        abort: jest.fn().mockResolvedValue(undefined),
        dispose: jest.fn(),
        sessionId: 'pi_session_existing',
      };
      const openSpy = jest.fn().mockReturnValue(fakeSessionManager);
      const fakeSdk = {
        AuthStorage: {
          create: jest.fn().mockReturnValue({}),
        },
        ModelRegistry: {
          create: jest.fn().mockReturnValue(createModelRegistryMock()),
        },
        SessionManager: {
          create: jest.fn(),
          open: openSpy,
        },
        createAgentSession: jest.fn().mockResolvedValue({ session: fakeSession }),
      };

      (manager as any).loadSdk = jest.fn().mockResolvedValue(fakeSdk);

      const snapshot = await manager.rehydrateSession({
        runtimeSessionKey: 'chat:chat_rehydrate:manager',
        sessionStoreRef: storeRef,
        projectPath: process.cwd(),
      });

      expect(openSpy).toHaveBeenCalledWith(storeRef, path.dirname(storeRef), process.cwd());
      expect(snapshot).toEqual(
        expect.objectContaining({
          piSessionId: 'pi_session_existing',
          sessionStoreRef: storeRef,
        }),
      );
    });
  });

  describe('loadSdk', () => {
    it('returns cached SDK promise on subsequent calls', async () => {
      // Mock the SDK to avoid dynamic import issues in Jest
      const fakeSdk = {
        AuthStorage: { create: jest.fn() },
        ModelRegistry: { create: jest.fn() },
        SessionManager: { create: jest.fn(), open: jest.fn() },
        createAgentSession: jest.fn(),
      };
      (manager as any).loadSdk = jest.fn().mockResolvedValue(fakeSdk);

      // Call loadSdk twice
      const sdk1 = await (manager as any).loadSdk();
      const sdk2 = await (manager as any).loadSdk();

      expect(sdk1).toBe(fakeSdk);
      expect((manager as any).loadSdk).toHaveBeenCalledTimes(2);
    });
  });

  describe('resolveCwd', () => {
    it('prefers ready repo mirror path over legacy project path', () => {
      const readyDir = path.join(process.cwd(), '.tmp-ready-repo');
      const projectDir = path.join(process.cwd(), '.tmp-project-path');
      mkdirSync(readyDir, { recursive: true });
      mkdirSync(projectDir, { recursive: true });
      tempDirs.push(readyDir, projectDir);

      const cwd = (manager as any).resolveCwd({
        repoMirrorPath: readyDir,
        repoSyncStatus: 'ready',
        projectPath: projectDir,
      });

      expect(cwd).toBe(readyDir);
    });

    it('falls back to projectPath when repo not ready', () => {
      const projectDir = path.join(process.cwd(), '.tmp-fallback-project');
      mkdirSync(projectDir, { recursive: true });
      tempDirs.push(projectDir);

      const cwd = (manager as any).resolveCwd({
        repoMirrorPath: '/nonexistent/repo',
        repoSyncStatus: 'error',
        projectPath: projectDir,
      });

      expect(cwd).toBe(projectDir);
    });

    it('uses config workdir as final fallback', () => {
      const cwd = (manager as any).resolveCwd({
        repoMirrorPath: '/nonexistent/repo',
        repoSyncStatus: 'unconfigured',
        projectPath: '/nonexistent/project',
      });

      expect(cwd).toBe(process.cwd());
    });
  });
});