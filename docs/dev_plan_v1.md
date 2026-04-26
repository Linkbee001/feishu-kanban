# 飞书项目协同开发助手 V1 开发计划

## 1. 文档信息

**文档名称**：飞书项目协同开发助手 V1 开发计划  
**文档版本**：V1.0  
**文档状态**：开发实施版  
**编写日期**：2026-04-22  
**输入文档**：`docs/prd_v1.md`  
**适用范围**：MVP 到 V1 上线  
**主要读者**：后端开发、飞书集成开发、pi mono/gstack 对接开发、测试、产品、实施与运维人员

---

## 2. 项目背景与目标

### 2.1 背景

团队已经以飞书群作为项目沟通主场，但项目讨论、文档沉淀、任务拆解、智能体执行、代码环境和执行记录之间仍然割裂。V1 的目标是在不额外建设复杂前台的前提下，把飞书群、飞书文档、多维表格、项目环境、pi mono 和 gstack 串成一个项目协同闭环。

本项目坚持三个核心判断：

1. **群即项目**：一个正式项目默认绑定一个飞书群，用户在哪个群中 @机器人，就进入哪个项目上下文。
2. **沉淀优先**：机器人回复不是终点，文档、任务、文件和执行记录的自动归档才是核心价值。
3. **环境是一级对象**：pi mono 智能体运行在云端，任何涉及代码仓、模型、skill 和日志的动作都必须落在明确的项目环境中。

### 2.2 V1 建设目标

V1 要交付一个可真实使用的最小闭环：

* 用户在飞书项目群中初始化项目空间。
* 系统自动绑定项目、文档目录、多维表格和默认项目环境。
* 用户在群内 @机器人发起需求分析、文档生成、任务拆解、进展查询和代码分析。
* 后端识别项目、环境和意图，必要时调用 pi mono。
* pi mono 进入项目环境，在项目文件夹中调用 gstack skill。
* gstack 产出的文档、任务和文件经 pi mono 返回后，由后端统一同步到飞书文档、多维表格和文件空间。
* 所有写入对象都能追溯到来源群、来源消息、来源用户、来源环境和智能体执行记录。

### 2.3 成功标准

* 项目负责人能在飞书群内完成项目初始化。
* 群内对话能稳定定位到正确项目和默认环境。
* gstack 生成的文档能通过后端同步为飞书文档。
* gstack 生成的任务能通过后端写入飞书多维表格。
* 涉及环境执行的机器人回复能明确展示当前环境、代码仓和分支。
* 关键写入动作具备确认机制、幂等处理和执行记录。

---

## 3. MVP 范围与非范围

### 3.1 V1 必做范围

**项目空间能力**

* 飞书群邀请机器人后可初始化项目。
* 一个飞书群默认绑定一个正式项目。
* 自动创建或绑定项目文档目录。
* 自动创建或绑定项目任务多维表格。
* 自动创建默认项目环境。

**飞书协同能力**

* 支持群内 @机器人消息。
* 支持私聊机器人，但私聊不自动绑定最近项目。
* 支持飞书消息卡片确认。
* 支持向群内返回摘要、链接、当前环境和执行状态。

**沉淀能力**

* 文档型输出同步到飞书文档。
* 任务型输出写入飞书多维表格。
* 文件型输出上传到飞书文件空间或文档目录。
* 执行过程记录到后端，并在群内可查询摘要。

**环境和智能体能力**

* 项目至少一个默认环境。
* 环境记录代码仓地址、默认分支、pi mono 环境标识、模型配置和 gstack skill 配置。
* 后端通过 pi mono 发起智能体执行。
* pi mono 在项目文件夹中调用 gstack。
* gstack 输出经 pi mono 返回，后端统一沉淀到飞书。

**安全与追溯能力**

* 飞书事件签名校验。
* 事件去重和幂等处理。
* 覆盖正式文档、批量写任务、跨项目写入、环境切换等动作需确认。
* 所有产物记录来源群、来源用户、来源消息、来源环境和执行记录。

### 3.2 V1 不做范围

* 不做自动代码提交。
* 不做自动创建 PR。
* 不做自动发布上线。
* 不做复杂多智能体自治协作。
* 不做完整 DevOps 平台。
* 不做复杂项目管理前端，只提供必要管理 API 和轻量运维入口。
* 不做复杂多租户计费和团队级模板市场。

---

## 4. 总体架构

### 4.1 架构原则

* **飞书是主界面**：用户主要通过飞书群、飞书文档和多维表格完成协同。
* **后端是编排中心**：项目上下文、飞书资产、确认机制、幂等、追溯和同步逻辑全部由后端统一管理。
* **pi mono 是执行宿主**：云端智能体运行、项目文件夹访问、模型调用和 gstack 调度都由 pi mono 承担。
* **gstack 是研发 skill 能力层**：gstack 不管理飞书项目，也不直接同步飞书；它负责执行需求分析、技术方案、任务拆解、代码分析等研发能力。
* **沉淀由后端统一完成**：所有 gstack 产物必须经 pi mono 返回后，由后端写入飞书文档、多维表格或文件空间。

### 4.2 系统架构图

