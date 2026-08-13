# Cursor 如何调用 Lanhu MCP

本文说明在 Cursor 里如何使用 `@lanhu/mcp`：有哪些入口、参数怎么传、常见场景怎么组合。

---

## 1. 前置配置

在 Cursor 的 MCP 配置（如 `mcp.json`）中注册服务，并设置环境变量：

| 变量 | 必填 | 说明 |
|------|------|------|
| `LANHU_COOKIE` | 是 | 蓝湖登录 Cookie（浏览器 DevTools → Network 复制） |

与 **server-nest**、**debug 页面**共用同一份 Cookie：在仓库根目录 `.env` 中填写 `LANHU_COOKIE` 即可。

本地开发示例：

```bash
# 编辑根目录 .env 中的 LANHU_COOKIE
npm run dev:mcp
# 或构建后 node mcp/dist/server.js（stdio）
```

Cursor 里也可在 `mcp.json` 的 `env` 中配置，无需改 `.env` 文件。

---

## 2. MCP 提供什么

Cursor 里 Agent 可通过三类能力访问蓝湖设计稿：

| 类型 | 名称 | 作用 |
|------|------|------|
| **Tool** | `lanhu_design` | 主工具：列画板、分析、切图、tokens |
| **Resource** | `project-designs` | 只读资源：`lanhu://project/{pid}/designs?tid={tid}` 列画板 |
| **Resource** | `design` | 只读资源：`lanhu://project/{pid}/design/{design_id}?tid={tid}` 单张设计稿 JSON 分析 |
| **Prompt** | `frontend-dev` | 预置任务：像素级前端还原 |
| **Prompt** | `design-review` | 预置任务：设计一致性与可实现性审查（正文含推荐 `lanhu_design` 参数） |

**重要**：Prompt 只生成一段「用户指令」，**不会自动拉数据**；真正取数仍靠 `lanhu_design`（或 Resource）。

---

## 3. 推荐工作流

```text
1. list 或读 Resource project-designs  → 看清画板名 / 序号 / id
2. lanhu_design(mode=analyze, design_names=...)  → 拿 HTML、预览图、tokens 等
3. （可选）mode=slices 或 with_slices=true  → 补 B 套切图元数据
4. Agent 在项目里写代码 / 做审查
```

单张 `detailDetach` URL 可直接 `mode=analyze`（可省略 `design_names`）；`stage` 全项目须 `design_names` 或先 list。

---

## 4. Tool：`lanhu_design`

### 4.1 `mode`（先选干什么）

| mode | 说明 | 需要 `design_names` | 默认 |
|------|------|---------------------|------|
| `list` | 列出项目内所有设计稿 | 否 | |
| `analyze` | 深度分析（HTML/CSS、tokens、图层等） | 有条件（见下） | **是** |
| `slices` | 仅 B 套切图元数据（`getSlices`） | 有条件（见下） | |
| `tokens` | 仅 Design Tokens | 有条件（见下） | |

**`design_names` 何时可省略**

| URL 情况 | 是否可省略 `design_names` |
|----------|---------------------------|
| `detailDetach` 含 `image_id` | ✅ 自动分析 URL 指定画板 |
| list 仅 1 张设计稿 | ✅ 自动选该张 |
| `stage` 全项目（多稿） | ❌ 必填，或先 `mode=list` |

`design_names` 支持：画板名、序号（如 `"1"`）、id、`"all"`。显式传入时优先于 URL 的 `image_id`。

**示例（Agent 调用 JSON）：**

```json
{ "url": "https://lanhuapp.com/web/#/item/project/stage?pid=xxx&tid=xxx", "mode": "list" }
```

```json
{
  "url": "https://lanhuapp.com/web/#/item/project/stage?pid=xxx&tid=xxx",
  "mode": "analyze",
  "design_names": "首页"
}
```

```json
{
  "url": "...",
  "mode": "analyze",
  "design_names": ["首页", "详情页"]
}
```

```json
{ "url": "...", "mode": "slices", "design_names": "首页" }
```

不传 `mode` 时等价于 `"analyze"`。

---

### 4.2 ` `（仅 `mode=analyze`）

控制 analyze **返回哪些数据产物**（不是换 mode）。

| 值 | 返回内容 |
|----|----------|
| `html` | HTML+CSS（还原主数据） |
| `image` | 预览图（content 里的 image 块） |
| `tokens` | Design Tokens |
| `layers` | 图层树 |
| `layout` | 布局摘要 |
| `slices` | A 套图片 mapping（本地路径 ← 远程 URL） |

**默认**（不传 `include`）：

```json
["html", "tokens", "layers", "layout", "image", "slices"]
```

**与 `mode=slices` 的区别：**

| | `analyze` + `include` 含 `slices` | `mode=slices` |
|--|-----------------------------------|---------------|
| 内容 | A 套 mapping（HTML 用到的图） | B 套完整切图元数据 |
| 其它 | 可同时要 html、tokens、预览图 | 只有切图信息 |

另：**`with_slices: true`**（仅 analyze）会在结果里再挂一份 B 套 `getSlices` 元数据。

---

### 4.3 `workflow_guide`（仅 `mode=analyze`）

控制返回文本里是否附带 **STEP 1~5 设计稿还原工作流说明**（见 `mcp/src/analyze/design-workflow-guide.ts`）。

