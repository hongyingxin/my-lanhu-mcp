# `@lanhu/mcp` — Cursor MCP 套壳

stdio MCP 进程，与 `server-nest/` 同级；业务逻辑在 `packages/lanhu-core`。

**Tool 参数、工作流、Prompt 用法** → [`docs/CURSOR_MCP.md`](../docs/CURSOR_MCP.md) · 方案 → [`docs/MCP_DESIGN.md`](../docs/MCP_DESIGN.md)

## 开发

```bash
# 仓库根目录
npm install
npm run build:mcp          # 或 npm run build（含 core + server-nest + mcp）
npm run dev:mcp            # tsx 热跑 stdio server
```

环境变量：根目录 [`.env.example`](../.env.example) → 复制为 `.env`，填 `LANHU_COOKIE`。排错见 [`docs/TROUBLESHOOTING.md`](../docs/TROUBLESHOOTING.md)。

Inspector 调试 → [`docs/MCP_INSPECTOR.md`](../docs/MCP_INSPECTOR.md)。

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

- 只注册 tool / Resource / Prompt，格式化 MCP 返回
- 不复制蓝湖 HTTP / 转换逻辑；实现以 `@lanhu/core` 为准
