# @lanhu/core

蓝湖设计稿解析的 **纯 Node 库**：URL 解析、蓝湖 HTTP、Schema/Sketch 转 HTML、切图元数据、一键流水线。

- **无** HTTP 服务、**无** Vue、**无** MCP
- 由 `server-nest`（或未来的 `mcp/`）`import` 后对外提供 API
- 权威行为对照：`~/个人/project/lanhu-text-mcp`（Python MCP）

```bash
npm run build -w @lanhu/core
npm run check -w @lanhu/core
```

测试用例目录：`tests/`（阶段 2 迁入 vitest，见根目录 `npm test`）。

HTTP 路由与调试台对应关系见 [`../../server-nest/README.md`](../../server-nest/README.md)。

---

## 在 monorepo 中的位置

```text
apps/debug-vue  →  server-nest  →  @lanhu/core  →  蓝湖 / DDS / CDN
mcp/（规划）    →  @lanhu/core
```

| 层 | 做什么 | 是否访问蓝湖外网 |
|----|--------|------------------|
| **拉数据** | `LanhuClient`、`listDesigns`、`getDesignSchemaJson`… | 是（需 Cookie） |
| **算结果** | `convertLanhuSchema`、`extractDesignTokens`、`normalizeDesignSectors`… | 否（只吃内存 JSON） |

---

## 目录结构

### 先记三层（比数文件夹重要）

`@lanhu/core` 是 **纯库**，没有 MCP / HTTP / Vue。和 `lanhu-mcp-server` 比，不是「多了一堆无用目录」，而是 **把 TS 仓库里的 `lanhu/` + `transform/` + 部分 `tools/design` 编排 + 落盘** 拆成可复用包：

```text
┌─────────────────────────────────────────────────────────────┐
│ 编排层   pipeline/analyze-design.ts  pipeline/concurrency.ts │
├─────────────────────────────────────────────────────────────┤
│ 蓝湖层   lanhu/*  client / parse-url / designs / sectors     │
│          pick-design                                         │
├─────────────────────────────────────────────────────────────┤
│ 转换层   transform/*  （只吃 JSON，不打蓝湖）                 │
├─────────────────────────────────────────────────────────────┤
│ 落盘层   persist/*    （可选，对齐 PY DATA_DIR）              │
└─────────────────────────────────────────────────────────────┘
         index.ts  types.ts  → 对外 export
```

