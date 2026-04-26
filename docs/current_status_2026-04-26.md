# 当前状态快照 2026-04-26

## 1. 背景

这份文档用于记录截至 2026-04-26 的实际落地状态，方便后续继续推进 `docs/construction_plan_v2.md` 和 `docs/pimono_multi_agent_session_plan.md`。

本次阶段的核心目标是：

- 把旧的单次执行器模型收口成正式的群级 session 架构
- 清理旧的内存初始化状态和旧 busy 判断
- 提供可用于测试、观察和资源回收的内部监控台
- 验证飞书群消息 -> 后端 -> PiMono -> 产物链路

## 2. 已完成内容

### 2.1 群级 session 架构

已完成以下重构：

- 新增 `group_agent_sessions` 持久化模型，作为群级正式会话真相源
- 群初始化草稿已从 `FeishuEventService` 的内存状态迁入正式 session 状态
- `conversation_contexts` 已收缩为私聊临时项目/环境选择，不再承载群正式会话
- 引入 Redis 群级锁，替换原先混合 busy 判断
- `GroupAgentSessionAdapter` / `GroupAgentSessionService` 已成为群会话统一入口
- `FeishuEventService` 已改成消息标准化、群路由、确认卡入口和回复发送，不再持有群初始化内存状态

### 2.2 Agent 执行链路

已完成以下改造：

- 群消息执行已统一通过 `AgentService.submitGroupMessage(...)`
- run、message、artifact、confirmation 的数据链路已打通
- PiMono 侧仍通过 `PiMonoAdapter` 接入，但外层业务已按 session 语义组织

### 2.3 资源清理与解绑

已完成以下资源回收能力：

- `解绑当前群` 会清理群标签并断开群与项目绑定
- `清理群关联资源` 会尝试清理：
  - 群标签
  - 项目文档目录
  - 多维表 table
  - 多维表 app
- 项目记录中已落库：
  - `docChatTabId`
  - `bitableChatTabId`
  用于更可靠地清理群标签
- 手动 `按资源 ID 清理` 已支持：
  - `folder`
  - `bitable`
  - `bitableTable`

### 2.4 监控台

内部监控台已完成一轮重设计，目标是服务测试与回收场景。

当前能力包括：

- 查看活动群 session、历史 disabled session、Redis 锁
- 查看最近 run、最近消息、artifact、confirmation
- 查看当前项目资源与群标签绑定
- 执行 `查询群绑定 / Seed / 正式初始化 / 解绑 / 清理 / 按资源 ID 清理`
- 顶部指标已补充说明文案
- `运行中` 指标已改为更准确的 `未收尾 Run`
- `disabled` session 已不再算作当前活动会话
- 左侧按钮区已改成线性测试流程：
  - Step 1 建立测试现场
  - Step 2 检查是否适合继续测试
  - Step 3 项目级回收
  - Step 4 手动按资源 ID 回收

## 3. 当前验证结果

### 3.1 后端基础状态

当前 API / worker / 数据库迁移 / Redis 都已可正常启动。

本地验证已通过：

- `npm test`
- `npm run build`

Docker 环境也已能正常启动 API 和 worker。

### 3.2 飞书事件接入

最初 Docker 环境跑的是 `webhook` 模式，但 `PUBLIC_BASE_URL=http://localhost:3000` 对飞书服务器不可达，导致群消息无反应。

随后已切换为长连接模式：

- `FEISHU_EVENT_MODE=ws`

当前长连接模式验证结果：

- worker 已成功启动 Feishu WebSocket client
- 飞书群消息已成功进入系统
- 监控台可以看到最近消息记录

结论：

- 事件接入层当前已经打通
- “群里发消息机器人没反应”的问题不再是飞书接入问题

## 4. 当前主要阻塞点

### 4.1 PiMono 仍是 CLI fallback，不是 SDK 直连

这是当前最重要的事实。

虽然整体架构已经按正式群 session 设计收口，但真正调用 PiMono 执行 agent 的这一层，仍然是：

- `PiMonoAdapter` 通过 `spawn(...)` 启动本地 Pi CLI
- 命令形态本质上还是 `pi --mode rpc ...`

也就是说：

- 飞书接入、群 session、Redis 锁、监控台都已经是新的架构
- 但执行内核仍是 CLI fallback

这与原本 V1.5 阶段允许的过渡策略一致，但现在已经暴露出明显边界问题。

### 4.2 真实运行失败原因

当前群消息已经可以进入 run，但最新失败原因不是飞书，也不是 worker 队列，而是 Pi CLI 的 session 兼容问题。