```text
飞书用户 / 项目群 / 私聊
        |
        v
飞书开放平台事件与机器人消息
        |
        v
NestJS 协同后端
  |-- ProjectModule        项目与群绑定
  |-- EnvironmentModule    项目环境管理
  |-- FeishuModule         飞书文档/多维表格/文件/消息
  |-- AgentModule          pi mono 适配与执行记录
  |-- ArtifactModule       文档/任务/文件沉淀
  |-- ConfirmationModule   写入前确认
  |
  |-- PostgreSQL           业务数据与追溯记录
  |-- Redis + BullMQ       异步队列、事件去重、状态轮询
        |
        v
pi mono 云端智能体执行宿主
        |
        v
项目环境 / 项目文件夹 / 代码仓
        |
        v
gstack skill 能力层
        |
        v
文档 / 任务 / 文件 / 日志产物
        |
        v
pi mono 返回后端
        |
        v
飞书文档 / 多维表格 / 文件空间 / 群消息
```

### 4.3 关键数据流

1. 飞书事件进入后端。
2. 后端校验事件、去重，并记录来源消息。
3. 后端通过飞书群 ID 定位项目。
4. 后端选择项目默认环境，或使用当前会话显式切换后的环境。
5. 后端判断是否需要确认；若需要，则发送确认卡片并暂停执行。
6. 后端创建 `agent_run`，调用 pi mono。
7. pi mono 在项目环境中调用 gstack skill。
8. gstack 生成结构化产物。
9. pi mono 将产物返回后端。
10. 后端按产物类型同步到飞书文档、多维表格和文件空间。
11. 后端记录 `artifact`，并向群内发送摘要和链接。

---

## 5. 核心角色与系统边界

| 对象 | 职责 | 不负责 |
| --- | --- | --- |
| 飞书用户 | 在群内发起需求、确认写入、查看结果 | 不直接选择底层执行节点 |
| 飞书群 | 项目协同入口和默认项目上下文 | 不承载复杂项目配置逻辑 |
| 飞书文档 | 承载 PRD、方案、纪要、周报等正式文档 | 不负责智能体执行 |
| 飞书多维表格 | 承载任务、状态、负责人、截止时间和关联链接 | 不负责意图识别 |
| NestJS 后端 | 项目编排、飞书集成、确认、同步、追溯、pi mono 调用 | 不直接运行 gstack |
| pi mono | 云端智能体运行宿主、环境隔离、模型调用、gstack 调度 | 不直接决定飞书项目上下文 |
| gstack | 研发 skill 能力层，生成文档、任务、代码分析等产物 | 不直接接飞书，不管理项目绑定 |
| PostgreSQL | 持久化项目、环境、执行、产物、确认记录 | 不承载短期队列状态 |
| Redis/BullMQ | 异步任务、事件去重、轮询和延迟任务 | 不作为核心业务最终存储 |

---

## 6. gstack 与 pi mono 的职责分工

### 6.1 gstack 是什么

gstack 是研发流程能力包，也就是 skill 执行层。它把研发协作中的专业动作封装为可复用能力，例如：

* 需求分析
* PRD 生成
* 技术方案生成
* 任务拆解
* 代码仓结构分析
* 改造建议
* 实施步骤生成
* 测试建议
* 发布说明
* 周报、复盘和会议纪要生成

gstack 的核心价值是“做什么研发动作，以及怎样标准化产出结果”。它不是飞书机器人，不负责飞书权限，不负责群项目绑定，也不负责把结果写回飞书。

### 6.2 pi mono 是什么

pi mono 是云端智能体执行宿主。它负责“在哪里执行、以什么环境执行、怎样调用模型和 skill”。在本项目中，pi mono 负责：

* 接收后端发起的执行请求。
* 进入指定项目环境。
* 访问项目文件夹或代码仓。
* 调度模型调用。
* 在项目文件夹中调用 gstack skill。
* 收集 gstack 输出的文档、任务、文件、日志和执行状态。
* 将执行结果返回给后端。

### 6.3 两者结合方式

V1 的确定链路如下：

```text
后端 -> pi mono -> 项目环境/项目文件夹 -> gstack skill -> pi mono -> 后端 -> 飞书
```

更具体地说：

1. 后端根据飞书群 ID 找到项目。
2. 后端根据项目找到默认环境。
3. 后端创建 `agent_run`。
4. 后端调用 pi mono 的执行接口，传入项目、环境、来源消息、用户意图、推荐 skill 和输出约束。
5. pi mono 切换到该项目环境，并进入项目文件夹。
6. pi mono 调用 gstack skill。
7. gstack 生成文档、任务、文件或日志产物。
8. pi mono 收集产物并返回后端。
9. 后端按产物类型同步到飞书。

### 6.4 V1 调用约定

V1 默认将 gstack 视为 pi mono 内部的 `GstackRunner`。实现上优先按 CLI/进程调用设计，接口上保留 SDK/API 替换空间。

pi mono 返回给后端的产物需要被适配为统一的 `AgentOutput`：

