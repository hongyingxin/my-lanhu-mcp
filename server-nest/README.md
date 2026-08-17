# @lanhu/server-nest

NestJS 版调试 HTTP 服务（默认入口，默认端口 **3001**）。

- 业务逻辑全部在 `@lanhu/core`（本服务只做 HTTP 入参校验与 `LanhuClient` 创建）
- Cookie：请求 `body.cookie` 优先，否则 `.env` 的 `LANHU_COOKIE`（DDS 默认复用同一 Cookie；body 可传 `ddsCookie` / `dds_cookie` 覆盖）

```bash
npm run dev -w @lanhu/server-nest   # 或根目录 npm run dev:server
```

调试台 `apps/debug-react` 只请求 `http://localhost:3001/api/...`，不直连蓝湖。

**架构与 env** → [`../docs/CONTEXT.md`](../docs/CONTEXT.md) · **排错** → [`../docs/TROUBLESHOOTING.md`](../docs/TROUBLESHOOTING.md) · **原型 HTTP 细节** → [`../docs/PROTOTYPE_AND_MCP.md`](../docs/PROTOTYPE_AND_MCP.md) §5

---

## 调用关系说明

```text
debug-react  →  POST /api/...  →  DesignsService / ApiController
                                    →  @lanhu/core 函数 或  LanhuClient 方法
                                    →  （部分步骤）HTTP 访问蓝湖 / DDS / CDN
```

| 术语 | 含义 |
|------|------|
| **core 本地处理** | 只在 Node 内存中计算（如 `parseLanhuUrl`、`convertLanhuSchema`），不向蓝湖发请求 |
| **访问蓝湖外网** | `LanhuClient` 向 `lanhuapp.com`、`dds.lanhuapp.com` 或资源 CDN URL 发 HTTP |

除下列注明外，设计稿接口均需有效 Cookie，否则返回 503。

---

## 基础接口 `ApiController`

| HTTP | Service | `@lanhu/core` / 其它 | 访问蓝湖外网 | 主要 body |
|------|---------|----------------------|--------------|-----------|
| `GET /api/health` | — | 读 `LANHU_COOKIE` 是否存在 | 否 | — |
| `POST /api/parse-url` | 内联 | **`parseLanhuUrl(url)`** | 否 | `url` |

---

## 设计稿接口 `DesignsController` → `DesignsService`

| HTTP | Service 方法 | 调用的 core / `LanhuClient` | 访问蓝湖外网 | 主要 body |
|------|--------------|-----------------------------|--------------|-----------|
| `POST /api/designs/list` | `listDesigns` | **`listDesigns(client, url)`**（`parseLanhuUrl` → `getProjectSectors` → `GET /api/project/images`，合并分组） | 是 | `url` |
| `POST /api/designs/sectors` | `sectors` | **`client.getProjectSectors(projectId)`** | 是 | `project_id` / `projectId` |
| `POST /api/designs/detail` | `detail` | 有 `teamId`：**`getDesignDocument`**；否则 **`getDocumentInfo`** | 是 | `project_id`, `image_id`, `team_id?` |
| `POST /api/designs/multi-info` | `multiInfo` | **`getProjectMultiInfo`**（`img_limit=500`, `detach=1`） | 是 | `project_id`, `team_id?` |
| `POST /api/designs/schema-revise` | `schemaRevise` | **`getDdsSchemaRevision(versionId)`** | 是（dds） | `version_id` / `versionId` |
| `POST /api/designs/schema` | `schema` | **`getDesignSchemaJson(client, imageId, teamId, projectId)`** | 是 | `project_id`, `image_id`, `team_id?` |
| `POST /api/designs/sketch` | `sketch` | **`getSketchJson(client, imageId, teamId, projectId)`** | 是 | 同上 |
| `POST /api/designs/convert-sketch` | `convertSketch` | **`getSketchJson`** → **`convertLanhuSketch`** | 是 / 否 | `project_id`, `image_id`, `team_id?` |
| `POST /api/designs/sketch-layer-annotations` | `sketchLayerAnnotations` | **`getSketchJson`** → **`convertLanhuSketch`**（仅 `layerAnnotations`） | 是 / 否 | 同上 |
| `POST /api/designs/sketch-annotations` | `sketchAnnotations` | **`getSketchJson`** → **`extractFullAnnotationsFromSketch`** | 是 / 否 | 同上 |
| `POST /api/designs/convert` | `convert` | 见下表 **convert 分支** | 视 body | `schema?` 或 `project_id` + `image_id` + `designName?` |
| `POST /api/designs/preview` | `preview` | **`client.fetchBinaryUrl(url)`** | 是（CDN 等） | `url` |
| `POST /api/designs/slices` | `slices` | **`getSlices(client, imageId, teamId, projectId)`** | 是 | `project_id`, `image_id`, `team_id?` |
| `POST /api/designs/analyze` | `analyze` | 单稿/批量；默认落盘 `data/lanhu_designs/{pid}/`；响应含 `artifacts`、`previewImage`(base64) 等 | 是 | `url`, `design?`, `withSlices?`, `persistArtifacts?` |

