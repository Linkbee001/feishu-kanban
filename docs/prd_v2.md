# 飞书群项目管理员机器人 PRD V2

## 1. 文档信息

- 文档名称：飞书群项目管理员机器人 PRD V2
- 文档状态：草案
- 编写日期：2026-04-28
- 适用范围：当前 `feishu-kanban` 仓库下一阶段产品与研发规划
- 关联文档：
  - `docs/prd_v1.md`
  - `docs/pimono_multi_agent_session_plan.md`
  - `docs/manager_agent_proactive_summary_design.md`

---

## 2. 为什么要重写 PRD

`PRD V1` 已经明确了总体方向：以飞书群为项目空间，以文档和多维表格为沉淀载体，以 Pi Mono 为执行底座。

但当前代码已经不再处于“纯概念设计”阶段，而是已经落下了一套可运行的骨架：

- 飞书事件接入与去重
- 群与项目绑定
- 群级 manager 会话
- Pi Mono skill 加载与结构化输出
- 文档 / 多维表格 / 群回复写回
- 群内 runtime todo 持久化
- confirmation 恢复执行
- digest 基础能力

因此，新的 PRD 不能继续按“从零设计产品”的写法展开，而必须围绕以下问题重写：

1. 当前代码已经实现了什么
2. 哪些关键能力还缺失
3. 产品形态应该怎样从现有能力自然演进
4. 后台控制台应该如何服务“群项目管理员机器人”而不是通用聊天机器人

本 PRD 的目标是：基于现有代码真实状态，规划下一阶段完整的产品收口方案。

---

## 3. 产品定义

### 3.1 产品定位

本产品不是通用 AI 助手，也不是单纯的飞书聊天机器人。

本产品的定位是：

`面向飞书群的项目管理员机器人系统`

它由两部分组成：

- 飞书群内的项目管理员机器人
- 用于配置、治理、观察、排障的后台控制台

### 3.2 核心价值

系统需要帮助团队在飞书群内完成以下闭环：

- 初始化项目与环境
- 持续跟进群内 `@` 消息
- 结合群上下文、项目文档、任务板和环境执行 skill
- 持续维护机器人自己的待办队列
- 将正式任务同步到群公共任务板
- 通过后台让管理员清楚看到机器人当前状态、能力边界和异常点

### 3.3 产品边界

当前阶段不解决以下问题：

- 多机器人自治协作平台
- 替代完整研发管理平台
- 替代 CI/CD 或完整 DevOps 平台
- 面向个人的跨渠道 omnichannel 助手
- 开放式高权限自动代码提交系统

---

## 4. 基于当前代码的现状基线

本节是本 PRD 与 `PRD V1` 最大的不同：所有目标都建立在已实现代码之上。

### 4.1 已实现的主干能力

#### A. 飞书群接入与项目初始化骨架

当前代码已具备：

- 飞书 webhook 事件接入与去重
- 基于群消息判断项目是否已初始化
- 在群未初始化时进入 bootstrap 流程
- 创建项目、文档目录、多维表格、默认环境

对应模块：

- `src/modules/feishu/feishu-event.service.ts`
- `src/modules/project/project.service.ts`
- `src/modules/feishu/feishu.service.ts`

#### B. 群级 manager 会话与 runtime

当前代码已具备：

- 群级会话注册对象 `group_agent_sessions`
- 群级串行执行
- 群级 manager runtime
- 群消息持久化为 `message_sources`
- 仅 `@bot` 的群消息进入 runtime

对应模块：

- `src/modules/agent/group-agent-session.service.ts`
- `src/modules/agent/group-runtime.service.ts`
- `src/modules/feishu/feishu-event.service.ts`

#### C. Pi Mono 执行与技能装载

当前代码已具备：

- Pi Mono 运行时接入
- 项目管理相关 skills 的本地装载
- 结构化输出与动作回收

对应模块：

- `src/modules/agent/pi-mono.adapter.ts`
- `src/modules/agent/pi-skill-mapping.ts`

