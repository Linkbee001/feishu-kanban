# Phase 06: Group Config UI

**Phase:** 06-group-config  
**Date:** 2026-05-08  
**Status:** Context gathered, ready for research

---

## Domain

在 Admin Dashboard 中添加群项目配置界面，让未配置的群可以通过 Web UI 完成初始化，替代当前仅通过 API 端点的方式。用户访问 `/admin` 后，可通过左侧导航进入群配置页面，完成 chatId 输入、群信息同步、项目配置填写、提交完成整个流程。

---

## Decisions

### D-01: 界面位置与入口
**Decision:** 左侧导航栏 + 独立页面

群配置作为独立功能页面，通过左侧导航栏访问：
- Dashboard 布局扩展为带侧边栏导航的完整布局（恢复/重构早期 Layout 组件设计）
- 导航项："机器人实例"（当前 Dashboard 内容）、"群配置"（新页面）
- 群配置为独立页面路由（如 `/admin/group-config`），非模态框

**Rationale:** 群配置是独立的管理功能，不是 Dashboard 的附属操作，独立页面更清晰。

### D-02: 配置表单设计
**Decision:** 单页长表单，分区展示

所有配置字段在一个页面上展示，分区域组织：
- **群信息区**（只读，自动填充）：chatId、群名称、成员列表
- **项目信息区**（必填/选填）：name（必填）、description（选填）
- **环境配置区**（选填）：repoUrl、repoBranch（默认 main）、modelName
- **策略设置区**（默认即可）：mentionOnly（布尔）、allowedSkills（多选）、enabled（布尔）

**Rationale:** 配置字段数量适中（~10个），单页表单比多步向导更直接，减少点击次数。

### D-03: 群信息同步
**Decision:** 手动输入 chatId → 点击同步 → 自动填充

流程：
1. 用户输入飞书群 chatId（如 `oc_a67d8bf658d58e65a7e63f153a693540`）
2. 点击"同步群信息"按钮
3. 前端调用 `/api/group-config/:chatId/sync`
4. 成功后自动填充：群名称、成员列表、ownerOpenId
5. 用户补充其他配置字段，点击"完成配置"
6. 调用 `/api/group-config/:chatId/complete`

**Rationale:** 需要先验证群存在且机器人已加入，同步 API 返回的信息作为表单默认值。

### D-04: 错误处理
**Decision:** 实时显示后端错误，前端基础验证

- 前端：必填字段校验、URL 格式校验
- 后端错误：chatId 不存在、群未加入、同步失败、配置解析错误 → 显示在对应字段下方

### D-05: 完成后的流程
**Decision:** 显示成功消息，自动刷新导航状态

配置完成后：
1. 显示成功消息（Toast 或 Alert）
2. 自动将群添加到"已配置群列表"（如实现了群列表展示）
3. 提供"返回 Dashboard"按钮

---

## Deferred Ideas

- 从已加入群列表中选择（需要飞书 API 支持获取群列表）
- 配置模板（标准项目、文档项目、代码项目）
- 配置预览（提交前查看配置摘要）
- 群列表页面（查看所有已配置/待配置群）

---

## Canonical Refs

- Backend API: `src/modules/config/group-config.controller.ts`
- Backend Service: `src/modules/config/group-config.service.ts`
- Frontend Dashboard: `frontend/src/components/Dashboard.tsx`
- Frontend Layout: `frontend/src/components/Layout.tsx`（需要恢复/重构）
- Admin API Types: `frontend/src/types/admin.ts`

---

## Codebase Context

### Reusable Assets
- `FilterBar` 组件样式（表单输入框样式一致）
- `ConfirmDialog` 组件（可用于确认提交）
- `useApi` hook（API 调用模式）
- `RobotInstanceTable` 的分区标题样式（表单区块标题）

### Integration Points
- Dashboard 路由扩展（App.tsx 或独立路由配置）
- Sidebar 导航（需要重构或新建）
- 与现有 GroupConfigService API 对接

### Patterns to Follow
- 表单验证：前端基础校验 + 后端错误处理（参考现有 API 调用模式）
- 加载状态：同步按钮 loading 状态
- 成功反馈：Toast 或 Alert 组件

---

## Acceptance Criteria

- [ ] 左侧导航栏可以切换到群配置页面
- [ ] 可以输入 chatId 并同步群信息
- [ ] 表单可以填写所有必要配置字段
- [ ] 提交后成功创建项目并完成群配置
- [ ] 配置完成后群可以使用机器人功能
