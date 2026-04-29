# Manager 混合上下文改造方案
更新时间：2026-04-27

## 1. 方案结论

经过对当前代码、Feishu 官方机器人思路、CNB skill 能力边界的重新分析，新的改造方向收敛为：

- 代码仓库：实时同步到本地，由 manager 直接基于本地 repo 工作
- 飞书资料：按需实时查询，不做默认全量本地同步

这是一套“本地 Repo 同步 + 飞书实时查询”的混合架构。

本方案替代上一版“代码仓库与飞书资料统一全量镜像到本地”的大一统思路。

## 2. 为什么调整方向

### 2.1 当前 manager 天然是本地代码工作流

当前 PiMono runtime 的核心工作方式就是本地文件访问：

- `PiMonoAdapter` 会根据环境确定 `cwd`
- 当前内置工具是只读文件工具：
  - `read`
  - `grep`
  - `find`
  - `ls`

这说明 manager 对代码最自然、最稳定的访问方式仍然是本地 repo，而不是远程按文件查询。

### 2.2 当前飞书资料并不需要先本地化才能分析

Feishu 官方机器人已经验证了一种更轻的思路：

- 实时调用 CLI / API
- 按需拉取文档、表格、聊天等信息
- 会话内临时缓存
- 不做长期同步副本

对于飞书云文档、bitable、项目文件夹这类远程事实源，这种方式更轻、更接近真实数据源，也避免了第一阶段就把同步系统做得很重。

### 2.3 CNB skill 不能直接替代代码本地化

CNB skill 更适合：

- PR / Issue / 评审 / 流水线
- 平台协作操作

但它没有提供我们真正需要的“通用远程仓库文件读取 / 代码搜索 / 仓库树浏览”能力。  
对于代码分析主链，仍然是本地 repo 更稳。

### 2.4 当前系统真正缺的是代码入口稳定性

当前环境虽然有：

- `repoUrl`
- `repoBranch`
- `projectPath`

但 `repoUrl` 只是元数据，不等于 manager 已经能访问仓库内容。  
真正决定 manager 能不能读代码的，仍然是本地目录是否存在且可用。

所以第一优先级应该是把“代码仓库本地入口”做稳定，而不是先做飞书全量镜像。

## 3. 新架构总览

新的上下文访问策略分三层：

### 3.1 运行态摘要层

来源：

- 数据库快照
- `ProjectRuntimeContextService`
- `MessageSource`
- `AgentRun`
- `Artifact`
- `GroupAgentSession`

用途：

- 群消息交互决策
- run 前快速理解最近状态
- 会话记忆补充

### 3.2 代码上下文层

来源：

- 本地托管 repo 镜像

用途：

- 代码阅读
- 代码搜索
- 故障排查
- 方案审查
- 正式执行阶段的代码分析

### 3.3 飞书项目资料层

来源：

- 飞书实时 API / CLI 查询

用途：

- 读取需求文档
- 读取会议纪要
- 读取 bitable 任务状态
- 读取项目文件夹结构

策略：

- 按需查询
- 会话级短缓存
- 不做默认全量持久同步

## 4. 代码仓库改造方案

### 4.1 目标

为每个 `projectId + environmentId` 建立一个稳定的本地托管 repo 镜像，让 manager 永远基于该镜像目录工作，而不是依赖不稳定的人工工作树。

### 4.2 设计原则

- 不直接改用户人工使用的仓库目录
- 系统维护自己的托管镜像目录
- manager 统一从托管镜像读取代码
- 交互前轻量保鲜，执行前强一致保鲜

### 4.3 建议目录

```text
.runtime/repos/{projectId}/{environmentId}/
  repo/
  manifest.json
```

说明：

- `repo/`
  - 托管的 git 仓库镜像目录
- `manifest.json`
  - 最近同步时间、branch、head SHA、错误信息、状态

### 4.4 新增模块

#### `RepoWorkspaceService`

职责：

- 分配本地托管目录
- 返回 `repoRoot`、`manifestPath`
- 确保目录存在

建议接口：

```ts
getRepoWorkspace(projectId: string, environmentId: string): {
  workspaceRoot: string;
  repoRoot: string;
  manifestPath: string;
}
```

#### `RepoSyncService`

职责：

- 初始化本地 repo 镜像
- clone / fetch / checkout 指定 branch
- 记录同步结果

建议接口：

```ts
ensureRepoFresh(input: {
  projectId: string;
  environmentId: string;
  repoUrl?: string | null;
  repoBranch?: string | null;
  force?: boolean;
}): Promise<{
  repoRoot: string;
  headRef?: string | null;
  synced: boolean;
  error?: string | null;
}>
```

#### `RepoSyncQueue` / `RepoSyncProcessor`

职责：

- 同步任务异步化
- 管理重试、并发和错误状态
- 供交互主链和执行主链触发

建议 job：

- `sync-repo`
- `sync-repo-force`

### 4.5 数据字段扩展建议

建议在 `ProjectEnvironment` 上增加：

- `repoMirrorPath`
- `lastRepoSyncAt`
- `repoSyncStatus`
- `repoSyncError`
- `repoHeadRef`

