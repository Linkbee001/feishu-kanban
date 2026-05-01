# feishu-kanban 项目长期记忆

本文档用于沉淀这个仓库的长期稳定认知，后续继续开发时优先阅读这里，而不是每次重新全量搜索代码。

## 1. 项目一句话

`feishu-kanban` 是一个基于 NestJS 的飞书项目协作后端，目标是把“飞书群 + 项目文档/任务板 + AI manager 代理 + 仓库运行环境 + 管理控制台”串成一个可运营的项目管理机器人系统。

当前产品定位更接近：

- 面向飞书群的项目管理机器人
- 带治理能力的 agent runtime 平台
- 不是通用聊天机器人
- 不是完整 DevOps 平台

## 2. 当前总体架构

仓库是一个典型的 `API + Worker + PostgreSQL + Redis + Prisma + BullMQ` 后端工程。

- `src/main.ts`
  - 启动 HTTP API 进程
- `src/worker.ts`
  - 启动 Worker 进程
- `src/app.module.ts`
  - 组装全量业务模块、Prisma、BullMQ 队列、中间件
- `src/worker.module.ts`
  - 挂载各类队列处理器、Feishu WS bootstrap、digest/repo sync 等后台任务
- `prisma/schema.prisma`
  - 当前最重要的系统真实数据模型来源

基础组件分层如下：

1. 接入层
   - Feishu webhook / Feishu websocket
   - Admin HTTP API
   - Dev/调试 HTTP API
2. 编排层
   - Group session
   - Group runtime task queue
   - Agent run lifecycle
   - Confirmation flow
3. 执行层
   - Pi Mono adapter
   - Repo mirror / workspace sync
   - Artifact sync
4. 治理层
   - Group policy
   - Project member profiles
   - Agent role profile / project override
   - Digest / runtime events / admin console

## 3. 代码目录速记

### 根目录

- `src/`
  - 主业务代码
- `prisma/`
  - Prisma schema 与迁移
- `test/`
  - Jest 测试
- `docs/`
  - PRD、设计方案、阶段记录
- `pi-skills/`
  - 提供给 manager agent 的本地 skills
- `scripts/`
  - 验证脚本
- `demo/`
  - 演示相关内容
- `dist/`
  - 构建产物

### `src/modules/`

- `health/`
  - 健康检查
- `project/`
  - 项目初始化、项目绑定/解绑、成员画像、群策略
- `environment/`
  - 项目环境管理，承载 repo/model/runtime 配置
- `feishu/`
  - 飞书 API、事件处理、WebSocket 接入、飞书资源读写
- `agent/`
  - manager 决策、group session、runtime task、role profile、Pi Mono 集成
- `artifact/`
  - 文档/任务/总结等产物查询与重试同步
- `confirmation/`
  - 高风险动作确认机制
- `conversation/`
  - 私聊上下文选择
- `digest/`
  - 定时摘要与上下文汇总
- `repo/`
  - 仓库镜像同步、workspace 路径管理、凭证解析
- `admin/`
  - 管理控制台页面与后台 API
- `dev/`
  - 调试/验证工具页面与接口

### `src/queues/processors/`

- `feishu-event.processor.ts`
  - 飞书事件异步处理
- `agent-run.processor.ts`
  - agent run 执行
- `artifact-sync.processor.ts`
  - 产物同步
- `cleanup.processor.ts`
  - 清理类任务
- `project-digest.processor.ts`
  - 摘要任务
- `repo-sync.processor.ts`
  - 仓库同步任务

## 4. 核心业务对象

以 `prisma/schema.prisma` 为准，当前最关键的模型是：

- `Project`
  - 一个飞书群绑定出的正式项目
- `ProjectEnvironment`
  - 项目环境，包含 repo/model/输出目录/同步状态等
- `MessageSource`
  - 飞书消息落库后的标准输入记录
- `AgentRun`
  - 一次 agent 正式执行
- `Artifact`
  - agent 产生的文档、任务、总结、文件、日志等
- `ConfirmationRequest`
  - 高风险动作确认单
- `GroupAgentSession`
  - 群级 manager 会话实例，是群机器人真正的运行实体
- `GroupRuntimeTask`
  - 群运行时内部待办队列
- `GroupPolicy`
  - 群策略，控制是否启用、是否只响应 @、允许哪些 skills、是否需要确认等
- `ProjectMemberProfile`
  - 群成员画像，用于角色/责任/权限建模
- `RuntimeEvent`
  - runtime 事件流，用于审计与观测
- `AgentRoleProfile`
  - 角色级提示词/灵魂/standing orders 配置
- `ProjectAgentProfileOverride`
  - 项目级角色配置覆盖

## 5. 目前已经成型的能力

