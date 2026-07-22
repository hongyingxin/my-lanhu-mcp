# 蓝湖外网 API 参考（`@lanhu/core` 已用）

> 非蓝湖官方公开文档，由 Web 端行为逆向并在 `@lanhu/core` 中封装。  
> 代码位置：`packages/lanhu-core/src/lanhu/`、`packages/lanhu-core/src/types.ts`。  
> 最后更新：2026-07-22

---

## 1. 总览

| 域名 | 用途 |
|------|------|
| `https://lanhuapp.com` | 主 API（JSON 信封） |
| `https://dds.lanhuapp.com` | DDS Schema 修订查询 |
| 响应里的 CDN URL | Schema / Sketch / 预览图 / 切图 |
| `https://axure-file.lanhuapp.com` | 原型 Axure 静态资源（相对路径会拼此前缀） |

**认证**：有效登录 **Cookie**（`LANHU_COOKIE`）。DDS 域默认复用同一 Cookie。

**本仓库 HTTP/MCP** 不直接暴露下表端点，经 `server-nest` → `@lanhu/core` 或 MCP → `@lanhu/core` 调用。

---

## 2. 通用约定

### 2.1 JSON 信封（`lanhuapp.com` / `dds.lanhuapp.com`）

除 CDN 直链外，主站与 DDS 接口返回形如：

```json
{
  "code": "00000",
  "msg": "success",
  "data": { },
  "result": { }
}
```

| 字段 | 说明 |
|------|------|
| `code` | 成功：`0` / `"0"` / `"00000"`（见 `isLanhuSuccessCode`） |
| `msg` | 错误信息 |
| `data` / `result` | 业务载荷，core 取 **`data ?? result`** |

失败时 `LanhuClient.getLanhuPayload` 抛 `LanhuApiError`。

### 2.2 请求 Header

**主站**（`LanhuClient` · `createLanhuFetch` 非 DDS）：

| Header | 值 |
|--------|-----|
| `Cookie` | 登录 Cookie |
| `Referer` | `https://lanhuapp.com/web/` |
| `Accept` | `application/json, text/plain, */*` |
| `request-from` | `web` |
| `real-path` | `/item/project/product` |
| `User-Agent` | Chrome 风格 UA |

**DDS 域**（`dds.lanhuapp.com`）：

| Header | 值 |
|--------|-----|
| `Cookie` | 同主 Cookie 或 body 传入的 ddsCookie |
| `Referer` | `https://dds.lanhuapp.com/` |
| `Authorization` | `Basic dW5kZWZpbmVkOg==` |

### 2.3 CDN / 直链

- **无**上述 JSON 信封，响应体即为 JSON 文件或二进制。
- Schema URL 由 DDS 接口返回；Sketch / 原型 mapping 由 `versions[0].json_url` 给出。
- 资源 URL 常为完整 `https://...` 或相对路径（原型 assets 拼 `axure-file.lanhuapp.com`）。

---

## 3. 设计稿 API

### 3.1 `GET /api/project/images`

拉取项目内**全部 UI 设计稿**列表。

| 项 | 内容 |
|----|------|
| **域名** | `lanhuapp.com` |
| **core** | `listDesigns` → `LanhuClient.getLanhuPayload` |

**Query 入参**

| 参数 | 必填 | 说明 |
|------|------|------|
| `project_id` | 是 | 项目 ID（URL `pid`） |
| `team_id` | 是 | 团队 ID（URL `tid`） |
| `dds_status` | 否 | core 固定 `1` |
| `position` | 否 | core 固定 `1` |
| `show_cb_src` | 否 | core 固定 `1` |
| `comment` | 否 | core 固定 `1` |

**回参 `data`（常用字段）**

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | 项目名称 |
| `images[]` | array | 设计稿列表 |
| `images[].id` | string | 设计稿 ID（`image_id`） |
| `images[].name` | string | 画板名 |
| `images[].width` / `height` | number | 尺寸 |
| `images[].url` | string | 列表缩略/封面 URL |
| `images[].has_comment` | boolean | 是否有评论 |
| `images[].update_time` | string | 更新时间 |
| `images[].latest_version` | string | 最新版本 ID（部分场景） |

**core 映射**：`LanhuProjectImagesPayload` → `LanhuDesignSummary[]`（`source: projectImages`）。

---

### 3.2 `GET /api/project/project_sectors`

