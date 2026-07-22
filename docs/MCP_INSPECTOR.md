# MCP Inspector 调试指南

[MCP Inspector](https://github.com/modelcontextprotocol/inspector) 是官方提供的 MCP 调试工具，带 Web UI，可用来测试 Tools、Resources、Prompts 等能力。

本仓库的 MCP Server 位于 `mcp/`（包名 `@lanhu/mcp`），通过 **stdio** 与客户端通信。

## 前置条件

1. 已在仓库根目录配置 `.env`，并填入 `LANHU_COOKIE`（与 HTTP 服务相同）。
2. 已执行 `npm install`。

`LANHU_COOKIE` 也可通过 Inspector 的 `-e` 参数或 UI 中的 Env 字段传入。

## 基本启动

仅启动 Inspector UI（不自动连接本仓库 MCP）：

```bash
npx @modelcontextprotocol/inspector
```

浏览器打开：**http://localhost:6274**

## 调试本仓库 MCP Server

在**仓库根目录**执行以下任一方式。

### 方式 1：开发模式（推荐）

无需先 `build`，改代码后重启即可：

```bash
npx @modelcontextprotocol/inspector -- npx tsx mcp/src/server.ts
```

若 `.env` 未生效，可显式传入 Cookie：

```bash
npx @modelcontextprotocol/inspector -e LANHU_COOKIE="你的cookie" -- npx tsx mcp/src/server.ts
```

### 方式 2：使用 npm scripts

```bash
# 等价于 tsx mcp/src/server.ts（会先 build @lanhu/core）
npm run dev:mcp
```

另开终端启动 Inspector 并连接：

```bash
npx @modelcontextprotocol/inspector -- npx tsx mcp/src/server.ts
```

### 方式 3：构建后运行

```bash
npm run build:mcp

npx @modelcontextprotocol/inspector -- node mcp/dist/server.js
```

### 方式 4：在 mcp 目录下

```bash
cd mcp
npm run build
npx @modelcontextprotocol/inspector -- node dist/server.js
```

## 常用参数

| 参数 | 说明 |
|------|------|
| `-e KEY=VALUE` | 给 MCP Server 传环境变量，可重复使用 |
| `--` | 分隔 Inspector 自身参数与 MCP Server 启动命令 |
| 命令后的参数 | 传给 MCP Server（如 `arg1 arg2`） |

示例：

```bash
npx @modelcontextprotocol/inspector \
  -e LANHU_COOKIE="xxx" \
  -e MCP_SERVER_NAME="lanhu-mcp-node" \
  -- node mcp/dist/server.js
```

## 在 Inspector UI 中手动配置

若只运行 `npx @modelcontextprotocol/inspector`（不带 server 命令），可在 UI 里填写：

| 字段 | 值 |
|------|-----|
| Transport | `stdio` |
| Command | `node` 或 `npx` |
| Args | `mcp/dist/server.js` 或 `tsx mcp/src/server.ts` |
| Env | `LANHU_COOKIE`（必填） |

点击 **Connect** 后，在左侧可测试：

- **Tools** — 如 `lanhu_design`（`list` / `analyze` / `slices` / `tokens`）
- **Resources** — 如 `project-designs`、`design`
- **Prompts** — 设计稿还原相关提示词

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `LANHU_COOKIE` | 是 | 蓝湖登录 Cookie |
| `MCP_SERVER_NAME` | 否 | 服务名，默认 `lanhu-mcp-node` |
| `MCP_SERVER_VERSION` | 否 | 版本号，默认 `0.1.0` |

配置加载逻辑见 `mcp/src/config.ts`：优先读取仓库根目录 `.env`。

## 常见问题

**连接失败 / 提示缺少 LANHU_COOKIE**

在 `.env` 中配置，或通过 `-e LANHU_COOKIE=...` 传入。

**`node mcp/dist/server.js` 报错找不到文件**

先执行 `npm run build:mcp`。

**只开 Inspector、不传 server 命令**

UI 能打开，但不会自动连上本仓库 MCP；需在 UI 中手动填写 Command / Args / Env，或使用上文「调试本仓库 MCP Server」中带 `--` 的一键命令。

**首次 `npx` 较慢**

会临时下载 `@modelcontextprotocol/inspector`，属正常现象。

## 相关命令速查

```bash
# 根目录
npm run dev:mcp      # 直接跑 MCP（stdio，供 Cursor 等客户端使用）
npm run build:mcp    # 构建 mcp → dist/

# Inspector + 本仓库 MCP（开发）
npx @modelcontextprotocol/inspector -- npx tsx mcp/src/server.ts

# Inspector + 本仓库 MCP（生产构建）
npm run build:mcp
npx @modelcontextprotocol/inspector -- node mcp/dist/server.js
```
