# 文档索引

> 最后更新：2026-08-17

本仓库采用 **「docs 手册 + 包旁 README」**，不把所有 `.md` 搬进 `docs/`。

---

## 文档分工（写新文档前先读）

| 层级 | 位置 | 写什么 | 示例 |
|------|------|--------|------|
| **手册** | `docs/*.md` | 跨模块、给新人/Cursor/排错；架构与 MCP 用法 | `CONTEXT.md`、`CURSOR_MCP.md` |
| **包旁** | 各目录 `README.md` | 只写**本目录**怎么跑、目录结构、API/路由表 | `lanhu-core/README.md`、`server-nest/README.md` |
| **入口** | 根 `README.md` | 面向用户：MCP 介绍、安装、Cursor 配置、使用示例 | 开发细节 → `DEVELOPMENT.md` |
| **开发** | `docs/DEVELOPMENT.md` | clone 后 monorepo 上手、架构、调试命令 | 能力边界 → `CONTEXT.md` |

**原则**

- 同一主题**只在一处写全**；其它文件用链接，不复制大段。
- 改 HTTP 路由 → 优先改 `server-nest/README.md`。
- 改 core 导出 / 流水线 → 优先改 `packages/lanhu-core/README.md`。
- 改蓝湖外网入参/回参 → 优先改 `docs/LANHU_API.md`。
- 改 MCP 参数 / Agent 工作流 → 优先改 `docs/CURSOR_MCP.md`。
- `data/README.md` 为本地落盘备忘（`data/` 被 gitignore）；权威说明见下文「落盘与 Git」。

---

## 日常必读（`docs/`）

| 文档 | 用途 |
|------|------|
| [**DEVELOPMENT.md**](./DEVELOPMENT.md) | **开发上手**：架构、npm 命令、包一览 |
| [**CURSOR_MCP.md**](./CURSOR_MCP.md) | Cursor 配置；`lanhu_design` 参数与 **`lanhu_page` 用法（§5）** |
| [**prototype-and-mcp.md**](./prototype-and-mcp.md) | 原型 URL 语义、Playwright 管线、HTTP §5 / MCP 实现细节 |
| [**CONTEXT.md**](./CONTEXT.md) | **项目总览**：能力边界、链路、技术选型（**新对话先读**） |
| [**TROUBLESHOOTING.md**](./TROUBLESHOOTING.md) | Cookie、Playwright 安装、503 / MCP 常见错误 |
| [**CHANGELOG.md**](./CHANGELOG.md) | **版本迭代记录**（功能变更、升级注意） |
| [**BACKLOG.md**](./BACKLOG.md) | **待办与计划**（未实现项、已知限制下的改进方向） |
| [**MCP_INSPECTOR.md**](./MCP_INSPECTOR.md) | MCP Inspector 本地调试 |

---

## 设计与实现参考（`docs/`）

| 文档 | 用途 |
|------|------|
| [MCP_DESIGN.md](./MCP_DESIGN.md) | MCP 方案定稿（1 Tool + 4 mode、list vs analyze） |
| [MCP_IMPLEMENTATION.md](./MCP_IMPLEMENTATION.md) | `@lanhu/mcp` 工程蓝图；对照 `mcp/` 源码 |
| [LANHU_API.md](./LANHU_API.md) | 蓝湖外网端点：入参 / 回参（`@lanhu/core` 已用） |
| [GITIGNORE.md](./GITIGNORE.md) | `.gitignore` 与 `data/` 落盘规则 |

---

## 代码旁 README（就近维护）

| 路径 | 用途 | 不在此重复的内容 |
|------|------|------------------|
| [`../README.md`](../README.md) | 面向用户：MCP 介绍、Cursor 配置、使用示例 | 开发命令 → `DEVELOPMENT.md` |
| [`../packages/lanhu-core/README.md`](../packages/lanhu-core/README.md) | core 模块树、**导出 API**、analyze/原型流水线 | 蓝湖 HTTP 明细 → `LANHU_API.md` |
| [`../server-nest/README.md`](../server-nest/README.md) | **HTTP 路由表**（designs + pages）、Service 映射 | Cookie 排错 → `TROUBLESHOOTING.md` |
| [`../mcp/README.md`](../mcp/README.md) | `npm run dev:mcp`、`mcp.json` 路径示例 | Tool 参数与工作流 → `CURSOR_MCP.md` |
| [`../apps/debug-react/README.md`](../apps/debug-react/README.md) | 调试台 Tab、目录结构、本 app 环境变量 | list vs analyze 说明 → `MCP_DESIGN.md` §6 |
| [`../data/README.md`](../data/README.md) | 本地 `data/` 目录结构备忘（可选） | Git 规则 → `GITIGNORE.md` §2 |

---

## 推荐阅读顺序

```text
1. 根 README.md          → MCP 安装与 Cursor 配置（用户）
2. docs/DEVELOPMENT.md   → monorepo 开发上手（贡献者）
3. docs/CONTEXT.md       → 能力边界与链路
4. 按任务跳转：
   · 调 MCP     → CURSOR_MCP.md
   · 原型/PRD   → prototype-and-mcp.md
   · HTTP 联调  → server-nest/README.md
   · 蓝湖外网 API → LANHU_API.md
   · core 开发  → packages/lanhu-core/README.md
   · 报错       → TROUBLESHOOTING.md
```

---

## 新对话引用（Cursor）

```text
@docs/CONTEXT.md
@docs/README.md
```

按任务追加：`@docs/CURSOR_MCP.md` · `@docs/prototype-and-mcp.md` · `@docs/LANHU_API.md` · `@docs/TROUBLESHOOTING.md`
