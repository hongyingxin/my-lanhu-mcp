# MCP `mode=slices` — B 套切图下载（功能设计）

> **状态**：已实现（2026-08-14）。  
> **范围**：`lanhu_design` · `mode=slices`（**仅 B 套**）；v1 不含 A 套 mapping、不含 CLI。  
> **关联**：[`MCP_DESIGN.md`](./MCP_DESIGN.md) §4.3、[`BACKLOG.md`](./BACKLOG.md) §P1、[`CHANGELOG.md`](./CHANGELOG.md) §0.1.2（C-JSON mirror 已发布部分）。

---

## 1. 背景与目标

### 1.1 问题

当前 `mode=slices` 仅调用 `getSlices()` 返回 **元数据 + URL 目录**（含 C-JSON 镜像）。Agent 仍需自行 fetch 或写脚本落盘，与原始设计「**直接下载指定切图**」不符。

调试台（`SliceDownloadPanel`）已在浏览器内实现 B 套下载（format / scale / 选图），但 **MCP 与 core 未复用**。

### 1.2 目标（v1）

一次 MCP 调用完成：

```text
url + design_names? + slice_format? + slice_scale? + slice_names? + output_dir?
  → 从蓝湖拉 B 套切图元数据
  → 按 format / scale 解析下载 URL
  → 写入本地 assets/slices/
  → 返回落盘路径 + 元数据（content 镜像 JSON）
```

### 1.3 非目标（v1）

| 项 | 说明 |
|----|------|
| A 套 mapping 下载 | 走 `mode=analyze` + `include:slices`；`slice_source=mapping` 另立项 |
| `download` 开关 | **不做**；`mode=slices` 默认即下载 |
| `file_names` / 业务重命名 | **不做**；文件名保留蓝湖原名（最小安全化）；标准命名由 **AI 在项目内**处理 |
| 文件名 `@2x` 后缀 | **不做**；倍率仅体现在图片像素，不进文件名 |
| MCP `content[]` 切图 base64 | **不做**（多图 token 过大） |
| 独立 CLI | **不做**；仅 **core + MCP** |
| HTTP `POST /api/designs/download-assets` | v1 可选跟进；优先 MCP |

---

## 2. 与 A/B 套的关系

| 套 | 数据源 | MCP 入口 |
|----|--------|----------|
| **A** | `convert.after.mapping` | `mode=analyze` + `include: "slices"`（文本 mapping，不自动落盘切图） |
| **B** | `getSlices()` + `scaleUrls` | **`mode=slices`（本文）** |

`with_slices`（analyze 附加 B 套 JSON）**不在 v1 改动**；长期可收敛为 `sliceSource`（见 core README）。

---

## 3. 参数约定

### 3.1 Schema（`lanhu_design`）

```typescript
lanhu_design({
  url: string,                              // 必填
  mode: "slices",
  design_names?: string | string[],         // 选稿；规则同 analyze（可省略条件见 MCP_DESIGN §3.2）

  slice_format?: "png" | "webp" | "svg",    // 默认 "png"
  slice_scale?: string,                     // 默认 "2x"（Web 通用倍率，见 scaleUrls 键名）
  slice_names?: string | string[],          // 默认：全部切图；可指定蓝湖 slice.name 或 id

  output_dir?: string,                      // 落盘根目录；见 §4
})
```

**无** `download`、`file_names`、`slice_source` 字段。

### 3.2 默认值

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `slice_format` | **`png`** | Web 场景常用；需 webp 时显式传入 |
| `slice_scale` | **`2x`** | 对应 `scaleUrls["2x"]`；iOS/Android 键名如 `ios_2x`、`android_xhdpi` 可显式传 |
| `slice_names` | 全部 | 不传则下载 `slices[]` 每一项 |
| `output_dir` | 见 §4.2 | 未传时用 `LANHU_DATA_DIR/lanhu_designs/{pid}/{designId}_{slug}/` 为根 |

### 3.3 `slice_names` 匹配规则

- 字符串：精确匹配 `LanhuSliceInfo.name` 或 `id`
- 数组：多个名称/id
- 无匹配：**`isError`** + `available_slices: string[]`（名称列表）
- 不传：下载全部（`totalSlices` 张）

### 3.4 URL 解析

复用 core / 调试台逻辑：

1. `slice_scale` → `slice.scaleUrls[slice_scale]`，若无则回退 `downloadUrl`
2. `slice_format` → `applyFormatToScaleUrl(url, format)`（`packages/lanhu-core/src/transform/slice-scale-urls.ts`）
3. `slice_format === "svg"` → 优先 `svgUrl`，忽略 scale

---

## 4. 落盘路径

### 4.1 方案 X（定稿）

