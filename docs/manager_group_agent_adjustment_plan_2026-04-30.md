# 群项目管理智能体调整方案 2026-04-30

## 1. 文档目标

本文档用于收敛当前 Feishu 群项目管理智能体的后续演进方向。

本次目标不是继续扩展一套更复杂的 workflow，也不是新建一层新的编排系统，而是基于现有代码结构和 Pi Mono SDK 主链，把系统收敛成一个长期驻留在群里的项目管理智能体。

智能体需要在明确边界内，依赖模型能力自主完成：

- 理解群内需求、决策、问题、进展、风险
- 必要时先做分析、产品需求设计、方案整理、任务拆解
- 判断哪些内容要沉淀为知识文档
- 判断哪些内容要落成正式任务并推动对应角色跟进
- 在群里只给简洁反馈，不把大段分析留在聊天里

## 2. 现有代码主链判断

基于当前代码，群项目管理智能体的真实主链已经基本成型。

关键入口和链路如下：

- 群消息入口在 `src/modules/feishu/feishu-event.service.ts`
- 群运行时主入口在 `src/modules/agent/group-runtime.service.ts`
- 长会话、skills、tools、runtime turn 主脑在 `src/modules/agent/pi-mono.adapter.ts`
- 正式产物同步在 `src/modules/artifact/artifact.service.ts`
- Artifact 异步同步链路在 `src/queues/processors/artifact-sync.processor.ts`

当前群场景的真正主入口是 `GroupRuntimeService.handleMentionMessage()`，而不是 `AgentService.handleInteractiveGroupMessage()`。

因此，后续收敛应明确以 `group runtime` 为中心，`formal execution` 和 `runtime_audit` 只是正式产出链路的一部分，不应再围绕另一套平行 manager 主链进行设计。

## 3. 目标态定义

### 3.1 智能体定位

`manager` 是一个群项目管理员，不是普通聊天助手，也不是后端流程执行器。

它的核心职责是：

- 把群里的需求、决策、问题、进展、风险转化为项目管理结果
- 在需要时先做分析、设计、拆解
- 将稳定结论沉淀为知识文档
- 将待确认、待执行、待分配事项落成正式任务
- 推动责任人和角色继续跟进

### 3.2 正式落点

正式落点只保留两类：

- Feishu 云文档，作为项目知识库
- Feishu 多维表格，作为正式跟进事项板

群消息本身不是正式知识库，`groupRuntimeTask` 也不是正式项目任务真相源。

### 3.3 模型与后端分工

后端负责：

- 会话生命周期
- 工具暴露
- 权限边界
- 确认机制
- 产物同步
- 状态持久化
- 审计与重试

模型负责：

- 理解消息
- 选择是否要分析、设计、拆解
- 判断是否需要正式沉淀
- 选择产出为文档、任务、摘要或组合
- 在边界内自主完成执行

## 4. 上下文模型

群项目管理智能体的默认上下文不应仅来自群聊。

目标态应以三层上下文共同构成：

- 群消息：当前触发信号
- 长会话记忆：近期项目脉络
- 关联项目资源：Feishu 文档文件夹和多维表格

这意味着 manager 不应退化为只看聊天消息的 bot。

### 4.1 保留项目资源理解能力

现有代码已经具备这部分能力，应完整保留：

- 项目绑定资源记录在 `project.docFolderToken`、`project.bitableAppToken`、`project.bitableTableId`
- 文档文件夹扫描和文档读取由 `FeishuProjectReader` 提供
- 多维表格快照读取由 `FeishuProjectReader.readBitableSnapshot()` 提供
- Pi Mono runtime 已经暴露了 `list_project_folder`、`read_project_doc`、`search_project_docs`、`read_project_bitable`、`list_recent_project_artifacts`

### 4.2 调整实现方式

保留能力，但收敛实现方式。

不再把整个项目上下文大包强塞进 prompt，而改成：

- 给 manager 一个轻量资源摘要
- 让 manager 知道项目已绑定哪些资源
- 让 manager 在需要时自己按需读取文档和任务板

这样更符合“智能体自主理解上下文”的目标，也更符合 Pi Mono SDK 的工作方式。

## 5. Prompt 设计原则

## 5.1 稳定层与动态层分离

Prompt 分为两层：

- 稳定层：长期身份、边界、工作方式
- 动态层：当前 turn 事实、群策略、repo 状态、当前消息、等待状态

稳定层不应频繁改动，也不应继续主要来源于数据库自由文本。

### 5.2 稳定层内容

稳定层需要表达的内容只有这些：

