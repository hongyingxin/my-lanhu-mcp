# 本地落盘目录结构

> `{LANHU_DATA_DIR}` 默认 `{repoRoot}/data`（MCP 锚定仓库根，见 [`CHANGELOG.md`](./CHANGELOG.md) §0.1.3）。  
> Git 忽略规则见 [`GITIGNORE.md`](./GITIGNORE.md)。设计稿 MCP 用法见 [`CURSOR_MCP.md`](./CURSOR_MCP.md) §10.1；原型见 [`PROTOTYPE_AND_MCP.md`](./PROTOTYPE_AND_MCP.md) §4。

---

## 1. 设计稿 `lanhu_designs/`

触发：`POST /api/designs/analyze`（默认 `persistArtifacts: true`）、MCP `lanhu_design(mode=analyze)`（**始终落盘**）、MCP `mode=slices`（切图 PNG 子目录）。

```text
{LANHU_DATA_DIR}/lanhu_designs/{projectId}/{designId}_{画板名}/
  {slug}.png                         # 整稿预览
  {slug}.html                        # 主 HTML（Schema 或 Sketch）
  {slug}.css                         # Schema 路径才有
  {slug}.body.html                   # Schema 路径才有
  {slug}.sketch-fallback.html        # Schema 主 HTML + Sketch fallback 并存且不同时
  {slug}.image-mapping.json          # A 套 mapping
  {slug}.schema.json
  {slug}.sketch.json
  {slug}.tokens.txt
  {slug}.layout-summary.txt
  {slug}.layer-tree.txt
  {slug}.sketch-annotations.txt
  {slug}.layer-annotations.json
  {slug}.warnings.json               # 有 warnings 时
  {slug}.slices.json                 # with_slices / withSlices 且拉到 B 套元数据时（非 PNG）
  {slug}.analyze-meta.json           # 索引 + projectName / include / versionId / documentInfo / warnings 全文
  assets/slices/                     # mode=slices 下载的 B 套切图 PNG（可选 output_dir 改根）
    title.png
    …
```

**说明**

- `{slug}` = `safeDesignFilename(画板名)`，与目录段 `{designId}_{画板名}` 中的画板名一致。
- `include` 缺哪项，对应文件可能不存在（例如未跑 layout 则无 `.layout-summary.txt`）。
- B 套 **PNG** 不在 analyze 里批量下载；走 `mode=slices` 或 [`MCP_SLICES.md`](./MCP_SLICES.md)。
- REST 可用 `persistArtifacts: false` 关闭落盘；MCP analyze **无此开关**。

---

## 2. 原型 `lanhu_prototypes/`

触发：`POST /api/pages/download` / `analyze`、MCP `lanhu_page`（有 `docId` 时下载 + 分析）。

```text
{LANHU_DATA_DIR}/lanhu_prototypes/{projectId}/{docId}_{文档名}/
  *.html                             # Axure 页面 HTML
  files/  resources/  data/  images/ # Axure 静态资源
  .lanhu-page-cache.json             # 下载缓存（version_id / 页列表）
  .lanhu-project-mapping.json        # GET json_url 的完整项目 mapping
  .lanhu-download-sources.json       # json_url + 每页 sign_md5 / CDN URL
  .lanhu-page-mappings/              # 各页 mapping_md5 的页级 mapping
    {页面stem}.json
  screenshots/
    .screenshot_cache.json
    {页面stem}.png
    {页面stem}.txt
    {页面stem}_styles.json
```

> **旧路径（已废弃）**：`data/axure_extract_{docId前8位}/` + 并列 `*_screenshots/`（v0.1.3 以前）。

---

## 3. 相关文档

| 主题 | 文档 |
|------|------|
| MCP 设计稿 analyze | [`CURSOR_MCP.md`](./CURSOR_MCP.md) §3.1、§10.1 |
| MCP 原型 | [`CURSOR_MCP.md`](./CURSOR_MCP.md) §5.3 |
| CDN / 下载链路 | [`PROTOTYPE_AND_MCP.md`](./PROTOTYPE_AND_MCP.md) §3.4 |
| Git 忽略 | [`GITIGNORE.md`](./GITIGNORE.md) |