```ts
type AgentOutputType = 'document' | 'task' | 'file' | 'log' | 'summary';

interface AgentOutput {
  type: AgentOutputType;
  title: string;
  content?: string;
  contentFormat?: 'markdown' | 'json' | 'text';
  filePath?: string;
  mimeType?: string;
  tasks?: AgentTaskOutput[];
  metadata?: Record<string, unknown>;
}

interface AgentTaskOutput {
  title: string;
  description?: string;
  taskType?: 'feature' | 'bug' | 'risk' | 'todo' | 'release' | 'test';
  priority?: 'P0' | 'P1' | 'P2' | 'P3';
  assigneeHint?: string;
  dueDateHint?: string;
  aiSuggestion?: string;
}
```

如果 pi mono 已有真实协议，后端的 `PiMonoAdapter` 负责把真实协议映射成以上内部模型。

### 6.5 必须避免的误解

* gstack 不直接接飞书。
* gstack 不决定当前项目。
* gstack 不负责飞书文档、多维表格或文件上传。
* 后端不直接在本机执行 gstack。
* pi mono 不是单纯模型代理，它是云端环境和智能体执行宿主。
* 飞书写入统一由后端完成，这样才能保证权限、确认、幂等和追溯一致。

---

## 7. 技术选型

### 7.1 后端

* 语言：TypeScript
* 框架：Node.js + NestJS
* ORM：Prisma
* 数据库：PostgreSQL
* 缓存与队列：Redis + BullMQ
* 飞书 SDK：优先使用官方 Node SDK 或封装 HTTP Client
* 日志：Pino 或 NestJS Logger + JSON 结构化日志
* 配置：`.env` + NestJS ConfigModule
* 测试：Jest + Supertest

### 7.2 外部系统

* 飞书开放平台：自建应用机器人、事件订阅、消息卡片、云文档、多维表格、文件上传。
* pi mono：云端智能体执行宿主，通过后端 adapter 调用。
* gstack：运行在 pi mono 管理的项目环境中，通过 skill 执行研发动作。

### 7.3 部署依赖

* Node.js 20 LTS
* PostgreSQL 15+
* Redis 7+
* Docker/Docker Compose
* 可公网访问的 HTTPS 回调地址，用于飞书事件订阅

---

## 8. 模块拆分

### 8.1 NestJS 模块

| 模块 | 主要职责 |
| --- | --- |
| `AppModule` | 应用入口、全局配置、日志、中间件 |
| `ProjectModule` | 项目创建、群绑定、项目查询、项目状态 |
| `EnvironmentModule` | 项目环境创建、默认环境、环境切换、环境状态 |
| `FeishuModule` | 飞书事件、机器人消息、文档、多维表格、文件 API |
| `AgentModule` | pi mono adapter、执行创建、状态查询、结果拉取 |
| `ArtifactModule` | 文档、任务、文件、执行记录沉淀 |
| `ConfirmationModule` | 写入前确认、消息卡片、确认状态机 |
| `ConversationModule` | 群聊/私聊上下文、临时项目与环境上下文 |
| `AdminModule` | 运维查询、配置修正、执行记录排障 |
| `AuthModule` | 管理接口鉴权、飞书用户身份映射 |

### 8.2 代码目录建议

```text
src/
  app.module.ts
  config/
  common/
    errors/
    logging/
    idempotency/
  modules/
    project/
    environment/
    feishu/
    agent/
    artifact/
    confirmation/
    conversation/
    admin/
    auth/
  queues/
  prisma/
test/
```

---

## 9. 数据模型

### 9.1 `projects`

项目主表。一个正式项目默认绑定一个飞书群。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | uuid | 项目 ID |
| `name` | varchar | 项目名称 |
| `description` | text | 项目说明 |
| `owner_open_id` | varchar | 项目负责人飞书 open_id |
| `feishu_chat_id` | varchar unique | 绑定飞书群 ID |
| `status` | enum | `initializing`、`active`、`paused`、`completed`、`closed` |
| `doc_folder_token` | varchar | 飞书文档目录 token |
| `bitable_app_token` | varchar | 飞书多维表格 app token |
| `bitable_table_id` | varchar | 任务表 table ID |
| `default_environment_id` | uuid nullable | 默认环境 ID |
| `default_skill_set` | jsonb | 默认 gstack skill 配置 |
| `created_by` | varchar | 创建人 open_id |
| `created_at` | timestamptz | 创建时间 |
| `updated_at` | timestamptz | 更新时间 |

### 9.2 `project_environments`

项目环境表。环境是 pi mono 执行上下文和代码上下文的产品对象。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | uuid | 环境 ID |
| `project_id` | uuid | 所属项目 |
| `name` | varchar | 环境名称，如 `默认主环境`、`前端环境` |
| `type` | enum | `default`、`temporary`、`module` |
| `pi_mono_env_id` | varchar | pi mono 环境标识 |
| `repo_url` | text | 代码仓地址 |
| `repo_branch` | varchar | 默认分支 |
| `repo_access_mode` | enum | `readonly`、`write_protected` |
| `project_path` | text | pi mono 内项目文件夹路径 |
| `model_endpoint` | text | 模型地址 |
| `model_name` | varchar | 默认模型 |
| `skill_set` | jsonb | gstack skill 配置 |
| `output_dir` | text | 产物输出目录 |
| `log_uri` | text | 日志位置 |
| `status` | enum | `creating`、`active`、`disabled`、`error` |
| `created_by` | varchar | 创建人 |
| `created_at` | timestamptz | 创建时间 |
| `last_active_at` | timestamptz | 最近活跃时间 |

