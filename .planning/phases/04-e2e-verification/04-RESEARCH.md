# Phase 04: E2E Verification + Admin Dashboard - Research

**Researched:** 2026-05-06
**Domain:** NestJS E2E testing, React + TailwindCSS admin UI, authentication patterns
**Confidence:** HIGH (stack verification), MEDIUM (E2E patterns - no existing E2E tests), HIGH (existing code patterns)

## Summary

Phase 04 combines two major objectives: E2E verification of the rebuilt system (v1.0.0 + v1.1.0) and development of a modern React + TailwindCSS admin dashboard to replace the existing vanilla HTML admin console. The existing admin console (`src/modules/admin/admin-console.page.ts`) demonstrates the desired UI structure but uses inline styles and vanilla JavaScript. The new dashboard will use React components, TailwindCSS utilities, and proper frontend build tooling while maintaining the embedded deployment pattern through NestJS static assets.

The existing testing infrastructure includes Jest with supertest, but only unit tests exist (`*.spec.ts`). No E2E test files (`*.e2e-spec.ts`) are present, so this phase will establish the E2E testing pattern. The existing `docs/E2E-TEST-GUIDE.md` and `scripts/e2e-manual-test.sh` provide manual testing guidance that E2E tests should automate.

**Primary recommendation:** Use existing NestJS testing patterns from unit tests, create first E2E test files following NestJS conventions, and build React frontend with TailwindCSS using a separate frontend directory that embeds via nest-cli.json assets configuration.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Verify message processing flow — Feishu message receive → FeishuEventService → GroupRuntimeService → PiMonoAdapter → Pi SDK execute → reply
- **D-02:** Verify config management flow — new group pending_config → fixed response → Admin API complete → Project creation
- **D-03:** Verify Agent Run flow — create run → queue process → Pi SDK execute → doc sync to Feishu
- **D-04:** Verify Admin API existing features — robot instance list, runtime state, policy update
- **D-05:** Verify 7 Pi services collaboration — PiSessionStateService, PiSessionManager, PiPromptBuilder, PiOutputProcessor, PiExecutor, PiEventRecorder, PiToolRegistry
- **D-06:** Use React + TypeScript for standalone frontend project
- **D-07:** Use TailwindCSS as UI styling framework
- **D-08:** Use embedded deployment — frontend static files embed in NestJS via nest-cli.json assets configuration
- **D-09:** Implement feature modules: robot instance management, config management, Agent Run management, runtime monitoring
- **D-10:** Implement quick delete — delete test group all associated data (Project, GroupAgentSession, MessageSource, RuntimeEvents)
- **D-11:** Implement reset config — reset group state to pending_config, clear PROJECT-CONFIG.md
- **D-12:** Implement integrated log viewer — embed log viewer in admin UI, real-time display worker/API logs
- **D-13:** Use environment-based authentication: dev env no login, production use existing AdminAuthGuard (JWT Token)
- **D-14:** Frontend served via NestJS static assets, unified port access

### Claude's Discretion
- Frontend component specific layout and style (follow TailwindCSS best practices)
- Log viewer technical implementation (WebSocket real-time push vs HTTP polling)
- Admin dashboard responsive design details
- Feature module interaction details (button positions, confirmation dialogs, etc.)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| D-01 | Verify message processing flow | NestJS E2E testing patterns, existing FeishuEventService tests provide mock patterns |
| D-02 | Verify config management flow | GroupConfigService/controller patterns documented, AdminAuthGuard bypass documented |
| D-03 | Verify Agent Run flow | AgentService patterns documented, queue testing approach from existing processor tests |
| D-04 | Verify Admin API | AdminService/controller patterns fully documented, existing unit tests provide mock factories |
| D-05 | Verify 7 Pi services | Phase 03 verification patterns, existing pi-*.spec.ts tests provide validation templates |
| D-06-09 | React + TailwindCSS dashboard | Component patterns documented, TailwindCSS version 4.2.4 verified |
| D-10-11 | Quick delete/reset | Requires new Admin endpoints, existing AdminService patterns extensible |
| D-12 | Log viewer | HTTP polling recommended for simplicity, WebSocket infrastructure exists but not for admin |
| D-13-14 | Auth + deployment | AdminAuthGuard bypass logic verified, nest-cli.json assets pattern documented |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| E2E test execution | Test runner (Jest) | — | Tests run outside application, no tier assignment |
| Admin UI rendering | Browser / Client | — | React components render in browser |
| Admin UI serving | Frontend Server (NestJS) | CDN / Static | NestJS serves static assets, no separate CDN required |
| Admin API endpoints | API / Backend | — | NestJS controllers handle API requests |
| Authentication logic | API / Backend | — | AdminAuthGuard runs server-side |
| Log aggregation | API / Backend | — | Log viewing requires backend log access |
| Test data cleanup | API / Backend | Database | Delete endpoints modify database state |