| 值 | 行为 |
|----|------|
| 不传 / `true` | 默认附带（需 `include` 含 `html`） |
| `false` | 不附带，省 token |

**生效条件（须同时满足）：**

1. `workflow_guide !== false`
2. `include` 中包含 `"html"`

无 `html` 时即使 `workflow_guide: true` 也不会插入 guide。

返回的 `structuredContent.workflow_guide` 表示**本次是否实际附带了** guide。

---

## 5. 在 Cursor 里怎么「控制」参数

Cursor **没有** `mode` / `include` / `workflow_guide` 的单独 UI 开关，由 **对话意图 → Agent 构造 tool 参数**。

| 你想做的事 | 对话示例 | Agent 应传参 |
|------------|----------|--------------|
| 列画板 | 「列出这个项目的设计稿」 | `mode: "list"` |
| 完整分析还原 | 「分析首页并写代码」 | `mode: "analyze"`, `design_names: "首页"` |
| 轻量分析 | 「只要 HTML 和预览图」 | `include: ["html", "image"]` |
| 不要布局摘要 | 「不要 layout summary」 | `include` 里去掉 `"layout"` |
| 不要 STEP 1~5 | 「不要工作流说明」 | `workflow_guide: false` |
| 只要切图元数据 | 「拉首页的 B 套切图」 | `mode: "slices"`, `design_names: "首页"` |
| 只要 tokens | 「提取首页 design tokens」 | `mode: "tokens"`, `design_names: "首页"` |
| 设计审查 | 「审查这个设计稿的一致性」 | 可用 Prompt `design-review`；或 `include` 去掉 `html`，`workflow_guide: false` |

也可用 **Resource** 代替 `list`：读取 `lanhu://project/{pid}/designs?tid={tid}`。

单张稿结构化 JSON（无长文本/HTML 块）可读 `lanhu://project/{pid}/design/{design_id}?tid={tid}`；完整还原仍推荐 `lanhu_design(mode=analyze)`。

---

## 6. Prompt 入口

### `frontend-dev`

- **参数**：`url`（必填）、`design_name`（可选）
- **作用**：触发「像素级前端还原」任务（中文短说明）
- **实际调用**：Agent 仍应 `lanhu_design(mode=analyze, design_names=...)`；默认 `include` 含 `html`，`workflow_guide` 默认 `true`

### `design-review`

- **参数**：`url`（必填）、`design_name`（可选，画板名）
- **作用**：触发设计一致性 / 可实现性审查
- **Prompt 正文已写明**推荐先调 `lanhu_design`：
  - `mode: "analyze"`
  - `design_names`: 与 `design_name` 一致，未传时需 Agent 自行指定画板名
  - `include: ["layout", "layers", "image", "tokens"]`（**不要** `html`）
  - `workflow_guide: false`
- **说明**：审查靠预览图 + tokens/layers，避免 HTML 长文与 STEP 1~5 guide 占 token；拿到数据后再与用户代码对比

`frontend-dev` 不会在正文里写死 tool 参数，Agent 应默认 `mode=analyze`、全量 `include`、`workflow_guide: true`。

---

## 7. 常见组合示例

```json
{
  "url": "https://lanhuapp.com/web/#/item/project/stage?pid=xxx&tid=xxx",
  "mode": "analyze",
  "design_names": "首页"
}
```

默认：全量 include + STEP 1~5 guide（适合还原）。

```json
{
  "url": "...",
  "mode": "analyze",
  "design_names": "首页",
  "include": ["html", "image"],
  "workflow_guide": false
}
```

轻量：只要 HTML 和预览图，省 token。

```json
{
  "url": "...",
  "mode": "analyze",
  "design_names": "首页",
  "include": ["layout", "layers", "image", "tokens"],
  "workflow_guide": false
}
```

审查向：不要 HTML 长文和还原 guide（`layout` 默认已含，可只去掉 `html`）。

```json
{
  "url": "...",
  "mode": "analyze",
  "design_names": "首页",
  "with_slices": true
}
```

analyze 同时带 B 套切图元数据。

---

## 8. 参数总览

```text
lanhu_design
├── url                    必填，蓝湖项目 URL（stage 或 detailDetach）
├── mode                   list | analyze（默认）| slices | tokens
├── design_names           analyze/slices/tokens：URL 含 image_id 或仅 1 张时可省略；stage 多稿必填
├── include                仅 analyze；控制返回数据类型
├── workflow_guide         仅 analyze；默认 true；需 include 含 html 才插入 STEP 1~5
└── with_slices            仅 analyze；是否额外挂 B 套 getSlices 元数据
```

---

## 9. 返回结构简述

- **文本 content**：`formatAnalyzeSummary` 拼装的说明 + 各画板 HTML / layout / mapping 等  
  摘要标题为中文，例如：`设计稿分析结果`、`--- 布局摘要 ---`、`--- 图层结构 ---`、`--- 设计令牌（Design Tokens）---`
- **图片 content**：`include` 含 `image` 时，每画板预览图 base64（多稿时文本顶部有顺序说明）
- **structuredContent**：JSON，含 `mode`、`include`、`workflow_guide`、各 `designs[]` 字段（`html_code`、`image_url_mapping` 等）

**Resource `design`**：返回 JSON（含 `html_code`、`design_tokens` 等），不含 MCP image 块与 workflow 长文。详见 `mcp/src/tools/lanhu-design.ts` 的 `formatAnalyzeSummary` 输出。
