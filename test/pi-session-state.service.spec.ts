import { PiSessionStateService } from '../src/modules/agent/pi-session-state.service';
import { createSessionState } from './conftest';

describe('PiSessionStateService', () => {
  let service: PiSessionStateService;

  beforeEach(() => {
    service = new PiSessionStateService();
  });

  describe('createState', () => {
    it('returns SessionRuntimeState with runtimeSessionKey', () => {
      const state = service.createState({
        runtimeSessionKey: 'chat:test:manager',
        cwd: process.cwd(),
        sessionManager: { getSessionFile: jest.fn() } as any,
      });

      expect(state.runtimeSessionKey).toBe('chat:test:manager');
    });

    it('returns SessionRuntimeState with cwd', () => {
      const state = service.createState({
        runtimeSessionKey: 'chat:test:manager',
        cwd: '/test/path',
        sessionManager: { getSessionFile: jest.fn() } as any,
      });

      expect(state.cwd).toBe('/test/path');
    });

    it('returns SessionRuntimeState with runtimeTaskSnapshots empty array', () => {
      const state = service.createState({
        runtimeSessionKey: 'chat:test:manager',
        cwd: process.cwd(),
        sessionManager: { getSessionFile: jest.fn() } as any,
      });

      expect(state.runtimeTaskSnapshots).toEqual([]);
    });

    it('returns SessionRuntimeState with pendingRuntimeTaskEvents empty array', () => {
      const state = service.createState({
        runtimeSessionKey: 'chat:test:manager',
        cwd: process.cwd(),
        sessionManager: { getSessionFile: jest.fn() } as any,
      });

      expect(state.pendingRuntimeTaskEvents).toEqual([]);
    });

    it('returns SessionRuntimeState with eventSequence initialized to 0', () => {
      const state = service.createState({
        runtimeSessionKey: 'chat:test:manager',
        cwd: process.cwd(),
        sessionManager: { getSessionFile: jest.fn() } as any,
      });

      expect(state.eventSequence).toBe(0);
    });

    it('returns SessionRuntimeState with recentEvents empty array', () => {
      const state = service.createState({
        runtimeSessionKey: 'chat:test:manager',
        cwd: process.cwd(),
        sessionManager: { getSessionFile: jest.fn() } as any,
      });

      expect(state.recentEvents).toEqual([]);
    });

    it('returns SessionRuntimeState with toolCache as new Map', () => {
      const state = service.createState({
        runtimeSessionKey: 'chat:test:manager',
        cwd: process.cwd(),
        sessionManager: { getSessionFile: jest.fn() } as any,
      });

      expect(state.toolCache).toBeInstanceOf(Map);
      expect(state.toolCache.size).toBe(0);
    });

    it('accepts optional sessionStoreRef', () => {
      const state = service.createState({
        runtimeSessionKey: 'chat:test:manager',
        cwd: process.cwd(),
        sessionManager: { getSessionFile: jest.fn() } as any,
        sessionStoreRef: '/sessions/test.jsonl',
      });

      expect(state.sessionStoreRef).toBe('/sessions/test.jsonl');
    });

    it('accepts optional roleProfile', () => {
      const roleProfile = {
        agentRole: 'manager' as const,
        agentsMd: 'agents',
        soulMd: 'soul',
        userMd: 'user',
        standingOrdersMd: 'orders',
        promptPreludeMd: 'prelude',
        skills: ['progress-summary'],
        compiledContextFile: '# AGENTS\ncontent',
      };

      const state = service.createState({
        runtimeSessionKey: 'chat:test:manager',
        cwd: process.cwd(),
        sessionManager: { getSessionFile: jest.fn() } as any,
        roleProfile,
      });

      expect(state.currentRoleProfile).toEqual(roleProfile);
    });

    it('stores state in internal sessions map', () => {
      const state = service.createState({
        runtimeSessionKey: 'chat:test:manager',
        cwd: process.cwd(),
        sessionManager: { getSessionFile: jest.fn() } as any,
      });

      const retrieved = service.getState('chat:test:manager');
      expect(retrieved).toBe(state);
    });
  });

  describe('getState', () => {
    it('returns undefined for non-existent session', () => {
      const state = service.getState('chat:nonexistent:manager');
      expect(state).toBeUndefined();
    });

    it('returns existing state for valid sessionKey', () => {
      const created = service.createState({
        runtimeSessionKey: 'chat:test:manager',
        cwd: process.cwd(),
        sessionManager: { getSessionFile: jest.fn() } as any,
      });

      const retrieved = service.getState('chat:test:manager');
      expect(retrieved).toBe(created);
    });
  });

  describe('updateSession', () => {
    it('updates session property on state', () => {
      const state = service.createState({
        runtimeSessionKey: 'chat:test:manager',
        cwd: process.cwd(),
        sessionManager: { getSessionFile: jest.fn() } as any,
      });

      const mockSession = { prompt: jest.fn(), dispose: jest.fn() } as any;
      service.updateSession(state, mockSession);

      expect(state.session).toBe(mockSession);
    });
  });

  describe('clearState', () => {
    it('removes state from internal map', () => {
      const state = service.createState({
        runtimeSessionKey: 'chat:test:manager',
        cwd: process.cwd(),
        sessionManager: { getSessionFile: jest.fn() } as any,
      });

      service.clearState('chat:test:manager');
      const retrieved = service.getState('chat:test:manager');
      expect(retrieved).toBeUndefined();
    });

    it('calls session.dispose when session exists', () => {
      const mockDispose = jest.fn();
      const state = service.createState({
        runtimeSessionKey: 'chat:test:manager',
        cwd: process.cwd(),
        sessionManager: { getSessionFile: jest.fn() } as any,
      });

      const mockSession = { prompt: jest.fn(), dispose: mockDispose } as any;
      service.updateSession(state, mockSession);
      service.clearState('chat:test:manager');

      expect(mockDispose).toHaveBeenCalled();
    });

    it('does not throw when state does not exist', () => {
      expect(() => service.clearState('chat:nonexistent:manager')).not.toThrow();
    });

    it('does not call dispose when session is undefined', () => {
      const state = service.createState({
        runtimeSessionKey: 'chat:test:manager',
        cwd: process.cwd(),
        sessionManager: { getSessionFile: jest.fn() } as any,
      });

      // session is undefined by default
      service.clearState('chat:test:manager');
      // No error - dispose not called on undefined
      expect(service.getState('chat:test:manager')).toBeUndefined();
    });
  });
});