## Standard Stack

### Core (Backend E2E Testing)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @nestjs/testing | 11.1.9 | Test module creation | [VERIFIED: package.json] NestJS official testing utilities |
| Jest | 30.2.0 | Test framework | [VERIFIED: package.json] Existing test infrastructure |
| supertest | 7.1.4 | HTTP endpoint testing | [VERIFIED: package.json] Standard for NestJS E2E HTTP tests |
| ts-jest | 29.4.5 | TypeScript transform | [VERIFIED: package.json] Required for TS test files |

### Core (Frontend)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.5 | Component framework | [VERIFIED: npm registry] Current stable version |
| TailwindCSS | 4.2.4 | Utility-first CSS | [VERIFIED: npm registry] Current major version |
| TypeScript | 5.9.3 | Type safety | [VERIFIED: package.json] Matches backend TypeScript version |

### Supporting (Frontend Build)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vite | [ASSUMED] 6.x | Build tool | Faster than webpack for React SPA, standard for TailwindCSS 4.x |
| @vitejs/plugin-react | [ASSUMED] 4.x | React support | Required for Vite + React |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vite | webpack | webpack more complex setup, Vite faster dev experience |
| HTTP polling | WebSocket for logs | WebSocket more complex, polling sufficient for admin UI |
| React SPA | Next.js SSR | Next.js adds server complexity, SPA simpler for embedded admin |

**Installation (Frontend):**
```bash
# Create frontend directory
mkdir -p frontend

# Install frontend dependencies
cd frontend
npm init -y
npm install react@19.2.5 react-dom@19.2.5 tailwindcss@4.2.4
npm install -D @types/react@19.2.14 @types/react-dom vite@latest @vitejs/plugin-react@latest typescript@5.9.3
```

