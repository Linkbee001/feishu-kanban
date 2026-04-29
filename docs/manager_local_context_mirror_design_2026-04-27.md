# Manager 本地上下文镜像机制设计
更新时间：2026-04-27

## 1. 目标

当前 manager 已经完成了 LLM 决策主链改造，但上下文来源仍然不统一：

- 交互主链使用 `ProjectRuntimeContextService` 组装数据库快照
- 正式执行依赖 `PiMonoAdapter` 在本地 `cwd` 中用 `read/grep/find/ls` 读取文件
- digest 链路能远程读取飞书文档和 bitable，但这部分上下文没有稳定进入交互主链
- `repoUrl` 目前只是环境元数据，不等于 manager 已经能读取该仓库代码

本方案的目标是建立一个统一的本地上下文镜像层，使 manager 在交互决策、正式执行、digest 三类运行中都能从同一套本地目录读取项目关键资料。

目标收口为四点：

1. 将 repo、飞书文档、bitable、运行态摘要统一同步到本地工作区
2. 将 PiMono 的 `cwd` 从单一代码目录升级为项目工作区根目录
3. 将当前 prompt 从“注入 JSON 快照”逐步升级为“引导 agent 读取本地镜像目录”
4. 在本地上下文能力稳定后，再收敛最终的 skill 集

## 2. 当前代码基线

以下内容以当前代码为准：

- 环境元数据定义在 `ProjectEnvironment`
  - `repoUrl` / `repoBranch` / `projectPath`
  - 见 `prisma/schema.prisma`
- 交互主链上下文由 `src/modules/agent/project-runtime-context.service.ts` 提供
  - 当前只提供数据库快照
  - 明确写有 `Interactive runtime context uses database-backed snapshots only.`
- PiMono 运行时在 `src/modules/agent/pi-mono.adapter.ts`
  - `cwd` 来源于 `environment.projectPath`
  - 若为空则回退到 `PI_MONO_WORKDIR` 或 `process.cwd()`
  - 当前开放的内置工具是 `read/grep/find/ls`
- 已初始化群消息入口在 `src/modules/agent/agent.service.ts`
  - `handleInteractiveGroupMessage(...)` 会先调用 `runManagerDecision(...)`
- 正式执行入口在 `src/queues/processors/agent-run.processor.ts`
  - 执行前调用 `runtimeContext.assemble(...)`
- digest 链路使用 `src/modules/digest/project-context-assembler.service.ts`
  - 该服务已经可以通过 `FeishuProjectReader` 读取飞书 folder/doc/bitable

当前系统最关键的缺口不是 skill 不足，而是 manager 读取项目资料时仍然依赖多套来源：

- 代码：本地 `projectPath`
- 交互上下文：数据库
- 飞书文档 / bitable：digest 远程抓取

这会导致 manager 的项目认知不连续、不稳定，也无法保障“从本地实时读取项目关键资料”。

## 3. 设计原则

### 3.1 统一工作区

每个项目环境都应拥有一个独立的本地工作区，而不是只依赖单个代码目录。

### 3.2 托管镜像优先

manager 读取的代码仓库应为系统托管镜像，而不是直接操作用户可能正在使用的工作树。

### 3.3 本地读取优先

manager 在交互和执行阶段优先从本地镜像目录读取上下文，仅在同步层访问远程源。

### 3.4 事件驱动保鲜

不追求持续流式同步，而采用“进入运行前保鲜 + 关键事件后回写 + 后台定时校正”的策略。

### 3.5 本地目录即运行时契约

本地工作区目录结构应成为 manager 的稳定契约。后续 skill 是否存在、怎么触发，都应基于这套目录进行设计。

## 4. 目标目录结构

建议新增统一工作区根目录：

```text
.runtime/projects/{projectId}/envs/{environmentId}/
  repo/
  context/
    project.json
    environment.json
    runtime/
      session.json
      recent_messages.json
      recent_runs.json
      recent_artifacts.json
    feishu/
      folder_index.json
      docs/
        {token}__{slug}.md
      bitable/
        fields.json
        recent_rows.json
        summary.json
    sync_manifest.json
```

说明：

- `repo/`
  - 托管的只读仓库镜像目录
- `context/project.json`
  - 项目基础信息
- `context/environment.json`
  - 当前环境元数据
- `context/runtime/`
  - 群会话、最近消息、最近 run、最近 artifact 的本地摘要
- `context/feishu/folder_index.json`
  - 飞书项目文件夹结构快照
- `context/feishu/docs/`
  - 飞书文档落地文本
- `context/feishu/bitable/`
  - 任务表字段、最近记录和摘要
- `context/sync_manifest.json`
  - 同步时间、来源版本、错误、TTL 和状态

## 5. 上下文源映射

### 5.1 Repo 源

来源：

- `ProjectEnvironment.repoUrl`
- `ProjectEnvironment.repoBranch`

落地位置：

- `repo/`

用途：

- code analysis
- investigation
- review / risk 检查
- 正式执行阶段的代码阅读

