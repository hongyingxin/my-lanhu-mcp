# MCP 实现设计（`@lanhu/mcp`）

> 在 [`MCP_DESIGN.md`](./MCP_DESIGN.md) 方案定稿基础上的**工程实现蓝图**。  
> 读者：实现者 / Code Review；实现变更以本文件 + 代码为准。  
> 最后更新：2026-06-05

---

## 1. 目标与边界

### 1.1 第一期交付

| 交付项 | 说明 |
|--------|------|
| **Tool** | `lanhu_design`（4 mode） |
| **Resource** | `project-designs` |
| **Prompt** | 第二期；第一期可空注册或跳过 |
| **传输** | stdio（Cursor 默认）；HTTP 不做了 |
| **依赖** | 只调 `@lanhu/core`，不调 `server-nest` |

### 1.2 不做（第一期）

- `lanhu_resolve_invite_link`、`lanhu_page`、留言板
- 复制 `server-nest` 分步 HTTP 逻辑
- 外部 MCP tool 别名

---

## 2. 包与目录（已定稿：方案 A）

MCP 作为 **可运行入口** 放在仓库根 `mcp/`（与 `server-nest/` 同级），不进 `packages/*`。

| 包 | 角色 |
|----|------|
| `packages/lanhu-core` | 库：蓝湖 API、转换、`include` 单稿分析 |
| `server-nest/` | HTTP 调试 API（:3001） |
| **`mcp/`** | stdio MCP 进程（Cursor） |

### 2.1 目录结构

```text
mcp/
├── package.json          # name: @lanhu/mcp, bin: lanhu-mcp
├── tsconfig.json
├── config.example.env    # LANHU_COOKIE / DDS_COOKIE 说明
├── README.md
├── src/
│   ├── server.ts         # createServer + main(stdio)
│   ├── config.ts         # 读 env，校验 Cookie
│   ├── result.ts         # createToolResult / 错误格式化
│   ├── resources/
│   │   └── project-designs.ts
│   ├── prompts/          # 第二期
│   │   ├── frontend-dev.ts
│   │   └── design-review.ts
│   └── tools/
│       ├── index.ts      # registerAllTools
│       └── lanhu-design.ts   # 四 mode 分发 + MCP 响应格式化（不含 include 分支）
└── tests/
    ├── lanhu-design-schema.test.ts
    └── pick-design-names.test.ts
```

根 `package.json` workspaces 增加 **`"mcp"`**（与 `"server-nest"` 写法一致）。

`packages/lanhu-core` 新增（include 逻辑，供 MCP / server / 调试台共用）：

```text
packages/lanhu-core/src/pipeline/
├── analyze-design.ts     # 编排：list、pick、batch、persist（变薄）
└── analyze-include.ts    # ★ 单文件：AnalyzeInclude、默认、analyzeDesignWithInclude
```

### 2.2 依赖

```json
{
  "name": "@lanhu/mcp",
  "dependencies": {
    "@lanhu/core": "*",
    "@modelcontextprotocol/sdk": "^1.18.1",
    "zod": "^4.1.12"
  },
  "bin": {
    "lanhu-mcp": "./dist/server.js"
  }
}
```

### 2.3 与三层关系

```text
Cursor / Claude Desktop
    │  stdio MCP
    ▼
mcp/                    ← 本设计（参数、格式化、Resource）
    │  import
    ▼
packages/lanhu-core/    ← 已有 listDesigns / analyzeDesign / getSlices …
    │
    ▼
蓝湖 API

server-nest / debug-react   ← 独立，MCP 不依赖
```

---

## 3. 配置

### 3.1 环境变量

与 `server-nest` / `.env.example` 对齐：

| 变量 | 必填 | 说明 |
|------|------|------|
| `LANHU_COOKIE` | 是 | 蓝湖 Cookie |
| `DDS_COOKIE` | 否 | 默认回退 `LANHU_COOKIE` |

启动时无 Cookie → `ConfigurationError`，tool 返回 `isError: true` 友好文案。

### 3.2 Cursor `mcp.json` 示例

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

