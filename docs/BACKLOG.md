# 待办与计划

> 本文件记录**尚未实现**的功能与已知限制下的改进方向。  
> 已发布变更见 [`CHANGELOG.md`](./CHANGELOG.md)；MCP 方案定稿见 [`MCP_DESIGN.md`](./MCP_DESIGN.md)。

最后更新：2026-08-14

---

## 优先级说明

| 标记 | 含义 |
|------|------|
| **P0** | 影响 Cursor Agent 主流程，建议优先做 |
| **P1** | 体验/一致性改进 |
| **P2** | 增强项，可择机 |

---

## P0 — Cursor Agent 读不到 `structuredContent`

### 背景

MCP 工具结果有两个通道（见 `mcp/src/result.ts`）：

| 字段 | Inspector | Cursor Agent |
|------|-----------|----------------|
| `content[]` | ✅ | ✅ **主要读这里** |
| `structuredContent` | ✅ | ❌ **通常读不到** |

这是 **Cursor 客户端侧已知限制**（非本仓库 MCP 协议错误）：UI 的 tool card 能展开 Structured JSON，但传给模型的上下文往往只有 `content` 文本。社区讨论：[Cursor ignores structuredContent](https://forum.cursor.com/t/cursor-ingnores-structuredcontent-from-mcp-result/156072)、[structuredContent-only results silently dropped](https://forum.cursor.com/t/mcp-tool-results-containing-only-structuredcontent-are-silently-dropped/167346)。

**原则（定稿）：** 凡需 Agent 使用的数据，必须写入 `content`；`structuredContent` 仅作 Inspector / 未来客户端的加分项，不能作唯一数据源。

### C-JSON 镜像（`@lanhu/mcp`）

**已发布** — [`CHANGELOG.md`](./CHANGELOG.md) §0.1.2（**Cursor 专项**；官方修复后可从白名单释放）

- 常量名单：`mcp/src/structured-content-mirror.ts` → `STRUCTURED_CONTENT_MIRROR_KEYS`
- `lanhu_design:list` ✅：`content` = 摘要 + 紧凑 JSON 镜像
- `lanhu_design:slices` ✅：`content` = 摘要 + 紧凑 JSON 镜像（B 套切图元数据）
- **不** mirror：`analyze` / `tokens`

**仍待做（在名单中追加 key 后同样走 mirror）**

| 待追加 key | 说明 |
|------------|------|
| `lanhu_design:selection_error` | 选稿失败时的 `available_designs` |

### 各 mode 现状

| mode | `content` | 计划 |
|------|-----------|------|
| `list` | 摘要 + JSON 镜像 | ✅ 已实现 |
| `slices` | 摘要 + JSON 镜像 | ✅ 已实现 |
| 选稿失败 | 错误文案 | 加入名单后 mirror |
| `tokens` / `analyze` | 已有足够文本 | 不 mirror |

### 不在此计划内

- 等待 Cursor 官方修复后再移除 `content` 冗余（无时间表，不依赖）。
- `lanhu_page` 若存在「仅 Structured 有数据」的模式，按同样原则单独立项排查。

---

## P1 — MCP 选稿与元数据

（摘自 [`CHANGELOG.md`](./CHANGELOG.md) §0.1.1「未包含」）

| 项 | 说明 |
|----|------|
| `structuredContent.resolved_design` | analyze 成功时返回完整选稿元数据（index、id、name、sectors 等），便于 Agent 程序化引用 |
| stage URL 自动推断当前画板 | 从浏览器上下文或 list 默认项推断，减少重复传 `design_names`（需产品约定，避免误分析） |

---

## P1 — MCP 体积与参数

（摘自 [`MCP_IMPLEMENTATION.md`](./MCP_IMPLEMENTATION.md)）

| 项 | 说明 |
|----|------|
| `html_max_chars` | analyze 文本/HTML 截断预览 + 全量保留在 Structured（在 Cursor 修复 Structured 之前，全量仍须以 `content` 为准） |
| `list` 分页 | `limit` / `offset` 或按 sector 过滤，控制大项目 list 的 token |

---

## P2 — 低优先级 / 能力扩展

| 项 | 说明 | 参考 |
|----|------|------|
| 邀请链接解析 | `resolve_invite_link` | [`CONTEXT.md`](./CONTEXT.md) §3.4 |
| 团队留言板 | say 系列 | 同上 |
| 飞书集成 | — | 同上 |
| MCP 进程内 pid/tid 缓存 | **不做**；URL 作每次调用上下文，固定项目用 `.env` / Cursor Rules | 对话结论 2026-08-13 |
| `.env` 读取 `LANHU_DDS_COOKIE` | 当前 DDS 复用 `LANHU_COOKIE`；独立 DDS Cookie 可从 HTTP body / mcp.json `env` 传入 | [`LANHU_API.md`](./LANHU_API.md) |

---

## 维护约定

- 实现完成后：条目移至 [`CHANGELOG.md`](./CHANGELOG.md) 对应版本，并从本文删除或标为已完成。
- 新计划：按 P0 / P1 / P2 追加，写清**背景、范围、验收**，避免与 CHANGELOG 重复大段说明。