#### D. 正式产物沉淀

当前代码已具备：

- 文档写回
- 多维表格写回
- 群回复
- 产物与审计记录

对应模块：

- `src/modules/artifact/artifact.service.ts`
- `src/modules/feishu/feishu.service.ts`
- `prisma/schema.prisma` 中的 `artifacts` / `agent_runs`

#### E. 机器人内部待办

当前代码已具备：

- 群级持久化待办 `group_runtime_tasks`
- confirmation 中断与恢复
- 单群串行执行主循环

对应模块：

- `src/modules/agent/group-runtime-task.service.ts`
- `src/modules/agent/group-runtime.service.ts`
- `src/modules/confirmation/confirmation.service.ts`

#### F. digest 能力基础

当前代码已具备：

- digest processor
- 项目上下文装配器
- 面向主动总结的基础设计方向

对应模块：

- `src/modules/digest/project-digest.service.ts`
- `src/modules/digest/project-context-assembler.service.ts`

### 4.2 当前代码与目标之间的关键偏差

#### 偏差 1：缺少“群成员画像”正式模型

当前初始化只采集：

- 项目名
- 项目描述
- 仓库地址
- 分支
- 模型信息

但没有采集、存储和维护群成员角色与职责。

影响：

- 机器人不知道群里“谁负责什么”
- 无法做真正的成员待办分配
- 无法做确认权限分层

#### 偏差 2：缺少“群策略”层

当前群是否工作，主要由：

- 是否初始化
- 是否 `@bot`

来决定。

但缺少正式配置：

- 群是否启用
- 是否只允许 `@`
- 哪些 skill 可用
- 哪些操作可自动执行
- 默认环境是什么
- 是否归档只读

#### 偏差 3：交互态上下文仍然偏弱

当前 `ProjectRuntimeContextService` 在交互态主要注入数据库快照，默认并不会把：

- 文档目录摘要
- 文档正文摘要
- 多维表格摘要
- 群成员画像

统一打包进每一次 runtime。

影响：

- 群内响应更依赖临时工具调用
- 机器人对项目状态的整体感知不稳定

#### 偏差 4：内部待办机制仍偏 prompt 驱动

虽然当前已有 `group_runtime_tasks`，但核心规则仍不够后端化：

- 何时创建待办
- 何时更新待办
- 如何去重
- 如何续跑
- 如何强约束同时只允许一个 running task

仍主要靠 prompt 约束。

#### 偏差 5：公共任务板还是“弱结构 append”

当前多维表格已能创建任务记录，但仍存在：

- 字段类型弱
- 负责人只是文本提示
- 状态流转不完整
- 缺少 record 更新机制
- 更像“写入结果”，而不是“维护任务板”

#### 偏差 6：后台控制面尚未产品化

当前系统已有大量后台能力骨架，但还没有形成面向管理员的控制台，导致：

- 机器人运行状态不可见
- 待办队列不可见
- 群成员与权限不可配
- skill 启停不可配
- 环境安全边界不可配

---

## 5. 新 PRD 的核心判断

### 5.1 机器人是“群项目管理员”，不是聊天接口

产品核心对象不是一段聊天记录，而是一个“绑定到飞书群和项目的机器人实例”。

### 5.2 后台不是通用 AI 设置页，而是控制台

后台服务的是：

- 配置
- 运行状态观察
- 风险控制
- 人工干预
- 项目治理

### 5.3 飞书群仍然是主工作面

后台不替代飞书群，只负责：

- 管理机器人
- 查看状态
- 调整规则
- 排查异常

### 5.4 先做“单 manager 角色做深”，而不是多 agent 做广

当前代码已经围绕 `manager` 打好了主干，因此下一阶段仍坚持：

- 一个群一个正式 manager
- 把管理能力做深做稳
- skill 和 wake mode 可扩展
- 暂不引入复杂多 agent 协作前台

---

## 6. 目标产品结构

### 6.1 产品总结构

下一阶段产品由三层组成：

