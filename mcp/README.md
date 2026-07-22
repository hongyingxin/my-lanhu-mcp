# `@lanhu/mcp` — Cursor MCP 套壳

stdio MCP 进程，与 `server-nest/`（HTTP 调试）同级，业务逻辑在 `packages/lanhu-core`。

## 已定稿

| 项 | 约定 |
|----|------|
| Tool | `lanhu_design`（`mode`: list / analyze / slices / tokens，**默认 analyze**）、`lanhu_page`（原型） |
| Resource | `project-designs`、单稿 design |
| Prompt | `frontend-dev`、`design-review` |
| `include` | 在 **core** `pipeline/analyze-include.ts`；默认 `["html","tokens","layers","image"]` |
| 文档 | [`docs/CONTEXT.md`](../docs/CONTEXT.md)、[`docs/CURSOR_MCP.md`](../docs/CURSOR_MCP.md) |

## 开发

```bash
# 根目录
npm install
npm run build:mcp          # 或 npm run build（含 core + server-nest + mcp）
npm run dev:mcp            # tsx 热跑 stdio server
```

环境变量见 [`config.example.env`](./config.example.env)。

## Cursor `mcp.json`

```json
{
  "mcpServers": {
    "lanhu": {
      "command": "node",
      "args": ["/绝对路径/lanhu-node/mcp/dist/server.js"],
      "env": {
        "LANHU_COOKIE": "session=..."
      }
    }
  }
}
```

开发期可将 `command` 改为 `npx`，`args` 改为 `["tsx", "/绝对路径/lanhu-node/mcp/src/server.ts"]`。

## 原则

- 只注册 tool、格式化 MCP 返回；不复制蓝湖 HTTP / 转换逻辑
- 业务实现以 `@lanhu/core` 为准