### 9.3 `message_sources`

来源消息表，用于全链路追溯。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | uuid | 来源 ID |
| `project_id` | uuid nullable | 关联项目 |
| `environment_id` | uuid nullable | 关联环境 |
| `source_type` | enum | `group`、`private` |
| `feishu_event_id` | varchar | 飞书事件 ID |
| `feishu_chat_id` | varchar | 群或私聊 ID |
| `feishu_message_id` | varchar | 消息 ID |
| `sender_open_id` | varchar | 发送人 |
| `raw_text` | text | 原始文本 |
| `received_at` | timestamptz | 接收时间 |
| `trace_id` | varchar | 链路追踪 ID |

### 9.4 `agent_runs`

智能体执行记录表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | uuid | 后端执行 ID |
| `project_id` | uuid | 项目 ID |
| `environment_id` | uuid | 环境 ID |
| `message_source_id` | uuid | 来源消息 |
| `pi_mono_run_id` | varchar nullable | pi mono 执行 ID |
| `intent` | varchar | 用户意图 |
| `skill_name` | varchar nullable | 推荐或实际执行的 gstack skill |
| `prompt` | text | 发给 pi mono 的任务说明 |
| `status` | enum | `queued`、`running`、`syncing`、`succeeded`、`failed`、`canceled`、`timeout` |
| `progress` | int | 进度百分比 |
| `output_summary` | text | 结果摘要 |
| `error_code` | varchar nullable | 错误码 |
| `error_message` | text nullable | 错误信息 |
| `started_at` | timestamptz nullable | 开始时间 |
| `finished_at` | timestamptz nullable | 结束时间 |
| `created_at` | timestamptz | 创建时间 |

### 9.5 `artifacts`

沉淀产物表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | uuid | 产物 ID |
| `project_id` | uuid | 项目 ID |
| `environment_id` | uuid nullable | 来源环境 |
| `agent_run_id` | uuid nullable | 来源执行 |
| `message_source_id` | uuid nullable | 来源消息 |
| `type` | enum | `document`、`task`、`file`、`execution_log`、`summary` |
| `title` | varchar | 产物标题 |
| `status` | enum | `pending`、`synced`、`failed`、`skipped` |
| `feishu_url` | text nullable | 飞书链接 |
| `feishu_token` | varchar nullable | 飞书 token |
| `bitable_record_id` | varchar nullable | 多维表格记录 ID |
| `file_key` | varchar nullable | 飞书文件 key |
| `content_hash` | varchar nullable | 内容 hash，支持幂等 |
| `metadata` | jsonb | 扩展信息 |
| `created_at` | timestamptz | 创建时间 |

### 9.6 `confirmation_requests`

写入前确认表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | uuid | 确认请求 ID |
| `project_id` | uuid nullable | 项目 ID |
| `environment_id` | uuid nullable | 环境 ID |
| `message_source_id` | uuid | 来源消息 |
| `action_type` | varchar | 动作类型 |
| `payload` | jsonb | 待执行动作参数 |
| `status` | enum | `pending`、`confirmed`、`rejected`、`expired` |
| `card_message_id` | varchar nullable | 飞书确认卡片消息 ID |
| `confirmed_by` | varchar nullable | 确认人 |
| `expires_at` | timestamptz | 过期时间 |
| `decided_at` | timestamptz nullable | 决策时间 |

### 9.7 `conversation_contexts`

会话上下文表，用于私聊临时项目和群内临时环境切换。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | uuid | 上下文 ID |
| `source_type` | enum | `group`、`private` |
| `feishu_chat_id` | varchar | 会话 ID |
| `user_open_id` | varchar nullable | 私聊用户或群内操作者 |
| `project_id` | uuid nullable | 当前临时项目 |
| `environment_id` | uuid nullable | 当前临时环境 |
| `expires_at` | timestamptz | 过期时间 |
| `updated_at` | timestamptz | 更新时间 |

### 9.8 `feishu_event_dedup`

飞书事件去重表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `event_id` | varchar primary key | 飞书事件 ID |
| `message_id` | varchar nullable | 消息 ID |
| `handled_at` | timestamptz | 处理时间 |
| `trace_id` | varchar | 链路追踪 ID |

---

## 10. 飞书集成设计

### 10.1 应用形态

V1 使用飞书自建应用机器人。

需要启用：

* 机器人入群能力。
* 群消息接收。
* 私聊消息接收。
* 消息卡片交互。
* 云文档创建、编辑、读取。
* 多维表格创建、字段管理、记录写入。
* 文件上传。

### 10.2 事件入口

后端提供统一飞书事件入口：

```text
POST /webhooks/feishu/events
```

处理内容：

* 飞书 URL verification。
* 事件签名校验。
* 事件解密，若应用启用加密。
* 事件去重。
* 入队异步处理。

V1 重点处理事件：

* 机器人被邀请入群。
* 群内 @机器人消息。
* 私聊机器人消息。
* 消息卡片按钮点击。

### 10.3 机器人回复规范

机器人在群内回复必须包含：

* 当前项目名称。
* 当前环境名称。
* 若涉及代码分析，展示代码仓和分支。
* 执行摘要。
* 已沉淀产物链接。
* 执行记录 ID。