**Version verification:**
- React 19.2.5 [VERIFIED: npm registry 2026-05-06]
- TailwindCSS 4.2.4 [VERIFIED: npm registry 2026-05-06]
- @types/react 19.2.14 [VERIFIED: npm registry 2026-05-06]

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           E2E Test Flow                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  Test Runner (Jest)                                                          │
│      │                                                                        │
│      ▼                                                                        │
│  Test Module (TestingModule)                                                 │
│      │                                                                        │
│      ├──► HTTP Request (supertest) ──► NestJS App (main.ts)                  │
│      │                                      │                                │
│      │                                      ▼                                │
│      │                              Controller Layer                          │
│      │                                      │                                │
│      │                                      ▼                                │
│      │                              Service Layer                            │
│      │                                      │                                │
│      │                                      ▼                                │
│      │                              Prisma Mock / Real DB                    │
│      │                                                                        │
│      └──► Database Query (psql) ──► PostgreSQL                               │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           Admin Dashboard Flow                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  Browser                                                                      │
│      │                                                                        │
│      ├──► React App (frontend/dist/)                                         │
│      │        │                                                               │
│      │        ▼                                                               │
│      │   TailwindCSS Styles                                                   │
│      │        │                                                               │
│      │        ▼                                                               │
│      │   API Calls (fetch) ──► NestJS Static Assets (nest-cli.json)          │
│      │                                      │                                │
│      │                                      ▼                                │
│      │                              Admin Controller (/api/admin/*)           │
│      │                                      │                                │
│      │                                      ▼                                │
│      │                              AdminService                              │
│      │                                      │                                │
│      │                                      ▼                                │
│      │                              Prisma / GroupRuntimeService              │
│      │                                                                        │
│      └──► Log Viewer Poll ──► Log Endpoint ──► File System (logs/*.log)      │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
feishu-kanban/
├── frontend/                   # New React frontend project
│   ├── src/
│   │   ├── components/         # React components
│   │   │   ├── Layout.tsx      # Main layout (sidebar + header)
│   │   │   ├── Sidebar.tsx     # Navigation sidebar
│   │   │   ├── Dashboard.tsx   # Home dashboard
│   │   │   ├── InstanceList.tsx # Robot instance list
│   │   │   ├── InstanceDetail.tsx # Instance detail page
│   │   │   ├── LogViewer.tsx   # Real-time log viewer
│   │   │   └── ConfigPanel.tsx # Config management panel
│   │   ├── hooks/              # Custom hooks
│   │   │   ├── useApi.ts       # API fetch wrapper
│   │   │   ├── useLogPoll.ts   # Log polling hook
│   │   │   └── useAuth.ts      # Auth bypass detection
│   │   ├── App.tsx             # Root component
│   │   ├── main.tsx            # Entry point
│   │   └── index.css           # TailwindCSS imports
│   ├── vite.config.ts          # Vite configuration
│   ├── tailwind.config.ts      # TailwindCSS configuration
│   ├── tsconfig.json           # Frontend TS config
│   └── package.json            # Frontend dependencies
│   └── dist/                   # Build output (served by NestJS)
│
├── test/
│   ├── *.spec.ts               # Existing unit tests
│   ├── e2e/                    # NEW: E2E test directory
│   │   ├── message-flow.e2e-spec.ts    # D-01 verification
│   │   ├── config-flow.e2e-spec.ts     # D-02 verification
│   │   ├── agent-run.e2e-spec.ts       # D-03 verification
│   │   ├── admin-api.e2e-spec.ts       # D-04 verification
│   │   └── cleanup.e2e-spec.ts         # D-10/D-11 verification
│   │   └── setup/
│   │       ├── e2e-test.module.ts      # Test app module
│   │       └── e2e-test.fixture.ts     # Test fixtures
│   │
│   └── conftest.ts             # Existing mock factories (reuse)
│
├── nest-cli.json               # MODIFY: Add assets for frontend
├── src/modules/admin/
│   ├── admin.controller.ts     # MODIFY: Add delete/reset endpoints
│   ├── admin.service.ts        # MODIFY: Add delete/reset methods
│   └── admin-logs.controller.ts # NEW: Log viewing endpoints
│   └── admin-logs.service.ts   # NEW: Log file reading service
│
└── docs/
    └── E2E-TEST-GUIDE.md       # Existing manual guide (reference)
```

### Pattern 1: NestJS E2E Testing
**What:** Use `@nestjs/testing` Test module with supertest for HTTP endpoint verification
**When to use:** All E2E tests for API endpoints, message flow, config flow
**Example:**
```typescript
// Source: [CITED: existing test patterns from test/admin.service.spec.ts]
import { Test } from '@nestjs/testing';
import * as request from 'supertest';

describe('Admin API E2E', () => {
  let app: INestApplication;

  beforeAll(async () {
    const module = await Test.createTestingModule({
      imports: [AdminModule, ConfigModule],
      // Use real database or mock based on test scope
    })
    .overrideGuard(AdminAuthGuard)
    .useValue({ canActivate: () => true }) // Bypass auth for tests
    .compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists robot instances', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/admin/robot-instances')
      .expect(200);

    expect(response.body).toBeInstanceOf(Array);
    expect(response.body[0]).toHaveProperty('chatId');
  });
});
```

### Pattern 2: React Admin Dashboard Component
**What:** Functional components with TailwindCSS utility classes, API hooks for data fetching
**When to use:** All admin UI components
**Example:**
```typescript
// Source: [ASSUMED] Based on TailwindCSS 4.x patterns + existing admin-console.page.ts structure
import { useApi } from '../hooks/useApi';

export function InstanceList() {
  const { data: instances, loading, error } = useApi('/api/admin/robot-instances');

  if (loading) return <div className="p-4 text-gray-500">Loading...</div>;
  if (error) return <div className="p-4 text-red-500">{error.message}</div>;

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Robot Instances</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {instances?.map((instance) => (
          <InstanceCard key={instance.chatId} instance={instance} />
        ))}
      </div>
    </div>
  );
}

function InstanceCard({ instance }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow">
      <h3 className="font-semibold text-lg">{instance.robotName}</h3>
      <p className="text-gray-600 text-sm">{instance.projectName}</p>
      <div className="mt-2 flex gap-2">
        <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-sm">
          {instance.sessionMode}
        </span>
        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm">
          {instance.runtimeStatus}
        </span>
      </div>
    </div>
  );
}
```

### Pattern 3: nest-cli.json Assets Configuration
**What:** Configure frontend build output as NestJS static assets
**When to use:** Embedding React SPA in NestJS application
**Example:**
```json
// Source: [CITED: NestJS docs pattern, current nest-cli.json structure]
{
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true,
    "assets": [
      {
        "include": "../frontend/dist/**/*",
        "outDir": "dist/src",
        "watchAssets": true
      }
    ]
  }
}
```

### Pattern 4: Log Polling Hook
**What:** HTTP polling for real-time log updates (chosen over WebSocket for simplicity)
**When to use:** Log viewer component, dashboard monitoring
**Example:**
```typescript
// Source: [ASSUMED] Standard React polling pattern
import { useEffect, useState } from 'react';

