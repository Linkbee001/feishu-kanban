# Testing

**Last mapped:** 2026-05-02

## Test Framework

| Component | Technology | Version |
|-----------|------------|---------|
| Framework | Jest | 30.2.0 |
| TypeScript | ts-jest | 29.4.5 |
| Environment | Node | - |
| HTTP Testing | Supertest | 7.1.4 |

## Jest Configuration

**Config file:** `jest.config.ts`

```typescript
{
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/node_modules/', '/demo/', '/dist/', '/dist_old/'],
  modulePathIgnorePatterns: ['/demo/', '/dist/', '/dist_old/'],
}
```

## Test Organization

### Test Location

Tests located in `test/` directory (not co-located with source):
```
test/
├── *.spec.ts              # Unit tests
└── repo/*.spec.ts         # Module-specific tests
```

### Test Naming

| Pattern | Usage |
|---------|-------|
| `*.spec.ts` | Unit tests |
| `*.e2e-spec.ts` | Integration tests (not present yet) |

### Test Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `test` | `jest --runInBand` | All tests sequentially |
| `test:pi-runtime` | Jest specific adapter test | PiMono validation |
| `test:group-runtime` | Jest group runtime tests | Group session validation |
| `verify:runtime-fast` | Combined tests + build | Pre-deploy check |
| `test:watch` | Jest watch mode | Development |

## Test Patterns

### Mock Factory Pattern

Tests use factory functions to create mocks:

```typescript
function createConfig(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    PI_MONO_PROVIDER: 'bailian',
    PI_MONO_MODEL: 'kimi-k2.5',
    // ...
  };
  return {
    get: jest.fn((key: string) => values[key]),
  };
}

function createPrisma() {
  return {
    artifact: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    runtimeEvent: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue(undefined),
    },
    // ...
  };
}
```

### Common Mock Types

| Mock | Factory | Purpose |
|------|---------|---------|
| Config | `createConfig()` | ConfigService mock |
| Prisma | `createPrisma()` | Database mock |
| Redis | `createRedis()` | Redis client mock |
| Queue | `createArtifactQueue()` | BullMQ queue mock |
| Feishu | `createFeishu()` | Feishu API mock |
| FeishuReader | `createFeishuReader()` | Document reader mock |

### Test Setup/Cleanup

```typescript
describe('SomeService', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length) {
      const dir = tempDirs.pop();
      if (dir) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });
});
```

### NestJS Testing

Uses `@nestjs/testing`:

```typescript
import { Test } from '@nestjs/testing';

const module = await Test.createTestingModule({
  providers: [
    AgentService,
    { provide: PrismaService, useValue: createPrisma() },
    { provide: ConfigService, useValue: createConfig() },
  ],
}).compile();

service = module.get(AgentService);
```

## Coverage

### Coverage Collection

Configured to collect from:
- `src/**/*.(t|j)s`

Coverage reports not configured by default.

### Coverage Command

```bash
jest --coverage
```

## Test Categories

### Unit Tests

| Test File | Focus Area |
|-----------|------------|
| `state-machine.spec.ts` | State transition logic |
| `feishu.service.spec.ts` | Feishu API client |
| `agent.service.spec.ts` | Agent service methods |
| `pi-mono.adapter.spec.ts` | LLM adapter |
| `group-runtime.service.spec.ts` | Group runtime |
| `artifact.service.spec.ts` | Artifact management |
| `admin.service.spec.ts` | Admin endpoints |
| `group-policy.service.spec.ts` | Policy management |
| `role-profile.service.spec.ts` | Role profiles |

### Processor Tests

| Test File | Focus Area |
|-----------|------------|
| `feishu-event.service.spec.ts` | Event processing |
| `artifact-sync.processor.spec.ts` | Artifact sync |
| `project-digest.processor.spec.ts` | Digest generation |
| `project-digest.service.spec.ts` | Digest logic |

### Repo Module Tests

| Test File | Focus Area |
|-----------|------------|
| `repo-sync.service.spec.ts` | Repository sync |
| `repo-credential-resolver.service.spec.ts` | Credential lookup |
| `repo-workspace.service.spec.ts` | Workspace management |

### Integration Tests

| Test File | Focus Area |
|-----------|------------|
| `pi-skill-loading.spec.ts` | Skill loading end-to-end |

## Testing Best Practices

1. **Run tests in band** - Sequential execution avoids race conditions
2. **Mock external services** - No real API calls in unit tests
3. **Use temp directories** - Clean up filesystem state
4. **Factory pattern** - Reusable mock creation
5. **Fast verification** - `verify:runtime-fast` for pre-deploy checks