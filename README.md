# Lanhu Node

蓝湖设计稿与原型（PRD/Axure）解析 — Node.js monorepo。

```text
debug-react → server-nest (:3001) → @lanhu/core → 蓝湖 API
mcp/（Cursor）─────────────────────┘
```

## 文档

- [**项目上下文**](./docs/CONTEXT.md) — 架构、能力、开发命令（**新对话先读**）
- [**文档索引**](./docs/README.md) — 全部 docs 说明与归档标记
- [Cursor MCP 使用](./docs/CURSOR_MCP.md)
- [MCP Inspector 调试](./docs/MCP_INSPECTOR.md)

## 快速开始

```bash
cp .env.example .env   # 填入 LANHU_COOKIE
npm install
npm run dev            # server :3001 + debug-react :5174
# 或分别启动：
npm run dev:server
npm run dev:react
npm run dev:mcp        # MCP stdio
npm run test
npm run build
```

调试台默认 **React**：`apps/debug-react` → http://localhost:5174  
所有请求走 **前端 → server → @lanhu/core**；Mock 模式读 `apps/debug-*/src/mock/`。

`POST /api/designs/analyze` 默认将预览图、HTML、mapping、Schema/Sketch 等写入 [`data/lanhu_designs/`](./data/README.md)。传 `persistArtifacts: false` 可关闭落盘。

## 包说明

| 路径 | 说明 |
|------|------|
| [`packages/lanhu-core/`](./packages/lanhu-core/) | 蓝湖 API、转换、原型管线 |
| [`server-nest/`](./server-nest/) | Nest HTTP 调试 API |
| [`mcp/`](./mcp/) | Cursor MCP（`lanhu_design`、`lanhu_page`） |
| [`apps/debug-react/`](./apps/debug-react/) | 主调试台 |