设计稿**分组**（文件夹）及稿与分组关系。

| 项 | 内容 |
|----|------|
| **core** | `listDesigns` 内 `getProjectSectors` |

**Query 入参**

| 参数 | 必填 | 说明 |
|------|------|------|
| `project_id` | 是 | 项目 ID |

**回参 `data`（常用字段）**

| 字段 | 类型 | 说明 |
|------|------|------|
| `sectors[]` | array | 分组树 |
| `sectors[].id` | string | 分组 ID |
| `sectors[].name` | string | 分组名 |
| `sectors[].parent_id` | string | 父分组 ID |
| `sectors[].order` | number | 排序 |
| `sectors[].images` | string[] | 该组下 `image_id` 列表 |

**core 映射**：`normalizeDesignSectors` → `LanhuDesignSectorSummary[]` + `image_id → sectors` 映射。

---

### 3.3 `GET /api/project/image`

单张设计稿或原型文档的**详情**（含版本列表）。设计稿与原型**共用路径**，query 不同。

#### 3.3a 设计稿详情（有 team）

| 项 | 内容 |
|----|------|
| **core** | `getDesignDocument` → `getSketchJson` / `getSlices` |

**Query 入参**

| 参数 | 必填 | 说明 |
|------|------|------|
| `image_id` | 是 | 设计稿 ID |
| `team_id` | 是 | 团队 ID |
| `project_id` | 是 | 项目 ID |
| `dds_status` | 否 | core 固定 `1` |
| `all_versions` | 否 | core 固定 `0` |

#### 3.3b 单稿 URL / 无 team（detailDetach）

| 参数 | 必填 | 说明 |
|------|------|------|
| `pid` | 是 | 项目 ID |
| `image_id` | 是 | 设计稿 ID |

**core**：`getDocumentInfo` · `listDesigns`（detailDetach 单稿）

#### 3.3c 原型文档详情

| 参数 | 必填 | 说明 |
|------|------|------|
| `pid` | 是 | 项目 ID |
| `image_id` | 是 | 文档 ID（同 `docId`） |

**core**：`getPrototypeDocumentInfo` · `listPages` · `downloadResources`

**回参 `data`（常用字段）**

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 稿/文档 ID |
| `name` | string | 名称 |
| `type` | string | 类型 |
| `width` / `height` | number | 画布尺寸（设计稿） |
| `url` | string | 封面/预览相关 URL |
| `has_comment` | boolean | |
| `update_time` / `create_time` | string | |
| `versions[]` | array | 版本列表（**取 `[0]` 为最新**） |
| `versions[].id` | string | 版本 ID |
| `versions[].json_url` | string | Sketch JSON 或 Axure mapping JSON 的 CDN URL |
| `versions[].version_info` | string | 版本描述 |

**core 类型**：`LanhuDocumentInfo` · `LanhuVersionInfo`。

---

### 3.4 `GET /api/project/multi_info`

项目维度的**多图摘要**，用于查某稿的 `latest_version`（Schema 链路）或原型项目元信息。

| 项 | 内容 |
|----|------|
| **core** | `getDesignSchemaJson` · `listDesigns`（detailDetach 可选）· `listPages`（原型） |

**Query 入参（设计稿 / Schema）**

| 参数 | 必填 | 说明 |
|------|------|------|
| `project_id` | 是 | 项目 ID |
| `team_id` | 否 | 有则传 |
| `img_limit` | 否 | core 固定 `500` |
| `detach` | 否 | core 固定 `1` |

**Query 入参（原型 listPages 附加）**

| 参数 | 必填 | 说明 |
|------|------|------|
| `project_id` | 是 | |
| `team_id` | 是 | |
| `doc_info` | 否 | core 固定 `1` |

**回参 `data` / `result`（常用字段）**

| 字段 | 类型 | 说明 |
|------|------|------|
| `images[]` | array | 项目内各稿摘要 |
| `images[].id` | string | `image_id` |
| `images[].latest_version` | string | **Schema 用的 version_id** |
| `project_name` / `name` | string | 项目名 |
| `creator_name` | string | 原型 list 时可能附带 |
| `folder_name` | string | |
| `save_path` | string | core 映射为 `project_path` |
| `member_cnt` | number | |

**core 类型**：`LanhuProjectMultiInfoPayload`。

---

### 3.5 `GET /api/dds/image/store_schema_revise`（DDS 域）

