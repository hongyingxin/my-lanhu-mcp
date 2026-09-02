# Git 忽略说明

> 规则以仓库根目录 [`.gitignore`](../.gitignore) 为准。  
> 落盘目录树详见 [`DATA_LAYOUT.md`](./DATA_LAYOUT.md)。

---

## 1. 必忽略（含敏感或可再生）

| 路径 / 模式 | 原因 |
|-------------|------|
| `node_modules/` | 依赖，由 `npm install` 生成 |
| `dist/`、`*.tsbuildinfo` | 各 workspace 编译产物 |
| `.env`、`.env.local`、`.env.*.local` | **蓝湖 Cookie** 等密钥；只用 [`.env.example`](../.env.example) 作模板 |
| `*.log` | 运行日志 |
| `coverage/`、`.vitest/` | 测试覆盖率与 vitest 缓存 |
| **`.gitkeep`** | 空目录占位，仅本地需要 |
| **`*.md`（默认）** | 本地说明类 Markdown 不纳入版本库 |

### 1.1 仍会提交的 Markdown（例外）

| 模式 | 示例 |
|------|------|
| 根 `README.md` | 项目入口 |
| `docs/**/*.md` | 路线图、本说明等 |
| 各包 / 应用 `README.md` | `packages/lanhu-core/README.md`、`apps/debug-react/README.md` 等 |

**不提交**的 Markdown 示例：`data/README.md`（本地备忘）、将来 `tests/fixtures/**/NOTES.md` 等。

---

## 2. 落盘目录 `data/`

| 路径 | Git | 说明 |
|------|-----|------|
| `data/.gitkeep` | ❌ 忽略 | 仅占位，本地自建即可 |
| `data/README.md` | ❌ 忽略 | 可选本地备忘；权威结构见 [`DATA_LAYOUT.md`](./DATA_LAYOUT.md) |
| `data/lanhu_designs/**` | ❌ 忽略 | 设计稿 analyze / slices 写入 |
| `data/lanhu_prototypes/**` | ❌ 忽略 | 原型 Axure 包、截图、mapping sidecar |

可通过 `LANHU_DATA_DIR` 把根目录指到仓库外（如 `/Users/hong/my-text-data`；内容同样不应提交）。

### 2.1 设计稿 `lanhu_designs/`（摘要）

完整列表与每个文件说明见 [`DATA_LAYOUT.md`](./DATA_LAYOUT.md) §1。

```text
data/lanhu_designs/{projectId}/{designId}_{画板名}/
  {slug}.png / .html / .css / .body.html / .sketch-fallback.html
  {slug}.image-mapping.json / .schema.json / .sketch.json
  {slug}.tokens.txt / .layout-summary.txt / .layer-tree.txt
  {slug}.sketch-annotations.txt / .layer-annotations.json
  {slug}.warnings.json / .slices.json / .analyze-meta.json
  assets/slices/                     # B 套切图 PNG（mode=slices）
```

### 2.2 原型 `lanhu_prototypes/`（摘要）

完整列表见 [`DATA_LAYOUT.md`](./DATA_LAYOUT.md) §2。

```text
data/lanhu_prototypes/{projectId}/{docId}_{文档名}/
  *.html, files/, resources/, …
  .lanhu-page-cache.json
  .lanhu-project-mapping.json
  .lanhu-download-sources.json
  .lanhu-page-mappings/
  screenshots/
```

---

## 3. 建议提交的内容

| 类型 | 示例 |
|------|------|
| 源码 | `packages/lanhu-core/src/`、`server-nest/`、`apps/debug-react/` |
| 文档 | `docs/*.md`（见 §1.1 例外） |
| Mock | `apps/debug-react/src/mock/data/*.json` |
| 测试代码 | `packages/lanhu-core/tests/*.test.ts` |

---

## 4. 修改忽略规则时

1. 改根目录 `.gitignore`  
2. 同步更新本文与 [`DATA_LAYOUT.md`](./DATA_LAYOUT.md)（若目录结构变化）  
3. 误提交敏感文件：从 git 移除跟踪并轮换 Cookie  

---

## 5. 修订记录

| 日期 | 说明 |
|------|------|
| 2026-06-03 | 初版 |
| 2026-06-03 | 增加全局忽略 `.gitkeep`、`*.md`（`docs/` 与各 `README.md` 除外）；`data/` 不再提交 `.gitkeep` / `README.md` |
| 2026-08-17 | 补全 `lanhu_designs` / `lanhu_prototypes` 落盘摘要；链到 `DATA_LAYOUT.md` |