### `POST /api/designs/convert` 分支

| body 条件 | 调用链 | 访问蓝湖外网 | Cookie |
|-----------|--------|--------------|--------|
| 带有 **`schema` 对象** | **`convertLanhuSchema(schema, designName)`** | **否** | 不需要 |
| 无 `schema`，有 **`projectId` + `imageId`** | **`getDesignSchemaJson`** → **`convertLanhuSchema`** | 是 | 需要 |

---

## core 内部链路（便于对照分步调试）

### `getDesignSchemaJson`（`packages/lanhu-core/src/designs.ts`）

1. `client.getProjectMultiInfo`
2. `client.getDdsSchemaRevision`
3. `client.getJson(schemaUrl)` 下载 schema 文件

### `getSketchJson`

1. `getDesignDocument` 或 `getDocumentInfo`
2. `client.getJson(versions[0].json_url)`

### `analyzeDesign`（`packages/lanhu-core/src/pipeline/analyze-design.ts`）

| 步骤 | 方法 | 访问蓝湖外网 |
|------|------|--------------|
| 解析 URL | `parseLanhuUrl` | 否 |
| 列表 + 选稿 | `listDesigns` → `pickDesign` | 是 / 否 |
| Schema 路 | `getDesignSchemaJson` → `convertLanhuSchema` | 是 / 否 |
| Sketch | `getSketchJson` | 是 |
| Tokens | `extractDesignTokens` | 否 |
| Fallback | `convertLanhuSketch` | 否 |
| 可选切图 | `getSlices`（`withSlices: true`） | 是 |

---

## 路由一览（用途）

| 路由 | 用途 |
|------|------|
| `GET /api/health` | 探活；返回 server 是否配置了 `.env` 里的 `LANHU_COOKIE` |
| `POST /api/parse-url` | 从蓝湖链接解析 `tid` / `pid` / `image_id` 等，不访问蓝湖 |
| `POST /api/designs/list` | **设计稿列表**（主入口）：拉项目下全部设计图，并合并分组、`aiSuggestion`；调试台「拉列表」、analyze 内部都会用 |
| `POST /api/designs/sectors` | 仅拉 **项目分组**（`project_sectors`）；list 已含分组时可不调，留给分步排错 |
| `POST /api/designs/detail` | 单张设计稿 **详情**（`project/image`）：尺寸、版本、封面等元数据 |
| `POST /api/designs/multi-info` | 项目 **多图摘要**，主要为了拿某稿的 `latest_version` / `version_id`，供后续 schema 链路使用 |
| `POST /api/designs/schema-revise` | 已知 `version_id` 时，查 DDS **Schema 修订**（`data_resource_url`），分步调试 schema 第 1 步 |
| `POST /api/designs/schema` | **下载 Schema JSON**（multi_info → schema_revise → CDN），供查看或交给 convert |
| `POST /api/designs/sketch` | **下载 Sketch JSON**（图层树、标注、PS 切图信息等），无 Schema 或要做 Sketch fallback 时用 |
| `POST /api/designs/convert-sketch` | **Sketch → HTML**（+ mapping），分步调试 Sketch fallback |
| `POST /api/designs/sketch-layer-annotations` | 仅返回 Sketch 转换中的 **CSS 图层标注**（`layerAnnotations`） |
| `POST /api/designs/sketch-annotations` | 仅返回 Sketch **标注文本**（`sketchAnnotations`） |
| `POST /api/designs/convert` | **Schema → HTML**（+ mapping）。body 带 `schema` 则只算不拉蓝湖；否则先拉 schema 再转 |
| `POST /api/designs/preview` | 按 URL **代理下载二进制**（预览图、切图 CDN 等），返回 base64，给调试台展示/打包下载 |
| `POST /api/designs/slices` | **切图 B 套**：登记切图列表 + `scaleUrls` 多倍率链接 |
| `POST /api/designs/analyze` | **一键流水线**：list → 选稿 → schema 转 HTML（失败则 sketch fallback）→ tokens → 可选 `withSlices`（仅附带 B 套元数据，见下） |