低打扰规则：

* 长内容不直接刷屏，优先生成文档并返回摘要和链接。
* 长时间执行先返回“已开始处理”，再通过后续消息更新结果。
* 错误信息面向用户时要简洁，详细错误进入执行记录。

### 10.4 文档沉淀规则

文档型产物默认写入项目文档目录。推荐目录结构：

```text
01_项目基础资料
02_需求文档
03_技术方案
04_会议纪要
05_任务输出
06_发布记录
07_复盘资料
```

文档命名：

```text
{日期}_{文档类型}_{标题}
```

示例：

```text
2026-04-22_技术方案_支付模块改造方案
```

覆盖正式文档前必须走确认请求。默认策略是新建文档，不覆盖已有文档。

### 10.5 任务表字段

V1 自动创建任务多维表格时，至少包含以下字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| 任务ID | 文本 | 后端生成 |
| 项目名称 | 文本 | 项目名称 |
| 任务标题 | 文本 | 必填 |
| 任务描述 | 多行文本 | 任务详情 |
| 任务类型 | 单选 | 研发任务、缺陷、风险、优化、发布、测试 |
| 优先级 | 单选 | P0、P1、P2、P3 |
| 状态 | 单选 | 待确认、待处理、处理中、待验收、已完成、已关闭、已搁置 |
| 负责人 | 人员 | 可为空 |
| 截止日期 | 日期 | 可为空 |
| AI建议 | 多行文本 | gstack 生成 |
| 待确认项 | 多行文本 | 不明确字段 |
| 来源群 | 文本 | 飞书群 ID 或名称 |
| 来源消息 | 文本 | 飞书消息 ID |
| 来源环境 | 文本 | 环境名称 |
| 来源执行 | 文本 | agent_run ID |
| 关联文档 | URL | 文档链接 |
| 关联附件 | URL | 文件链接 |
| 更新时间 | 日期时间 | 更新时间 |

批量写入任务前默认需要确认。确认通过后，任务默认写入“待确认”状态。

### 10.6 文件沉淀规则

文件型产物上传到项目文件空间或文档目录，并生成 `artifact` 记录。

支持类型：

* Markdown
* docx
* pdf
* xlsx
* 图片
* 压缩包
* 脚本文件
* 导出产物

文件命名：

```text
{日期}_{产物类型}_{标题}_{agentRunId短码}.{ext}
```

---

## 11. 智能体执行链路

### 11.1 意图分类

后端收到消息后先做轻量意图分类：

* `project_init`：项目初始化。
* `document_generate`：生成文档。
* `task_breakdown`：拆解任务。
* `progress_query`：查询进展。
* `environment_query`：查看当前环境。
* `environment_switch`：切换环境。
* `code_analysis`：基于项目环境分析代码。
* `general_chat`：普通问答。

不涉及 pi mono 的意图可由后端直接处理，例如当前环境查询、项目绑定查询、执行记录查询。

涉及研发 skill 或代码上下文的意图必须调用 pi mono，再由 pi mono 调用 gstack。

### 11.2 创建执行

执行输入至少包含：

```ts
interface StartAgentRunInput {
  projectId: string;
  environmentId: string;
  sourceMessageId: string;
  userOpenId: string;
  intent: string;
  prompt: string;
  suggestedSkill?: string;
  outputContract: {
    allowDocument: boolean;
    allowTask: boolean;
    allowFile: boolean;
    requireSourceTrace: boolean;
  };
}
```

### 11.3 pi mono 请求

后端的 `PiMonoAdapter` 对外提供统一接口：

```ts
interface PiMonoAdapter {
  startRun(input: StartAgentRunInput): Promise<{ piMonoRunId: string }>;
  getRunStatus(piMonoRunId: string): Promise<PiMonoRunStatus>;
  fetchOutputs(piMonoRunId: string): Promise<AgentOutput[]>;
  cancelRun(piMonoRunId: string): Promise<void>;
}
```

V1 可以采用轮询方式获取 pi mono 状态。若 pi mono 支持 webhook，后续可切换为回调模式。

### 11.4 输出处理

后端收到 `AgentOutput[]` 后按类型处理：

* `document`：创建飞书文档，写入 Markdown/文本内容，记录 `artifact`。
* `task`：写入飞书多维表格，记录每条任务的 `artifact`。
* `file`：上传飞书文件，记录 `artifact`。
* `summary`：用于机器人群内摘要。
* `log`：记录执行日志摘要，不直接刷屏。

### 11.5 异常处理

* pi mono 创建执行失败：群内提示执行未启动，并记录失败 `agent_run`。
* pi mono 执行超时：标记 `timeout`，提示用户可稍后查询。
* gstack 输出格式不合法：标记产物同步失败，保留原始输出摘要。
* 飞书写入失败：`artifact` 标记 `failed`，进入重试队列。
* 部分产物成功、部分失败：群内返回成功链接和失败摘要，执行状态可为 `succeeded_with_warnings`，数据库可用 `metadata.warning` 标识。

---

## 12. 核心业务流程

### 12.1 项目群初始化

