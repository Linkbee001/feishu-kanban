# Technology Stack

**Last mapped:** 2026-05-02

## Runtime & Languages

| Component | Technology | Version |
|-----------|------------|---------|
| Runtime | Node.js | ≥20 |
| Language | TypeScript | 5.9.3 |
| Target | ES2022 | - |

## Backend Framework

| Layer | Technology | Purpose |
|-------|------------|---------|
| Core Framework | NestJS | 11.1.9 - Modular backend architecture |
| HTTP Platform | Express | Via @nestjs/platform-express |
| Validation | class-validator + class-transformer | Request validation and transformation |
| API Documentation | Swagger | @nestjs/swagger 11.2.3 |

## Database & ORM

| Component | Technology | Notes |
|-----------|------------|-------|
| Database | PostgreSQL | Via Prisma ORM |
| ORM | Prisma Client | 6.18.0 |
| Schema Management | Prisma Migrate | Manual migrations |

**Key models:** `Project`, `ProjectEnvironment`, `MessageSource`, `AgentRun`, `Artifact`, `ConfirmationRequest`, `GroupAgentSession`, `GroupRuntimeTask`, `GroupPolicy`

## Message Queue & Caching

| Component | Technology | Purpose |
|-----------|------------|---------|
| Queue System | BullMQ | 5.61.2 - Job queue for async processing |
| Queue Integration | @nestjs/bullmq | 11.0.3 |
| Redis | ioredis | 5.8.2 - Queue backing + caching |

**Queues defined:**
- `feishu-event.queue` - Feishu webhook events
- `agent-run.queue` - Agent execution jobs
- `artifact-sync.queue` - Artifact synchronization
- `notification.queue` - User notifications
- `cleanup.queue` - Cleanup tasks
- `project-digest.queue` - Project summaries
- `repo-sync.queue` - Repository mirroring

## AI/LLM Integration

| Component | Technology | Purpose |
|-----------|------------|---------|
| Agent SDK | @mariozechner/pi-coding-agent | 0.68.1 - Core agent runtime (PiMono) |
| Default Provider | Bailian (Alibaba) | DashScope API |
| Default Model | kimi-k2.5 | Primary reasoning model |
| Thinking Levels | off/minimal/low/medium/high/xhigh | configurable reasoning depth |

**Alternative providers supported:** OpenAI, Anthropic, Gemini, Groq, OpenRouter

## External Service Integration

| Service | SDK | Purpose |
|---------|-----|---------|
| Feishu/Lark | @larksuiteoapi/node-sdk | 1.61.1 - Feishu collaboration platform |
| ID Generation | nanoid | 5.1.6 - Unique identifiers |

## Configuration & Validation

| Component | Technology | Purpose |
|-----------|------------|---------|
| Config | @nestjs/config | 4.0.2 - Environment configuration |
| Validation | Joi | 18.0.1 - Schema validation for env vars |

## Development Tools

| Tool | Version | Purpose |
|------|---------|---------|
| NestJS CLI | 11.0.10 | Build and development |
| ESLint | 9.38.0 | Code linting (typescript-eslint 8.46.2) |
| Jest | 30.2.0 | Testing framework |
| ts-jest | 29.4.5 | TypeScript Jest transform |
| ts-node | 10.9.2 | Development execution |
| Supertest | 7.1.4 | HTTP endpoint testing |

## Build Configuration

**TypeScript (`tsconfig.json`):**
- Module: CommonJS
- Target: ES2022
- Strict mode enabled (with `noImplicitAny: false`, `strictPropertyInitialization: false`)
- Decorator metadata enabled
- Source maps enabled
- Output: `./dist`

**NestJS (`nest-cli.json`):**
- Source root: `src`
- Auto-delete output dir on build