开发期可用 `tsx mcp/src/server.ts` 或 `npm run dev -w @lanhu/mcp`。

---

## 4. Tool：`lanhu_design`

### 4.1 Input Schema（Zod）

```typescript
const IncludeOption = z.enum(["html", "image", "tokens", "layout", "layers"]);

const inputSchema = {
  url: z.string().min(1),
  mode: z.enum(["list", "analyze", "slices", "tokens"]).default("analyze"),
  design_names: z.union([z.string(), z.array(z.string())]).optional(),
  include: z.array(IncludeOption).optional(),              // 仅 analyze
  with_slices: z.boolean().optional(),                     // 仅 analyze，B 套，默认 false
  // slices 专用（第一期可先实现，第二期文档化）
  slice_format: z.enum(["png", "webp", "svg"]).optional(),
  slice_scale: z.string().optional(),                      // 1x / 2x / ios_2x …
};
```

**命名**：MCP 侧用 snake_case（`design_names`、`with_slices`）；内部映射 `@lanhu/core` 的 camelCase。

### 4.2 Tool Description（给模型看）

要点写入 `registerTool` description：

1. **Workflow**：`mode=list`（或 Resource）→ 确认 `design_names` → `analyze` / `slices` / `tokens`
2. **list 与 analyze 分离**：analyze **不**返回全量 designs
3. **slices**：B 套 `getSlices` + scaleUrls；webp/png 用 `slice_format`
4. **mapping**：在 `analyze` + `include: html` 的 `structuredContent.convert.mapping`（A 套）
5. **detailDetach**：有 `image_id` 时 list 仅 1 张

### 4.3 分发流程

```text
registerLanhuDesignTool(server)
    │
    ├─ loadConfig() → LanhuClient(cookie, ddsCookie)
    ├─ parseLanhuUrl(url)
    ├─ listDesigns(client, url)          // 所有 mode 共用（list 直接返回）
    │
    ├─ mode === "list"
    │     → createToolResult(summary, { projectName, totalDesigns, designs })
    │
    ├─ mode !== "list" && !design_names
    │     → isError + hint: available_designs[]
    │
    ├─ pickDesigns(designs, design_names, parsed.docId)
    │     → 空 → isError + available_designs
    │
    ├─ mode === "slices"  → handleSlicesMode(...)
    ├─ mode === "tokens"  → handleTokensMode(...)
    └─ mode === "analyze" → handleAnalyzeMode(...)
```

### 4.4 各 mode 实现映射

| mode | core 调用 | MCP 层额外工作 |
|------|-----------|----------------|
| **list** | `listDesigns` | 裁剪 designs 字段（index/id/name/width/height/sectors?） |
| **analyze** | 见 §5 | 格式化 content（text + 可选 image）、structuredContent |
| **slices** | `getSlices` + `pickDesign`（单稿取第一张） | 可选 `applyFormatToScaleUrl`；附 `slice_format` / `slice_scale` |
| **tokens** | `getSketchJson` + `extractDesignTokens` | 多稿 `mapConcurrent(5)`；纯文本 sections |

**`design_names: "all"`**：

- **analyze**：调 `analyzeDesignBatch`（core 已有）
- **tokens**：MCP 层并发调 sketch+tokens
- **slices**：只取 **`targetDesigns[0]`**；传 `"all"` 也仅处理第一张，响应可加 `warning`

---

## 5. `mode=analyze` 与 `include`（core 单文件，已定稿）

**已定稿**：`include` 放在 **`packages/lanhu-core/src/pipeline/analyze-include.ts`**；`analyze-design.ts` 负责 list / pick / batch / persist。MCP、`server-nest`、调试台共用 core。

### 5.1 `analyze-include.ts`