1. 项目负责人创建飞书群并邀请机器人。
2. 机器人检测到入群事件，提示输入初始化指令。
3. 用户发送“初始化项目”并提供项目名称、负责人、说明。
4. 后端检查该群是否已绑定项目。
5. 若未绑定，创建 `project`。
6. 后端创建飞书文档目录。
7. 后端创建任务多维表格及默认字段。
8. 后端创建默认项目环境。
9. 后端保存群、文档、表格、环境绑定关系。
10. 机器人在群内返回初始化结果。

### 12.2 群内文档生成

1. 用户在项目群中 @机器人：“帮我根据上面的讨论生成 PRD”。
2. 后端通过群 ID 定位项目。
3. 后端选择默认环境。
4. 后端创建 `message_source`。
5. 后端识别意图为 `document_generate`。
6. 后端创建 `agent_run` 并调用 pi mono。
7. pi mono 在项目环境中调用 gstack 文档生成 skill。
8. gstack 生成 Markdown 文档。
9. pi mono 返回文档型 `AgentOutput`。
10. 后端创建飞书文档并写入内容。
11. 后端记录 `artifact`。
12. 机器人返回文档摘要和链接。

### 12.3 群内任务拆解

1. 用户要求“根据这份方案拆任务”。
2. 后端定位项目和环境。
3. 后端判断为批量写入任务，创建确认请求。
4. 用户点击确认卡片。
5. 后端调用 pi mono。
6. pi mono 调用 gstack 任务拆解 skill。
7. gstack 返回任务列表。
8. 后端写入飞书多维表格，默认状态为“待确认”。
9. 后端记录每条任务产物。
10. 机器人返回写入数量、任务表链接和执行记录。

### 12.4 基于代码环境的分析

1. 用户在项目群中说：“基于当前项目代码分析支付模块，生成改造方案”。
2. 后端定位项目默认环境。
3. 机器人先提示当前环境、代码仓、分支。
4. 后端创建 `agent_run`。
5. 后端请求 pi mono 在该环境执行。
6. pi mono 进入项目文件夹。
7. pi mono 调用 gstack 代码分析或技术方案 skill。
8. gstack 分析仓库结构并生成改造方案。
9. pi mono 返回文档、摘要和可能的任务建议。
10. 后端将方案同步为飞书文档；任务建议若批量写入需确认。
11. 机器人返回方案链接、摘要和来源环境。

### 12.5 项目进展查询

1. 用户问“当前项目进展如何？”。
2. 后端定位项目。
3. 后端读取任务表缓存或飞书多维表格。
4. 后端读取近期 `artifacts`、`agent_runs` 和最新文档记录。
5. 后端汇总任务状态、阻塞项、待确认项、近期文档和环境执行摘要。
6. 机器人在群内返回简短总结。
7. 如果用户要求正式周报，再调用 pi mono/gstack 生成周报文档。

### 12.6 环境切换

1. 用户输入“切换到前端环境”。
2. 后端检查该项目下是否存在对应环境。
3. 切换环境属于关键动作，发送确认卡片。
4. 用户确认后，后端写入 `conversation_contexts`。
5. 后续当前群会话在上下文过期前使用该环境。
6. 机器人提示当前环境、代码仓和分支。

### 12.7 私聊模式

1. 用户私聊机器人提出项目相关请求。
2. 后端不默认使用最近项目。
3. 若请求涉及项目操作，机器人要求用户选择项目。
4. 用户选择后，后端保存临时私聊上下文。
5. 私聊中涉及正式写入时必须再次确认项目和写入动作。

---

## 13. API 与事件接口

### 13.1 飞书事件接口

```text
POST /webhooks/feishu/events
```

职责：

* URL verification。
* 签名校验。
* 事件解密。
* 事件去重。
* 入队 `feishu-event.queue`。

### 13.2 项目 API

```text
POST /api/projects/init-from-chat
GET  /api/projects/:id
GET  /api/projects/by-chat/:chatId
PATCH /api/projects/:id
POST /api/projects/:id/archive
```

这些 API 主要用于内部编排和轻量后台，不作为普通用户主入口。

### 13.3 环境 API

```text
POST /api/projects/:projectId/environments
GET  /api/projects/:projectId/environments
GET  /api/environments/:id
PATCH /api/environments/:id
POST /api/environments/:id/set-default
```

### 13.4 执行 API

```text
POST /api/agent-runs
GET  /api/agent-runs/:id
POST /api/agent-runs/:id/cancel
POST /api/agent-runs/:id/retry-sync
```

### 13.5 产物 API

```text
GET /api/projects/:projectId/artifacts
GET /api/artifacts/:id
POST /api/artifacts/:id/retry-sync
```

### 13.6 确认 API

飞书卡片回调统一进入飞书事件入口，内部路由到：

```text
POST /internal/confirmations/:id/confirm
POST /internal/confirmations/:id/reject
```

不直接暴露给公网普通调用。

---

## 14. 异步任务与状态机

### 14.1 队列设计

| 队列 | 职责 |
| --- | --- |
| `feishu-event.queue` | 飞书事件异步处理 |
| `agent-run.queue` | 创建和推进 pi mono 执行 |
| `agent-status-poll.queue` | 轮询 pi mono 状态 |
| `artifact-sync.queue` | 文档、任务、文件同步到飞书 |
| `notification.queue` | 机器人进度和结果通知 |
| `cleanup.queue` | 确认过期、临时上下文清理 |