**`output_dir` 表示落盘根目录**；文件**始终**写入：

```text
{root}/assets/slices/{filename}
```

与 HTML 转换中 `./assets/slices/` 约定一致（`localize-image-urls.ts`）。

### 4.2 默认根目录（未传 `output_dir`）

```text
root = {LANHU_DATA_DIR}/lanhu_designs/{pid}/{designId}_{slug}/
```

| 变量 | 解析 |
|------|------|
| `LANHU_DATA_DIR` | 环境变量；默认 **`{repoRoot}/data`**（`resolveLanhuDataDirAnchored`，相对路径锚定仓库根） |
| `{pid}` | URL 解析的 `projectId` |
| `{designId}_{slug}` | 蓝湖 `image_id` + `_` + 画板名安全化（`resolveDesignDirSegment`） |

**示例**（仓库 `/Users/hong/个人/project/lanhu-node`，`pid=dfb2e434-...`，`designId=214c0a95-...`，画板名 `画板 3`）：

```text
/Users/hong/个人/project/lanhu-node/data/lanhu_designs/dfb2e434-.../214c0a95-..._画板 3/assets/slices/title.png
```

### 4.3 用户指定 `output_dir`

```json
{ "output_dir": "/Users/hong/工作/jujing/faha/vite-vue/src/views" }
```

→ 写入（**不追加** `{designId}_{slug}` 层）：

```text
/Users/hong/工作/jujing/faha/vite-vue/src/views/assets/slices/title.png
```

**注意**：MCP 进程 cwd **不等于** Cursor 打开的前端项目；要进业务仓库须 **显式传** `output_dir`。

### 4.4 与 analyze 落盘的关系

| 能力 | 目录 |
|------|------|
| analyze 落盘（HTML、预览、mapping JSON） | `{LANHU_DATA_DIR}/lanhu_designs/{pid}/{designId}_{slug}/` 下各 `{画板名}.*` |
| slices 下载（v1） | 同上根 + **`assets/slices/`** 子目录 |

共用 `{pid}` 层级，便于同一项目 artifacts 集中。

---

## 5. 文件名规则

### 5.1 定稿

| 规则 | 说明 |
|------|------|
| 基础名 | 蓝湖 `slice.name`（或 `id` 回退） |
| 安全化 | **仅**文件系统必需：去掉 `/\`、过长截断等（与 `sanitizeFilename` 同级，**不做**业务语义替换） |
| 扩展名 | 由 `slice_format` 决定：`.png` / `.webp` / `.svg` |
| 倍率后缀 | **不加** `@2x`（与调试台 zip 内命名脱钩） |

示例：

| 蓝湖 name | 输出文件名（format=png） |
|-----------|-------------------------|
| `title` | `title.png` |
| `702 拷贝 3` | `702_拷贝_3.png`（或保留中文，实现取 OS 安全策略） |

### 5.2 AI 负责标准命名

- **不在代码中**将 `702 拷贝 3` → `promo-banner` 等
- Agent 根据返回 JSON 中的 `slice_name`、`size`、`position` 等在项目内 **rename / 改引用**
- 与 A 套 HTML 中 `image_1.png` 类路径的对齐，也在 **还原流程**中由 Agent 处理

---

## 6. Core 层（`@lanhu/core`）

### 6.1 新增能力（拟）

```typescript
/** B 套切图：解析 URL + 可选过滤 + 下载落盘 */
export async function downloadDesignSlices(
  client: LanhuClient,
  ctx: { teamId?: string; projectId: string },
  design: LanhuDesignSummary,
  options: {
    sliceFormat?: "png" | "webp" | "svg";
    sliceScale?: string;
    sliceNames?: string | string[];
    outputRoot: string;           // §4 的 root，函数内 append assets/slices
  },
): Promise<DownloadDesignSlicesResult>;
```

**`DownloadDesignSlicesResult`（拟）**：

```typescript
{
  designId: string;
  designName: string;
  outputRoot: string;
  outputDir: string;              // {outputRoot}/assets/slices
  sliceFormat: string;
  sliceScale: string;
  totalSlices: number;
  downloaded: number;
  failed: number;
  files: Array<{
    sliceName: string;
    sliceId?: string;
    file: string;                 // 文件名
    path: string;                 // 绝对路径
    url: string;                  // 实际 fetch 的 URL
    bytes: number;
    size?: string;                // 蓝湖 size 字段
  }>;
  warnings?: string[];
  slices?: LanhuSlicesResult;     // 原始元数据（可选附带，供 mirror）
}
```

### 6.2 实现要点

- 内部：`getSlices()` → 过滤 `slice_names` → 逐张 `client.fetchBinaryUrl` 或 `fetch`
- 路径：`join(outputRoot, "assets", "slices", filename)`
- 逻辑可自 `apps/debug-react/.../slice-download.ts` 抽离，**去掉** `@scale` 文件名规则
- 导出 `applyFormatToScaleUrl`（若尚未从 core index 导出）

### 6.3 单测

- URL 解析：format / scale / svg 分支（mock slice）
- 文件名安全化
- `slice_names` 过滤与错误结构

---

## 7. MCP 层（`@lanhu/mcp`）

### 7.1 流程

```text
mode === "slices"
  → listDesigns + pickDesign（现有）
  → resolve outputRoot（§4）
  → downloadDesignSlices(...)
  → createToolResult(summary, structured, mirrorKey=lanhu_design:slices)