**切图 A 套 / B 套（当前 vs 计划）**

| 套 | 来源 | 当前怎么拿到 | 计划 |
|----|------|--------------|------|
| **A** | Schema/sketch 转换 `mapping` | analyze / convert **默认**；调试台「从 mapping 载入」下载 | `sliceSource: "mapping"` |
| **B** | `getSlices` · 设计师登记切图 | 单独 `POST /api/designs/slices`，或 analyze 传 `withSlices: true` | `sliceSource: "slices"` |
| **both** | — | 需分别调两次 | `sliceSource: "both"`（待实现） |

analyze **不会**默认批量下载 A 套 mapping 里每张 PNG；落盘仅有 `*.image-mapping.json` 与整稿 `*.png` 预览。

```text
GET  /api/health
POST /api/parse-url
POST /api/designs/list | sectors | detail | multi-info | schema-revise
POST /api/designs/schema | sketch | convert-sketch | sketch-layer-annotations | sketch-annotations
POST /api/designs/convert | preview | slices | analyze
POST /api/pages/list-documents | list | download | analyze | analyze-local
GET  /api/pages/screenshot
```

**日常建议**：联调优先 `list` + `analyze`；要拆问题再用中间路由；切图下载用 `slices` + `preview`。

---

## 原型接口 `PagesController` → `PagesService`

原型 URL 须为 `#/item/project/product?tid=...&pid=...`；列页/下载/分析须带 `docId`（或 body 传 `doc_id` / `image_id`）。

| HTTP | Service 方法 | `@lanhu/core` | 访问蓝湖外网 | 主要 body |
|------|--------------|---------------|--------------|-----------|
| `POST /api/pages/list-documents` | `listDocuments` | **`listProductDocuments`** | 是 | `url` |
| `POST /api/pages/list` | `list` | **`listPages`** | 是 | `url` + docId |
| `POST /api/pages/download` | `download` | **`downloadResources`** | 是 | `url` + docId；`force_update?` |
| `POST /api/pages/analyze` | `analyze` | **`analyzePrototypePages`**（含 Playwright） | 是 | `url` + docId；**`page_names`**（必填） |
| `POST /api/pages/analyze-local` | `analyzeLocal` | **`analyzeLocalPage`** | 否 | `outputDir` + `pageName`（已下载目录内重分析） |
| `GET /api/pages/screenshot` | — | 读 `LANHU_DATA_DIR` 下截图文件 | 否 | query `path` |

参数细节、落盘目录与 MCP `lanhu_page` 差异见 [`../docs/PROTOTYPE_AND_MCP.md`](../docs/PROTOTYPE_AND_MCP.md) §4–§6。

---

## 与调试台 / Mock

- 非 Mock：上表接口由调试台调用，蓝湖请求均在 **server 进程** 内完成。
- Mock 若只加载本地 JSON 再 **`POST /convert` 且 body 带 `schema`**：只走 core 转换，**不访问蓝湖**（可删浏览器内 `converter`，与线上一致）。

源码入口：

- `src/api/api.controller.ts`
- `src/designs/designs.controller.ts`
- `src/designs/designs.service.ts`
- `src/pages/pages.controller.ts`
- `src/pages/pages.service.ts`
- `src/lanhu/lanhu-client.service.ts`
