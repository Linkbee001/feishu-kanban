# Architecture

**Last mapped:** 2026-05-02

## System Pattern

**Primary Pattern:** Modular Monolith with Event-Driven Queue Processing

The system follows NestJS modular architecture with:
- Clear module boundaries per domain
- BullMQ queues for async processing
- Dual entry points (API + Worker)

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        Entry Points                           │
├─────────────────────┬────────────────────────────────────────┤
│   main.ts (API)     │         worker.ts (Worker)              │
│   NestFactory       │   NestFactory.createApplicationContext   │
│   HTTP + WebSocket  │         Background Workers              │
└─────────────────────┴────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                       Core Modules                            │
├──────────┬──────────┬──────────┬──────────┬──────────────────┤
│ Project  │ Feishu   │  Agent   │ Artifact │ Conversation     │
│ Environ  │ Events   │ Runtime  │  Sync    │ Context          │
└──────────┴──────────┴──────────┴──────────┴──────────────────┤
│  Admin   │   Repo   │  Digest  │   Dev    │ Confirmation     │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                    Infrastructure Layer                       │
├─────────────────────┬────────────────────────────────────────┤
│   PrismaModule      │              BullModule                 │
│   (PostgreSQL)      │              (Redis + Queues)           │
├─────────────────────┴────────────────────────────────────────┤
│   ConfigModule (Global)   │   TraceMiddleware (Request Tracing) │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                    External Systems                           │
├─────────────┬─────────────┬──────────────┬───────────────────┤
│  PostgreSQL │    Redis    │   Feishu API │   LLM Providers   │
│   (Prisma)  │  (ioredis)  │  (Lark SDK)  │   (PiMono)        │
└─────────────┴─────────────┴──────────────┴───────────────────┘
```

## Entry Points

### API Entry (`src/main.ts`)
- Creates NestJS HTTP application
- Global ValidationPipe (whitelist + transform)
- Global HttpExceptionFilter
- Configurable port via `PORT` env

### Worker Entry (`src/worker.ts`)
- Creates NestJS ApplicationContext
- Runs background processors
- Separate process for queue workers

## Module Organization

### Core Business Modules

| Module | Directory | Purpose |
|--------|-----------|---------|
| Project | `src/modules/project/` | Project CRUD, status management |
| Environment | `src/modules/environment/` | Project environment configs |
| Feishu | `src/modules/feishu/` | Feishu API integration, webhooks |
| Agent | `src/modules/agent/` | AI agent orchestration, PiMono adapter |
| Artifact | `src/modules/artifact/` | Generated artifact management |
| Conversation | `src/modules/conversation/` | Conversation context tracking |
| Confirmation | `src/modules/confirmation/` | User confirmation requests |
| Admin | `src/modules/admin/` | Admin API endpoints |
| Repo | `src/modules/repo/` | Repository mirroring |
| Digest | `src/modules/digest/` | Project summary generation |
| Dev | `src/modules/dev/` | Development utilities |
| Health | `src/modules/health/` | Health check endpoints |

### Agent Subsystem Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Agent Module                            │
├──────────────────────────────────────────────────────────┤
│  AgentService                                             │
│  ├── createRun() → Queue agent execution                  │
│  ├── handleInteractiveGroupMessage() → Group chat flow    │
│  └── processInteractiveDecision() → Card action handling  │
├──────────────────────────────────────────────────────────┤
│  GroupAgentSessionService                                 │
│  ├── Session lifecycle management                         │
│  ├── Lock acquisition/release                             │
│  └── State persistence                                    │
├──────────────────────────────────────────────────────────┤
│  GroupRuntimeService                                      │
│  ├── Task queue management                                │
│  ├── Runtime orchestration                                │
│  └── Steer/followup/collect/interrupt modes               │
├──────────────────────────────────────────────────────────┤
│  PiMonoAdapter                                            │
│  ├── LLM provider abstraction                             │
│  ├── Skill loading                                        │
│  ├── Session store management                             │
│  └── Tool execution                                       │
├──────────────────────────────────────────────────────────┤
│  ProjectRuntimeContextService                             │
│  ├── Context bundle assembly                              │
│  └── Project-specific skill mapping                       │
└──────────────────────────────────────────────────────────┘
```

## Queue Processing Architecture

### Queue Definitions (`src/queues/queue.constants.ts`)

| Queue | Processor | Purpose |
|-------|-----------|---------|
| `feishu-event.queue` | `FeishuEventProcessor` | Webhook event handling |
| `agent-run.queue` | `AgentRunProcessor` | Agent execution |
| `artifact-sync.queue` | `ArtifactSyncProcessor` | Artifact sync to Feishu |
| `notification.queue` | ( TBD) | User notifications |
| `cleanup.queue` | `CleanupProcessor` | Periodic cleanup |
| `project-digest.queue` | `ProjectDigestProcessor` | Summary generation |
| `repo-sync.queue` | `RepoSyncProcessor` | Repository mirroring |

### Queue Flow

```
Feishu Webhook → FeishuEventQueue → FeishuEventService
                                            ↓
                                    AgentRunQueue → PiMonoAdapter
                                            ↓
                                    ArtifactSyncQueue → Feishu API
```

## State Machine Patterns

**Implementation:** `src/common/state/state-machine.ts`

Three state machines enforce valid transitions:

### AgentRunStatus
```
queued → running → syncing → succeeded
         ↓         ↓
       canceled   failed
         ↓         ↓
       timeout    timeout
```

### ArtifactStatus
```
pending → synced
    ↓       ↓
  failed  skipped
```

### ConfirmationStatus
```
pending → confirmed
    ↓       ↓
  rejected expired
```

## Data Flow Patterns

### Message Processing Flow

1. Feishu webhook receives message
2. Event queued in `feishu-event.queue`
3. FeishuEventService routes to appropriate handler
4. AgentRun created and queued
5. PiMonoAdapter executes agent logic
6. Artifacts queued for sync
7. Results posted back to Feishu

### Confirmation Flow

1. High-risk action detected
2. ConfirmationRequest created with expiry
3. Interactive card sent to user
4. Card action triggers decision
5. Status updated (confirmed/rejected/expired)
6. Action proceeds or cancels

## Middleware & Filters

| Component | File | Purpose |
|-----------|------|---------|
| TraceMiddleware | `src/common/trace/trace.middleware.ts` | Request tracing |
| HttpExceptionFilter | `src/common/errors/http-exception.filter.ts` | Unified error responses |

## Configuration Pattern

**Validation Schema:** `src/config/env.validation.ts`

- Joi schema validation at startup
- All env vars validated before app starts
- Sensible defaults for optional vars