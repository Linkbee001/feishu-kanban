# Phase 04: E2E Verification + Admin Dashboard - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-06
**Phase:** 04-e2e-verification
**Areas discussed:** 验证范围、管理后台功能、技术栈、部署方式、认证方式

---

## 验证范围与流程

| Option | Description | Selected |
|--------|-------------|----------|
| 验证范围与流程 | 消息处理、配置、Agent Run、Admin API、确认流程等具体测试范围 | ✓ |
| 测试环境与集成 | 真实飞书环境 vs 模拟环境，Pi SDK 真实调用 vs mock | |
| 测试数据管理 | 测试数据创建、清理、隔离策略 | |
| 验证标准定义 | 什么算通过：单元测试通过、E2E 流程成功、飞书文档同步 | |

**User's choice:** 验证范围与流程
**Notes:** 用户提到想通过建立一套完整的管理后台来快速验证群功能，这扩展了阶段范围

---

## 管理后台范围

| Option | Description | Selected |
|--------|-------------|----------|
| 验证现有功能 | 使用现有的 Admin API + curl/脚本进行验证，不新增前端 | |
| 新增管理后台 UI | 创建一个管理后台 Web UI 来进行可视化的验证操作 | ✓ |
| 分阶段实现 | 先用现有 API 验证，后续阶段添加管理后台 | |

**User's choice:** 新增管理后台 UI
**Notes:** 用户明确想要管理后台 UI，而非仅使用现有 API

---

## 管理后台功能模块

| Option | Description | Selected |
|--------|-------------|----------|
| 机器人实例管理 | 查看所有群状态、配置、运行时状态 | ✓ |
| 配置管理 | 初始化配置、更新配置、查看 PROJECT-CONFIG.md | ✓ |
| Agent Run 管理 | 创建、监控、取消 Agent 运行 | ✓ |
| 运行时监控 | 查看运行时事件、任务板、确认请求 | ✓ |

**User's choice:** 全选
**Notes:** 用户需要完整的四个功能模块，外加快速验证功能（删除、重置配置）和日志追踪

---

## 技术栈选择

| Option | Description | Selected |
|--------|-------------|----------|
| React | React + TypeScript，组件化开发 | ✓ |
| Vue 3 | Vue 3 + TypeScript，更轻量 | |
| Angular | Angular + TypeScript，完整框架 | |

**User's choice:** React
**Notes:** 用户选择 React 作为前端框架

---

## UI 样式框架

| Option | Description | Selected |
|--------|-------------|----------|
| Ant Design | 蚂蚁金服设计语言，适合管理后台 | |
| TailwindCSS | TailwindCSS + shadcn/ui，更现代灵活 | ✓ |
| ProComponents | 基于 Ant Design 的中后台框架 | |

**User's choice:** TailwindCSS
**Notes:** 用户选择 TailwindCSS 作为样式框架

---

## 日志展示方式

| Option | Description | Selected |
|--------|-------------|----------|
| 集成日志查看 | 在后台 UI 中嵌入日志查看器，实时显示运行日志 | ✓ |
| 日志下载 | 提供日志文件下载链接，使用外部工具查看 | |

**User's choice:** 集成日志查看
**Notes:** 用户希望在管理后台中直接查看实时日志

---

## 部署方式

| Option | Description | Selected |
|--------|-------------|----------|
| 前端静态部署 | 前端静态文件部署，通过 API 调用后端 | |
| 嵌入式部署 | 前端嵌入 NestJS，统一端口 | ✓ |

**User's choice:** 嵌入式部署
**Notes:** 用户希望前端嵌入 NestJS，统一端口访问

---

## 登录认证方式

| Option | Description | Selected |
|--------|-------------|----------|
| JWT Token | 复用现有 AdminAuthGuard (JWT token) | |
| 飞书 OAuth | 使用飞书 OAuth 登录，更安全 | |
| 环境区分 | 开发环境无登录，生产环境需登录 | ✓ |

**User's choice:** 环境区分
**Notes:** 用户希望开发环境不需要登录，生产环境使用 JWT 认证

---

## Claude's Discretion

以下领域用户授权 Claude 自行决定：

1. **前端组件布局和样式** — 遵循 TailwindCSS 最佳实践
2. **日志查看器技术实现** — WebSocket 实时推送 vs HTTP 轮询
3. **管理后台响应式设计细节** — 按钮位置、确认弹窗等
4. **各功能模块的交互细节** — 按钮位置、确认弹窗等

---

## Deferred Ideas

None — discussion stayed within phase scope.

---

*Discussion completed: 2026-05-06*