1. 飞书群协作层
2. 机器人运行层
3. 后台控制台层

### 6.2 飞书群协作层

用户在飞书群里完成：

- 发起需求
- `@机器人`
- 补充上下文
- 确认高风险操作
- 获取进展与结果

### 6.3 机器人运行层

机器人负责：

- 识别当前项目与环境
- 读取上下文
- 选择 skill
- 执行任务
- 维护内部待办
- 写回正式产物

### 6.4 后台控制台层

后台负责：

- 配置机器人实例
- 配置群成员与角色
- 配置 skill 与工具权限
- 查看运行时状态与日志
- 维护公共任务板同步规则
- 人工恢复、暂停、重试

---

## 7. 核心对象模型

下一阶段产品围绕以下对象展开：

1. 机器人实例
2. 群
3. 项目
4. 群成员画像
5. 群策略
6. 环境
7. 技能
8. AI 内部待办
9. 公共任务
10. 审计与确认

---

## 8. 功能方案

### 8.1 机器人实例管理

#### 定义

一个飞书群项目管理员机器人实例，代表“某个飞书群下的正式 manager”。

#### 后台要展示的核心字段

- 机器人名称
- 所属群
- 所属项目
- 初始化状态
- 当前运行状态
- 当前环境
- 最近活跃时间
- 是否阻塞
- 是否待确认

#### 建议状态

- `未初始化`
- `初始化中`
- `运行中`
- `等待确认`
- `阻塞中`
- `异常`
- `已归档`

### 8.2 群初始化流程升级

#### 当前已有

- 群绑定项目
- 创建文档目录
- 创建多维表格
- 创建默认环境

#### 新目标

初始化要一次性补足 5 类信息：

1. 项目信息
2. 环境信息
3. 群成员信息
4. 群策略信息
5. 工作空间基础文档

#### 新流程

1. 用户在群里首次 `@机器人`
2. 若项目未初始化，进入 bootstrap
3. 收集项目与环境基础信息
4. 拉取群成员并生成初始成员画像
5. 创建项目资源
6. 创建机器人实例默认群策略
7. 创建工作空间文档骨架
8. 初始化完成后自动续跑原始需求

### 8.3 群成员与角色管理

#### 新增产品能力

系统要支持正式管理群成员画像。

#### 成员画像最小字段

- `openId`
- `displayName`
- `groupNickname`
- `projectRole`
- `responsibility`
- `permissionLevel`
- `isDecisionMaker`
- `isTaskAssignable`
- `lastActiveAt`

#### 业务作用

- 帮助机器人理解群内职责分工
- 支持公共任务负责人映射
- 支持确认权限控制
- 支持风险升级时的通知对象选择

### 8.4 群策略管理

#### 新增产品能力

每个机器人实例都要有一份正式群策略。

#### 群策略最小字段

- `enabled`
- `mentionOnly`
- `allowedSkills`
- `defaultEnvironmentId`
- `allowAutoTaskCreation`
- `allowTaskBoardWrite`
- `allowDocWrite`
- `highRiskActionsRequireConfirmation`
- `archivedAt`

#### 业务作用

- 将群的运行方式从代码分支转成配置
- 为未来多群类型支持提供边界

### 8.5 项目上下文与工作空间

#### 新目标

将项目长期上下文从“散落的 prompt 输入”升级成“正式治理资产”。

#### 工作空间建议文档

- `PROJECT.md`
- `MEMBERS.md`
- `RULES.md`
- `MEMORY.md`
- `SKILLS.md`
- `ENV.md`
- `TASKS.md`

#### 作用

- 让机器人有长期稳定上下文
- 让管理员能编辑治理层，而不只是改数据库字段
- 为角色 profile 和 standing orders 提供落点

### 8.6 会话与上下文装载升级

#### 当前问题

交互态上下文注入偏弱。

#### 新目标

每次群 runtime 执行前，组装统一的 `ProjectContextBundle`，至少包含：

