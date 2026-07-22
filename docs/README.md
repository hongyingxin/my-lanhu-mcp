# 文档索引

> 最后更新：2026-07-22

本仓库采用 **「docs 手册 + 包旁 README」**，不把所有 `.md` 搬进 `docs/`。

---

## 文档分工（写新文档前先读）

| 层级 | 位置 | 写什么 | 示例 |
|------|------|--------|------|
| **手册** | `docs/*.md` | 跨模块、给新人/Cursor/排错；架构与 MCP 用法 | `CONTEXT.md`、`CURSOR_MCP.md` |
| **包旁** | 各目录 `README.md` | 只写**本目录**怎么跑、目录结构、API/路由表 | `lanhu-core/README.md`、`server-nest/README.md` |
| **入口** | 根 `README.md` | clone 后 30 秒上手 + 链到本索引 | 快速开始、包一览 |

**原则**

- 同一主题**只在一处写全**；其它文件用链接，不复制大段。
- 改 HTTP 路由 → 优先改 `server-nest/README.md`。
- 改 core 导出 / 流水线 → 优先改 `packages/lanhu-core/README.md`。
- 改 MCP 参数 / Agent 工作流 → 优先改 `docs/CURSOR_MCP.md`。
- `data/README.md` 为本地落盘备忘（`data/` 被 gitignore）；权威说明见下文「落盘与 Git」。

---

## 日常必读（`docs/`）

| 文档 | 用途 |
|------|------|
| [**CONTEXT.md**](./CONTEXT.md) | **项目总览**：架构、能力、开发命令（**新对话先读**） |
| [**CURSOR_MCP.md**](./CURSOR_MCP.md) | Cursor 配置与 `lanhu_design` / `lanhu_page` 参数 |
| [**prototype-and-mcp.md**](./prototype-and-mcp.md) | 原型 URL 语义、Playwright 管线、HTTP §5 / MCP `lanhu_page` |
| [**TROUBLESHOOTING.md**](./TROUBLESHOOTING.md) | Cookie、Playwright 安装、503 / MCP 常见错误 |
| [**MCP_INSPECTOR.md**](./MCP_INSPECTOR.md) | MCP Inspector 本地调试 |

---

## 设计与实现参考（`docs/`）

| 文档 | 用途 |
|------|------|
| [MCP_DESIGN.md](./MCP_DESIGN.md) | MCP 方案定稿（1 Tool + 4 mode、list vs analyze） |
| [MCP_IMPLEMENTATION.md](./MCP_IMPLEMENTATION.md) | `@lanhu/mcp` 工程蓝图；对照 `mcp/` 源码 |
| [GITIGNORE.md](./GITIGNORE.md) | `.gitignore` 与 `data/` 落盘规则 |

---

## 代码旁 README（就近维护）

| 路径 | 用途 | 不在此重复的内容 |
|------|------|------------------|
| [`../README.md`](../README.md) | 仓库入口、快速开始 | 架构细节 → `CONTEXT.md` |
| [`../packages/lanhu-core/README.md`](../packages/lanhu-core/README.md) | core 模块树、**导出 API**、analyze/原型流水线 |  monorepo 总览 → `CONTEXT.md` |
| [`../server-nest/README.md`](../server-nest/README.md) | **HTTP 路由表**（designs + pages）、Service 映射 | Cookie 排错 → `TROUBLESHOOTING.md` |
| [`../mcp/README.md`](../mcp/README.md) | `npm run dev:mcp`、`mcp.json` 路径示例 | Tool 参数与工作流 → `CURSOR_MCP.md` |
| [`../apps/debug-react/README.md`](../apps/debug-react/README.md) | 调试台 Tab、目录结构、本 app 环境变量 | list vs analyze 说明 → `MCP_DESIGN.md` §6 |
| [`../data/README.md`](../data/README.md) | 本地 `data/` 目录结构备忘（可选） | Git 规则 → `GITIGNORE.md` §2 |

---

## 推荐阅读顺序

```text
1. 根 README.md          → 安装、启动
2. docs/CONTEXT.md       → 能力边界与命令
3. 按任务跳转：
   · 调 MCP     → CURSOR_MCP.md
   · 原型/PRD   → prototype-and-mcp.md
   · HTTP 联调  → server-nest/README.md
   · core 开发  → packages/lanhu-core/README.md
   · 报错       → TROUBLESHOOTING.md
```

---

## 新对话引用（Cursor）

```text
@docs/CONTEXT.md
@docs/README.md
```

按任务追加：`@docs/CURSOR_MCP.md` · `@docs/prototype-and-mcp.md` · `@docs/TROUBLESHOOTING.md`