日常改 bug：**列表/切图** → `lanhu/designs.ts`；**HTML/mapping** → `transform/`；**一键 analyze** → `pipeline/`；**写 data/** → `persist/`。

### `packages/lanhu-core/` 文件树（当前）

```text
packages/lanhu-core/
├── package.json
├── tsconfig.json
├── README.md
├── src/
│   ├── index.ts                 # 对外 export 汇总
│   ├── types.ts                 # 公共类型（保留根目录，全包引用）
│   ├── lanhu/                   # 蓝湖 HTTP + 列表 + 切图（对齐 lanhu-mcp-server）
│   │   ├── client.ts
│   │   ├── parse-url.ts
│   │   ├── designs.ts           # list / schema / sketch / getSlices（B 套，偏大）
│   │   ├── design-sectors.ts
│   │   └── pick-design.ts
│   ├── pipeline/
│   │   ├── analyze-design.ts    # analyzeDesign / analyzeDesignBatch
│   │   └── concurrency.ts       # 批量并发（默认 5）
│   ├── persist/
│   │   ├── data-dir.ts          # LANHU_DATA_DIR、安全文件名
│   │   └── analyze-artifacts.ts # 落盘 html / mapping / 预览图等
│   └── transform/
│       ├── convert-schema.ts    # Schema → HTML + mapping（A 套入口）
│       ├── schema-to-html.ts    # DDS 树 → HTML 字符串
│       ├── localize-image-urls.ts
│       ├── convert-sketch.ts    # Sketch fallback 入口
│       ├── sketch-to-html.ts
│       ├── sketch-utils.ts
│       ├── design-tokens.ts
│       ├── layer-tree.ts        # 图层树文本（TS 合在 design-tokens 里）
│       ├── layout-summary.ts
│       ├── sketch-annotations.ts
│       ├── slice-scale-urls.ts  # B 套 scaleUrls（TS 无此文件）
│       └── constants.ts
├── tests/                       # vitest（根目录 npm test）
│   ├── pick-design.test.ts
│   ├── get-slices.test.ts
│   ├── layer-tree.test.ts
│   ├── layout-summary.test.ts
│   └── data-dir.test.ts
└── dist/                        # tsc 产物（勿手改；勿提交陈旧 .js）
```

> `transform/` 文件多，是因为 **A 套 / Sketch fallback / 标注 / B 套 URL** 分文件；不是重复实现。`lanhu/designs.ts` 单文件较大，主因 **PY 级 B 套切图** 逻辑集中在此（后续可抽到 `lanhu/slices/` 子目录，见 ROADMAP §6.1.2）。

### 与 `lanhu-mcp-server` 目录对照

两边 **transform 主干同族**（schema/sketch HTML、annotations、tokens）；差异在 **NODE 拆库 + PY 对齐 + 无 MCP 壳**。

```text
lanhu-mcp-server/                    lanhu-node/packages/lanhu-core/
────────────────────────────────────────────────────────────────────
src/server.ts          MCP 入口       （无 → 将来 mcp/ + server-nest）
src/tools/
  design.ts            list/analyze/   pipeline/analyze-design.ts
                       slices/tokens   + pick-design + design-sectors
  page.ts              PRD             （NODE 不做）
  resolve-invite.ts                    （NODE 不做）
src/lanhu/
  client.ts            ≈              lanhu/client.ts + lanhu/parse-url.ts
  designs.ts           简化 getSlices   lanhu/designs.ts（+PS切图+scaleUrls）
  pages.ts             PRD             —
src/transform/
  schema-to-html.ts    ≈              schema-to-html + convert-schema
  sketch-to-html.ts    ≈              sketch-to-html + convert-sketch
  sketch-annotations   ≈              sketch-annotations
  design-tokens.ts     tokens+layerTree  design-tokens + layer-tree.ts
  layout-summary.ts    ≈              layout-summary.ts
  page-static-extractor   PRD          —
  （无 slice-scale-urls）              slice-scale-urls.ts
src/shared/*           工具            pipeline/concurrency.ts、src/types.ts
（无 persist）                          persist/*
tests-ts/              仓库根          tests/
```

| 你觉得「复杂」的点 | 原因 | TS 里对应物 |
|-------------------|------|-------------|
| 文件数比 TS `lanhu/`+`transform/` 多 | 编排、落盘、选稿、sectors 独立成文件 | 塞在 `tools/design.ts`（~460 行） |
| `designs.ts` 很长 | 完整 B 套切图（PY 标杆） | `lanhu/designs.ts` 更短、无 `scaleUrls` |
| `convert-schema` + `schema-to-html` 两层 | 方便 HTTP 只调 convert、单测 schema | TS 常直接 `convertSchemaToHtml` |
| `persist/` | 调试台 / analyze 落盘 `data/` | TS MCP 不落同样结构 |
| `dist/` 在仓库里可见 | 包发布 `main: dist/index.js` | TS 也有 `dist/`，但平时看 `src/` 即可 |

**行数粗算（仅 `src/`）**：`lanhu-core` ~6.4k；`lanhu-mcp-server` 的 `lanhu/`+`transform/` ~3.4k，再加 `tools/`+`shared/` ~1k ≈ 4.5k。库层 NODE 更大主要来自 **designs 切图 + persist + sectors + 增强 layout/layer**，不是目录拆错。

---

## 对外 API 一览

从 `import { … } from "@lanhu/core"` 导出，按模块说明用途。

### `lanhu/parse-url.ts`

| 导出 | 用途 |
|------|------|
| `parseLanhuUrl(input)` | 解析 stage / detailDetach 等链接或 query 字符串 |
| `buildQuery(params)` | 拼蓝湖 API query（内部/调试） |

### `lanhu/client.ts`

| 导出 | 用途 |
|------|------|
| `LanhuClient` | 带 Cookie 的蓝湖客户端 |
| `LanhuApiError` | API 非 `00000` 或 HTTP 失败 |
| `createLanhuFetch` | 注入统一 Header 的 fetch |
| `getLanhuPayload` / `getJson` | 通用 JSON 请求 |
| `getDocumentInfo` / `getDesignDocument` | 单稿详情 |
| `getProjectMultiInfo` | 项目多图、查 `latest_version` |
| `getDdsSchemaRevision` | DDS schema 修订 URL |
| `getProjectSectors` | 项目分组（`listDesigns` 内部也会调） |
| `fetchBinaryUrl` | 下载 CDN/预览图二进制（base64） |

构造：`new LanhuClient({ cookie, ddsCookie?, fetchImpl? })`。

### `lanhu/designs.ts`

| 导出 | 用途 | 访问蓝湖 |
|------|------|----------|
| `listDesigns(client, url \| params)` | 设计稿列表；合并 sectors、`aiSuggestion`（>8 张） | 是 |
| `getDesignSchemaJson(client, imageId, teamId, projectId)` | 拉 DDS Schema JSON | 是 |
| `getSketchJson(...)` | 拉 Sketch JSON + 文档信息 | 是 |
| `getSlices(...)` | **切图 B 套**：从 sketch 提取切图 + `scaleUrls` | 是 |

`listDesigns` 支持 `detailDetach` 单稿 URL（返回 1 条，不拉 sectors）。

### `lanhu/design-sectors.ts`

| 导出 | 用途 |
|------|------|
| `normalizeDesignSectors(raw)` | 分组路径、`image_id → 分组列表`（对齐 PY） |
| `sectorNamesForDesign(map, id)` | 单稿分组名数组 |
| `buildDesignListAiSuggestion(n)` | 设计过多时的 AI 提示文案 |

### `lanhu/pick-design.ts`

| 导出 | 用途 |
|------|------|
| `pickDesign` / `pickDesigns` | 按 index / 全名 / 子串选稿 |
| `normalizeDesignQuotes` | 弯引号 → 直引号 |

### `pipeline/analyze-design.ts`

| 导出 | 用途 |
|------|------|
| `analyzeDesign(options)` | 一键流水线（见下节） |
| `analyzeDesignBatch(options)` | 多稿并发（`pipeline/concurrency.ts`） |

`AnalyzeDesignOptions`：`url`、`design?`、`withSlices?`、`cookie`、`ddsCookie`。

### `transform/` — 本地处理（一般不访问蓝湖）

| 导出 | 用途 |
|------|------|
| `convertLanhuSchema(schema, designName)` | **A 套**：Schema → HTML + `mapping` |
| `convertLanhuToHtml` / `minifyHtml` / `localizeImageUrls` | 转换子步骤 |
| `convertLanhuSketch(sketch, opts)` | Sketch → HTML fallback |
| `convertSketchToHtml` | 底层 sketch 转 HTML |
| `extractDesignTokens(sketch)` | 设计 token 文本（供 AI） |
| `resolveDesignScale` / `resolveDesignImageUrl` | Sketch 辅助 |
| `buildScaleUrls` / `buildPsScaleUrls` / `applyFormatToScaleUrl` | **B 套** 多倍率 URL |

---

## `analyzeDesign` 流水线

对标 PY **`lanhu_mcp_server.py`** / MCP `lanhu_get_ai_analyze_design_result`（本地 `debug_design.py` 为同步骤调试脚本，见 `docs/COMPARISON_AND_ROADMAP.md` §1.1）：

```text
parseLanhuUrl
  → listDesigns
  → pickDesign
  → [有 teamId] getDesignSchemaJson → convertLanhuSchema     （convertSource: schema）
  → getSketchJson
  → extractDesignTokens
  → [schema 失败] convertLanhuSketch                         （convertSource: sketch）
  → [withSlices] getSlices
```

- 失败步骤写入 `warnings[]`，不中断整条（除非 list 等关键步失败）。
- 返回 `AnalyzeDesignResult`：`design`、`convert`、`schema`、`sketch`、`designTokens`、`layoutSummary`、`layerTree`、`sketchAnnotations`、`layerAnnotations`、`slices` 等。

---

## 切图：A 套 vs B 套

| 套 | 数据从哪来 | core 入口 | 典型用途 |
|----|------------|-----------|----------|
| **A** | `convert.after.mapping` | `convertLanhuSchema` → `localizeImageUrls` | HTML 内 `./assets/slices/*` 对照 CDN |
| **B** | 设计师登记切图 + 倍率 | `getSlices` + `buildScaleUrls` / `buildPsScaleUrls` | 下载 PNG/WebP、MCP 切图 tool |

两套互不替代；切图对齐以 **PY `get_design_slices`** 为准。

### 当前行为（实现现状）

| 入口 | A 套 | B 套 |
|------|------|------|
| `analyzeDesign` | **默认有**：Schema/sketch 转换产出 `convert.after.mapping` + HTML 本地路径 | **默认无**：仅当 `withSlices: true` 时在结果里附带 `slices`（元数据，不批量下载 PNG） |
| `POST /api/designs/slices` | — | 仅 B 套 |
| `POST /api/designs/convert` | 仅 A 套 | — |
| 调试台切图 Tab | 可手动切 `mapping` / `scaleUrls` 两源展示与下载 | 同左 |

`persistAnalyzeArtifacts` 默认只落盘 **整稿预览 PNG** + `image-mapping.json`，**不会**自动把 A 套 mapping 里每张图或 B 套切图全部下载到 `data/`。

### 计划：统一选择 A 套 / B 套（待做）

后续在 **analyze / MCP / 调试台 / 批量下载** 中支持显式选择切图源，避免 Agent 或前端混用两套路径：

| 计划参数（草案） | 取值 | 行为 |
|------------------|------|------|
| `sliceSource` 或 `assetSource` | `"mapping"` | 仅 A 套：用 `convert.after.mapping` 生成下载列表 |
| | `"slices"` | 仅 B 套：调 `getSlices`，用 `scaleUrls` / `downloadUrl` |
| | `"both"` | 两套都返回/都可选下载（去重策略待定） |

拟落地范围：

- `@lanhu/core`：`AnalyzeDesignOptions.sliceSource?`；按选择拉取/聚合，不与 `withSlices` 语义重复（`withSlices` 可收敛为 `sliceSource` 含 B 套）
- `server-nest`：`POST /api/designs/analyze` body 同上；可选 `POST /api/designs/download-assets` 按源批量落盘
- 阶段 3 MCP：`lanhu_design` · `analyze` 的 `include` 或独立字段与 TS `include: slices` 对齐，并增加 **mapping 资产** 说明
- `debug-vue`：已有 `sliceSource`（`mapping` \| `scaleUrls`），与 API 字段对齐命名

详见 [`docs/COMPARISON_AND_ROADMAP.md`](../../docs/COMPARISON_AND_ROADMAP.md) §6.1.2。

---

## 主要类型（`types.ts`）

| 类型 | 说明 |
|------|------|
| `LanhuUrlParams` | 解析后的 URL 参数 |
| `LanhuDesignSummary` / `LanhuDesignListResult` | 列表项与列表结果（含 `sectors`、`aiSuggestion`） |
| `LanhuDesignSchemaJsonResult` | schema + versionId + schemaUrl |
| `LanhuSketchJsonResult` | sketch + documentInfo |
| `LanhuSlicesResult` / `LanhuSliceInfo` | B 套切图列表 |
| `AnalyzeDesignResult` | 流水线聚合结果 |
| `ConvertLanhuSchemaResult` / `ConvertSketchResult` | 转换结果（before/after/mapping） |

---

## 使用示例

```ts
import {
  LanhuClient,
  listDesigns,
  analyzeDesign,
  convertLanhuSchema,
} from "@lanhu/core";

const client = new LanhuClient({ cookie: process.env.LANHU_COOKIE });

// 列表
const list = await listDesigns(client, "https://lanhuapp.com/web/#/item/project/stage?tid=...&pid=...");

// 仅转换（已有 schema，不访问蓝湖）
const convert = convertLanhuSchema(schemaObject, "首页");

// 一键（会访问蓝湖）
const analyzed = await analyzeDesign({
  url: "https://lanhuapp.com/web/#/item/project/stage?tid=...&pid=...",
  design: "6",
  withSlices: true,
  cookie: process.env.LANHU_COOKIE,
});
```

---

## 依赖与约束

- Node.js ≥ 20，`"type": "module"`
- 需要有效蓝湖 **Cookie**（`LANHU_COOKIE`；DDS 可用 `LANHU_DDS_COOKIE` 或回退同一 Cookie）
- 列表 / schema 等设计稿接口通常需要 URL 中的 **`tid`（team_id）**

---

## 相关文档

- 项目上下文：[`../../docs/CONTEXT.md`](../../docs/CONTEXT.md)
- 缺口与路线：[`../../docs/COMPARISON_AND_ROADMAP.md`](../../docs/COMPARISON_AND_ROADMAP.md)
- HTTP 路由说明：[`../../server-nest/README.md`](../../server-nest/README.md)
