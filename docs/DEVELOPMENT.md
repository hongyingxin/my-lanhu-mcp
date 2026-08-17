# 开发指南

> 仓库 clone 后的 monorepo 上手、调试与包分工。  
> 能力边界与完整命令见 [`CONTEXT.md`](./CONTEXT.md) · 文档索引见 [`README.md`](./README.md)。

---

## 架构

```text
debug-react → server-nest (:3001) → @lanhu/core → 蓝湖 API
mcp/（Cursor）─────────────────────┘
```

- 业务逻辑在 **`@lanhu/core`**；HTTP 与 MCP 均为薄壳。
- 调试台不直连蓝湖；Cookie 配置在根目录 `.env` 或 MCP `env`。

---

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

- 调试台：http://localhost:5174 · 请求走 **前端 → server → @lanhu/core**
- Mock 模式读 `apps/debug-react/src/mock/`
- 设计稿 analyze 默认落盘 [`data/lanhu_designs/`](./DATA_LAYOUT.md)；`LANHU_PERSIST_ARTIFACTS=false` 时不写磁盘（MCP + REST 共用）

Cookie、Playwright、503 等排错 → [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md)

---

## 包说明

| 路径 | 说明 | 文档 |
|------|------|------|
| [`packages/lanhu-core/`](../packages/lanhu-core/) | 蓝湖 API、转换、原型管线 | [README](../packages/lanhu-core/README.md) |
| [`server-nest/`](../server-nest/) | Nest HTTP 调试 API | [README](../server-nest/README.md) |
| [`mcp/`](../mcp/) | Cursor MCP | [README](../mcp/README.md) |
| [`apps/debug-react/`](../apps/debug-react/) | 主调试台 | [README](../apps/debug-react/README.md) |

---

## 相关文档

| 主题 | 文档 |
|------|------|
| 项目总览 | [`CONTEXT.md`](./CONTEXT.md) |
| 本地落盘目录 | [`DATA_LAYOUT.md`](./DATA_LAYOUT.md) |
| Cursor MCP | [`CURSOR_MCP.md`](./CURSOR_MCP.md) |
| 原型 / PRD | [`PROTOTYPE_AND_MCP.md`](./PROTOTYPE_AND_MCP.md) |
| 蓝湖外网 API | [`LANHU_API.md`](./LANHU_API.md) |
| MCP Inspector | [`MCP_INSPECTOR.md`](./MCP_INSPECTOR.md) |
