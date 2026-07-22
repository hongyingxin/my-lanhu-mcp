# Git 忽略说明

> 规则以仓库根目录 [`.gitignore`](../.gitignore) 为准。

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

**不提交**的 Markdown 示例：`data/README.md`、将来 `tests/fixtures/**/NOTES.md` 等。

---

## 2. analyze 落盘目录 `data/`

| 路径 | Git | 说明 |
|------|-----|------|
| `data/.gitkeep` | ❌ 忽略 | 仅占位，本地自建即可 |
| `data/README.md` | ❌ 忽略 | 说明见本文 §2，勿依赖仓库内副本 |
| `data/lanhu_designs/**` | ❌ 忽略 | analyze 写入的 HTML、mapping、schema、预览图等 |

落盘路径与文件命名：

```text
data/lanhu_designs/{projectId}/
  {设计名}.png
  {设计名}.html
  {设计名}.image-mapping.json
  {设计名}.schema.json / .sketch.json / .tokens.txt …
```

可通过 `LANHU_DATA_DIR` 把根目录指到仓库外。

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
2. 同步更新本文  
3. 误提交敏感文件：从 git 移除跟踪并轮换 Cookie  

---

## 5. 修订记录

| 日期 | 说明 |
|------|------|
| 2026-06-03 | 初版 |
| 2026-06-03 | 增加全局忽略 `.gitkeep`、`*.md`（`docs/` 与各 `README.md` 除外）；`data/` 不再提交 `.gitkeep` / `README.md` |