```typescript
export type AnalyzeInclude = "html" | "image" | "tokens" | "layout" | "layers";

export const DEFAULT_ANALYZE_INCLUDE: AnalyzeInclude[] =
  ["html", "tokens", "layers", "image"];

export function resolveAnalyzeInclude(include?: AnalyzeInclude[]): Set<AnalyzeInclude>;

/** 单稿分析；按 include 守卫各产物是否写入结果 */
export async function analyzeDesignWithInclude(
  client: LanhuClient,
  ctx: { teamId?: string; projectId: string },
  design: LanhuDesignSummary,
  options: { include?: AnalyzeInclude[]; withSlices?: boolean },
): Promise<AnalyzeDesignSliceResult>;

// analyze-design.ts 对外
export interface AnalyzeDesignOptions {
  include?: AnalyzeInclude[];
  withSlices?: boolean;
}
```

`analyze-design.ts`：`analyzeDesign` → `analyzeDesignWithInclude` → 可选 `persistAnalyzeArtifacts`。

| include | 当前 core | 补强后 |
|---------|-----------|--------|
| html | ✅ 固定跑 | `include` 含 html 才 Schema/Sketch convert |
| image | ⚠️ 仅 persist | **含 image 即** `fetchBinaryUrl(design.url)` → `previewImage` |
| tokens | ✅ 固定跑 | 含 tokens 才 extract |
| layout | ⚠️ Schema 时 | 含 layout 且 Schema 成功才 summary |
| layers | ✅ 固定跑 | 含 layers 才 layerTree |
| slices | `withSlices` | **不进 include**；保持 `with_slices` 或 `mode=slices` |

### 5.2 MCP analyze 输出格式

`createToolResult` 文本 + structuredContent，例如：

```typescript
interface LanhuDesignAnalyzeStructured {
  status: "success" | "error";
  mode: "analyze";
  projectName?: string;
  params: LanhuUrlParams;
  designs: Array<{
    design: LanhuDesignSummary;
    convertSource?: "schema" | "sketch";
    htmlCode?: string;
    imageUrlMapping?: Record<string, string>;
    layoutSummary?: string;
    layerTree?: string;
    designTokens?: string;
    warnings: string[];
    slices?: LanhuSlicesResult;  // with_slices 时
  }>;
}
```

**content 数组**：

1. `text`：人类可读 summary（HTML 成功数、Sketch fallback 数、warnings）
2. `image`（可选）：`include` 含 image 时 base64 封面（每张稿一条）

**体积控制**：`htmlCode` 可截断 preview 字段 + 全量在 structuredContent；或提供 `html_max_chars`（第二期）。

---

## 6. `mode=slices`（B 套）

```typescript
// 流程
const design = targetDesigns[0];
const slicesResult = await getSlices(client, design.id, teamId, projectId, true);

// 可选后处理（复用 core slice-scale-urls）
import { applyFormatToScaleUrl } from "@lanhu/core"; // 需 export

if (slice_format && slice_format !== "svg") {
  for (const slice of slicesResult.slices) {
    if (slice.downloadUrl) slice.downloadUrl = applyFormatToScaleUrl(...);
    if (slice.scaleUrls) { /* 各 scale 键同样处理 */ }
  }
}
```

返回 `structuredContent`：`totalSlices`、`sliceScale`、`slices[]`（含 `scaleUrls`）。

**与 analyze 分工**：默认不在 analyze 里带 slices；`with_slices: true` 仅当用户明确要一次拿 HTML + B 套列表。

---

## 7. `mode=tokens`

```typescript
for (const design of targetDesigns) {
  const sketch = await getSketchJson(client, design.id, teamId, projectId);
  const tokens = extractDesignTokens(sketch.sketch);
  sections.push(`--- ${design.name} ---\n${tokens}`);
}
```

不拉 Schema/HTML；并发上限 5。

---

## 8. Resource：`project-designs`

文件：`src/resources/project-designs.ts`