- 你是群项目管理员
- 正式知识进入文档
- 正式跟进事项进入多维表格
- 需要时先分析、设计、拆解，再决定最终产物
- 群里只给短反馈
- 内部 runtime todo 只是智能体自己的 scratchpad
- 不臆造未验证事实
- 优先参考项目绑定资源，而不是只依赖群聊

### 5.3 动态层内容

动态层建议只保留：

- 当前 request kind
- 当前项目与环境
- repo 能力状态
- session memory summary
- 当前群策略是否允许写文档或任务板
- 当前群消息
- 当前是否在等待确认或存在待续事项

## 6. Skill 设计原则

本次不建议大规模新增 skill 名称，也不建议再把 manager 设计成技能菜单驱动型助手。

最省改动、最贴现有结构的做法，是保留现有四个核心 skill，并重写其 `SKILL.md` 边界和用途。

建议保留为默认技能：

- `requirement-analysis`
- `document-generate`
- `task-breakdown`
- `progress-summary`

这四个 skill 的目标重新定义如下：

- `requirement-analysis`
  负责需求理解、问题分析、信息缺口识别、产品设计入口

- `document-generate`
  负责把稳定结论、方案说明、会议纪要、项目知识沉淀为文档

- `task-breakdown`
  负责把需求、方案、目标拆成可执行事项，附带责任人建议、优先级、依赖和下一步动作

- `progress-summary`
  负责阶段回顾、状态总结、风险提炼、阶段性沉淀

以下 skill 不再作为 manager 默认技能：

- `meeting-minutes`
- `weekly-report`
- `environment-switch`
- `code-analysis`
- `project-init`

其中 `project-init` 只保留给 bootstrap 场景。

### 6.1 Skill 的写法要求

Skill 文案不应写成死流程脚本，而应写成：

- 适用场景
- 何时读取
- 输出倾向
- 常见错误
- 何时不要用

skill 是模型的思考辅助，不是后端流程步骤。

## 7. 正式产物与沉淀语义

### 7.1 保留 ArtifactService

`ArtifactService` 不应删除。

它已经承担了：

- 正式产物记录
- Feishu 文档写入
- Bitable 写入
- 同步状态跟踪
- 去重
- 失败重试

这些都是有价值的正式提交能力。

### 7.2 调整 ArtifactService 的角色

`ArtifactService` 不应代表“所有模型产出”，而应代表“模型决定正式提交的产出”。

现有链路中，只要模型产出 `document`，就会同步到云文档；只要产出 `task`，就会同步到 Bitable。

这会导致任何 document/task 结果都被视为正式沉淀，语义过重。

应调整为：

- `summary` 与 `reply_group` 用于非正式输出
- `document` 与 `task` 用于候选正式输出
- 是否真正上云，由模型显式表达提交意图，并由后端做边界校验

### 7.3 建议的正式提交控制

不引入新链路，只在现有 `AgentOutput.metadata` 上增加轻量语义。

建议使用以下任一语义：

- `metadata.persist = true | false`
- `metadata.deliveryMode = durable | ephemeral`
- 或结合现有 `targetChannels`

最终落地规则建议为：

- 只有显式要求沉淀到 `feishu_doc` 的 `document` 才写云文档
- 只有显式要求沉淀到 `bitable` 的 `task` 才写多维表格
- 否则只作为本轮输出或本地记录，不自动上云

这样能够保留智能体自主决策，而不必用外部 CLI 重建另一套写入路径。

## 8. 群策略与后端边界

需要保留并强化的结构化业务边界包括：

- `mentionOnly`
- `allowDocWrite`
- `allowTaskBoardWrite`
- `highRiskActionsRequireConfirmation`

这些字段已经存在于 `groupPolicy`，应继续保留并成为 manager 主链的一部分。

需要做到：

- Prompt 明确知道当前群策略是否允许写文档和任务板
- Artifact 正式同步前再做后端兜底检查
- 高风险正式动作仍由 confirmation 机制把关

后端设边界，模型做决策。

## 9. Role Profile 收敛

原来的：

- `agentsMd`
- `soulMd`
- `standingOrdersMd`
- `promptPreludeMd`
- `skillsJson`

当前是数据库配置项，但本次建议退出主舞台。

原因如下：

- 现在产品目标已收敛为单一稳定 `manager`
- 继续把角色文本放数据库会带来行为漂移
- prompt 变化不走代码评审，不利于稳定调优
- 调试和回归时很难定位问题来源

### 9.1 建议方案

保留 `RoleProfileService`，但改成代码内固化 profile。

`RoleProfileService.compile()` 继续存在，只负责：

- 组合固定 manager profile
- 注入当前项目、群、用户等轻量上下文
- 输出 `compiledContextFile`

不再以数据库 profile 文本作为主来源。

### 9.2 配套处理