export function useLogPoll(chatId: string, interval = 5000) {
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await fetch(`/api/admin/logs/${chatId}?since=${Date.now() - interval}`);
        const data = await response.json();
        setLogs(prev => [...prev.slice(-100), ...data.lines]);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Fetch failed'));
      }
    };

    fetchLogs();
    const timer = setInterval(fetchLogs, interval);
    return () => clearInterval(timer);
  }, [chatId, interval]);

  return { logs, error };
}
```

### Pattern 5: AdminAuthGuard Bypass Logic
**What:** Environment-based authentication bypass for development/testing
**When to use:** All admin endpoints, test configuration
**Example:**
```typescript
// Source: [VERIFIED: src/common/auth/admin-auth.guard.ts]
@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    // Bypass 1: Test environment
    if (this.config.get('NODE_ENV') === 'test') {
      return true;
    }

    // Bypass 2: Localhost + development
    const request = context.switchToHttp().getRequest();
    if (this.isLocalDevBypassAllowed(request)) {
      return true;
    }

    // Production: JWT validation
    const token = request.header('authorization')?.replace(/^Bearer\s+/i, '');
    const expected = this.config.get<string>('ADMIN_JWT_SECRET');
    if (!token || token !== expected) {
      throw new UnauthorizedException('Invalid admin token');
    }
    return true;
  }

  private isLocalDevBypassAllowed(request) {
    if (this.config.get('NODE_ENV') !== 'development') {
      return false;
    }
    const host = request.header('host')?.split(':')[0]?.toLowerCase();
    const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
    return localHosts.has(host ?? '');
  }
}
```

### Anti-Patterns to Avoid
- **Duplicate auth logic:** Don't implement new auth patterns — reuse AdminAuthGuard
- **WebSocket for logs:** WebSocket adds complexity; HTTP polling sufficient for admin dashboard
- **Inline styles:** Existing admin-console.page.ts uses inline CSS — use TailwindCSS utilities instead
- **No test cleanup:** E2E tests must cleanup test data (use D-10 delete endpoints)
- **Separate frontend port:** Don't run frontend on separate port — embed via NestJS assets

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP testing | Custom fetch wrapper | supertest | NestJS standard, handles cookies/headers |
| Auth bypass | Custom env check logic | AdminAuthGuard override | Existing guard already has bypass logic |
| Test fixtures | Manual mock setup | conftest.ts factories | Existing patterns reusable |
| Log streaming | Custom WebSocket server | HTTP polling endpoint | Simpler, no new infrastructure |
| CSS styling | Custom CSS framework | TailwindCSS utilities | Decided in CONTEXT.md D-07 |
| Admin UI structure | New layout design | Existing admin-console.page.ts as template | Same UI requirements, modern stack |

**Key insight:** Existing code provides substantial patterns to reuse. Don't reinvent auth, testing infrastructure, or UI structure — modernize the existing admin console implementation.

## Common Pitfalls

### Pitfall 1: No E2E Test Cleanup
**What goes wrong:** E2E tests leave test data in database, causing subsequent test failures
**Why it happens:** Tests focus on verification, forget cleanup step
**How to avoid:** Every E2E test must call cleanup endpoint (D-10) or use transaction rollback
**Warning signs:** Test failures on second run, database state inconsistent

### Pitfall 2: Frontend Build Not Integrated
**What goes wrong:** React frontend builds to wrong directory, NestJS can't serve it
**Why it happens:** Vite output path doesn't match nest-cli.json assets configuration
**How to avoid:** Configure Vite `build.outDir` to `../dist/src/frontend` relative to frontend dir
**Warning signs:** 404 errors on admin routes, assets not found

### Pitfall 3: Auth Guard Not Bypassed in Tests
**What goes wrong:** E2E tests fail with 401 Unauthorized
**Why it happens:** AdminAuthGuard requires JWT token in tests
**How to avoid:** Override AdminAuthGuard in test module: `.overrideGuard(AdminAuthGuard).useValue({ canActivate: () => true })`
**Warning signs:** All admin endpoint tests return 401

### Pitfall 4: Log Endpoint File Access
**What goes wrong:** Log reading service can't access worker/API log files
**Why it happens:** Log files written by separate process, path configuration missing
**How to avoid:** Use relative path from project root: `logs/worker.log`, `logs/api.log`
**Warning signs:** Log viewer shows empty, file read errors in backend

### Pitfall 5: CORS Blocking Frontend API Calls
**What goes wrong:** React frontend can't call NestJS API due to CORS
**Why it happens:** Frontend served from same origin but browser treats embedded assets differently
**How to avoid:** NestJS serves frontend as static assets from same origin — no CORS needed if path matches
**Warning signs:** Browser console CORS errors, API calls fail

## Code Examples

### E2E Test Setup Pattern
```typescript
// Source: [CITED: test/admin.service.spec.ts patterns + jest.config.ts]
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AdminModule } from '../../src/modules/admin/admin.module';
import { ConfigModule } from '../../src/modules/config/config.module';
import { AdminAuthGuard } from '../../src/common/auth/admin-auth.guard';