根据 `version_id` 获取 **DDS Schema 文件 URL**。

| 项 | 内容 |
|----|------|
| **域名** | `dds.lanhuapp.com` |
| **core** | `getDdsSchemaRevision` → `getDesignSchemaJson` |

**Query 入参**

| 参数 | 必填 | 说明 |
|------|------|------|
| `version_id` | 是 | 来自 `multi_info.images[].latest_version` |

**回参 `data`（常用字段）**

| 字段 | 类型 | 说明 |
|------|------|------|
| `data_resource_url` | string | Schema JSON 的 CDN URL |

**core 类型**：`LanhuSchemaRevisionPayload`。

---

### 3.6 CDN `GET` — Schema JSON

| 项 | 内容 |
|----|------|
| **URL** | `store_schema_revise.data_resource_url` |
| **core** | `LanhuClient.getJson(schemaUrl, { dds: true })` |

**入参**：无 query（完整 URL）。

**回参**：DDS Schema 对象（大 JSON 树）。core 作 `UnknownRecord` 交给 `convertLanhuSchema`。

**core 产出**：`LanhuDesignSchemaJsonResult`（`schema`、`schemaUrl`、`versionId`）。

---

### 3.7 CDN `GET` — Sketch JSON

| 项 | 内容 |
|----|------|
| **URL** | `document.versions[0].json_url` |
| **core** | `getSketchJson` → `getJson(jsonUrl)` |

**回参（结构因稿而异，core 常用）**

| 字段 | 说明 |
|------|------|
| `meta` | 宿主信息（如 Figma / Sketch） |
| `layers` / 图层树 | 切图、标注、tokens 来源 |
| `sliceScale` / `exportScale` | 切图倍率 |

**core 产出**：`LanhuSketchJsonResult`（`sketch`、`documentInfo`、`jsonUrl`）。

---

### 3.8 CDN `GET` — 二进制（预览图 / 切图 / 资源）

| 项 | 内容 |
|----|------|
| **core** | `LanhuClient.fetchBinaryUrl` |

**入参**

| 项 | 说明 |
|----|------|
| `url` | 完整 CDN URL（若含 `x-oss-process` 则保留 query，否则 strip query） |
| `Referer` | 默认 `https://lanhuapp.com/web/` |

**回参（core 封装，非蓝湖 JSON）**

| 字段 | 类型 | 说明 |
|------|------|------|
| `data` | string | Base64 |
| `contentType` | string | MIME |

---

## 4. 原型 / PRD API

### 4.1 `GET /api/project/product_documents`

项目下**全部 PRD/Axure 文档**列表（无 `docId` 时第一步）。

| 项 | 内容 |
|----|------|
| **core** | `listProductDocuments` |

**Query 入参**

| 参数 | 必填 | 说明 |
|------|------|------|
| `team_id` | 是 | |
| `project_id` | 是 | |

**回参 `data`（常用字段）**

| 字段 | 类型 | 说明 |
|------|------|------|
| `resources[]` | array | 文档列表（core 遍历此项） |
| `resources[].id` | string | `doc_id` |
| `resources[].name` | string | 文档名 |
| `resources[].type` | string | 如 `axure` |
| `resources[].last_version_num` | any | |
| `resources[].latest_version` | any | |
| `resources[].create_time` / `update_time` | string | |
| `default_group_id` | any | |
| `doc_can_download` | any | |
| `need_group` | any | |

**core 产出**：`ProductDocumentsListResult`（含合成 `doc_url`）。

---

### 4.2 原型 mapping CDN JSON

由 `getPrototypeDocumentInfo` → `versions[0].json_url` 取得，**无 JSON 信封**。

**回参（项目级 mapping，常用字段）**

| 字段 | 类型 | 说明 |
|------|------|------|
| `pages` | object | `{ [html文件名]: PageEntry }` |
| `pages[html].html.sign_md5` | string | HTML 文件 CDN 路径或 URL |
| `pages[html].mapping_md5` | string | 该页资源 mapping 的 CDN 路径 |
| `sitemap.rootNodes` | array | 页面树（listPages 用） |

**`sitemap.rootNodes[]` 节点（listPages 解析）**

| 字段 | 说明 |
|------|------|
| `pageName` | 页面展示名 |
| `url` | HTML 文件名（如 `xxx.html`） |
| `id` | 页面节点 ID（对应 URL `pageId`） |
| `type` | 如 `Wireframe` / `Folder` |
| `children` | 子节点 |