- 默认 allowlist 改成代码常量
- 下线 `AgentProfileController`
- 后续确认稳定后，再删除 `AgentRoleProfile` 和 `ProjectAgentProfileOverride`

## 10. ProjectRuntimeContextService 的定位调整

`ProjectRuntimeContextService` 当前可以组装很大的 `projectContextBundle`。

本次不建议删除它，但要调整定位。

它后续更适合做：

- digest 任务上下文装配
- admin / 调试汇总
- manager 的轻量资源摘要提供者

不再作为群 manager 每轮主 prompt 的全量上下文载体。

轻量资源摘要建议只包含：

- 是否绑定文档文件夹
- 最近若干文档标题和更新时间
- 是否绑定任务板
- 当前任务板中的待确认、阻塞、进行中数量
- 最近正式产物摘要

## 11. 对现有模块的具体调整建议

### 11.1 `src/modules/agent/group-runtime.service.ts`

保留，不拆。

它继续作为群 manager 唯一主入口。

需要调整的是：

- 更明确把当前 `groupPolicy` 传递给 runtime 主脑
- 不再把 manager 产品定义建立在另一套 interactive group 主链之上

### 11.2 `src/modules/agent/pi-mono.adapter.ts`

这是本次最核心的调整点。

需要完成：

- 收敛 `buildPrompt()` 结构
- 把 manager 明确定义为群项目管理员
- 把项目文档和任务板定义为正式落点
- 明确内部 runtime todo 只是 scratchpad
- 提醒模型优先参考项目资源，而不是只看群消息
- 减少 runtime 术语噪音

同时保留现有：

- Pi Mono session 管理
- ResourceLoader 和 skills 装载
- 自定义工具
- group runtime turn 编排
- runtime audit 输出链

### 11.3 `src/modules/agent/role-profile.service.ts`

保留，不新建模块。

调整方向：

- 去掉对数据库 profile 文本的依赖
- 用代码常量代替默认 manager profile
- 保留 `compile()` 输出能力

### 11.4 `src/modules/project/group-policy.service.ts`

保留。

调整方向：

- 默认技能列表不再从数据库 profile 读取
- 直接使用代码内默认 manager skills
- 继续维护结构化边界字段

### 11.5 `src/modules/artifact/artifact.service.ts`

保留。

调整方向：

- 增加正式提交意图判断
- 增加群策略兜底校验
- 避免任何 `document`/`task` 都无脑自动上云

### 11.6 `src/queues/processors/artifact-sync.processor.ts`

保留。

调整方向：

- 不再默认发送“Execution completed”式的大段群消息
- 群内反馈主要由 `reply_group` 控制
- artifact sync 负责产物同步和状态变更

### 11.7 `src/modules/agent/group-runtime-task.service.ts`

保留。

但定位明确为：

- 智能体内部运行态
- 等待确认和待续事项记录
- runtime turn 状态投影

不再把它视作正式项目任务系统。

## 12. 非目标

本次不做以下事情：

- 不新增新的 workflow 引擎
- 不引入第二套 Feishu CLI 写入主链
- 不把 manager 拆成多个常驻子 agent
- 不新建新的大型 prompt 配置系统
- 不以 projectContextBundle 全量注入作为 manager 未来主方向

## 13. 实施顺序

建议按以下顺序推进：

1. 固化 manager role profile

- 在 `RoleProfileService` 中固化默认 `agentsMd / soul / standing orders / prelude / skills`
- 停用数据库化 profile 的主来源地位

2. 收口默认技能

- 保留四个核心 skill
- 重写四个 `SKILL.md`
- 退出其他默认 skill

3. 调整 Pi Mono manager prompt

- 以群项目管理员身份为中心
- 引入轻量资源感知
- 引入正式落点和内部 scratchpad 的清晰边界

4. 调整正式提交语义

- 在 `ArtifactService` 中引入显式沉淀意图
- 同步前结合群策略做兜底

5. 降低 `projectContextBundle` 主链权重

- 保留其汇总能力
- 把群 manager 的主上下文切回“轻量摘要 + 按需读取”

6. 清理历史配置层

- 停用 `AgentProfileController`
- 稳定后删除相关 profile 表

## 14. 最终判断

这次收敛的目标，不是创造新的架构层，而是在现有主链上完成减法：

- 以 `GroupRuntimeService + PiMonoAdapter` 为主脑
- 以 `ArtifactService` 为正式提交通道
- 以 Feishu 文档和多维表格为正式落点
- 以长会话和项目绑定资源为默认上下文
- 以少量核心 skill 为思考辅助
- 以结构化群策略为边界

最终得到的是一个真正意义上的群项目管理智能体，而不是一套更复杂的后端 workflow。