- 项目基本信息
- 当前环境信息
- 群成员画像摘要
- 公共任务板摘要
- 最近文档摘要
- 最近消息摘要
- 关键工作空间规则

#### 原则

- digest 路径与 interactive 路径尽量共享同一套上下文装配能力
- interactive 允许轻量化，但不能缺失核心治理信息

### 8.7 skill 管理升级

#### 当前问题

skill 能加载，但还没有真正产品化。

#### 新目标

让 skill 成为后台可见、可控、可审计的正式能力单元。

#### skill 页面至少展示

- skill 名称
- 分类
- 描述
- 当前状态
- 默认启用状态
- 是否允许自动触发
- 是否需要确认
- 适用环境范围

#### skill 分类建议

- 初始化类
- 理解类
- 规划类
- 推进类
- 同步类
- 总结类
- 风险类

### 8.8 工具与环境管理升级

#### 当前已有

- 项目环境
- repo 信息
- 模型信息
- repo access mode

#### 新目标

把环境从“连接信息”升级成“权限边界对象”。

#### 建议权限档位

- `只读协作`
- `受控写入`
- `高权限执行`

#### 需要后台配置的内容

- 仓库地址
- 默认分支
- repo access mode
- 模型
- 可用工具
- 写仓库权限
- 写文档权限
- 写多维表格权限
- 是否允许执行命令

### 8.9 AI 内部待办机制升级

#### 当前已有

- `group_runtime_tasks`
- confirmation 恢复
- 群级串行执行

#### 新目标

将 AI 内部待办做成正式运行机制，而不再主要依赖 prompt 约束。

#### 需要明确的规则

- 哪些消息会生成待办
- 哪些消息只更新现有待办
- 如何去重
- 如何从 `queued` 变成 `running`
- 如何进入 `waiting_confirmation`
- 如何自动续跑
- 如何人工恢复

#### 建议状态

- `queued`
- `running`
- `blocked`
- `waiting_confirmation`
- `completed`
- `failed`
- `cancelled`

#### 新要求

- 同一群同一时刻只允许一个 running task
- 后端保证约束，不能只依赖 prompt

### 8.10 公共任务板升级

#### 当前问题

当前多维表格任务还是弱结构。

#### 新目标

将多维表格升级成正式公共任务板。

#### 任务最小字段

- 标题
- 描述
- 状态
- 负责人
- 优先级
- 截止时间
- 来源消息
- 来源文档
- 关联群成员
- 关联 AI 内部待办
- 最近更新时间

#### 核心要求

- 支持成员映射
- 支持状态更新
- 支持去重
- 支持任务更新而不是只 append

### 8.11 安全与确认升级

#### 当前已有

- confirmation request 基础能力

#### 新目标

让安全与确认成为后台可配策略。

#### 后台至少支持配置

- 哪些 skill 自动执行
- 哪些 skill 需要确认
- 哪些成员有确认权限
- 哪些动作必须双重确认
- 哪些群只允许建议不允许直接写入

#### 默认需要确认的动作

- 高权限环境切换
- 写仓库
- 执行命令
- 批量创建正式任务
- 修改关键项目上下文

### 8.12 运行状态与日志

#### 新目标

后台必须能看见机器人现在在做什么。

#### 运行状态最小展示项

- 当前 active run
- 当前 running todo
- queued 数量
- blocked 数量
- waiting confirmation 数量
- 最近 skill
- 最近错误
- 最近写入产物

#### 日志最小展示项

- 消息触发记录
- skill 选择记录
- 工具调用记录
- 待办状态变更
- 确认事件
- 产物写回记录

---

## 9. 后台控制台 PRD

### 9.1 页面定位

后台是“群项目管理员机器人控制台”，不是聊天窗口。

### 9.2 页面结构

参考三栏结构：

- 左栏：机器人实例 / 群项目列表
- 中栏：实例管理菜单
- 右栏：配置详情 / 状态详情 / 工作空间文档

### 9.3 一级菜单建议

- 机器人实例
- 群与项目
- 技能
- 任务
- 环境
- 安全
- 运行状态