**core 产出**：`LanhuPagesListResult`（`pages: LanhuPageEntry[]`）。

---

### 4.3 页级 mapping CDN JSON

URL：`normalizeAssetUrl(page.mapping_md5)` → 常为 `axure-file.lanhuapp.com/...`

**回参（常用字段）**

| 字段 | 说明 |
|------|------|
| `styles` | `{ 本地相对路径: { sign_md5 } }` |
| `scripts` | 同上 |
| `images` | 同上 |

**core**：`downloadPageResources` 下载到 Axure 目录。

---

### 4.4 CDN `GET` — 原型 HTML / 静态文件

| 项 | 内容 |
|----|------|
| **core** | `downloadResources` · `fetchText` / `fetchBytes` |

| 资源 | URL 来源 |
|------|----------|
| HTML | `pages[html].html.sign_md5` |
| CSS/JS/图片 | 页级 mapping 的 `sign_md5` |

相对路径统一经 `normalizeAssetUrl` 拼 `https://axure-file.lanhuapp.com/`。

**core 产出**：`DownloadResourcesResult`（`version_id`、`output_dir`、`status`）。

---

## 5. 调用链（core 编排）

### 5.1 设计稿 Schema → HTML

```text
GET /api/project/multi_info          → images[].latest_version
GET /api/dds/image/store_schema_revise (dds) → data_resource_url
GET {schema CDN URL}                 → schema JSON
  → convertLanhuSchema (本地)
```

### 5.2 设计稿 Sketch fallback

```text
GET /api/project/image               → versions[0].json_url
GET {sketch CDN URL}                 → sketch JSON
  → convertLanhuSketch (本地)
```

### 5.3 设计稿列表

```text
GET /api/project/project_sectors     → 可选，失败仅 warning
GET /api/project/images              → designs[]
```

detailDetach 单稿：

```text
GET /api/project/multi_info          → 可选
GET /api/project/image (pid+image_id) → 1 条 design
```

### 5.4 原型 analyze

```text
GET /api/project/product_documents   → 选 doc（或无 docId 时）
GET /api/project/image (pid+docId)   → versions[0]
GET {mapping json_url}               → pages + sitemap
GET axure CDN (html + assets)        → 落盘 axure_extract_*
  → fixHtmlFiles → renderPrototypePages (Playwright，非 HTTP)
```

---

## 6. core 函数 ↔ 蓝湖端点

| core 函数 | 蓝湖端点 / 资源 |
|-----------|-----------------|
| `listDesigns` | `project_sectors` + `project/images`；或 `project/image`（detailDetach） |
| `getDesignSchemaJson` | `multi_info` → `store_schema_revise` → Schema CDN |
| `getSketchJson` | `project/image` → Sketch CDN |
| `getSlices` | 同 Sketch + 本地解析 sketch 图层 |
| `listProductDocuments` | `product_documents` |
| `getPrototypeDocumentInfo` | `project/image` |
| `listPages` | `project/image` + `multi_info`? + mapping CDN + sitemap |
| `downloadResources` | 同上 + Axure CDN 批量 |
| `LanhuClient.fetchBinaryUrl` | 任意二进制 CDN URL |

---

## 7. 与本仓库 HTTP 的对应（简表）

| 蓝湖能力 | server-nest 调试入口 |
|----------|----------------------|
| 设计稿列表 | `POST /api/designs/list` |
| 分组 | `POST /api/designs/sectors` |
| 详情 / Sketch | `POST /api/designs/detail` · `sketch` |
| multi_info | `POST /api/designs/multi-info` |
| Schema 修订 | `POST /api/designs/schema-revise` |
| Schema 文件 | `POST /api/designs/schema` |
| 预览/切图代理 | `POST /api/designs/preview` |
| 原型文档列表 | `POST /api/pages/list-documents` |
| 原型页面列表 | `POST /api/pages/list` |
| 原型下载 | `POST /api/pages/download` |

完整 HTTP body 见 [`server-nest/README.md`](../server-nest/README.md)。

---

## 8. 说明与限制

- 字段表仅列出 **core 实际读取** 的键；蓝湖可能还有未使用字段。
- Schema / Sketch / mapping 的 CDN 结构随蓝湖版本变化，以落盘 JSON 为准。
- 官方未文档化接口，**Cookie 失效、字段变更** 见 [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md)。
