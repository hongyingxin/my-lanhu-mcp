# @lanhu/debug-react

蓝湖调试台 **React** 版（Vite + shadcn/ui + Redux Toolkit）。仅 HTTP 调 `server-nest`，无浏览器内转换。

项目架构、Cookie、MCP → [`docs/CONTEXT.md`](../../docs/CONTEXT.md) · HTTP 路由 → [`server-nest/README.md`](../../server-nest/README.md) · 原型 Tab → [`docs/PROTOTYPE_AND_MCP.md`](../../docs/PROTOTYPE_AND_MCP.md) §5

## 开发

```bash
npm run dev:server   # :3001
npm run dev:react    # :5174
```

`.env.development`：`VITE_API_BASE=http://localhost:3001` · 根目录 `.env` 配 `LANHU_COOKIE`（见 [`docs/TROUBLESHOOTING.md`](../../docs/TROUBLESHOOTING.md)）。

## 调试台阶段（左侧 Tab）

| 阶段 | 内容 |
|------|------|
| 连接 | Cookie、URL、Mock、服务 health |
| 选稿 | 设计稿列表 |
| 分析 | 一键 analyze + 分步 API |
| 转换 | Schema / Sketch → HTML 预览 |
| 结果 | 请求日志 + 分组结果 Tab |
| 切图 | A/B 套下载 |
| 原型 | PRD 列表 / 下载 / 分析（见 `PrototypePanel`） |

路由：`/` 为唯一主界面（`/workspace` 等重定向到 `/`）。

## 目录

```text
src/
├── api/                   # debug-api、parse-url
├── mock/data/             # 离线 Mock JSON
├── store/                 # RTK slices
├── features/workspace/    # 主界面与 actions
├── features/slices-download/
└── components/layout/
```

## 本 app 约定

- Schema 转换只走 `POST /api/designs/convert`（含 Mock 加载后）
- 推荐流程：连接 → **list** → 选稿 → **analyze**（analyze 不会回填整份列表，见 [`docs/MCP_DESIGN.md` §6](../../docs/MCP_DESIGN.md#6-list-与-analyze-的职责分工易混点)）