### 5.2 飞书文档源

来源：

- `Project.docFolderToken`
- `FeishuProjectReader.scanProjectFolder(...)`
- `FeishuProjectReader.getDocumentRawContent(...)`

落地位置：

- `context/feishu/folder_index.json`
- `context/feishu/docs/*.md`

用途：

- requirement analysis
- document generate
- progress / weekly / meeting 类总结

### 5.3 Bitable 源

来源：

- `Project.bitableAppToken`
- `Project.bitableTableId`
- `FeishuProjectReader.readBitableSnapshot(...)`

落地位置：

- `context/feishu/bitable/fields.json`
- `context/feishu/bitable/recent_rows.json`
- `context/feishu/bitable/summary.json`

用途：

- task breakdown
- progress summary
- stale / risk review

### 5.4 运行态摘要源

来源：

- `ProjectRuntimeContextService`
- `GroupAgentSession`
- `MessageSource`
- `AgentRun`
- `Artifact`

落地位置：

- `context/runtime/*.json`

用途：

- 交互决策
- 执行前快速理解最近状态
- digest 的上下文复用

## 6. 新增模块设计

### 6.1 `ContextWorkspaceService`

职责：

- 生成并维护工作区路径
- 为项目环境计算 `workspaceRoot`
- 提供子目录定位：
  - `repoDir`
  - `contextDir`
  - `runtimeDir`
  - `feishuDocsDir`
  - `bitableDir`
- 确保目录存在

建议接口：

```ts
getWorkspacePaths(projectId: string, environmentId: string): {
  workspaceRoot: string;
  repoDir: string;
  contextDir: string;
  runtimeDir: string;
  feishuDocsDir: string;
  bitableDir: string;
  syncManifestPath: string;
}
```

### 6.2 `RepoMirrorService`

职责：

- 管理托管的 repo 镜像
- clone / fetch / checkout 指定 branch
- 为没有本地代码入口的环境建立可读镜像
- 避免直接修改用户原始工作树

原则：

- 不对外部人工工作目录直接执行自动写入
- 尽量将 manager 的代码阅读入口固定到托管镜像目录
- 对无 `repoUrl` 的环境允许跳过 repo 同步

建议接口：

```ts
ensureRepoMirror(input: {
  projectId: string;
  environmentId: string;
  repoUrl?: string | null;
  repoBranch?: string | null;
}): Promise<{
  repoDir: string;
  synced: boolean;
  headRef?: string | null;
  error?: string | null;
}>
```

### 6.3 `FeishuContextMirrorService`

职责：

- 复用 `FeishuProjectReader`
- 将 folder/doc/bitable 快照写入本地文件
- 将飞书远程资料转成 manager 可直接读取的本地上下文

建议输出：

- `folder_index.json`
- `docs/*.md`
- `bitable/fields.json`
- `bitable/recent_rows.json`
- `bitable/summary.json`

建议接口：

```ts
syncFeishuContext(input: {
  projectId: string;
  environmentId: string;
  docFolderToken?: string | null;
  bitableAppToken?: string | null;
  bitableTableId?: string | null;
}): Promise<{
  docsSynced: number;
  bitableSynced: boolean;
  errors: Record<string, string>;
}>
```

### 6.4 `RuntimeContextMirrorService`

职责：

- 将数据库运行态快照写入 `context/runtime/`
- 对接 `ProjectRuntimeContextService`
- 为 manager 提供本地 JSON 摘要入口

建议输出：

- `project.json`
- `environment.json`
- `runtime/session.json`
- `runtime/recent_messages.json`
- `runtime/recent_runs.json`
- `runtime/recent_artifacts.json`

### 6.5 `ContextSyncQueue` / `ContextSyncProcessor`

职责：

- 将 repo 同步、飞书镜像、运行态摘要写盘统一到异步队列
- 管理失败重试、并发和可观测性

建议 job 类型：

- `sync-runtime-context`
- `sync-repo-mirror`
- `sync-feishu-context`
- `sync-all-context`

## 7. 同步触发策略

### 7.1 交互决策前

接入点：

- `AgentService.handleInteractiveGroupMessage(...)`

行为：

- 先检查 `sync_manifest.json`
- 若 runtime context 过期，先刷新 runtime 摘要
- 若 repo / feishu context 超过 TTL，则触发同步
- 允许 repo / feishu 部分失败，但必须把错误写入 manifest

目标：

- manager 决策阶段尽量先看到本地最新上下文

### 7.2 正式执行前

接入点：

- `AgentRunProcessor.process(...)`

行为：

- 在 `piMono.executeRun(...)` 之前执行 `ensureFreshContext`
- 确保 repo 镜像和飞书文档至少达到可用状态

目标：

- 正式执行阶段比交互阶段要求更高的上下文完整度

### 7.3 Artifact 成功同步后

接入点：

- `ArtifactSyncProcessor`

行为：