### 5.1 飞书项目初始化

项目支持从飞书群触发初始化，自动完成：

- 创建项目记录
- 创建默认环境
- 创建飞书文档目录
- 创建任务 bitable
- 建立群与项目绑定
- 初始化默认群策略
- 同步群成员画像
- 创建一组工作区骨架文档
  - `PROJECT.md`
  - `MEMBERS.md`
  - `RULES.md`
  - `MEMORY.md`
  - `SKILLS.md`
  - `ENV.md`
  - `TASKS.md`
- 尝试给飞书群挂上“项目文档 / 任务看板”标签页

### 5.2 飞书消息接入与路由

系统支持两种接入模式：

- webhook
- websocket

消息进入系统后会做这些事：

- 事件去重
- 解析消息文本与 mentions
- 区分群聊/私聊
- 群未初始化时进入 bootstrap 引导
- 已初始化群进入 manager runtime
- 私聊模式先要求选择项目，再进入交互
- 落库为 `MessageSource`

### 5.3 群级 manager runtime

系统当前的正式 agent 角色只有一个：

- `manager`

每个飞书群只维护一个 manager session，关键特征：

- 有持久化 `GroupAgentSession`
- 有 Redis 锁，避免并发串话
- 有群内运行时任务队列 `GroupRuntimeTask`
- 有 runtime 状态与事件沉淀
- 有 memory summary / session state / summary policy

### 5.4 manager 决策与执行

一条消息进入 manager 后，大致分两步：

1. 先做 manager decision
   - 决定追问
   - 决定要求确认
   - 决定直接执行
2. 如果执行，则创建 `AgentRun`
   - 入 `AGENT_RUN_QUEUE`
   - 后续由 worker 执行和同步产物

群策略会影响决策结果，例如：

- `mentionOnly`
- `allowedSkillsJson`
- `highRiskActionsRequireConfirmation`

### 5.5 仓库镜像与工作区

每个环境可配置 repo：

- `repoUrl`
- `repoBranch`
- `repoCredentialRef`
- `repoAccessMode`

当前 repo 能力是“镜像同步到本地工作目录”，不是直接远程在线编辑。主要能力：

- clone/fetch 仓库
- 切换到目标分支
- reset 到远端 head
- clean 未跟踪文件
- 记录 mirror path / head ref / sync status / sync error

这部分由 `RepoSyncService` 负责，是 runtime 能不能安全读代码的重要前置。

### 5.6 产物沉淀

agent 输出会被结构化为 `Artifact`，目前主要类型：

- `document`
- `task`
- `file`
- `execution_log`
- `summary`

系统支持：

- 查询项目产物
- 查询单个产物
- 重试同步某个产物
- 重试同步某次 run 的产物

### 5.7 确认机制

当 manager 判断某些动作风险较高时，会走确认流：

- 创建 `ConfirmationRequest`
- 发飞书卡片或确认入口
- 用户确认/拒绝
- runtime 恢复执行

典型高风险场景包括：

- 环境切换
- 任务板写入
- 需要明确确认的 skill 执行

### 5.8 成员画像与群策略治理

当前系统已经把“治理能力”从纯 prompt 约束推进到显式数据模型：

- `ProjectMemberProfile`
  - 群成员 openId、显示名、角色、职责、权限、是否可分配任务等
- `GroupPolicy`
  - 群是否启用、默认环境、允许 skills、是否只响应 @、是否允许自动任务创建等

这说明项目已经不再只是“消息进来就跑一下 agent”，而是在做正式的 runtime 治理。

### 5.9 管理控制台

系统已经有一套偏运维/治理视角的后台接口和页面：

- `GET /admin/console`
  - 控制台页面
- `GET /api/admin/robot-instances`
  - 查看所有机器人实例
- `GET /api/admin/robot-instances/:chatId`
  - 查看单实例概要
- `GET /api/admin/robot-instances/:chatId/runtime`
  - 查看 runtime 快照、任务、事件
- `GET /api/admin/robot-instances/:chatId/logs`
  - 查看消息、run、artifact、confirmation、runtime event 日志
- `GET/PATCH /api/admin/robot-instances/:chatId/policy`
  - 查看/修改群策略
- `GET/PATCH /api/admin/robot-instances/:chatId/members...`
  - 查看/同步/编辑成员画像

这部分已经是当前项目最实用的“观测与治理入口”。

### 5.10 定时 digest

系统支持 daily/weekly digest 调度与生成，核心特征：

- 根据 summary policy 决定是否开启
- 支持时区配置
- 支持 daily status / weekly report draft
- 产出目标可以是：
  - `internal_digest`
  - `group_message`
  - `feishu_doc`

