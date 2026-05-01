# Feishu-Kanban 架构说明文档

## 目录

1. [项目概述](#1-项目概述)
2. [项目结构](#2-项目结构)
3. [技术栈](#3-技术栈)
4. [进程架构](#4-进程架构)
5. [数据库设计](#5-数据库设计)
6. [模块组织](#6-模块组织)
7. [API 结构](#7-api-结构)
8. [队列系统](#8-队列系统)
9. [外部集成](#9-外部集成)
10. [配置管理](#10-配置管理)
11. [测试架构](#11-测试架构)
12. [状态机与验证](#12-状态机与验证)
13. [架构模式](#13-架构模式)

---

## 1. 项目概述

**feishu-kanban** 是一个基于 NestJS 的后端系统，用于飞书项目协作助手。它将飞书群组、项目文档、任务看板、AI 管理者代理、代码仓库运行环境和管理控制台整合为统一的项目管理机器人系统。

### 产品定位

- **面向飞书的项目管理机器人**：以飞书为核心协作界面
- **具备治理能力的代理运行平台**：支持策略控制、权限管理和审计
- **非通用聊天机器人**：专注于项目管理场景，而非通用对话
- **非完整 DevOps 平台**：提供轻量级仓库同步，而非完整 CI/CD

### 核心能力

| 能力 | 说明 |
|------|------|
| 群组项目绑定 | 将飞书群组与项目文档、任务看板关联 |
| 智能代理执行 | 基于 Pi Mono SDK 的 AI 代理运行时 |
| 资源同步 | 文档、任务、文件等产物的自动同步 |
| 风险确认 | 高风险操作的卡片确认流程 |
| 定时摘要 | 每日/每周自动生成项目摘要 |
| 仓库镜像 | Git 仓库的克隆与同步 |

---

## 2. 项目结构

### 根目录布局

```
feishu-kanban/
├── src/                    # 主业务源代码
├── prisma/                 # Prisma schema 和数据库迁移
├── test/                   # Jest 测试文件
├── docs/                   # PRD、设计文档、状态记录
├── pi-skills/              # 管理者代理的本地技能
├── scripts/                # 验证脚本
├── demo/                   # 演示相关内容
├── dist/                   # 构建输出
├── node_modules/           # 依赖包
├── package.json            # 项目配置
├── tsconfig.json           # TypeScript 配置
├── docker-compose.yml      # Docker 编排
├── Dockerfile              # 容器构建定义
├── nest-cli.json           # NestJS CLI 配置
├── jest.config.ts          # Jest 测试配置
├── eslint.config.mjs       # ESLint 配置
└── .env.example            # 环境变量模板
```

### 源代码结构 (`src/`)

```
src/
├── main.ts                 # API 进程入口
├── worker.ts               # Worker 进程入口
├── app.module.ts           # 主应用模块
├── worker.module.ts        # Worker 模块（含队列处理器）
│
├── config/
│   └── env.validation.ts   # 环境变量验证（Joi）
│
├── common/
│   ├── prisma/
│   │   ├── prisma.service.ts   # Prisma 客户端包装
│   │   └── prisma.module.ts    # Prisma 模块
│   ├── trace/
│   │   └── trace.middleware.ts # 请求追踪中间件
│   ├── errors/
│   │   └── http-exception.filter.ts # 全局异常过滤器
│   ├── state/
│   │   └── state-machine.ts    # 状态转换验证
│   └── auth/
│       └── admin-auth.guard.ts # 管理 API 认证守卫
│
├── modules/
│   ├── health/             # 健康检查端点
│   ├── project/            # 项目初始化、绑定、成员、策略
│   ├── environment/        # 项目环境管理（仓库/模型/运行时）
│   ├── feishu/             # 飞书 API、事件、WebSocket、资源管理
│   ├── agent/              # 管理者决策、会话、运行时、Pi Mono 集成
│   ├── artifact/           # 文档/任务/摘要产物同步
│   ├── confirmation/       # 高风险操作确认流程
│   ├── conversation/       # 私聊上下文选择
│   ├── digest/             # 定时摘要和上下文组装
│   ├── repo/               # 仓库镜像同步、凭证管理
│   ├── admin/              # 管理控制台页面和 API
│   └── dev/                # 调试/验证工具
│
└── queues/
    ├── queue.constants.ts  # 队列名称常量
    └── processors/
        ├── feishu-event.processor.ts   # 飞书事件处理
        ├── agent-run.processor.ts      # 代理执行
        ├── artifact-sync.processor.ts  # 产物同步
        ├── cleanup.processor.ts        # 清理任务
        ├── project-digest.processor.ts # 摘要任务
        └── repo-sync.processor.ts      # 仓库同步
```

### Pi-Skills 目录结构

```
pi-skills/
├── document-generate/      # 文档生成技能
├── progress-summary/      # 进度摘要技能
├── requirement-analysis/   # 需求分析技能
└── task-breakdown/         # 任务分解技能
```

每个技能包含：
- `SKILL.md` - 技能定义和提示词
- 相关资源文件

---

## 3. 技术栈

### 核心框架与库

| 类别 | 技术 | 版本 | 说明 |
|------|------|------|------|
| **运行时** | Node.js | >=20 | JavaScript 运行环境 |
| **框架** | NestJS | 11.x | 企业级 Node.js 框架 |
| **语言** | TypeScript | 5.9.x | 类型安全的 JavaScript |
| **数据库** | PostgreSQL | - | 关系型数据库 |
| **ORM** | Prisma | 6.18.x | 类型安全的数据库访问 |
| **队列** | BullMQ | 5.61.x | Redis 支持的作业队列 |
| **缓存/锁** | Redis (ioredis) | 5.8.x | 缓存和分布式锁 |
| **验证** | class-validator, Joi | 0.14.x, 18.x | 数据验证 |
| **飞书 SDK** | @larksuiteoapi/node-sdk | 1.61.x | 飞书开放平台 SDK |
| **AI 代理 SDK** | @mariozechner/pi-coding-agent | 0.68.x | Pi Mono 代理运行时 |
| **API 文档** | @nestjs/swagger | 11.x | OpenAPI/Swagger 集成 |

### 关键依赖

```json
{
  "@nestjs/bullmq": "队列集成",
  "@nestjs/config": "环境配置",
  "@nestjs/platform-express": "HTTP 服务器",
  "form-data": "文件上传",
  "nanoid": "ID 生成",
  "reflect-metadata": "TypeScript 装饰器"
}
```

### 开发工具

| 工具 | 用途 |
|------|------|
| **Jest** (30.x) | 测试框架 |
| **ts-jest** | TypeScript Jest 集成 |
| **ESLint** | 代码检查 |
| **Prisma CLI** | 数据库迁移 |
| **ts-node** | 开发执行 |

---

## 4. 进程架构

系统运行两个独立进程：

### API 进程 (`src/main.ts`)

```
┌─────────────────────────────────────────┐
│              API Process                 │
├─────────────────────────────────────────┤
│ - HTTP Server (Port 3000)               │
│ - Webhooks /webhooks/feishu/events       │
│ - Admin API /api/*                       │
│ - Internal API /internal/*               │
├─────────────────────────────────────────┤
│ NestFactory.create()                    │
│ - ValidationPipe (whitelist, transform) │
│ - HttpExceptionFilter                   │
│ - TraceMiddleware                        │
│ - SwaggerModule                          │
└─────────────────────────────────────────┘
```

**职责：**
- 接收飞书 Webhook 事件
- 提供管理控制台 API
- 处理内部服务调用

### Worker 进程 (`src/worker.ts`)

```
┌─────────────────────────────────────────┐
│            Worker Process                │
├─────────────────────────────────────────┤
│ - BullMQ Queue Processing                │
│ - Feishu WebSocket Client               │
│ - Scheduled Digest Scanner              │
├─────────────────────────────────────────┤
│ NestFactory.createApplicationContext()  │
│ - Queue Processors                      │
│ - FeishuWsBootstrap                     │
│ - ProjectDigestBootstrap                │
└─────────────────────────────────────────┘
```

**职责：**
- 处理异步作业队列
- 维护飞书 WebSocket 长连接
- 执行定时摘要扫描

### Docker 部署

`docker-compose.yml` 定义三个容器：

```yaml
services:
  migrate:    # 数据库迁移（tools profile）
  api:        # HTTP API 服务器
  worker:     # 后台作业处理器
```

---

## 5. 数据库设计

### 枚举类型

#### ProjectStatus
```
initializing | active | paused | completed | closed
```

#### EnvironmentType
```
default | temporary | module
```

#### EnvironmentStatus
```
creating | active | disabled | error
```

#### RepoSyncStatus
```
uninitialized | syncing | ready | error
```

#### RepoAccessMode
```
readonly | write_protected
```

#### AgentRunStatus
```
queued | running | syncing | succeeded | failed | canceled | timeout
```

#### AgentRunType
```
formal_execution | runtime_audit | bootstrap | digest
```

#### ArtifactType
```
document | task | file | execution_log | summary
```

#### ArtifactStatus
```
pending | synced | failed | skipped
```

#### ConfirmationStatus
```
pending | confirmed | rejected | expired
```

#### AgentRole
```
manager
```

#### GroupSessionMode
```
bootstrap | active | disabled
```

#### GroupSessionStatus
```
idle | busy | error | disabled
```

#### GroupRuntimeTaskStatus
```
queued | running | blocked | waiting_confirmation | completed | failed | canceled
```

#### RuntimeQueueMode
```
steer | followup | collect | interrupt | steer_backlog
```

### 核心数据模型

#### Project - 项目
```
┌─────────────────────────────────────────┐
│ Project                                 │
├─────────────────────────────────────────┤
│ id: String                              │
│ chatId: String          // 飞书群组 ID   │
│ docFolderToken: String  // 文档夹 token │
│ taskBoardToken: String  // 任务看板 token│
│ status: ProjectStatus                    │
│ name: String                             │
│ createdAt, updatedAt                     │
└─────────────────────────────────────────┘
         │
         ├── 1:N ──► ProjectEnvironment
         ├── 1:N ──► MessageSource
         ├── 1:N ──► AgentRun
         ├── 1:N ──► Artifact
         ├── 1:N ──► GroupAgentSession
         └── 1:N ──► GroupPolicy
```

#### ProjectEnvironment - 项目环境
```
┌─────────────────────────────────────────┐
│ ProjectEnvironment                       │
├─────────────────────────────────────────┤
│ id: String                              │
│ projectId: String                       │
│ name: String                            │
│ type: EnvironmentType                   │
│ status: EnvironmentStatus               │
│ repoUrl: String?                        │
│ repoBranch: String?                     │
│ repoSyncStatus: RepoSyncStatus          │
│ repoAccessMode: RepoAccessMode          │
│ model: String?                          │
│ skillSet: String[]                      │
│ isDefault: Boolean                      │
│ createdAt, updatedAt                     │
└─────────────────────────────────────────┘
         │
         └── 1:N ──► AgentRun
```

#### GroupAgentSession - 群组代理会话
```
┌─────────────────────────────────────────┐
│ GroupAgentSession                       │
├─────────────────────────────────────────┤
│ id: String                              │
│ projectId: String                       │
│ environmentId: String                   │
│ mode: GroupSessionMode                  │
│ status: GroupSessionStatus              │
│ lockedBy: String?                       │
│ lockedAt: DateTime?                     │
│ lastActiveAt: DateTime?                │
│ standingOrders: Json?                  │
│ digestConfig: Json?                     │
│ createdAt, updatedAt                    │
└─────────────────────────────────────────┘
         │
         ├── 1:N ──► GroupRuntimeTask
         └── 1:N ──► RuntimeEvent
```

#### AgentRun - 代理执行
```
┌─────────────────────────────────────────┐
│ AgentRun                                │
├─────────────────────────────────────────┤
│ id: String                              │
│ projectId: String                       │
│ environmentId: String                   │
│ sessionId: String?                      │
│ type: AgentRunType                     │
│ status: AgentRunStatus                 │
│ sourceType: SourceType                  │
│ sourceId: String                        │
│ triggerMessageId: String?              │
│ input: Json                             │
│ output: Json?                           │
│ startedAt: DateTime?                   │
│ completedAt: DateTime?                 │
│ createdAt, updatedAt                    │
└─────────────────────────────────────────┘
         │
         └── 1:N ──► Artifact
```

#### Artifact - 产物
```
┌─────────────────────────────────────────┐
│ Artifact                                │
├─────────────────────────────────────────┤
│ id: String                              │
│ projectId: String                       │
│ agentRunId: String?                    │
│ type: ArtifactType                     │
│ status: ArtifactStatus                 │
│ title: String?                          │
│ content: Json?                          │
│ feishuToken: String?                   │
│ syncedAt: DateTime?                    │
│ createdAt, updatedAt                    │
└─────────────────────────────────────────┘
```

#### ConfirmationRequest - 确认请求
```
┌─────────────────────────────────────────┐
│ ConfirmationRequest                     │
├─────────────────────────────────────────┤
│ id: String                              │
│ projectId: String                       │
│ sessionId: String                       │
│ taskId: String?                         │
│ actionType: String                      │
│ actionDescription: String              │
│ actionPayload: Json                     │
│ status: ConfirmationStatus             │
│ cardMessageId: String?                 │
│ expiresAt: DateTime                     │
│ respondedAt: DateTime?                 │
│ createdAt, updatedAt                    │
└─────────────────────────────────────────┘
```

#### GroupPolicy - 群组策略
```
┌─────────────────────────────────────────┐
│ GroupPolicy                             │
├─────────────────────────────────────────┤
│ id: String                              │
│ projectId: String                       │
│ mentionOnly: Boolean                    │
│ enabledSkills: String[]                │
│ writePermissions: Json?                │
│ createdAt, updatedAt                    │
└─────────────────────────────────────────┘
```

### ER 图概览

```
┌──────────┐     1:N     ┌───────────────────┐
│ Project  │────────────►│ ProjectEnvironment │
└──────────┘             └───────────────────┘
     │
     │ 1:N
     ▼
┌──────────┐     1:N     ┌───────────────────┐
│ AgentRun │────────────►│ Artifact          │
└──────────┘             └───────────────────┘
     │
     │ N:1
     ▼
┌───────────────────┐
│ GroupAgentSession │
└───────────────────┘
     │
     │ 1:N
     ├────────────────────┐
     ▼                    ▼
┌───────────────┐  ┌───────────────┐
│RuntimeTask    │  │ RuntimeEvent │
└───────────────┘  └───────────────┘
```

---

## 6. 模块组织

### 模块概览

```
┌─────────────────────────────────────────────────────────────────┐
│                        NestJS Modules                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐ │
│  │   Health    │  │   Project    │  │     Environment       │ │
│  │  (健康检查)  │  │  (项目管理)  │  │    (环境管理)          │ │
│  └─────────────┘  └──────────────┘  └─────────────────────────┘ │
│                                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐ │
│  │   Feishu    │  │    Agent     │  │      Artifact          │ │
│  │  (飞书集成)  │  │  (代理运行)  │  │    (产物同步)          │ │
│  └─────────────┘  └──────────────┘  └─────────────────────────┘ │
│                                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐ │
│  │Confirmation │  │ Conversation │  │       Digest          │ │
│  │  (确认流程)  │  │  (对话上下文) │  │    (定时摘要)          │ │
│  └─────────────┘  └──────────────┘  └─────────────────────────┘ │
│                                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐ │
│  │    Repo     │  │    Admin     │  │        Dev             │ │
│  │  (仓库同步)  │  │  (管理控制)  │  │    (调试工具)          │ │
│  └─────────────┘  └──────────────┘  └─────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 各模块详解

#### Health Module (`src/modules/health/`)
- **职责**: 提供健康检查端点
- **控制器**: `health.controller.ts`
- **端点**: `GET /health`

#### Project Module (`src/modules/project/`)
- **服务**:
  - `ProjectService`: 项目 CRUD、从聊天初始化、清理、解绑
  - `GroupPolicyService`: 群组策略管理（仅提及、技能、权限）
  - `ProjectMemberProfileService`: 成员档案同步和管理
- **控制器**: `project.controller.ts`（受 AdminAuthGuard 保护）

#### Environment Module (`src/modules/environment/`)
- **服务**: `EnvironmentService`
- **职责**: 环境 CRUD、仓库同步触发、默认环境管理
- **控制器**: `environment.controller.ts`

#### Feishu Module (`src/modules/feishu/`)
- **服务**:
  - `FeishuService`: 完整的飞书开放 API 客户端
  - `FeishuEventService`: 事件处理、项目初始化引导、消息路由
  - `FeishuWsService`: WebSocket 事件客户端（webhook 替代方案）
  - `FeishuWsBootstrap`: Worker 初始化时启动 WebSocket
  - `FeishuProjectReader`: 文档/多维表格内容读取
- **控制器**: `feishu.controller.ts`（Webhook 端点）

#### Agent Module (`src/modules/agent/`)
- **核心服务**:
  - `AgentService`: 代理运行创建、取消、交互决策
  - `GroupAgentSessionService`: 会话生命周期、锁定、状态同步
  - `GroupRuntimeService`: 运行时消息处理、确认恢复
  - `GroupRuntimeTaskService`: 任务队列管理
  - `PiMonoAdapter`: Pi Mono SDK 集成（会话管理、执行）
  - `RoleProfileService`: 代理角色提示和 standing orders
  - `ProjectRuntimeContextService`: 上下文包组装
- **类型与常量**:
  - `agent.types.ts`: 输出类型、意图、策略、快照
  - `agent.constants.ts`: Redis 注入令牌
  - `agent.schemas.ts`: JSON 输出模式
  - `pi-skill-mapping.ts`: 技能目录解析
- **控制器**: `agent.controller.ts`（受 AdminAuthGuard 保护）

#### Artifact Module (`src/modules/artifact/`)
- **服务**: `ArtifactService`
- **职责**: 从输出创建产物、同步到飞书（文档、任务、文件）
- **控制器**: `artifact.controller.ts`

#### Confirmation Module (`src/modules/confirmation/`)
- **服务**: `ConfirmationService`
- **职责**: 创建确认、处理卡片决策、过期处理
- **控制器**: `confirmation.controller.ts`（内部端点）

#### Conversation Module (`src/modules/conversation/`)
- **服务**: `ConversationService`
- **职责**: 私聊上下文（项目选择）

#### Digest Module (`src/modules/digest/`)
- **服务**:
  - `ProjectDigestService`: 定时摘要（每日/每周）、cron 匹配
  - `ProjectContextAssembler`: 从飞书资源组装上下文包
  - `ProjectDigestBootstrap`: 摘要扫描调度

#### Repo Module (`src/modules/repo/`)
- **服务**:
  - `RepoSyncService`: Git 克隆/拉取、工作空间管理
  - `RepoWorkspaceService`: 工作空间路径解析
  - `RepoCredentialResolver`: 凭证密钥解析
  - `RepoSyncQueueService`: 同步作业入队

#### Admin Module (`src/modules/admin/`)
- **服务**: `AdminService`
- **职责**: 机器人实例、运行时、日志、成员、策略
- **控制器**: `admin.controller.ts`（管理控制台页面和 REST API）
- **页面**: `admin-console.page.ts`（HTML 管理 UI）

#### Dev Module (`src/modules/dev/`)
- **职责**: 调试/验证端点
- **功能**: 项目绑定工具页面

---

## 7. API 结构

### 端点总览

```
┌─────────────────────────────────────────────────────────────┐
│                      API Endpoints                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Webhooks (无认证)                                           │
│  └─ POST /webhooks/feishu/events     飞书事件入口             │
│                                                              │
│  Admin API (AdminAuthGuard)                                  │
│  ├─ POST   /api/projects/init-from-chat    初始化项目        │
│  ├─ GET    /api/projects/:id               获取项目           │
│  ├─ PATCH  /api/projects/:id               更新项目           │
│  ├─ GET    /api/projects/by-chat/:chatId   按聊天查找        │
│  ├─ POST   /api/projects/by-chat/:chatId/unbind   解绑       │
│  ├─ POST   /api/projects/by-chat/:chatId/cleanup  清理       │
│  ├─ POST   /api/agent-runs                 创建代理运行       │
│  ├─ GET    /api/agent-runs/:id             获取运行状态       │
│  ├─ POST   /api/agent-runs/:id/cancel      取消运行           │
│  ├─ POST   /api/agent-runs/:id/retry-sync  重试同步           │
│  ├─ POST   /api/artifacts/:id/retry-sync   重试产物同步       │
│  ├─ GET    /api/admin/robot-instances      机器人实例列表    │
│  ├─ GET    /api/admin/robot-instances/:chatId    实例详情    │
│  ├─ GET    /api/admin/robot-instances/:chatId/runtime  运行时│
│  ├─ GET    /api/admin/robot-instances/:chatId/tasks    任务  │
│  ├─ GET    /api/admin/robot-instances/:chatId/logs     日志  │
│  ├─ GET    /api/admin/robot-instances/:chatId/members  成员   │
│  ├─ GET    /api/admin/robot-instances/:chatId/policy   策略   │
│  └─ PATCH  /api/admin/robot-instances/:chatId/policy  更新策略│
│                                                              │
│  Internal API                                                │
│  ├─ POST /internal/confirmations/:id/confirm   确认操作       │
│  └─ POST /internal/confirmations/:id/reject   拒绝操作       │
│                                                              │
│  Admin Console                                               │
│  └─ GET  /admin/console     HTML 管理界面                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 认证机制

| 端点类型 | 认证方式 |
|----------|----------|
| Webhook | 飞书签名验证 (SHA256) |
| Admin API | JWT (AdminAuthGuard) |
| Internal API | 内部调用（无外部暴露） |

---

## 8. 队列系统

### BullMQ 队列概览

```
┌─────────────────────────────────────────────────────────────┐
│                    BullMQ Queues (Redis-backed)             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────┐    ┌─────────────────────────────┐│
│  │  feishu-event.queue │    │    agent-run.queue          ││
│  │  (飞书事件处理)       │    │    (代理执行)               ││
│  └─────────────────────┘    └─────────────────────────────┘│
│                                                              │
│  ┌─────────────────────┐    ┌─────────────────────────────┐│
│  │  artifact-sync.queue│    │    notification.queue       ││
│  │  (产物同步)          │    │    (通知投递)               ││
│  └─────────────────────┘    └─────────────────────────────┘│
│                                                              │
│  ┌─────────────────────┐    ┌─────────────────────────────┐│
│  │  cleanup.queue      │    │    project-digest.queue     ││
│  │  (清理任务)          │    │    (定时摘要)               ││
│  └─────────────────────┘    └─────────────────────────────┘│
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  repo-sync.queue (仓库同步)                             ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 处理器详解

#### FeishuEventProcessor
```
入队: 飞书 Webhook 收到事件
处理:
  1. 事件去重（FeishuEventDedup）
  2. 路由消息到项目/未初始化处理器
  3. 处理卡片动作确认
```

#### AgentRunProcessor
```
入队: 创建 AgentRun 记录
处理:
  1. 检查仓库能力
  2. 执行 Pi Mono SDK 运行
  3. 状态转换 (queued → running → syncing → succeeded)
  4. 入队产物同步
```

#### ArtifactSyncProcessor
```
入队: AgentRun 完成产生产物
处理:
  1. 根据产物类型同步到飞书
     - document: 创建文档/写入块
     - task: 创建多维表格记录
     - file: 上传文件
     - summary: 发送摘要消息
  2. 遵守群组策略写入权限
  3. 发送自动回复到群组
```

#### CleanupProcessor
```
入队: 定时调度
处理:
  1. 过期待确认请求
  2. 清理过期对话上下文
```

#### ProjectDigestProcessor
```
入队: 定时调度扫描
处理:
  1. 扫描活跃会话的定时摘要配置
  2. 执行每日/每周摘要运行
  3. 规范化摘要输出
```

#### RepoSyncProcessor
```
入队: 环境配置/更新仓库
处理:
  1. Git 克隆/拉取操作
  2. 更新数据库同步状态
```

---

## 9. 外部集成

### 飞书集成

#### API 能力

| 能力 | 方法 | 说明 |
|------|------|------|
| 消息发送 | `sendMessage` | 发送文本/卡片消息 |
| 消息反应 | `addReaction` | 添加表情反应 |
| 文档操作 | `createDocument`, `writeBlocks` | 创建和编辑文档 |
| 多维表格 | `createBitable`, `createField`, `createRecord` | 表格操作 |
| 云盘操作 | `createFolder`, `uploadFile` | 文件管理 |
| 群聊标签 | `createChatTab` | 创建群聊标签页 |
| 成员列表 | `getChatMembers` | 获取群成员 |
| 权限授予 | `grantPermission` | 文档权限管理 |

#### 事件处理

```
┌─────────────────────────────────────────────────────────────┐
│                    飞书事件流程                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌───────────┐     ┌──────────────┐     ┌─────────────────┐ │
│  │ 飞书服务器 │────►│ Webhook/WS   │────►│ FeishuEventSvc │ │
│  └───────────┘     └──────────────┘     └─────────────────┘ │
│                           │                     │          │
│                           ▼                     ▼          │
│                    ┌──────────────┐     ┌─────────────────┐ │
│                    │ 签名验证      │     │ 事件去重        │ │
│                    │ AES 解密      │     │ 消息路由        │ │
│                    └──────────────┘     └─────────────────┘ │
│                                                │            │
│                                                ▼            │
│                                    ┌─────────────────────┐  │
│                                    │ 入队到              │  │
│                                    │ feishu-event.queue  │  │
│                                    └─────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**支持的事件类型:**
- `im.message.receive_v1`: 接收消息
- `im.chat.member.bot.added_v1`: 机器人加入群聊
- `card.action.trigger`: 卡片动作触发

**安全机制:**
- SHA256 签名验证
- AES-256-CBC 事件解密
- Verification Token 验证

### Pi Mono Agent SDK 集成

#### 配置

```env
PI_MONO_PROVIDER=bailian
PI_MONO_MODEL=kimi-k2.5
PI_MONO_THINKING_LEVEL=off
PI_MONO_WORKDIR=/workspace
PI_MONO_AGENT_DIR=/workspace/.pi-agent
BAILIAN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_API_KEY=sk-...
```

#### 核心能力

```
┌─────────────────────────────────────────────────────────────┐
│                    Pi Mono SDK 集成                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  会话管理                                                    │
│  ├─ createSession()    创建新会话                            │
│  ├─ rehydrateSession() 恢复会话状态                          │
│  └─ closeSession()     关闭会话                              │
│                                                              │
│  执行能力                                                    │
│  ├─ 结构化工具执行                                          │
│  ├─ 内存管理                                                │
│  ├─ 输出模式强制                                            │
│  └─ 多提供商支持 (Bailian, OpenAI, Anthropic...)            │
│                                                              │
│  技能系统                                                    │
│  ├─ 文档生成 (document-generate)                            │
│  ├─ 进度摘要 (progress-summary)                             │
│  ├─ 需求分析 (requirement-analysis)                         │
│  └─ 任务分解 (task-breakdown)                               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 多提供商支持

| 提供商 | 模型示例 |
|--------|----------|
| Bailian | kimi-k2.5 |
| OpenAI | gpt-4, gpt-4-turbo |
| Anthropic | claude-3-opus, claude-3-sonnet |

---

## 10. 配置管理

### 环境变量

#### 必需变量

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | PostgreSQL 连接字符串 |
| `REDIS_URL` | Redis 连接字符串 |
| `FEISHU_APP_ID` | 飞书应用 ID |
| `FEISHU_APP_SECRET` | 飞书应用密钥 |
| `FEISHU_VERIFICATION_TOKEN` | Webhook 验证令牌 |
| `FEISHU_ENCRYPT_KEY` | 事件解密密钥 |
| `ADMIN_JWT_SECRET` | 管理 API JWT 密钥 |
| `PUBLIC_BASE_URL` | 公共 URL（用于回调） |

#### 可选变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `FEISHU_EVENT_MODE` | `webhook` | 事件接收模式 |
| `FEISHU_WS_EVENT_TYPES` | (列表) | WebSocket 事件订阅 |
| `PI_MONO_PROVIDER` | `bailian` | AI 提供商 |
| `PI_MONO_MODEL` | `kimi-k2.5` | 模型 ID |
| `REPO_MIRROR_ROOT` | (空) | 仓库工作空间根目录 |
| `REPO_SECRET_MAP_JSON` | `{}` | 凭证映射 |
| `CONFIRMATION_TTL_MINUTES` | `30` | 确认过期时间（分钟） |
| `AGENT_RUN_TIMEOUT_SECONDS` | `1800` | 运行超时（秒） |
| `DIGEST_TIMEZONE` | `Asia/Shanghai` | 摘要时区 |
| `DIGEST_DAILY_CRON` | `0 10 * * 1-5` | 每日摘要 cron |
| `DIGEST_WEEKLY_CRON` | `0 17 * * 5` | 每周摘要 cron |

### 配置验证

使用 Joi 进行环境变量验证：

```typescript
// src/config/env.validation.ts
export const validationSchema = Joi.object({
  DATABASE_URL: Joi.string().required(),
  REDIS_URL: Joi.string().required(),
  FEISHU_APP_ID: Joi.string().required(),
  FEISHU_APP_SECRET: Joi.string().required(),
  // ...
});
```

---

## 11. 测试架构

### 测试文件组织

```
test/
├── unit/                          # 单元测试
│   ├── state-machine.spec.ts      # 状态转换验证
│   ├── feishu.service.spec.ts     # 飞书 API 客户端
│   └── pi-skill-loading.spec.ts   # 技能解析
│
├── integration/                  # 集成测试
│   ├── agent.service.spec.ts     # 代理运行管理
│   ├── group-runtime.service.spec.ts  # 运行时处理
│   ├── pi-mono.adapter.spec.ts   # Pi Mono SDK 集成
│   ├── artifact.service.spec.ts   # 产物同步
│   ├── artifact-sync.processor.spec.ts # 同步处理器
│   ├── feishu-event.service.spec.ts    # 事件处理
│   ├── admin.service.spec.ts      # 管理操作
│   ├── role-profile.service.spec.ts    # 角色配置
│   ├── group-policy.service.spec.ts    # 策略管理
│   ├── feishu-project-reader.service.spec.ts # 资源读取
│   ├── project-digest.service.spec.ts  # 摘要逻辑
│   └── project-digest.processor.spec.ts # 摘要处理器
│
└── repo/                         # 仓库同步测试
    ├── repo-sync.service.spec.ts
    └── repo-workspace.service.spec.ts
```

### 测试脚本

```json
{
  "test": "jest --runInBand",
  "test:pi-runtime": "jest --runInBand test/pi-mono.adapter.spec.ts",
  "test:group-runtime": "jest --runInBand test/group-runtime.service.spec.ts test/feishu-event.service.spec.ts",
  "verify:runtime-fast": "npm run test:pi-runtime && npm run test:group-runtime && npm run build"
}
```

### 测试覆盖重点

| 模块 | 测试重点 |
|------|----------|
| State Machine | 状态转换合法性验证 |
| Feishu Service | API 调用模拟、错误处理 |
| Agent Service | 运行创建、取消、状态管理 |
| Group Runtime | 会话锁定、任务调度、确认恢复 |
| Pi Mono Adapter | SDK 集成、会话生命周期 |
| Artifact | 产物创建、同步逻辑 |

---

## 12. 状态机与验证

### AgentRun 状态转换

```
┌─────────┐
│ queued  │──────────────────────────────┐
└─────────┘                              │
     │                                   │
     │ start                            │ cancel/fail/timeout
     ▼                                   ▼
┌─────────┐                        ┌──────────┐
│ running │───────────────────────►│ canceled │
└─────────┘                        ├──────────┤
     │                             │  failed  │
     │ complete                    ├──────────┤
     ▼                             │ timeout  │
┌─────────┐                        └──────────┘
│ syncing │
└─────────┘
     │
     │ success/fail/timeout
     ▼
┌───────────┐
│ succeeded │
├───────────┤
│  failed   │
├───────────┤
│  timeout  │
└───────────┘
```

**合法转换:**
```
queued → running, canceled, failed, timeout
running → syncing, failed, timeout, canceled
syncing → succeeded, failed, timeout
```

### Artifact 状态转换

```
┌─────────┐
│ pending │
└─────────┘
     │
     │ sync attempt
     ▼
┌─────────┐
│ synced  │  ←── success
├─────────┤
│ failed  │  ←── retryable error
├─────────┤
│ skipped │  ←── policy disallow
└─────────┘

failed → synced, failed, skipped (重试)
```

### Confirmation 状态转换

```
┌─────────┐
│ pending │
└─────────┘
     │
     │ user action / timeout
     ▼
┌───────────┐
│ confirmed │  ←── 用户确认
├───────────┤
│ rejected  │  ←── 用户拒绝
├───────────┤
│ expired   │  ←── 超时
└───────────┘
```

### 状态验证实现

```typescript
// src/common/state/state-machine.ts

export const AgentRunTransitions: StateTransitions<AgentRunStatus> = {
  queued: ['running', 'canceled', 'failed', 'timeout'],
  running: ['syncing', 'failed', 'timeout', 'canceled'],
  syncing: ['succeeded', 'failed', 'timeout'],
  succeeded: [],
  failed: [],
  canceled: [],
  timeout: [],
};

export function canTransition<T extends string>(
  machine: StateTransitions<T>,
  from: T,
  to: T
): boolean {
  return machine[from]?.includes(to) ?? false;
}
```

---

## 13. 架构模式

### 分层架构

```
┌─────────────────────────────────────────────────────────────┐
│                      接入层 (Ingestion)                      │
│  飞书 Webhook/WS, 管理 HTTP API                              │
├─────────────────────────────────────────────────────────────┤
│                      编排层 (Orchestration)                   │
│  群组会话、运行时任务、代理运行、确认流程                       │
├─────────────────────────────────────────────────────────────┤
│                      执行层 (Execution)                      │
│  Pi Mono 适配器、仓库同步、产物同步                            │
├─────────────────────────────────────────────────────────────┤
│                      治理层 (Governance)                     │
│  群组策略、成员档案、定时摘要、运行时事件                       │
└─────────────────────────────────────────────────────────────┘
```

### 设计模式

| 模式 | 应用场景 |
|------|----------|
| **模块模式** | NestJS 模块化架构 |
| **仓储模式** | Prisma 服务抽象 |
| **队列模式** | BullMQ 作业处理 |
| **适配器模式** | Pi Mono SDK 集成 |
| **状态机** | 状态转换验证 |
| **锁模式** | 基于 Redis 的会话锁定 |

### 依赖流向

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Controller  │────►│   Service    │────►│   Prisma     │
│  (API 层)    │     │  (业务层)    │     │  (数据层)    │
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │
       │                    │
       ▼                    ▼
┌──────────────┐     ┌──────────────┐
│    Guard     │     │    Queue     │
│  (认证守卫)   │     │   (队列)     │
└──────────────┘     └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │  Processor   │
                     │  (处理器)     │
                     └──────────────┘
```

### 数据流

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  飞书    │────►│ Webhook │────►│  Queue  │────►│Processor│
│  事件   │     │  接入   │     │  入队   │     │  处理   │
└─────────┘     └─────────┘     └─────────┘     └─────────┘
                                                      │
                                                      ▼
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  飞书    │◄────│ 产物   │◄────│ Agent   │◄────│ Session │
│  同步   │     │  同步   │     │  Run    │     │  锁定   │
└─────────┘     └─────────┘     └─────────┘     └─────────┘
```

---

## 附录 A: 关键文件索引

| 文件 | 职责 |
|------|------|
| `src/main.ts` | API 进程入口 |
| `src/worker.ts` | Worker 进程入口 |
| `src/app.module.ts` | 主应用模块定义 |
| `src/worker.module.ts` | Worker 模块定义 |
| `prisma/schema.prisma` | 数据库模型定义 |
| `src/modules/feishu/feishu.service.ts` | 飞书 API 客户端 |
| `src/modules/agent/pi-mono.adapter.ts` | Pi Mono SDK 集成 |
| `src/modules/agent/group-runtime.service.ts` | 运行时核心逻辑 |
| `src/queues/processors/agent-run.processor.ts` | 代理执行处理器 |
| `src/common/state/state-machine.ts` | 状态机定义 |

---

## 附录 B: 常用命令

```bash
# 开发
npm run dev              # 启动开发服务器
npm run build            # 构建生产版本

# 数据库
npx prisma generate      # 生成 Prisma 客户端
npx prisma migrate dev   # 运行开发迁移
npx prisma studio        # 打开数据库 GUI

# 测试
npm run test             # 运行所有测试
npm run test:pi-runtime  # 运行 Pi Mono 测试
npm run verify:runtime-fast  # 快速验证

# Docker
docker-compose up -d     # 启动所有服务
docker-compose up migrate  # 运行迁移
```

---

*文档版本: 1.0*
*最后更新: 2026-05-01*