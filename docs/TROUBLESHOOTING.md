# 排错指南

> Cookie、Playwright、常见 HTTP/MCP 错误。环境变量见 [`.env.example`](../.env.example)，架构见 [`CONTEXT.md`](./CONTEXT.md)。

---

## 1. 获取蓝湖 Cookie

1. 浏览器登录 [lanhuapp.com](https://lanhuapp.com)
2. 打开 DevTools → **Network**
3. 刷新页面或打开任意设计稿/原型
4. 选中对 `lanhuapp.com` 的请求 → **Request Headers** → 复制整段 **`Cookie`**
5. 写入仓库根目录 `.env`：

```bash
cp .env.example .env
# 编辑 LANHU_COOKIE=...（不要加多余引号，除非值本身含空格）
```

**调试台**：也可在「连接」面板临时粘贴 Cookie（走 HTTP body，不写文件）。

**MCP / Inspector**：读根目录 `.env`，或在 `mcp.json` / `-e LANHU_COOKIE=...` 传入。

---

## 2. Cookie 相关错误

| 现象 | 可能原因 | 处理 |
|------|----------|------|
| `GET /api/health` 显示未配置 Cookie | `.env` 不存在或未填 | 按 §1 配置后重启 `npm run dev:server` |
| HTTP **503** +「Cookie 为空」 | server 无 env Cookie，请求 body 也未带 | 填 `.env` 或调试台粘贴 |
| 蓝湖 API 非 `00000` / 登录失效 | Cookie 过期、账号登出 | 重新登录蓝湖，复制新 Cookie 并**整段替换** |
| DDS / Schema 失败、其它接口正常 | 少见；DDS 默认复用 `LANHU_COOKIE` | 确认 Cookie 含 `session` / `user_token` 等；必要时 HTTP body 传 `ddsCookie` |
| MCP `ConfigurationError: LANHU_COOKIE is required` | MCP 进程未加载 `.env` | 在仓库根启动，或在 MCP 配置里写 `env.LANHU_COOKIE` |

Cookie 含登录态，**勿提交 Git**。若曾误提交，请轮换 Cookie 并从历史中移除敏感文件。

---

## 3. Playwright（原型分析）

原型 `POST /api/pages/analyze`、MCP `lanhu_page`、core `analyzePrototypePages` 依赖 **Playwright Chromium**。

首次使用或升级 `@lanhu/core` 后，在仓库根目录执行：

```bash
npm install
npx playwright install chromium
```

| 现象 | 可能原因 | 处理 |
|------|----------|------|
| 报错找不到 browser / executable | 未安装浏览器二进制 | 运行上方 `playwright install` |
| 路径含 `cursor-sandbox-cache` | 在 Cursor 内置终端启动了 Inspector / MCP | 改在**本机普通终端**启动，并 `unset PLAYWRIGHT_BROWSERS_PATH`（见 [`MCP_INSPECTOR.md`](./MCP_INSPECTOR.md)） |
| analyze 超时 / `networkidle` 卡住 | Axure 页外链或脚本慢 | 重试；检查 `lanhu_prototypes/...` 是否完整下载（`LANHU_PERSIST_ARTIFACTS=false` 时为 temp 目录） |
| `analyze-local` 失败 | `outputDir` 路径错误或 HTML 不存在 | 先 `POST /api/pages/download`，再对同目录 analyze-local |
| 截图 403 / path outside | 截图路径不在 `LANHU_DATA_DIR` 或系统 temp 下 | 使用 analyze 返回的路径；`LANHU_PERSIST_ARTIFACTS=false` 时路径在 `tmpdir` |

落盘目录说明：[`DATA_LAYOUT.md`](./DATA_LAYOUT.md)、[`PROTOTYPE_AND_MCP.md`](./PROTOTYPE_AND_MCP.md) §4。

### `LANHU_DATA_DIR` 写法

| 目标 | `.env` 示例 |
|------|-------------|
| 仓库根下 `data/`（默认） | `LANHU_DATA_DIR=./data` 或省略 |
| 仓库根下自定义子目录 | `LANHU_DATA_DIR=hong/my-text-data` |
| 用户主目录等绝对路径 | `LANHU_DATA_DIR=/Users/hong/my-text-data` |

相对路径锚定 monorepo 仓库根（MCP / server 用 `resolveLanhuDataDirAnchored`）。**勿写** `~/my-text-data`（Node 不展开 `~`）。

---

## 4. 设计稿常见问题

| 现象 | 处理 |
|------|------|
| list 为空 | 确认 URL 含 `tid` + `pid`；Cookie 有该项目权限 |
| analyze 只分析一张 | 预期行为；先 `list` 选稿再 analyze（见 [`MCP_DESIGN.md`](./MCP_DESIGN.md) §6） |
| Schema 失败但有 Sketch fallback | 看响应 `warnings[]`，或磁盘 `{slug}.warnings.json` / `.analyze-meta.json`；旧稿或无 DDS 时走 Sketch 正常 |
| 切图 B 套为空 | 设计师未登记切图；改调 A 套 mapping 或确认稿内有 PS 切图 |

---

## 5. MCP 连不上

| 现象 | 处理 |
|------|------|
| Cursor 看不到 tool | 检查 `mcp.json` 路径是否为 **`mcp/dist/server.js`** 或 dev 用 `tsx mcp/src/server.ts`；改代码后需重启 MCP |
| list 正常 analyze 报 `design_names` | stage 多稿 URL 须传 `design_names` 或先 list；detailDetach 含 `image_id` 可省略 |
| Inspector 无 env / Playwright 报错 | 本机终端 `source .env` + `unset PLAYWRIGHT_BROWSERS_PATH` 后启动；见 [`MCP_INSPECTOR.md`](./MCP_INSPECTOR.md) |

本地调试步骤：[`MCP_INSPECTOR.md`](./MCP_INSPECTOR.md)。