### 14.2 `agent_runs` 状态机

```text
queued -> running -> syncing -> succeeded
                         |-> failed
                         |-> timeout
running -> canceled
queued  -> canceled
```

状态说明：

* `queued`：后端已创建执行，尚未开始 pi mono 执行。
* `running`：pi mono 已开始执行。
* `syncing`：pi mono 执行完成，后端正在同步产物到飞书。
* `succeeded`：执行和产物同步完成。
* `failed`：执行或同步失败。
* `timeout`：超过 V1 设置的最大执行时间。
* `canceled`：用户或管理员取消。

### 14.3 `confirmation_requests` 状态机

```text
pending -> confirmed
pending -> rejected
pending -> expired
```

确认请求默认 30 分钟过期。过期后用户需重新发起操作。

### 14.4 `artifacts` 状态机

```text
pending -> synced
pending -> failed
pending -> skipped
failed  -> synced
```

`failed -> synced` 通过重试实现。

---

## 15. 权限、安全、幂等与追溯

### 15.1 飞书安全

* 所有飞书回调必须做签名校验。
* 开启事件加密时必须解密后再处理。
* `tenant_access_token` 统一由 `FeishuModule` 管理并缓存。
* 飞书应用密钥不得写入代码仓，必须通过环境变量或密钥系统注入。

### 15.2 用户权限

V1 最小权限规则：

* 项目初始化者默认为项目负责人。
* 群成员可发起普通查询和生成请求。
* 覆盖文档、批量写任务、环境切换、跨项目写入需要项目负责人或管理员确认。
* 管理后台接口需要管理员鉴权。

### 15.3 环境安全

* V1 的代码仓访问默认只读或写保护。
* V1 不允许自动提交代码、创建 PR 或上线。
* pi mono 执行时必须绑定明确 `environmentId`。
* 所有代码相关回复必须展示当前环境、仓库和分支。

### 15.4 幂等策略

* 飞书事件按 `event_id` 去重。
* 飞书消息按 `message_id + action_type` 防止重复触发。
* 文档和文件产物按 `content_hash` 防止重复写入。
* 多维表格任务写入记录 `agent_run_id` 和任务标题 hash，避免重试产生重复任务。
* 确认卡片按钮点击只允许第一个有效决策生效。

### 15.5 追溯策略

每条文档、任务、文件、执行记录都必须保存：

* 来源群。
* 来源用户。
* 来源消息。
* 来源时间。
* 来源项目。
* 来源环境。
* 来源 agent_run。
* 飞书最终链接或记录 ID。

---

## 16. 测试计划

### 16.1 单元测试

* 群 ID 到项目的定位规则。
* 私聊不默认绑定项目规则。
* 默认环境选择规则。
* 环境切换上下文过期规则。
* 写入前确认状态机。
* 飞书事件去重。
* `AgentOutput` 到飞书文档、任务、文件的映射。
* pi mono adapter 错误映射。

### 16.2 集成测试

* 飞书事件 URL verification。
* 飞书签名校验。
* 群内 @机器人消息入队。
* 消息卡片确认回调。
* 飞书文档创建和内容写入。
* 多维表格字段创建和记录写入。
* 文件上传。
* pi mono mock 执行成功、失败、超时、取消。
* artifact 同步失败后的重试。

### 16.3 端到端测试

必须覆盖以下场景：

1. 建群邀请机器人，完成项目初始化。
2. 群内生成 PRD，并沉淀为飞书文档。
3. 群内拆解任务，经确认后写入多维表格。
4. 基于默认环境触发代码分析，pi mono 调用 gstack，生成方案文档并同步飞书。
5. 查询当前项目进展，返回任务状态、最新文档和环境执行摘要。
6. 切换环境，经确认后后续执行使用新环境。
7. 私聊机器人时，涉及项目操作必须先选择项目。

### 16.4 验收标准

* 所有 MVP 场景可在飞书真实群内完成。
* 任一产物都能从飞书链接追溯到后端 `artifact`，再追溯到 `agent_run` 和来源消息。
* pi mono/gstack 执行失败时不会产生错误飞书写入。
* 飞书事件重复投递不会产生重复任务或重复文档。
* 批量任务写入和环境切换必须经过确认。

---

## 17. 部署计划

### 17.1 服务组成

V1 部署以下服务：

* `api`：NestJS HTTP 服务，接收飞书回调和管理 API。
* `worker`：BullMQ worker，处理事件、执行、同步和通知。
* `postgres`：业务数据库。
* `redis`：队列、缓存和去重。

### 17.2 环境变量

至少需要：

```text
NODE_ENV=
PORT=
DATABASE_URL=
REDIS_URL=

FEISHU_APP_ID=
FEISHU_APP_SECRET=
FEISHU_VERIFICATION_TOKEN=
FEISHU_ENCRYPT_KEY=

PI_MONO_BASE_URL=
PI_MONO_API_KEY=
PI_MONO_CALLBACK_SECRET=

ADMIN_JWT_SECRET=
PUBLIC_BASE_URL=
```

### 17.3 部署步骤

