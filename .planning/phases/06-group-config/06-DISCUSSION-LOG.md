# Phase 06 Discussion Log: Group Config UI

**Phase:** 06-group-config  
**Date:** 2026-05-08  
**Duration:** 1 session

---

## Discussion Summary

实现 Admin Dashboard 中的群配置功能，让用户通过 Web UI 完成飞书群的项目初始化配置。

---

## Areas Discussed

### Area 1: 界面位置与入口

**Presented Options:**
- A. Dashboard 顶部按钮 + 模态框
- B. 左侧导航栏 + 独立页面
- C. 空状态引导页（自动检测）

**User Selection:** B. 左侧导航栏 + 独立页面

**Discussion Notes:**
- 群配置是独立的管理功能，不是 Dashboard 的附属操作
- 独立页面更清晰，后续可扩展为群列表管理
- 需要恢复/重构早期 Layout 组件的侧边栏设计

---

### Area 2: 配置表单设计

**Presented Options:**
- A. 单页长表单
- B. 分步骤向导（4步）
- C. 基础信息展开 + 高级选项折叠

**User Selection:** A. 单页长表单

**Discussion Notes:**
- 配置字段数量适中（~10个）
- 单页表单比多步向导更直接，减少点击次数
- 分区展示：群信息区（只读）、项目信息区、环境配置区、策略设置区

---

### Area 3: 群信息同步

**Presented Options:**
- A. 手动输入 chatId → 点击同步 → 自动填充
- B. 完全手动填写（不依赖飞书同步）
- C. 从已加入群列表中选择

**User Selection:** A. 手动输入 chatId → 点击同步 → 自动填充

**Discussion Notes:**
- 需要先验证群存在且机器人已加入
- 同步 API 返回的信息作为表单默认值
- 流程：输入 chatId → 点击同步 → 填充群名称和成员列表 → 补充其他字段 → 提交完成

---

## Decisions Captured

| ID | Decision | Rationale |
|----|----------|-----------|
| D-01 | 左侧导航栏 + 独立页面 | 群配置是独立功能，独立页面更清晰 |
| D-02 | 单页长表单，分区展示 | 字段适中，单页更直接 |
| D-03 | 手动输入 chatId → 同步 → 自动填充 | 先验证群存在，再填充表单 |
| D-04 | 实时显示后端错误，前端基础验证 | 符合现有错误处理模式 |
| D-05 | 显示成功消息，自动刷新导航状态 | 完成后的标准反馈流程 |

---

## Deferred Ideas

以下功能被记录为未来可能的增强：

1. **从已加入群列表中选择** — 需要飞书 API 支持获取群列表
2. **配置模板** — 标准项目、文档项目、代码项目等预设模板
3. **配置预览** — 提交前查看配置摘要
4. **群列表页面** — 查看所有已配置/待配置群

---

## Technical Notes

### 后端 API 已存在
- `GET /api/group-config/:chatId` — 获取配置状态
- `POST /api/group-config/:chatId/sync` — 同步群信息
- `POST /api/group-config/:chatId/complete` — 完成配置

### 前端需要实现
- Sidebar 导航组件（恢复/重构早期 Layout 设计）
- GroupConfigPage 页面组件
- 表单组件（输入、同步按钮、分区展示）
- 路由配置（`/admin/group-config`）

### 复用组件
- `FilterBar` 样式（表单输入框）
- `ConfirmDialog`（确认提交）
- `useApi` hook（API 调用）
- `RobotInstanceTable` 的分区标题样式