```typescript
server.resource(
  "project-designs",
  new ResourceTemplate("lanhu://project/{pid}/designs?tid={tid}", { list: undefined }),
  { description: "List all design images in a Lanhu project" },
  async (uri, { pid, tid }) => {
    const url = `https://lanhuapp.com/web/#/item/project/stage?pid=${pid}&tid=${tid}`;
    const result = await listDesigns(client, url);
    return {
      contents: [{
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify({
          projectName: result.projectName,
          totalDesigns: result.totalDesigns,
          designs: result.designs.map(d => ({
            index: d.index, id: d.id, name: d.name,
            width: d.width, height: d.height,
          })),
        }, null, 2),
      }],
    };
  },
);
```

与 `mode=list` 同源；给 Agent 轻量发现画板。

---

## 9. Prompt（第二期）

| Prompt | 文件 | 行为 |
|--------|------|------|
| `frontend-dev` | `prompts/frontend-dev.ts` | 生成像素级还原 user message |
| `design-review` | `prompts/design-review.ts` | 生成走查 user message |

第一期 `server.ts` 可留注释占位，不注册。

---

## 10. 错误与校验

| 场景 | 返回 |
|------|------|
| 无 Cookie | `isError: true`，`ConfigurationError` 文案 |
| 省略 `mode` | 默认 **`analyze`** |
| 非 list 缺 `design_names` | `isError` + `hint` + `available_designs` |
| pick 无匹配 | 同上 |
| 蓝湖 418 / 网络 | `isError` + `message` + 可选 `requestUrl` |
| slices 缺 tid | `isError` + hint 换 stage URL |

统一 `src/result.ts`：

```typescript
export function createToolResult(text: string, structured?: object, isError?: boolean);
export function createToolError(error: unknown, context?: object);
```

---

## 11. 实施分期

### Phase A — 可跑通 Cursor（优先）

- [x] `mcp/` 脚手架 + 根 workspaces 注册 `"mcp"` + stdio server
- [x] `lanhu_design`：`list` / `slices` / `tokens`
- [x] Resource `project-designs`
- [x] `mcp.json` 示例写入 `mcp/README.md`

### Phase B — analyze 对齐 TS

- [x] core：`analyze-include.ts` + `include` + image 不依赖 persist
- [x] `lanhu_design`：`mode=analyze` + `include` + 多稿 batch
- [x] content 含 image 块

### Phase C — 抛光

- [ ] `slice_format` / `slice_scale` 后处理
- [ ] Prompt 两个
- [x] 单测 `resolveAnalyzeInclude` 默认
- [ ] 手动 Cursor 验收清单

---

## 12. 测试策略

| 层级 | 内容 |
|------|------|
| **单测** | `design_names` 解析、`include` 默认、错误 JSON 结构（mock core） |
| **集成** | 有 Cookie 时 against 真实 URL（`vitest` `it.skip` 默认，CI 不跑） |
| **手工** | Cursor 连 stdio：list → analyze 一张 → slices webp |

不在 MCP 包内重复 core 的 converter 单测。

---

## 13. 关键文件（实现时打开）

| 用途 | 参考 |
|------|------|
| MCP tool 编排 | `mcp/src/tools/lanhu-design.ts` |
| MCP 原型 tool | `mcp/src/tools/lanhu-page.ts` |
| MCP Resource/Prompt | `mcp/src/resources/`、`mcp/src/prompts/` |
| core analyze 编排 | `packages/lanhu-core/src/pipeline/analyze-design.ts` |
| core include 单稿 | `packages/lanhu-core/src/pipeline/analyze-include.ts` |
| core slices | `packages/lanhu-core/src/lanhu/designs.ts` → `getSlices` |
| format URL | `packages/lanhu-core/src/transform/slice-scale-urls.ts` |
| 方案定稿 | `docs/MCP_DESIGN.md` |

---

## 14. 已定稿的设计选择（2026-06-05）

| # | 项 | 定稿 |
|---|-----|------|
| 1 | **包位置** | **方案 A**：根目录 **`mcp/`** workspace（`@lanhu/mcp`），与 `server-nest/` 同级 |
| 2 | **`mode`** | **默认 `analyze`** |
| 3 | **`include`** | **`@lanhu/core`** 单文件 `pipeline/analyze-include.ts`；MCP 只透传 + 格式化 |
| 4 | **`include` 默认** | `["html","tokens","layers","image"]`；**不含 `slices`** |
| 5 | **`slices` + `"all"`** | 只取 **`targetDesigns[0]`**，可加 warning |
| 6 | **防误用** | 非 `list` 时 **`design_names` 必填** |

按 **Phase A → B** 开工。
