# Coding Conventions

**Last mapped:** 2026-05-02

## TypeScript Style

### Compiler Settings

| Setting | Value | Notes |
|---------|-------|-------|
| `strict` | true | Full strict mode |
| `noImplicitAny` | false | Relaxed for gradual adoption |
| `strictPropertyInitialization` | false | Allows uninitialized class properties |
| `target` | ES2022 | Modern JS features |
| `module` | CommonJS | Node.js compatibility |
| `experimentalDecorators` | true | NestJS dependency |
| `emitDecoratorMetadata` | true | DI metadata generation |

### Naming Conventions

| Category | Convention | Example |
|----------|------------|---------|
| Classes | PascalCase | `AgentService`, `GroupRuntimeTask` |
| Interfaces | PascalCase (no I prefix) | `SessionSubmitResult` |
| Type aliases | PascalCase | `InteractiveGroupSubmitResult` |
| Functions/Methods | camelCase | `createRun()`, `handleInteractiveGroupMessage()` |
| Variables | camelCase | `feishuChatId`, `projectId` |
| Constants | UPPER_SNAKE_CASE | `FEISHU_EVENT_QUEUE` |
| Enum values | snake_case | `formal_execution`, `runtime_audit` |
| Database columns | snake_case | `feishu_chat_id`, `created_at` |
| Database tables | snake_case plural | `projects`, `agent_runs` |

### File Naming

| Type | Convention | Example |
|------|------------|---------|
| Module | `*.module.ts` | `agent.module.ts` |
| Service | `*.service.ts` | `agent.service.ts` |
| Controller | `*.controller.ts` | `agent.controller.ts` |
| Types/Interfaces | `*.types.ts` | `agent.types.ts` |
| Schemas (DTOs) | `*.schemas.ts` | `agent.schemas.ts` |
| Constants | `*.constants.ts` | `queue.constants.ts` |
| Adapter | `*.adapter.ts` | `pi-mono.adapter.ts` |
| Processor | `*.processor.ts` | `feishu-event.processor.ts` |
| Test | `*.spec.ts` | `agent.service.spec.ts` |

## NestJS Patterns

### Module Structure

Standard NestJS module pattern:
```typescript
@Module({
  imports: [/* dependencies */],
  controllers: [/* exposed endpoints */],
  providers: [/* services */],
  exports: [/* shared services */],
})
export class SomeModule {}
```

### Dependency Injection

| Pattern | Usage |
|---------|-------|
| Constructor injection | Primary method |
| `@InjectQueue()` | BullMQ queue injection |
| `@Inject()` | Custom token injection |

### Service Decorators

```typescript
@Injectable()              // Standard service
@Controller('path')        // HTTP controller
@Processor('queue-name')   // Queue processor
```

### Controller Patterns

| Decorator | Purpose |
|-----------|---------|
| `@Body()` | Request body |
| `@Param()` | Route params |
| `@Query()` | Query params |
| `@Headers()` | HTTP headers |
| `@Req()` | Full request object |

## Prisma Patterns

### Schema Conventions

- Tables use `@@map("snake_case_name")`
- Fields use `@map("snake_case_name")`
- IDs default to `uuid()` with `@db.Uuid`
- Timestamps: `createdAt`, `updatedAt` with auto-population
- JSON fields: default `{}` or `[]` as appropriate

### Relations

| Pattern | Usage |
|---------|-------|
| `onDelete: Cascade` | Strong ownership (e.g., AgentRun → Project) |
| `onDelete: SetNull` | Weak reference (e.g., MessageSource → Project) |
| `onDelete: NoAction` | Protected relation |

### Enum Definitions

Enums defined in Prisma schema for database:
```prisma
enum AgentRunStatus {
  queued
  running
  syncing
  succeeded
  failed
  canceled
  timeout
}
```

TypeScript imports enum from Prisma client:
```typescript
import { AgentRunStatus } from '@prisma/client';
```

## Error Handling

### Exception Classes

| Class | Usage |
|-------|-------|
| `BadRequestException` | Invalid input/state |
| `NotFoundException` | Missing resource |
| `UnauthorizedException` | Auth failures |

### Global Filter

`HttpExceptionFilter` catches all exceptions:
- 500+ errors logged with stack trace
- Consistent JSON response format:
```json
{
  "statusCode": 400,
  "error": { "message": "..." },
  "timestamp": "2026-05-02T..."
}
```

### State Machine Validation

State transitions enforced via assertion functions:
```typescript
assertAgentRunTransition(from, to);  // throws BadRequestException
```

## Queue Patterns

### Queue Constants

Queue names defined centrally in `queue.constants.ts`:
```typescript
export const FEISHU_EVENT_QUEUE = 'feishu-event.queue';
```

### Processor Pattern

```typescript
@Processor(QUEUE_NAME)
export class SomeProcessor extends WorkerHost {
  process(job: Job<JobData>): Promise<Result> {
    // job handling
  }
}
```

### Queue Addition

```typescript
await this.queue.add('job-name', data, { jobId: id });
```

## Validation Patterns

### DTO Validation

Uses `class-validator` decorators:
```typescript
export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}
```

### Global ValidationPipe

```typescript
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,   // Strip unknown properties
  transform: true,   // Transform payloads to DTO instances
}));
```

### Environment Validation

Joi schema at startup:
```typescript
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production'),
  DATABASE_URL: Joi.string().required(),
  // ...
});
```

## Code Organization

### Import Order

1. External packages (NestJS, Prisma, etc.)
2. Internal modules (relative paths)
3. Types and interfaces

### Service Method Structure

Typical service method flow:
1. Validate input
2. Fetch required entities
3. Check business rules
4. Perform action
5. Queue side effects
6. Return result