describe('Admin API E2E', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env.test' }),
        AdminModule,
      ],
    })
    .overrideGuard(AdminAuthGuard)
    .useValue({ canActivate: () => true })
    .compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/admin/robot-instances', () => {
    it('returns array of instances', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/admin/robot-instances')
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
    });

    it('includes runtime state for each instance', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/admin/robot-instances')
        .expect(200);

      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('runtimeState');
      }
    });
  });
});
```

### Frontend Vite Configuration
```typescript
// Source: [ASSUMED] Standard Vite + React + TailwindCSS configuration
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: 'src',
  build: {
    outDir: '../dist', // Output to parent dist for NestJS assets
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3001, // Dev server port (not used in production)
    proxy: {
      '/api': {
        target: 'http://localhost:3000', // Proxy to NestJS backend
        changeOrigin: true,
      },
    },
  },
});
```

### TailwindCSS Configuration (v4.x)
```typescript
// Source: [ASSUMED] TailwindCSS 4.x configuration pattern
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Match existing admin-console.page.ts color palette
        primary: '#1d6b57',
        warning: '#aa5a22',
        danger: '#9a2f2f',
        panel: '#f5efe6',
      },
    },
  },
  plugins: [],
};

export default config;
```

### Log Reading Service
```typescript
// Source: [ASSUMED] Standard Node.js file reading pattern
import { Injectable } from '@nestjs/common';
import { readFile, stat } from 'fs/promises';
import { join } from 'path';

@Injectable()
export class AdminLogsService {
  private readonly logsDir = join(process.cwd(), 'logs');

  async getLogs(chatId: string, options?: { since?: number; limit?: number }) {
    const logFile = join(this.logsDir, 'worker.log');
    const stats = await stat(logFile);
    const sinceTime = options?.since ?? stats.mtimeMs - 60000; // Default: last minute

    const content = await readFile(logFile, 'utf-8');
    const lines = content.split('\n')
      .filter(line => line.includes(chatId)) // Filter by chat ID
      .slice(-(options?.limit ?? 100));

    return {
      lines,
      lastModified: stats.mtimeMs,
    };
  }