1. 准备 PostgreSQL 和 Redis。
2. 配置飞书自建应用权限和事件订阅地址。
3. 配置环境变量。
4. 执行数据库迁移。
5. 启动 `api` 和 `worker`。
6. 在飞书开放平台完成 URL verification。
7. 创建测试群，邀请机器人进行冒烟测试。

### 17.4 监控与日志

V1 至少记录：

* 飞书事件接收量、失败量和去重次数。
* pi mono 执行成功率、失败率、超时率。
* 飞书文档、多维表格、文件同步成功率。
* 队列积压数量。
* agent_run 平均耗时。
* artifact 同步失败明细。

---

## 18. 里程碑与排期

### 第 1 周：工程基础与数据模型

* 初始化 NestJS 项目。
* 接入 PostgreSQL、Prisma、Redis、BullMQ。
* 建立项目、环境、消息来源、执行、产物、确认请求核心表。
* 完成基础日志、配置和错误处理。

### 第 2 周：飞书机器人与项目初始化

* 完成飞书事件入口、签名校验、事件去重。
* 支持机器人入群和群内 @消息。
* 完成群绑定项目流程。
* 完成文档目录和任务表创建。
* 完成初始化结果群内回复。

### 第 3 周：文档、任务、文件沉淀

* 完成飞书文档创建和内容写入。
* 完成多维表格字段创建和任务写入。
* 完成文件上传。
* 完成 artifact 记录和同步重试。
* 完成批量任务确认卡片。

### 第 4 周：pi mono 与 gstack 执行链路

* 实现 `PiMonoAdapter`。
* 接入 pi mono 执行创建、状态轮询、输出获取。
* 明确 gstack 输出到 `AgentOutput` 的映射。
* 完成代码分析场景：pi mono 进入项目文件夹并调用 gstack。
* 完成 gstack 文档产物同步飞书文档。

### 第 5 周：项目进展查询与环境管理

* 完成默认环境创建和查看。
* 完成环境切换确认和会话上下文。
* 完成项目进展查询。
* 完成私聊选择项目流程。
* 完成执行记录查询和群内摘要展示。

### 第 6 周：联调、测试与上线准备

* 完成端到端测试。
* 完成错误处理、重试、超时和幂等加固。
* 完成部署脚本和环境文档。
* 完成飞书权限检查。
* 完成 UAT 和 V1 上线验收。

---

## 19. 风险与待确认事项

### 19.1 主要风险

| 风险 | 影响 | 应对 |
| --- | --- | --- |
| 飞书文档/多维表格权限不足 | 无法完成自动沉淀 | 提前创建自建应用并做权限冒烟测试 |
| pi mono 接口未稳定 | 执行链路延期 | 后端以 `PiMonoAdapter` 隔离真实协议 |
| gstack 输出不结构化 | 后端难以稳定同步 | 约定 `AgentOutput` 映射，必要时由 pi mono 做输出适配 |
| 长任务执行超时 | 用户体验差 | 先返回执行开始消息，后台轮询后再通知 |
| 飞书事件重复投递 | 重复文档或任务 | 使用事件去重和产物 hash 幂等 |
| 代码环境权限过大 | 安全风险 | V1 默认只读/写保护，不做代码提交 |
| 多环境上下文混淆 | 误操作 | 所有代码相关回复展示环境、仓库、分支 |

### 19.2 待确认事项

* pi mono 的真实执行接口、鉴权方式、状态查询方式和输出格式。
* pi mono 调用 gstack 的最终方式：CLI、SDK 或内部 API。
* gstack skill 名称与参数规范。
* 飞书文档写入格式是否直接支持 Markdown 转换，或需要后端转换为飞书文档块。
* 多维表格人员字段是否需要 open_id 到人员字段的映射。
* 项目文档目录是创建在应用空间，还是由用户提供父目录。
* 文件空间具体使用飞书云空间、文档附件，还是项目文档目录。

---

## 20. V1 验收清单

上线前必须逐项确认：

* 可以在新飞书群中邀请机器人并初始化项目。
* 项目初始化后能看到文档目录、任务表和默认环境。
* 群内 @机器人能定位正确项目。
* 私聊机器人不会自动使用最近项目。
* 文档型输出能同步为飞书文档并返回链接。
* 任务型输出能经确认后写入多维表格。
* 文件型输出能上传并返回链接。
* 代码分析请求会通过 pi mono 进入项目环境，并调用 gstack。
* gstack 生成的文档能经 pi mono 返回后同步到飞书文档。
* 群内回复能展示当前环境、代码仓、分支和执行记录 ID。
* 飞书事件重复投递不会重复写入产物。
* 覆盖文档、批量任务、环境切换、跨项目写入都有确认。
* 任一飞书产物都能追溯到来源消息、来源用户、来源环境和 agent_run。

---

## 21. 后续版本方向

### V2：规则增强版

* 更多 gstack skill 模板。
* 文档模板化。
* 更完整的任务状态机。
* 更完整的环境配置能力。
* 产物审核和人工编辑流程。

### V3：协同增强版

* 多环境协作。
* 自动风险识别。
* 周报自动生成。
* 项目管理视图增强。
* 团队级知识沉淀。

### V4：平台化版本

* 多项目统一管理。
* 模板市场。
* 环境模板。
* 团队级标准流程沉淀。
* 更细粒度权限体系。