digest 说明项目已经具备“主动总结”而不是仅被动响应。

## 6. 当前主要接口速记

### 项目与环境

- `POST /api/projects/init-from-chat`
- `GET /api/projects/by-chat/:chatId`
- `POST /api/projects/by-chat/:chatId/unbind`
- `POST /api/projects/by-chat/:chatId/cleanup`
- `GET /api/projects/:id`
- `PATCH /api/projects/:id`
- `POST /api/projects/:id/archive`
- `POST /api/projects/:projectId/environments`
- `GET /api/projects/:projectId/environments`
- `GET /api/environments/:id`
- `PATCH /api/environments/:id`
- `POST /api/environments/:id/repo-sync`
- `POST /api/environments/:id/set-default`

### Agent 与 runtime

- `POST /api/agent-runs`
- `GET /api/agent-runs/:id`
- `POST /api/agent-runs/:id/cancel`
- `POST /api/agent-runs/:id/retry-sync`
- `GET /api/group-runtime-sessions/:chatId`
- `GET /api/group-runtime-sessions/:chatId/tasks`

### 飞书与确认

- `POST /webhooks/feishu/events`
- `POST /internal/confirmations/:id/confirm`
- `POST /internal/confirmations/:id/reject`

### 产物与控制台

- `GET /api/projects/:projectId/artifacts`
- `GET /api/artifacts/:id`
- `POST /api/artifacts/:id/retry-sync`
- `GET /admin/console`
- `GET /api/admin/...`
- `GET /api/dev/project-binding-tool`
- `GET /api/dev/monitor`

## 7. 当前 skills 体系

仓库内置了一批本地 skills，路径在 `pi-skills/`：

- `requirement-analysis`
- `task-breakdown`
- `code-analysis`
- `document-generate`
- `meeting-minutes`
- `weekly-report`
- `progress-summary`
- `project-init`
- `environment-switch`

这些 skills 说明 agent 的目标并不只是写代码，而是覆盖项目管理闭环中的“理解、拆解、推进、总结、沉淀”。

## 8. 当前队列体系

在 `src/app.module.ts` / `src/worker.module.ts` 中注册的关键队列有：

- `FEISHU_EVENT_QUEUE`
- `AGENT_RUN_QUEUE`
- `ARTIFACT_SYNC_QUEUE`
- `CLEANUP_QUEUE`
- `PROJECT_DIGEST_QUEUE`
- `REPO_SYNC_QUEUE`

可以把它们理解为：

- 飞书输入队列
- agent 执行队列
- 产物落地队列
- 清理回收队列
- 主动摘要队列
- 仓库镜像同步队列

## 9. 对这个项目的正确心智模型

后续继续开发时，尽量用下面这套心智模型理解仓库：

1. 先把它看成“群级 manager runtime”
   - 不是简单 webhook 转发器
2. 再把它看成“项目治理平台”
   - 不只是 agent 调用器
3. 最后再把 Pi Mono 当作一个执行内核
   - 而不是整个系统本身

换句话说：

- 飞书是协作入口
- Project/Environment 是治理主对象
- GroupSession/RuntimeTask 是运行时骨架
- Pi Mono 是决策/执行引擎之一
- Admin 是观测与治理面
- Repo sync / artifact / digest 是闭环补全组件

## 10. 当前明确边界

项目已经做了很多，但当前边界也很清楚：

- 只有一个正式 agent role：`manager`
- 主交互面还是飞书群，不是 Web chat UI
- repo 同步是镜像式工作区，不是在线 IDE
- 强调群级串行与治理，不强调多 agent 并行自治
- 允许确认与人工干预，不追求全自动高权限执行

## 11. 后续开发时的优先阅读文件

如果以后只想快速恢复上下文，优先看这些文件：

- `docs/project_memory.md`
- `prisma/schema.prisma`
- `src/app.module.ts`
- `src/worker.module.ts`
- `src/modules/feishu/feishu-event.service.ts`
- `src/modules/agent/agent.service.ts`
- `src/modules/agent/group-runtime.service.ts`
- `src/modules/agent/group-agent-session.service.ts`
- `src/modules/project/project.service.ts`
- `src/modules/admin/admin.service.ts`
- `src/modules/repo/repo-sync.service.ts`
- `src/modules/digest/project-digest.service.ts`

## 12. 维护约定

以后只要发生以下变化，就应该同步更新本文档：

- 模块职责发生明显变化
- 新增/删除关键数据模型
- manager runtime 行为改变
- 群策略、成员治理、repo 同步、digest 策略有结构性变化
- 新增第二个正式 agent role
- 管理控制台主能力变化

建议把本文档当作“仓库级长期记忆索引”，侧重稳定事实，不记录短期任务细节。