- 正式产物写回飞书成功后，触发 `sync-runtime-context`
- 必要时触发 `sync-feishu-context`

目标：

- 本地镜像尽快反映最新产物沉淀结果

### 7.4 后台保鲜

接入点：

- 定时任务或独立巡检 job

行为：

- 周期性检查活跃项目环境的 manifest
- 修复过期、失败或缺失的镜像

## 8. PiMono 运行时接入方式

### 8.1 `cwd` 切换

当前：

- `PiMonoAdapter.resolveCwd(...)` 优先使用 `environment.projectPath`

改造后：

- `cwd` 应优先使用 `workspaceRoot`
- `repo/` 成为代码镜像目录
- `context/` 成为项目资料目录

结果：

- manager 用 `ls/find/read/grep` 时可以同时看代码和项目资料

### 8.2 Prompt 改造方向

当前 prompt 的核心问题是依赖大块 `projectContextBundle` JSON。

改造后应逐步改成：

- 说明 `repo/` 是代码目录
- 说明 `context/feishu/docs/` 是项目文档镜像
- 说明 `context/feishu/bitable/summary.json` 是任务总览
- 说明 `context/runtime/` 是最新运行态摘要
- 优先让 manager 自行读取本地文件，而不是只依赖 prompt 注入的 JSON

说明：

- 初期可以保留 `projectContextBundle` 作为兜底
- 最终目标是降低 prompt 注入体积，提高本地上下文自取能力

## 9. 数据与配置扩展建议

### 9.1 环境字段扩展

建议新增到 `ProjectEnvironment` 或独立镜像表：

- `workspaceRoot`
- `repoMirrorPath`
- `lastRepoSyncAt`
- `lastFeishuSyncAt`
- `lastRuntimeSyncAt`
- `contextSyncStatus`
- `contextSyncError`

### 9.2 可选独立表

若不希望把同步状态全部压进环境表，可新增：

`ProjectContextMirror`

建议字段：

- `projectId`
- `environmentId`
- `workspaceRoot`
- `repoMirrorPath`
- `repoHeadRef`
- `lastRepoSyncAt`
- `lastFeishuSyncAt`
- `lastRuntimeSyncAt`
- `status`
- `lastError`
- `manifestJson`

### 9.3 配置项

建议新增配置：

- `PROJECT_CONTEXT_ROOT`
- `CONTEXT_SYNC_REPO_TTL_SECONDS`
- `CONTEXT_SYNC_FEISHU_TTL_SECONDS`
- `CONTEXT_SYNC_RUNTIME_TTL_SECONDS`
- `CONTEXT_SYNC_DOC_CONTENT_LIMIT`
- `CONTEXT_SYNC_MAX_PARALLEL_JOBS`

## 10. 实施阶段

### 阶段 1：工作区与运行态摘要

- 新增 `ContextWorkspaceService`
- 将 runtime context 写入 `context/runtime/`
- 在交互主链和执行主链前接入 `ensureFreshRuntimeContext`

目标：

- 先让 manager 看到稳定的本地运行态摘要

### 阶段 2：Repo 镜像

- 新增 `RepoMirrorService`
- 为已配置 `repoUrl` 的环境创建托管镜像
- 将 PiMono `cwd` 切到 `workspaceRoot`

目标：

- 让 manager 对代码理解彻底摆脱“projectPath 不稳定”的问题

### 阶段 3：飞书文档与 bitable 镜像

- 新增 `FeishuContextMirrorService`
- 将现有 digest 中的远程读取能力沉淀到本地文件
- 交互主链、执行主链、digest 统一使用镜像目录

目标：

- 让 manager 在所有场景下都能本地读取文档与任务状态

### 阶段 4：Prompt 收口与 skill 决策

- 降低 `projectContextBundle` 的 prompt 注入比重
- 将 manager 主要认知源切到本地镜像
- 基于已成型的上下文目录，重新确定必须 skill 集

## 11. skill 收口前提

在本地上下文镜像机制落地前，不建议急于确定最终 skill 集。

原因：

- 没有本地 repo 镜像，就无法准确判断 `code-analysis` 和 `investigation` 的边界
- 没有飞书文档镜像，就无法准确判断 `requirement-analysis` 和 `document-generate` 的上下文深度
- 没有 bitable 镜像，就无法准确判断 `task-breakdown` 和 `progress-summary` 的职责范围

只有在 manager 能稳定访问：

- `repo/`
- `context/feishu/docs/`
- `context/feishu/bitable/`
- `context/runtime/`

之后，skill 的必要性才会自然收敛。

## 12. 当前建议结论

下一优先级不是新增 skill，而是先落地“本地上下文镜像机制”。

建议按以下顺序实施：

1. 工作区路径与 manifest
2. runtime context 本地化
3. repo 镜像托管
4. 飞书文档 / bitable 镜像
5. PiMono `cwd` 和 prompt 收口
6. 再确定最终必须 skill 集

这是当前代码结构下，最能提升 manager 实际理解能力、稳定性和可扩展性的路线。
