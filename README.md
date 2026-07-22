# Lanhu Node

蓝湖设计稿与原型（PRD/Axure）解析 — Node.js monorepo。

```text
debug-react → server-nest (:3001) → @lanhu/core → 蓝湖 API
mcp/（Cursor）─────────────────────┘
```

## 文档

**完整索引与分工说明** → [**docs/README.md**](./docs/README.md)

| 常用 | 链接 |
|------|------|
| 项目总览（新对话先读） | [docs/CONTEXT.md](./docs/CONTEXT.md) |
| Cursor MCP | [docs/CURSOR_MCP.md](./docs/CURSOR_MCP.md) |
| 排错 | [docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) |

各包 API / 路由见对应目录 `README.md`（见 [docs/README.md §代码旁 README](./docs/README.md#代码旁-readme就近维护)）。

## 快速开始

```bash
cp .env.example .env   # 填入 LANHU_COOKIE
npm install
npx playwright install chromium   # 原型 analyze / lanhu_page 需要（首次一次即可）
npm run dev            # server :3001 + debug-react :5174
# 或分别启动：
npm run dev:server
npm run dev:react
npm run dev:mcp        # MCP stdio
npm run test
npm run build
```

调试台：http://localhost:5174 · 请求走 **前端 → server → @lanhu/core** · Mock 读 `apps/debug-react/src/mock/`。

设计稿 analyze 默认落盘 [`data/lanhu_designs/`](./data/README.md)（`persistArtifacts: false` 可关闭）。

## 包说明

| 路径 | 说明 | 文档 |
|------|------|------|
| [`packages/lanhu-core/`](./packages/lanhu-core/) | 蓝湖 API、转换、原型管线 | [README](./packages/lanhu-core/README.md) |
| [`server-nest/`](./server-nest/) | Nest HTTP 调试 API | [README](./server-nest/README.md) |
| [`mcp/`](./mcp/) | Cursor MCP | [README](./mcp/README.md) |
| [`apps/debug-react/`](./apps/debug-react/) | 主调试台 | [README](./apps/debug-react/README.md) |