如果不想直接塞进环境表，也可以新增独立的 `RepoMirrorState` 表。

### 4.6 同步触发时机

#### 项目初始化后

- 如果配置了 `repoUrl`
- 自动创建首次本地镜像

#### 环境切换后

- 校验对应环境的本地 repo 是否存在
- 不存在则补建

#### 交互决策前

接入点：

- `AgentService.handleInteractiveGroupMessage(...)`

策略：

- 仅做轻量保鲜
- 如果超出短 TTL，则 `fetch`
- 若失败，不阻断所有交互，但要让 manager 明确知道 repo 不可用

#### 正式执行前

接入点：

- `AgentRunProcessor.process(...)`

策略：

- 强一致保鲜
- 必须在执行前把本地 repo 更新到目标 branch 最新状态

## 5. 飞书资料改造方案

### 5.1 目标

飞书资料先不做默认全量持久同步，而是通过工具化访问按需获取。

### 5.2 设计原则

- 云文档与 bitable 是远程事实源
- 优先使用实时查询
- 只做短缓存，不做大规模本地副本
- 先满足分析与问答，不把系统复杂度拉高

### 5.3 现有能力基础

当前已有：

- `FeishuProjectReader.scanProjectFolder(...)`
- `FeishuProjectReader.readBitableSnapshot(...)`
- 文档原始内容读取能力

这些能力已经足够支撑后续工具化，只是不应当在第一阶段扩展成“全量本地镜像系统”。

### 5.4 后续工具层方向

建议后续补一层 manager 可调用的 Feishu tools：

- `list_project_folder`
- `read_project_doc`
- `search_project_docs`
- `read_project_bitable`
- `list_recent_project_artifacts`

策略：

- manager 需要时再查
- 结果进入本轮会话缓存
- digest 也可以复用同一套查询能力

## 6. 对 manager 的实际影响

### 6.1 交互主链

交互阶段继续使用运行态数据库快照作为轻量上下文，但增加“代码可用性保障”：

- 进入 `runManagerDecision(...)` 前检查 repo 是否新鲜
- repo 可用时，manager 能在本地目录中直接读代码
- 飞书资料不预拉全量，必要时通过工具查询

### 6.2 正式执行链

正式执行前：

- 先同步本地 repo
- 再进入 `PiMonoAdapter.executeRun(...)`

这样 manager 在正式分析代码时有更稳定的上下文基础。

### 6.3 Digest 链路

digest 不强制改成本地化：

- 可以继续复用 `FeishuProjectReader`
- 后续再决定是否统一到飞书工具层

## 7. PiMono runtime 接入方式

### 7.1 `cwd` 调整

当前：

- `cwd` 依赖 `environment.projectPath`

改造后：

- 优先使用 `repoMirrorPath`
- 如果托管镜像尚未准备好，再回退到原 `projectPath`

这样可以做到：

- 代码入口稳定
- 不依赖用户手工维护的工作树

### 7.2 prompt 调整方向

prompt 应明确告诉 manager：

- 代码目录是当前本地 repo
- 运行态摘要来自上下文注入
- 飞书资料不是本地全量副本，需要时使用工具查询

这会比上一版“默认本地全量镜像”更贴合真实运行方式。

## 8. skill 策略调整

本阶段不先锁死完整 skill 集，先按上下文依赖拆两类：

### 8.1 依赖本地 repo 的核心能力

- `code-analysis`
- `investigation`
- `review-and-risk`

### 8.2 依赖飞书实时查询的核心能力

- `requirement-analysis`
- `document-generate`
- `task-breakdown`
- `progress-summary`

结论：

- 先把“代码本地化”做稳
- 再决定哪些 skill 必须常驻、哪些可以延后

## 9. 实施阶段

### 阶段 1：本地 repo 托管与同步

- 新增 `RepoWorkspaceService`
- 新增 `RepoSyncService`
- 新增 `RepoSyncQueue`
- 增加 repo 同步状态字段

目标：

- 为每个项目环境建立稳定的本地代码入口

### 阶段 2：manager 执行链接入 repo 保鲜

- `handleInteractiveGroupMessage(...)` 前轻量同步
- `AgentRunProcessor` 前强一致同步
- `PiMonoAdapter` 优先使用 `repoMirrorPath`

目标：

- 让 manager 在交互和执行阶段都可靠地看到最新代码

### 阶段 3：飞书工具层

- 将 `FeishuProjectReader` 能力工具化
- 提供按需查询接口
- 做会话级缓存

目标：

- 满足文档、任务表、项目资料分析，不引入重同步系统

### 阶段 4：skill 收口

- 基于稳定的上下文访问能力
- 再收敛最终必须 skill 集

## 10. 取舍结论

本次分析后的明确取舍如下：

- 不做“代码 + 飞书全量本地镜像”的第一阶段方案
- 代码仓库必须本地化，且应由系统托管同步
- 飞书资料先不做默认持久同步，优先按需实时查询
- manager 的上下文体系收敛为：
  - 运行态：数据库快照
  - 代码：本地 repo
  - 飞书资料：实时工具查询

这条路线更符合当前 PiMono runtime 的能力边界，也更适合分阶段落地。
