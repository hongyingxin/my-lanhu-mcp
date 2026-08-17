# MCP Inspector 调试指南

[MCP Inspector](https://github.com/modelcontextprotocol/inspector) 是官方提供的 MCP 调试工具，带 Web UI，可用来测试 Tools、Resources、Prompts 等能力。

本仓库的 MCP Server 位于 `mcp/`（包名 `@lanhu/mcp`），通过 **stdio** 与客户端通信。

## 前置条件

1. 已在仓库根目录配置 `.env`，并填入 `LANHU_COOKIE`（与 HTTP 服务相同）。
2. 已执行 `npm install`。
3. 若需测 **`lanhu_page`（原型）**：在仓库根执行 `npx playwright install chromium`（见 [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md) §3）。

`LANHU_COOKIE` 也可通过 Inspector 的 `-e` 参数或 UI 中的 Env 字段传入。

## 基本启动

仅启动 Inspector UI（不自动连接本仓库 MCP）：

```bash
npx @modelcontextprotocol/inspector
```

浏览器打开：**http://localhost:6274**

## 调试本仓库 MCP Server（推荐）

在**本机普通终端**（Terminal.app / iTerm 等）的**仓库根目录**执行，**不要**在 Cursor 内置 Agent 终端里启动——后者会注入 sandbox 的 `PLAYWRIGHT_BROWSERS_PATH`，导致原型 Playwright 找不到浏览器。

### 一键启动（加载 `.env`）

```bash
cd /path/to/lanhu-node
set -a && source .env && set +a
unset PLAYWRIGHT_BROWSERS_PATH

npx @modelcontextprotocol/inspector \
  -e "LANHU_DATA_DIR=${LANHU_DATA_DIR}" \
  -e "LANHU_PERSIST_ARTIFACTS=${LANHU_PERSIST_ARTIFACTS}" \
  -e "LANHU_COOKIE=${LANHU_COOKIE}" \
  -- npx tsx mcp/src/server.ts
```

终端会打印带 `MCP_PROXY_AUTH_TOKEN` 的 UI 地址，浏览器打开即可。

### 开发模式（仅 Cookie）

无需先 `build`，改代码后重启 Inspector 即可：

```bash
unset PLAYWRIGHT_BROWSERS_PATH
npx @modelcontextprotocol/inspector -e LANHU_COOKIE="你的cookie" -- npx tsx mcp/src/server.ts
```

### 使用 npm scripts

```bash
# 等价于 tsx mcp/src/server.ts（会先 build @lanhu/core）
npm run dev:mcp
```

另开终端启动 Inspector 并连接（同样 `unset PLAYWRIGHT_BROWSERS_PATH`）：

```bash
unset PLAYWRIGHT_BROWSERS_PATH
npx @modelcontextprotocol/inspector -- npx tsx mcp/src/server.ts
```

### 构建后运行

```bash
npm run build:mcp
unset PLAYWRIGHT_BROWSERS_PATH
npx @modelcontextprotocol/inspector -- node mcp/dist/server.js
```

## 常用参数

| 参数 | 说明 |
|------|------|
| `-e KEY=VALUE` | 给 MCP Server 传环境变量，可重复使用 |
| `--` | 分隔 Inspector 自身参数与 MCP Server 启动命令 |
| 命令后的参数 | 传给 MCP Server（如 `arg1 arg2`） |

示例：

```bash
unset PLAYWRIGHT_BROWSERS_PATH
npx @modelcontextprotocol/inspector \
  -e LANHU_COOKIE="xxx" \
  -e LANHU_DATA_DIR=/Users/hong/my-text-data \
  -e LANHU_PERSIST_ARTIFACTS=false \
  -e MCP_SERVER_NAME="lanhu-mcp-node" \
  -- npx tsx mcp/src/server.ts
```

## 在 Inspector UI 中手动配置

若只运行 `npx @modelcontextprotocol/inspector`（不带 server 命令），可在 UI 里填写：

| 字段 | 值 |
|------|-----|
| Transport | `stdio` |
| Command | `node` 或 `npx` |
| Args | `mcp/dist/server.js` 或 `tsx mcp/src/server.ts` |
| Env | `LANHU_COOKIE`（必填）；可选 `LANHU_DATA_DIR`、`LANHU_PERSIST_ARTIFACTS` |

点击 **Connect** 后，在左侧可测试：

- **Tools** — 如 `lanhu_design`（`list` / `analyze` / `slices` / `tokens`）、`lanhu_page`
- **Resources** — 如 `project-designs`、`design`
- **Prompts** — 设计稿还原相关提示词

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `LANHU_COOKIE` | 是 | 蓝湖登录 Cookie |
| `LANHU_DATA_DIR` | 否 | 落盘根目录，默认 `{repoRoot}/data`；相对路径锚定仓库根；绝对路径如 `/Users/hong/my-text-data`（`~` 不展开） |
| `LANHU_PERSIST_ARTIFACTS` | 否 | 是否写入 `LANHU_DATA_DIR`，默认 `true`；`false` 见 [`DATA_LAYOUT.md`](./DATA_LAYOUT.md) §0 |
| `MCP_SERVER_NAME` | 否 | 服务名，默认 `lanhu-mcp-node` |
| `MCP_SERVER_VERSION` | 否 | 版本号，默认 `0.1.0` |

配置加载逻辑见 `mcp/src/config.ts`：优先读取仓库根目录 `.env`（不覆盖已有 env）。

## 常见问题

**连接失败 / 提示缺少 LANHU_COOKIE**

在 `.env` 中配置，或通过 `-e LANHU_COOKIE=...` 传入。

**`browserType.launch: Executable doesn't exist`（路径含 `cursor-sandbox-cache`）**

在 Cursor 内置终端启动了 Inspector。改在**本机普通终端**执行，并 `unset PLAYWRIGHT_BROWSERS_PATH`（见上文「一键启动」）。

**`node mcp/dist/server.js` 报错找不到文件**

先执行 `npm run build:mcp`。

**只开 Inspector、不传 server 命令**

UI 能打开，但不会自动连上本仓库 MCP；需在 UI 中手动填写 Command / Args / Env，或使用上文「一键启动」命令。

**改了 `.env` 不生效**

重启 Inspector；`-e` 传入的值会覆盖 shell 里未 export 的变量。

**首次 `npx` 较慢**

会临时下载 `@modelcontextprotocol/inspector`，属正常现象。

## 相关命令速查

```bash
# 根目录
npm run dev:mcp      # 直接跑 MCP（stdio，供 Cursor 等客户端使用）
npm run build:mcp    # 构建 mcp → dist/

# Inspector + 本仓库 MCP（开发，本机终端）
unset PLAYWRIGHT_BROWSERS_PATH
set -a && source .env && set +a
npx @modelcontextprotocol/inspector \
  -e "LANHU_DATA_DIR=${LANHU_DATA_DIR}" \
  -e "LANHU_PERSIST_ARTIFACTS=${LANHU_PERSIST_ARTIFACTS}" \
  -e "LANHU_COOKIE=${LANHU_COOKIE}" \
  -- npx tsx mcp/src/server.ts

# Inspector + 本仓库 MCP（生产构建）
npm run build:mcp
unset PLAYWRIGHT_BROWSERS_PATH
npx @modelcontextprotocol/inspector -- node mcp/dist/server.js
```