```

### 7.2 响应

**`content[0].text`**：

```text
Downloaded 9 slice(s) to .../assets/slices (png@2x).

## 切图清单

| 蓝湖文件名 | 尺寸 | 说明 | 修改后名称 |
|------------|------|------|------------|
| title | 716×212 | | |
| 702 拷贝 3 | 702×188 | | |

{ ...structured JSON mirror... }
```

- **表格**：MCP 填「蓝湖文件名」「尺寸」；「说明」「修改后名称」留空，由 Agent 在同一会话补全后执行 `mv`
- **映射**：JSON `inventory[]` 另含 `disk_file`（当前落盘名）、`path`（绝对路径），便于 Agent 重命名
- 摘要 + 表格 + C-JSON 镜像（[`structured-content-mirror.ts`](../mcp/src/structured-content-mirror.ts)）

**`structuredContent`**：与 mirror 同源，供 Inspector。

### 7.3 Tool description 更新要点

- `mode=slices`：**下载 B 套切图**到 `{output_dir}/assets/slices/`（非仅 URL 列表）
- 默认 `png` + `2x`；`slice_names` 可筛指定切图
- 要进前端项目须传 `output_dir`

---

## 8. 验收标准

1. `mode=slices` 无额外开关即落盘；默认路径 `{LANHU_DATA_DIR}/lanhu_designs/{pid}/{designId}_{slug}/assets/slices/`
2. 传 `output_dir` 时文件在 `{output_dir}/assets/slices/`
3. 默认 `slice_format=png`、`slice_scale=2x`；传 `webp` 时文件扩展名与 OSS 参数正确
4. `slice_names` 过滤生效；无匹配报错含 `available_slices`
5. 文件名无 `@2x`；基于蓝湖原名安全化
6. `content` 含可 parse 的 JSON 镜像，且含 `inventory[]`（含 `disk_file`、`path` 映射字段）
7. `content` 含固定 Markdown 切图清单表（蓝湖文件名 / 尺寸 / 说明 / 修改后名称）
8. 单测 + 手工：用 stage URL + `image_id` 下载 9 张切图（与现有测试画板一致）

---

## 9. 实现任务（v1）

| # | 模块 | 任务 |
|---|------|------|
| 1 | core | `downloadDesignSlices` + 类型 + 导出 `applyFormatToScaleUrl`（如需） |
| 2 | core | 从 debug-react 抽离/对齐 URL 解析（避免双份 drift） |
| 3 | core | 单测 |
| 4 | mcp | Zod：`slice_format` / `slice_scale` / `slice_names` / `output_dir` |
| 5 | mcp | slices 分支改调 core 下载；更新 tool description |
| 6 | mcp | 响应 structured + summary 文案 |
| 7 | docs | CHANGELOG 新版本条目；BACKLOG 本项标完成 |
| 8 | 可选 | `server-nest` `/api/designs/slices` 增加 download  query/body（**非 v1 阻塞**） |

---

## 10. 后续（非 v1）

| 项 | 说明 |
|----|------|
| `slice_source=mapping` | A 套下载，需 convert，另立设计 |
| HTTP `download-assets` | 与 MCP 共用 core |
| CLI | 薄封装 core，按需再加 |
| `lanhu_design:selection_error` mirror | P0 剩余，独立项 |

---

## 11. 参考代码

| 路径 | 用途 |
|------|------|
| `packages/lanhu-core/src/lanhu/designs.ts` | `getSlices` |
| `packages/lanhu-core/src/transform/slice-scale-urls.ts` | `applyFormatToScaleUrl` |
| `packages/lanhu-core/src/persist/data-dir.ts` | `resolveLanhuDataDir`、`resolveDesignOutputDir` |
| `apps/debug-react/src/features/slices-download/slice-download.ts` | 调试台下载（参考，v1 文件名去掉 `@scale`） |
| `mcp/src/tools/lanhu-design.ts` | MCP 入口 |
| `mcp/src/structured-content-mirror.ts` | C-JSON mirror |