  async getApiLogs(options?: { since?: number; limit?: number }) {
    const logFile = join(this.logsDir, 'api.log');
    const content = await readFile(logFile, 'utf-8');
    return {
      lines: content.split('\n').slice(-(options?.limit ?? 100)),
    };
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Vanilla HTML/CSS admin console | React + TailwindCSS SPA | Phase 04 | Modern tooling, component reuse |
| Manual E2E testing (e2e-manual-test.sh) | Automated Jest E2E tests | Phase 04 | CI/CD integration, regression prevention |
| Inline CSS styles | TailwindCSS utilities | Phase 04 | Faster styling, responsive design |
| No test cleanup | D-10 delete endpoints | Phase 04 | Test isolation, reliability |

**Deprecated/outdated:**
- Inline CSS in admin-console.page.ts: Replace with TailwindCSS components
- Manual JWT generation (jwt-helper.js): Keep for manual testing, automate in E2E tests

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Vite 6.x is standard for React + TailwindCSS 4.x | Frontend Build | May need webpack if Vite incompatibility |
| A2 | HTTP polling sufficient for log viewer | Pattern 4 | WebSocket needed if real-time critical |
| A3 | Log files at `logs/worker.log` and `logs/api.log` | Log Reading Service | Path may differ, need env config |
| A4 | TailwindCSS 4.x config structure similar to v3 | TailwindCSS Configuration | Config format may differ significantly |
| A5 | NestJS assets pattern supports `../frontend/dist` | Pattern 3 | May need absolute path or different outDir |

**Validation needed:** Run `npm view vite version` and `npm view @vitejs/plugin-react version` to verify versions. Check log file paths in actual deployment environment.

## Open Questions (RESOLVED)

1. **Log file location and rotation**
   - What we know: scripts/e2e-manual-test.sh references `logs/worker.log`
   - **Resolution:** Use `logs/` relative to cwd as default, add LOG_DIR env variable for deployment flexibility. No rotation needed for dev/test.

2. **Frontend build integration with NestJS watch mode**
   - What we know: nest-cli.json supports `watchAssets: true`
   - **Resolution:** Separate development flows: Vite dev server (port 3001) for frontend work, NestJS watch for backend work. Production uses static build embedded via nest-cli.json assets.

3. **E2E test database isolation**
   - What we know: Manual test script uses real database
   - **Resolution:** Use dedicated test database with cleanup via D-10 delete endpoints. Transaction rollback not viable because queue state (Redis) is not transactional.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | ✓ | ≥20 | — |
| PostgreSQL | Data layer | ✓ (via DATABASE_URL) | — | — |
| Redis | Queue backing | ✓ (via REDIS_URL) | — | — |
| Jest | Testing | ✓ | 30.2.0 | — |
| supertest | E2E HTTP testing | ✓ | 7.1.4 | — |
| React | Frontend | ✗ (need install) | — | — |
| TailwindCSS | Frontend styles | ✗ (need install) | — | — |
| Vite | Frontend build | ✗ (need install) | — | webpack fallback |
| jsonwebtoken | JWT helper | ✓ (in scripts) | — | — |

**Missing dependencies with no fallback:**
- React, TailwindCSS, Vite: Frontend stack not installed, must add in frontend/package.json

**Missing dependencies with fallback:**
- Vite: Could use webpack if Vite issues, but Vite recommended for TailwindCSS 4.x

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 30.2.0 |
| Config file | jest.config.ts |
| Quick run command | `jest --runInBand test/e2e/*.e2e-spec.ts` |
| Full suite command | `npm run test` (all tests) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-01 | Message flow verification | E2E integration | `jest message-flow.e2e-spec.ts` | ❌ Wave 0 |
| D-02 | Config flow verification | E2E integration | `jest config-flow.e2e-spec.ts` | ❌ Wave 0 |
| D-03 | Agent Run verification | E2E integration | `jest agent-run.e2e-spec.ts` | ❌ Wave 0 |
| D-04 | Admin API verification | E2E integration | `jest admin-api.e2e-spec.ts` | ❌ Wave 0 |
| D-05 | Pi services collaboration | Unit (existing) | `npm run test:pi-runtime` | ✅ Exists |
| D-06-09 | Admin UI functionality | Manual E2E | — | ❌ Wave 0 |
| D-10-11 | Delete/reset endpoints | E2E integration | `jest cleanup.e2e-spec.ts` | ❌ Wave 0 |
| D-12 | Log viewer | Manual verification | — | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test` (quick unit tests)
- **Per wave merge:** `jest --runInBand test/e2e/*.e2e-spec.ts` (E2E suite)
- **Phase gate:** Full E2E suite green + frontend build successful

### Wave 0 Gaps
- [ ] `test/e2e/` directory — E2E test location
- [ ] `test/e2e/setup/e2e-test.module.ts` — Test app module with auth bypass
- [ ] `test/e2e/setup/e2e-test.fixture.ts` — Test data fixtures
- [ ] `frontend/` directory — React frontend project
- [ ] `frontend/vite.config.ts` — Vite configuration
- [ ] `frontend/tailwind.config.ts` — TailwindCSS configuration
- [ ] Frontend dependencies install: React, TailwindCSS, Vite

**Existing infrastructure covers:** Jest config, supertest, unit test patterns, mock factories (conftest.ts), JWT helper.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | AdminAuthGuard (JWT token) |
| V3 Session Management | no | Stateless JWT, no sessions |
| V4 Access Control | yes | AdminAuthGuard enforces admin role |
| V5 Input Validation | yes | NestJS ValidationPipe (whitelist + transform) |
| V6 Cryptography | partial | JWT signing (jsonwebtoken), no custom crypto |
| V7 Error Handling | yes | HttpExceptionFilter (global) |
| V9 Logging | yes | Winston/Pino for application logs, log viewer endpoint |

### Known Threat Patterns for NestJS + React Admin Dashboard

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| JWT token leak | Information Disclosure | HTTPS required, token in header not cookie |
| Admin endpoint exposure | Spoofing/Tampering | AdminAuthGuard on all admin routes |
| XSS in log viewer | Tampering | Sanitize log output, React escapes by default |
| CSRF on admin actions | Tampering | Same-origin for embedded frontend, no CSRF needed |
| Test data injection | Tampering | E2E tests use dedicated test database |
| Path traversal in logs | Tampering | Restrict log path to logs/ directory, no user input in path |

**Key security considerations:**
- Development bypass (localhost + NODE_ENV=development) must not be enabled in production
- JWT token stored in Authorization header, not localStorage (prevent XSS access)
- Log viewer must sanitize output to prevent log injection XSS
- Delete endpoints (D-10, D-11) must require admin auth in production

## Sources

### Primary (HIGH confidence)
- `.planning/codebase/STACK.md` — Tech stack versions verified [VERIFIED: 2026-05-06]
- `.planning/codebase/TESTING.md` — Jest configuration, test patterns [VERIFIED: 2026-05-06]
- `.planning/codebase/ARCHITECTURE.md` — Module architecture, queue flow [VERIFIED: 2026-05-06]
- `test/conftest.ts` — Mock factory patterns [VERIFIED: file read]
- `src/common/auth/admin-auth.guard.ts` — Auth bypass logic [VERIFIED: file read]
- `src/modules/admin/admin.service.ts` — Admin API patterns [VERIFIED: file read]
- `src/modules/admin/admin.controller.ts` — Admin endpoints [VERIFIED: file read]
- `src/modules/config/group-config.service.ts` — Config flow patterns [VERIFIED: file read]
- `docs/E2E-TEST-GUIDE.md` — Manual test procedures [VERIFIED: file read]

### Secondary (MEDIUM confidence)
- npm registry version checks for React 19.2.5, TailwindCSS 4.2.4 [VERIFIED: 2026-05-06]
- Existing test patterns from test/admin.service.spec.ts, test/group-runtime.service.spec.ts [VERIFIED: file read]

### Tertiary (LOW confidence - needs validation)
- Vite configuration patterns [ASSUMED] — Need to verify Vite 6.x compatibility
- TailwindCSS 4.x configuration format [ASSUMED] — May differ from v3 patterns
- Log file path assumptions [ASSUMED] — Need environment verification

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Versions verified via npm registry and package.json
- Architecture: HIGH — Existing code patterns thoroughly documented
- E2E testing: MEDIUM — No existing E2E tests, patterns extrapolated from unit tests
- Frontend build: MEDIUM — Vite/TailwindCSS patterns assumed, need validation
- Pitfalls: HIGH — Derived from existing code issues and common NestJS patterns

**Research date:** 2026-05-06
**Valid until:** 30 days (stable stack versions)