### 9.4 单实例菜单建议

- 基本信息
- 群成员与角色
- 项目上下文
- 技能管理
- 工具与环境
- 会话与待办
- 公共任务板
- 安全与确认
- 运行日志
- 工作空间

### 9.5 页面优先级

#### P0

- 机器人实例列表
- 基本信息页
- 群成员与角色页
- 会话与待办页
- 运行日志页

#### P1

- 技能管理页
- 工具与环境页
- 公共任务板页
- 安全与确认页

#### P2

- 工作空间文档编辑页
- 更丰富的状态分析页

---

## 10. 数据模型调整建议

本节只定义产品侧要求，不强制一次性完成所有数据库改造。

### 10.1 建议新增模型

#### `group_policies`

建议新增字段：

- `id`
- `project_id`
- `feishu_chat_id`
- `enabled`
- `mention_only`
- `allowed_skills_json`
- `default_environment_id`
- `allow_auto_task_creation`
- `allow_task_board_write`
- `allow_doc_write`
- `high_risk_actions_require_confirmation`
- `archived_at`
- `created_at`
- `updated_at`

#### `project_member_profiles`

建议新增字段：

- `id`
- `project_id`
- `feishu_chat_id`
- `open_id`
- `display_name`
- `group_nickname`
- `project_role`
- `responsibility`
- `permission_level`
- `is_decision_maker`
- `is_task_assignable`
- `metadata_json`
- `last_active_at`
- `created_at`
- `updated_at`

### 10.2 建议扩展模型

#### `group_runtime_tasks`

建议补：

- `blocked_reason`
- `next_action_hint`
- `priority`
- `trigger_type`

并补强状态定义与唯一运行约束。

#### `artifacts`

建议补：

- 更明确的 `source kind`
- 对公共任务板记录的更新关系

#### `agent_runs`

建议补：

- 实际 `skillName`
- 实际 intent 分类
- 是否写文档
- 是否写表
- 是否触发确认

---

## 11. 实施优先级

### 11.1 第一阶段：把现有骨架收口成正式产品底座

目标：

- 补齐群策略
- 补齐成员画像
- 补齐运行状态聚合
- 补齐初始化自动续跑

交付：

- `group_policies`
- `project_member_profiles`
- 初始化流程增强
- runtime 状态聚合接口

### 11.2 第二阶段：把后台控制台做出来

目标：

- 让管理员能看见和配置机器人

交付：

- 机器人实例列表
- 基本信息页
- 群成员与角色页
- 会话与待办页
- 运行日志页

### 11.3 第三阶段：把待办和任务板做强

目标：

- 让 AI 内部待办与公共任务板真正稳定运行

交付：

- 待办生成规则后端化
- 单 running 约束
- 公共任务板字段升级
- 任务更新与去重

### 11.4 第四阶段：把治理层文档化

目标：

- 让项目上下文和规则长期可维护

交付：

- 工作空间文档体系
- 后台工作空间编辑能力
- 与 runtime 上下文联动

---

## 12. 验收标准

### 12.1 业务验收

满足以下条件视为进入下一阶段可用状态：

1. 新群可以完成完整初始化，并自动续跑原始需求
2. 机器人能识别并维护群成员画像
3. 管理员能在后台看见机器人当前状态和待办队列
4. 群策略可配置并实际生效
5. 公共任务板支持负责人映射和任务更新
6. 高风险动作能根据策略进入确认流

### 12.2 技术验收

至少保证：

1. 同一群同一时刻只允许一个 running task
2. runtime、confirmation、artifact sync、digest 的状态可追踪
3. interactive 与 digest 共享统一的项目上下文装配逻辑
4. 后台核心页面都有稳定的只读查询接口

---

## 13. 一句话总结

`PRD V2` 的核心不是重新发明产品，而是承认当前代码已经有一套可运行骨架，并在此基础上把它收口成一个真正可配置、可治理、可观察的飞书群项目管理员机器人系统。