日志中已确认的关键错误：

```text
No session found matching 'chat:oc_...:manager'
```

监控台上的表现为：

```text
pi exited with code=1 signal=
```

根因分析：

- 业务层已经把 `runtime_session_key` 正式化为 `chat:{feishuChatId}:manager`
- 但 Pi CLI 对 `--session` 的处理并不是“按逻辑 key 自动创建正式 session”
- 它会把传入值当成 session 文件路径，或历史 session 查找关键字
- 所以直接传 `chat:...:manager` 会被解释成“查找已有 session”
- 找不到就直接退出

### 4.3 已做的修正

为解决 CLI 对 session key 的误解，已经在 `PiMonoAdapter` 中补了一层映射：

- 继续保留业务上的 `runtime_session_key`
- 但传给 Pi CLI 的，不再是逻辑 key 本身
- 而是稳定映射后的 session 文件路径，例如：
  - `PI_MONO_AGENT_DIR/sessions/managed/chat_oc_xxx_manager.jsonl`

这样做的目的，是让 Pi CLI 把它当成“会话文件路径”而不是“历史 session 模糊检索关键字”。

这个修复已提交到代码，但截至本快照生成时，还没有完成一轮新的 Docker 端到端复测结论确认。

## 5. 当前结论

截至 2026-04-26，系统状态可以总结为：

### 5.1 已经打通的部分

- 飞书长连接收消息
- 群级 session 建模
- Redis 串行锁
- run / message / artifact / confirmation 的数据追踪
- 资源解绑与清理
- 测试监控台

### 5.2 还没有真正收口的部分

- PiMono 执行内核仍然依赖 CLI fallback
- 还没有切换到 PiMono SDK 直连
- 因此 session 语义仍然受到 CLI 会话实现限制

### 5.3 当前真实阶段判断

可以认为当前系统已经完成：

- V1.5 的大部分外层架构重构

但尚未完成：

- PiMono 集成层的最终收口

换句话说：

- “平台层”已经接近目标态
- “执行层”还处在兼容态

## 6. 推荐下一步

### 6.1 近期优先级

建议按以下顺序继续推进：

1. 先验证最新的 session 文件路径修复是否能让 CLI fallback 继续工作
2. 如果修复后仍然不稳定，不建议继续在 CLI 兼容层投入过多时间
3. 直接进入 `PiMonoAdapter` 的 SDK 化改造

### 6.2 建议的收口方向

建议把下一阶段目标明确为：

- 保留现有群 session 架构
- 保留 Redis 锁
- 保留监控台与资源回收能力
- 重写 `PiMonoAdapter`
- 把 `createRun / getRun / cancelRun / runPrompt` 从 CLI 实现改成 SDK 实现
- 将 CLI 路径降级为可选 fallback，或在 SDK 稳定后直接删除

### 6.3 不建议继续投入的方向

当前不建议继续做大量 CLI 特性兼容工作，例如：

- 持续围绕 CLI session 规则补特殊映射
- 围绕 CLI 参数语义做复杂适配
- 把 CLI 会话模型强行当成正式 runtime session 模型

原因是这类工作会继续放大过渡层复杂度，不利于最终架构收口。

## 7. 与规划文档的偏差说明

相对于 `docs/pimono_multi_agent_session_plan.md` 的目标态，当前偏差主要有一条：

- 规划目标是逐步转向 PiMono SDK session
- 当前实际仍在使用 Pi CLI fallback

其余外层设计方向基本一致，包括：

- 群级正式 session
- `group_agent_sessions` 持久化建模
- Redis 群锁
- bootstrap / active 模式
- `manager` 作为当前唯一正式角色
- 监控、清理、追踪和审计能力

## 8. 相关代码位置

当前状态涉及的主要文件：

- `src/modules/agent/group-agent-session.service.ts`
- `src/modules/agent/agent.service.ts`
- `src/modules/agent/pi-mono.adapter.ts`
- `src/modules/feishu/feishu-event.service.ts`
- `src/modules/project/project.service.ts`
- `src/modules/feishu/feishu.service.ts`
- `src/modules/dev/dev.service.ts`
- `src/modules/dev/project-binding-tool.page.ts`
- `prisma/schema.prisma`

## 9. 一句话结论

当前系统已经完成“群 session 平台层”的重构，并且飞书长连接收消息已经打通；当前剩余的核心问题，不在飞书，不在 Redis，不在监控台，而在于 PiMono 仍通过 CLI fallback 接入，尚未完成 SDK 化收口。
