# Project Structure

**Last mapped:** 2026-05-02

## Root Directory Layout

```
feishu-kanban/
├── src/                    # Source code
│   ├── main.ts             # API entry point
│   ├── worker.ts           # Worker entry point
│   ├── app.module.ts       # Root module (API)
│   ├── worker.module.ts    # Root module (Worker)
│   ├── modules/            # Domain modules
│   ├── common/             # Shared utilities
│   ├── config/             # Configuration
│   └── queues/             # Queue definitions & processors
├── prisma/                 # Database schema & migrations
├── test/                   # Test files
├── docs/                   # Project documentation
├── dist/                   # Compiled output
├── node_modules/           # Dependencies
├── package.json            # Package manifest
├── nest-cli.json           # NestJS CLI config
├── tsconfig.json           # TypeScript config
├── jest.config.ts          # Jest test config
└── .claude/                # GSD configuration
```

## Source Directory Structure

### Modules (`src/modules/`)

```
modules/
├── admin/                  # Admin API endpoints
│   ├── admin.controller.ts
│   ├── admin.module.ts
│   └── admin.service.ts
├── agent/                  # AI agent system (largest module)
│   ├── agent.constants.ts
│   ├── agent.controller.ts
│   ├── agent.module.ts
│   ├── agent.schemas.ts
│   ├── agent.service.ts
│   ├── agent.types.ts
│   ├── group-agent-session.service.ts
│   ├── group-agent-session.types.ts
│   ├── group-runtime-task.service.ts
│   ├── group-runtime.controller.ts
│   ├── group-runtime.service.ts
│   ├── pi-mono.adapter.ts       # 113KB - Core LLM adapter
│   ├── pi-skill-mapping.ts
│   ├── project-runtime-context.service.ts
│   └── role-profile.service.ts
├── artifact/               # Artifact management
│   ├── artifact.controller.ts
│   ├── artifact.module.ts
│   └── artifact.service.ts
├── confirmation/           # Confirmation requests
│   ├── confirmation.controller.ts
│   ├── confirmation.module.ts
│   └── confirmation.service.ts
├── conversation/           # Conversation context
│   ├── conversation.module.ts
│   └── conversation.service.ts
├── dev/                    # Development utilities
│   ├── dev.controller.ts
│   └── dev.module.ts
├── digest/                 # Project summaries
│   ├── digest.module.ts
│   ├── digest.service.ts
│   └── project-digest.service.ts
├── environment/            # Environment management
│   ├── environment.controller.ts
│   ├── environment.module.ts
│   └── environment.service.ts
├── feishu/                 # Feishu integration
│   ├── feishu.controller.ts      # Webhooks
│   ├── feishu.module.ts
│   ├── feishu.service.ts         # API client
│   ├── feishu-event.service.ts   # Event routing
│   └── feishu-project-reader.service.ts
├── health/                 # Health check
│   ├── health.controller.ts
│   └── health.module.ts
├── project/                # Project management
│   ├── project.controller.ts
│   ├── project.module.ts
│   └── project.service.ts
└── repo/                   # Repository mirroring
    ├── repo.module.ts
    ├── repo-sync.service.ts
    ├── repo-credential-resolver.service.ts
    └── repo-workspace.service.ts
```

### Common Utilities (`src/common/`)

```
common/
├── auth/                   # Authentication guards
├── errors/                 # Error handling
│   └── http-exception.filter.ts
├── prisma/                 # Database client
│   ├── prisma.module.ts
│   └── prisma.service.ts
├── state/                  # State machines
│   └ state-machine.ts
└── trace/                  # Request tracing
    └ trace.middleware.ts
```

### Configuration (`src/config/`)

```
config/
└── env.validation.ts       # Joi validation schema
```

### Queues (`src/queues/`)

```
queues/
├── queue.constants.ts      # Queue name constants
└── processors/
    ├── feishu-event.processor.ts
    ├── cleanup.processor.ts
    ├── agent-run.processor.ts
    ├── artifact-sync.processor.ts
    ├── project-digest.processor.ts
    └── repo-sync.processor.ts
```

## Test Directory Structure

```
test/
├── state-machine.spec.ts
├── feishu.service.spec.ts
├── project-digest.processor.spec.ts
├── pi-skill-loading.spec.ts
├── agent.service.spec.ts
├── group-runtime.service.spec.ts
├── artifact.service.spec.ts
├── admin.service.spec.ts
├── role-profile.service.spec.ts
├── group-policy.service.spec.ts
├── feishu-project-reader.service.spec.ts
├── artifact-sync.processor.spec.ts
├── pi-mono.adapter.spec.ts
├── feishu-event.service.spec.ts
├── project-digest.service.spec.ts
├── repo/
│   ├── repo-workspace.service.spec.ts
│   ├── repo-credential-resolver.service.spec.ts
│   └── repo-sync.service.spec.ts
```

## Database Directory

```
prisma/
├── schema.prisma           # Database schema (472 lines)
└── migrations/
    ├── 20260422160000_init/
    ├── 20260425133000_group_agent_sessions/
    ├── 20260425152000_project_chat_tab_ids/
    ├── 20260426113000_project_digest_summary_policy/
    ├── 20260427223000_repo_mirror_support/
    ├── 20260428100000_group_runtime_runtime_profiles/
    ├── 20260428183000_prd_v2_policy_members_console/
    ├── 20260429160000_runtime_direct_cutover_v1/
    ├── 20260430183000_remove_agent_profiles/
```

## Documentation Directory

```
docs/
├── architecture.md         # System architecture (50KB)
├── prd_v1.md               # Product requirements v1
├── prd_v2.md               # Product requirements v2
├── dev_plan_v1.md          # Development plan
├── construction_plan_v2.md # Construction plan
├── project_memory.md       # Project context memory
├── current_status_*.md     # Status snapshots
├── manager_*.md            # Manager agent designs
├── pimono_*.md             # PiMono integration plans
├── group-runtime-*.md      # Runtime validation docs
└── sdk_runtime_update_*.md # SDK updates
```

## Key File Sizes

| File | Size | Purpose |
|------|------|---------|
| `src/modules/agent/pi-mono.adapter.ts` | ~113KB | Core LLM integration |
| `prisma/schema.prisma` | ~472 lines | Complete data model |
| `docs/architecture.md` | ~50KB | Architecture reference |