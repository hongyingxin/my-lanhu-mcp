# 版本迭代记录

> 本仓库为 monorepo；各包版本见对应 `package.json`。此处记录**面向使用者的功能与行为变更**。

---

## [0.1.2] — 2026-08-14

### 概述

解决 Cursor Agent **读不到 `structuredContent`** 的问题：`lanhu_design` **`list` / `slices`** 模式下，在 `content` 文本末尾追加 Structured JSON 镜像，Agent 可直接解析完整列表或 B 套切图元数据。

> **Cursor 专项 workaround**  
> 镜像机制是为 **Cursor 客户端**准备的：Agent 上下文通常只含 `content`，读不到 `structuredContent`（Inspector 正常）。这不是 MCP 协议要求，其他客户端若已支持 Structured 可不受影响。  
> 维护入口：`mcp/src/structured-content-mirror.ts` → `STRUCTURED_CONTENT_MIRROR_KEYS`（白名单）。  
> **若 Cursor 官方修复**（Agent 能稳定消费 `structuredContent`），可从白名单移除对应 key、停做 content 双写，并同步调整 `mcp/tests/structured-content-mirror.test.ts`。详见 [`BACKLOG.md`](./BACKLOG.md) §P0。

### `@lanhu/mcp` — C-JSON 镜像（P0 部分）

#### 新增

- **`structured-content-mirror.ts`**  
  常量名单 `STRUCTURED_CONTENT_MIRROR_KEYS`（格式 `{tool}:{mode}`），当前 `lanhu_design:list`、`lanhu_design:slices`
- **`createToolResult(..., mirrorKey?)`**（`mcp/src/result.ts`）  
  `mirrorKey` 命中名单时，在摘要后追加 `JSON.stringify(structuredContent)`（紧凑 JSON，不截断）

#### 变更

- **`lanhu_design` · `mode=list`**：`content` 由「仅一行摘要」改为「摘要 + JSON 镜像」；`structuredContent` 仍保留供 Inspector 使用
- **`lanhu_design` · `mode=slices`**：同上，Agent 可解析完整 B 套切图元数据（`slices[]`、`scaleUrls` 等）
- **`analyze` / `tokens`**：不启用 mirror（已有足够文本，避免双倍 token）

#### 测试

- 新增 `mcp/tests/structured-content-mirror.test.ts`（含 list / slices mirror 用例）

### 升级注意

1. `npm run build:mcp` 后重启 MCP（Cursor Settings → MCP Restart）
2. Agent 调用 `list` / `slices` 时，`content` 末尾会出现完整 JSON；大项目或大切图列表 token 消耗会增加（后续 P1 可加分页）

### 未包含（后续迭代）

> 完整待办见 [`BACKLOG.md`](./BACKLOG.md)。

- `lanhu_design:selection_error` 加入镜像名单（P0 剩余）
- structuredContent 中返回完整 `resolved_design` 元数据（P1）
- stage URL 自动从浏览器上下文推断当前画板（P1）
- `list` 分页 / sector 过滤（P1）

---

## [0.1.1] — 2026-08-13

### 概述

优化 `lanhu_design` 选稿体验：**detailDetach 链接含 `image_id` 时可直接 analyze**，与 HTTP `analyzeDesign` 行为对齐；stage 全项目多稿场景仍要求显式选稿，避免误分析。

### `@lanhu/mcp` — `lanhu_design` 选稿逻辑

#### 新增

- **`resolveDesignSelector`**（`mcp/src/tools/resolve-design-selector.ts`）  
  统一解析 `design_names`，优先级：
  1. 显式传入 `design_names`（可覆盖 URL 中的 `image_id`）
  2. URL 含 `image_id` / `docId` → 自动选该稿
  3. `listDesigns` 仅返回 1 张 → 自动选该张
  4. stage 全项目多稿且无 `image_id` → 报错并返回可选列表

- 成功响应字段 **`design_names_resolved_from`**（`analyze` / `slices` / `tokens`）  
  取值：`explicit` | `url.image_id` | `single_design`

#### 变更

- **`design_names` 由「非 list 必填」改为「有条件必填」**
  - ✅ 可省略：`detailDetach?...&image_id=...`、list 仅 1 张
  - ❌ 仍必填：`stage?tid=...&pid=...` 且项目内多稿

- 缺参错误信息增强：返回 `hint`、`auto_selectable`、`available_designs`（含 index / id / name）

- Tool **description** 与 **inputSchema** 说明同步更新

#### 测试

- 新增 `mcp/tests/resolve-design-selector.test.ts`（5 用例）
- `vitest.config.ts` 纳入 `mcp/tests/**/*.test.ts`

### 文档

| 文件 | 变更 |
|------|------|
| `docs/CURSOR_MCP.md` | `design_names` 何时可省略、参数总览 |
| `docs/MCP_DESIGN.md` | MCP 与 HTTP 选稿约定、四个 mode 说明 |
| `docs/MCP_IMPLEMENTATION.md` | 分发流程、`resolveDesignSelector` |
| `docs/TROUBLESHOOTING.md` | analyze 报 `design_names` 的排查说明 |

### Prompt

- `mcp/src/prompts/design-prompts.ts`：`frontend-dev` / `design-review` 注明 URL 含 `image_id` 时可省略 `design_names`

### 使用示例

**detailDetach（推荐，无需再传画板名）：**

```json
{
  "url": "https://lanhuapp.com/web/#/item/project/detailDetach?tid=TEAM_ID&pid=PROJECT_ID&image_id=DESIGN_ID",
  "mode": "analyze"
}
```

**stage 全项目（须指定画板）：**

```json
{
  "url": "https://lanhuapp.com/web/#/item/project/stage?tid=TEAM_ID&pid=PROJECT_ID",
  "mode": "analyze",
  "design_names": "画板名"
}
```

### 升级注意

1. 修改代码后执行 `npm run build:mcp`
2. 重启 MCP（Cursor Settings → MCP Restart，或重启 Inspector）
3. 更新 `.env` 中 `LANHU_COOKIE` 后须重启 MCP 进程（无需重新 build）
4. Schema 链路依赖 URL 中的 **`tid`** 与有效的 DDS Cookie（见 `docs/TROUBLESHOOTING.md`）

### 未包含（后续迭代）

> 完整待办见 [`BACKLOG.md`](./BACKLOG.md)。

- structuredContent 中返回完整 `resolved_design` 元数据（第二阶段）
- stage URL 自动从浏览器上下文推断当前画板
- **P0**：Cursor Agent 读不到 `structuredContent` → list/slices/选稿失败时把数据写入 `content` 文本（见 BACKLOG §P0）

---

## [0.1.0] — 基线

- `@lanhu/mcp`：`lanhu_design`（list / analyze / slices / tokens）、`lanhu_page`、Resource、Prompt
- `@lanhu/core`：设计稿 Schema / Sketch 双链路、原型 Playwright 分析
- `server-nest`：HTTP 调试 API
- 文档：`docs/CONTEXT.md`、`docs/CURSOR_MCP.md`、`docs/LANHU_API.md` 等
