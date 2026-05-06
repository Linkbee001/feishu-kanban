# Phase 04: E2E Verification + Admin Dashboard - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning

## Phase Boundary

验证 v1.0.0 (Rebuild) 和 v1.1.0 (Architecture Refactor) 后系统功能的完整性，并开发一个嵌入式管理后台 Web UI 用于可视化的验证和监控操作。

**In scope:**
- E2E 验证：消息处理流程、配置管理流程、Agent Run 流程、Admin API
- 管理后台 UI 开发（React + TailwindCSS）
- 嵌入式部署（嵌入 NestJS，统一端口）
- 快速验证功能（删除、重置配置）
- 集成日志查看器（实时显示运行日志）
- 环境区分认证（开发环境无登录，生产环境 JWT）

**Out of scope:**
- 其他模块的改动（保持现有后端 API 稳定）
- 飞书 OAuth 登录（使用现有 JWT 方式）
- 自动化测试脚本开发（后续阶段）
- 性能优化或行为改变

---

## Implementation Decisions

### 验证范围

- **D-01:** 验证 **消息处理流程** — 飞书消息接收 → FeishuEventService → GroupRuntimeService → PiMonoAdapter → Pi SDK 执行 → 回复
- **D-02:** 验证 **配置管理流程** — 新群 pending_config → 固定响应 → Admin API complete → Project 创建
- **D-03:** 验证 **Agent Run 流程** — 创建运行 → 队列处理 → Pi SDK 执行 → 文档同步到飞书
- **D-04:** 验证 **Admin API 现有功能** — 机器人实例列表、运行时状态、策略更新
- **D-05:** 验证 **7 个 Pi 服务协作** — PiSessionStateService, PiSessionManager, PiPromptBuilder, PiOutputProcessor, PiExecutor, PiEventRecorder, PiToolRegistry 正确协作

### 管理后台 UI

- **D-06:** 使用 **React + TypeScript** 开发独立前端项目
- **D-07:** 使用 **TailwindCSS** 作为 UI 样式框架
- **D-08:** 采用 **嵌入式部署** — 前端静态文件嵌入 NestJS，通过 `nest-cli.json` 配置 assets
- **D-09:** 实现以下功能模块：
  - **机器人实例管理**：查看所有群状态、配置、运行时状态
  - **配置管理**：初始化配置、更新配置、查看 PROJECT-CONFIG.md
  - **Agent Run 管理**：创建、监控、取消 Agent 运行
  - **运行时监控**：查看运行时事件、任务板、确认请求

### 快速验证功能

- **D-10:** 实现 **快速删除** — 删除测试群的所有关联数据（Project, GroupAgentSession, MessageSource, RuntimeEvents）
- **D-11:** 实现 **重置配置** — 将群状态重置为 pending_config，清除 PROJECT-CONFIG.md
- **D-12:** 实现 **集成日志查看** — 在后台 UI 中嵌入日志查看器，实时显示 worker/API 日志

### 认证与部署

- **D-13:** 采用 **环境区分认证**：
  - 开发环境 (`NODE_ENV=development`)：无登录验证
  - 生产环境：使用现有 AdminAuthGuard (JWT Token)
- **D-14:** 前端通过 NestJS static assets 提供，统一端口访问

### Claude's Discretion

- 前端组件的具体布局和样式（遵循 TailwindCSS 最佳实践）
- 日志查看器的技术实现（WebSocket 实时推送 vs HTTP 轮询）
- 管理后台的响应式设计细节
- 各功能模块的交互细节（按钮位置、确认弹窗等）

---

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 现有后端 API

- `src/modules/admin/admin.controller.ts` — Admin API 端点定义
- `src/modules/admin/admin.service.ts` — Admin 服务实现
- `src/modules/config/group-config.controller.ts` — 配置管理 API 端点
- `src/modules/config/group-config.service.ts` — 配置管理服务实现
- `src/modules/agent/agent.controller.ts` — Agent Run API 端点

### 前序阶段上下文

- `.planning/phases/03-rebuild-3/03-CONTEXT.md` — 7 个 Pi 服务分解决策
- `.planning/phases/02-rebuild-2/01-CONTEXT.md` — 配置管理简化决策
- `.planning/phases/01-rebuild-1/01-CONTEXT.md` — SessionContext, RuntimeState 决策

### 代码结构参考

- `.planning/codebase/ARCHITECTURE.md` — 模块架构
- `.planning/codebase/STACK.md` — 技术栈（NestJS, React, TailwindCSS）
- `.planning/codebase/TESTING.md` — 测试模式和约定

### E2E 测试指南（已创建）

- `docs/E2E-TEST-GUIDE.md` — E2E 测试步骤和验证方法
- `scripts/e2e-manual-test.sh` — 手动测试脚本
- `scripts/jwt-helper.js` — JWT Token 生成工具

---

## Existing Code Insights

### Reusable Assets

- **AdminAuthGuard** (`src/common/auth/admin-auth.guard.ts`) — JWT 认证守卫，可复用
- **AdminService** — 已有机器人实例列表、运行时状态 API
- **GroupConfigService** — 已有配置管理 API（complete, update, get）
- **AgentService** — 已有 Agent Run 创建、取消 API
- **conftest.ts** (`test/conftest.ts`) — 测试 mock 工厂模式，可借鉴

### Established Patterns

- **NestJS 模块化架构** — Admin 模块、Config 模块、Agent 模块已存在
- **AdminAuthGuard bypass** — `NODE_ENV=test` 或 localhost + development 可跳过认证
- **静态 assets 配置** — 通过 `nest-cli.json` 配置可嵌入前端文件

### Integration Points

- **前端入口**：需要配置 NestJS 静态文件服务，路由 `/admin/*`
- **API 调用**：前端通过 `/api/admin/*`, `/api/group-config/*`, `/api/agent-runs/*` 调用后端
- **日志查看**：需要访问日志文件或 worker 进程 stdout/stderr

---

## Specific Ideas

- 管理后台应该有 **仪表盘首页**，展示关键统计（群数量、活跃 session、运行中的 Agent Run）
- 每个群实例应该有 **详情页**，展示配置状态、运行时状态、最近事件
- Agent Run 应该有 **实时进度显示**，类似进度条或状态指示器
- 日志查看器应该有 **过滤功能**（按群 ID、按服务、按时间）

---

## Deferred Ideas

None — discussion stayed within phase scope.

---

*Phase: 04-e2e-verification*
*Context gathered: 2026-05-06*