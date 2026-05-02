# Integrations

**Last mapped:** 2026-05-02

## Feishu (Lark) Platform

**SDK:** `@larksuiteoapi/node-sdk` v1.61.1

### Integration Points

| Endpoint/Feature | Implementation | Purpose |
|------------------|----------------|---------|
| Webhook Events | `src/modules/feishu/feishu.controller.ts` | Receives push events |
| Message Reception | `im.message.receive_v1` | User messages in chats |
| Bot Added to Chat | `im.chat.member.bot.added_v1` | Group initialization trigger |
| Card Actions | `card.action.trigger` | Interactive card callbacks |
| Signature Verification | `feishu.service.ts:verifySignature()` | Security validation |
| Event Decryption | `feishu.service.ts:decryptEvent()` | Encrypted payload handling |

### Feishu Services

| Service | File | Purpose |
|---------|------|---------|
| FeishuService | `src/modules/feishu/feishu.service.ts` | API client, signature/crypto |
| FeishuEventService | `src/modules/feishu/feishu-event.service.ts` | Event routing and handling |
| FeishuProjectReaderService | `src/modules/feishu/feishu-project-reader.service.ts` | Read docs/bitable data |

### Feishu Data Operations

- **Documents:** Read project documents, list folders
- **Bitable (Tables):** Read table snapshots, search records
- **Messages:** Send text, send interactive cards
- **Reactions:** Add/remove message reactions

## LLM/AI Providers

### PiMono Agent System

**Primary Integration:** `src/modules/agent/pi-mono.adapter.ts`

| Feature | Configuration |
|---------|---------------|
| Provider Selection | `PI_MONO_PROVIDER` env var |
| Model Selection | `PI_MONO_MODEL` env var |
| Thinking Level | `PI_MONO_THINKING_LEVEL` |
| Working Directory | `PI_MONO_WORKDIR` |
| Agent Directory | `PI_MONO_AGENT_DIR` |
| Timeout | `AGENT_RUN_TIMEOUT_SECONDS` (default 1800) |

### Supported Providers

| Provider | Env Key | Base URL |
|----------|---------|----------|
| Bailian (Alibaba) | `DASHSCOPE_API_KEY` | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| OpenAI | `OPENAI_API_KEY` | Standard OpenAI API |
| Anthropic | `ANTHROPIC_API_KEY` | Anthropic API |
| Gemini | `GEMINI_API_KEY` | Google Gemini API |
| Groq | `GROQ_API_KEY` | Groq API |
| OpenRouter | `OPENROUTER_API_KEY` | OpenRouter proxy |

## Database (PostgreSQL)

**ORM:** Prisma Client

| Connection | Configuration |
|------------|---------------|
| URL | `DATABASE_URL` env var |
| Migrations | `prisma/migrations/` |
| Schema | `prisma/schema.prisma` |

### Key Entities

- `Project` - Project metadata and Feishu bindings
- `ProjectEnvironment` - Environment configs, repo settings
- `MessageSource` - Incoming message tracking
- `AgentRun` - Agent execution records
- `Artifact` - Generated artifacts (docs, tasks, logs)
- `ConfirmationRequest` - User approval requests
- `GroupAgentSession` - Multi-agent session state
- `GroupRuntimeTask` - Runtime task queue
- `GroupPolicy` - Group-level permissions

## Redis/ioredis

**Purpose:** Queue backing + distributed state

| Connection | Configuration |
|------------|---------------|
| URL | `REDIS_URL` env var |

### Usage Patterns

- BullMQ job queue backing
- Session lock tokens
- Distributed state management

## Repository Mirroring

### Git Repository Support

| Feature | Configuration |
|---------|---------------|
| Mirror Root | `REPO_SECRET_MAP_JSON` |
| Credential Mapping | `REPO_SECRET_MAP_JSON` (JSON map) |
| Sync TTL | `REPO_SYNC_TTL_SECONDS` (default 300) |

### Repo Services

| Service | File | Purpose |
|---------|------|---------|
| RepoSyncService | `src/modules/repo/repo-sync.service.ts` | Clone/mirror repos |
| RepoCredentialResolverService | `src/modules/repo/repo-credential-resolver.service.ts` | Credential lookup |
| RepoWorkspaceService | `src/modules/repo/repo-workspace.service.ts` | Workspace management |

## Authentication

| Component | Implementation |
|-----------|----------------|
| Admin JWT | `ADMIN_JWT_SECRET` env var |
| Auth Guard | `src/common/auth/` |

## Public API

| Component | Configuration |
|-----------|---------------|
| Base URL | `PUBLIC_BASE_URL` env var (required) |
| Port | `PORT` (default 3000) |