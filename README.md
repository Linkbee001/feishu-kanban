# 飞书项目协同开发助手 V1

这是 `docs/dev_plan_v1.md` 的 NestJS 后端实现骨架，覆盖 API、worker、Prisma 数据模型、BullMQ 队列、飞书真实 HTTP 适配层、pi mono 本地 RPC 适配层、确认机制和产物沉淀链路。

## 本地启动

1. 复制环境变量：

```bash
cp .env.example .env
```

2. 填写 `.env` 中的飞书、pi mono 和管理密钥配置。

3. 如果你本机已有 PostgreSQL 和 Redis，直接启动服务：

```bash
docker compose up --build
```

此时容器内会通过 `host.docker.internal` 访问你宿主机上的：

```env
DATABASE_URL=postgresql://feishu:feishu@localhost:5432/feishu_kanban?schema=public
REDIS_URL=redis://localhost:6379
```

本地开发也可以分开启动：

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run start:dev
npm run worker:dev
```

## 关键接口

- `POST /webhooks/feishu/events`：飞书事件入口，处理 URL verification、签名、解密、去重并入队。
- `POST /api/projects/init-from-chat`：从飞书群初始化项目、文档目录、任务表和默认环境。
- `POST /api/agent-runs`：创建 pi mono 执行。
- `POST /internal/confirmations/:id/confirm`：内部确认入口。
- `POST /api/artifacts/:id/retry-sync`：重试产物同步。

除飞书 webhook 外，管理/内部接口默认使用 `Authorization: Bearer ${ADMIN_JWT_SECRET}`。

## pi mono 集成

本项目通过 `@mariozechner/pi-coding-agent` 的 SDK 直接集成 `badlogic/pi-mono`。worker 使用 SDK session 管理、rehydrate、memory 和结构化工具，不再依赖 `pi --mode rpc` CLI fallback。

常用配置：

```env
PI_MONO_PROVIDER=bailian
PI_MONO_MODEL=kimi-k2.5
PI_MONO_THINKING_LEVEL=off
PI_MONO_WORKDIR=/workspace
PI_MONO_AGENT_DIR=/workspace/.pi-agent
BAILIAN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_API_KEY=sk-...
```

当 `PI_MONO_PROVIDER=bailian` 时，后端会在 pi 启动前自动写入 `${PI_MONO_AGENT_DIR}/models.json`，注册百炼 OpenAI 兼容 provider：

```json
{
  "providers": {
    "bailian": {
      "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
      "api": "openai-completions",
      "apiKey": "DASHSCOPE_API_KEY",
      "models": [{ "id": "kimi-k2.5" }]
    }
  }
}
```

pi 的最终回复会被解析为 `AgentOutput[]`，包括 `document`、`task`、`file`、`log`、`summary`。后端会要求 pi 只输出合法 JSON。

## 验证命令

```bash
npm run build
npm test
npm run lint
npx prisma validate
```

## 当前实现边界

- 飞书调用使用真实 OpenAPI HTTP 客户端，但实际权限、具体租户能力和文档块格式仍需在飞书应用中做冒烟验证。
- gstack 由 pi / skills / prompt 体系触发；后端只负责 skill 名称、prompt 和输出 schema。
- V1 不做自动代码提交、PR 创建、发布上线和复杂前端后台。
