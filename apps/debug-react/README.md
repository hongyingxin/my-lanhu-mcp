# @lanhu/debug-react

蓝湖调试台 **React** 版（Vite + shadcn/ui + Redux Toolkit + React Router）。仅通过 HTTP 调 `server-nest`，无浏览器内本地转换。

## 技术栈

| 类别 | 选型 |
|------|------|
| UI | shadcn/ui（new-york）+ Tailwind CSS 4 |
| 状态 | Redux Toolkit（settings / session / inspect / slices / logs / ui） |
| 路由 | React Router 7 |
| HTTP | axios → `server-nest` :3001 |

## 开发

```bash
npm run dev:server   # :3001
npm run dev:react    # :5174
```

环境变量：`.env.development` → `VITE_API_BASE=http://localhost:3001`

## 路由

| 路径 | 说明 |
|------|------|
| `/` | 调试台（唯一主界面） |
| `/workspace`、`/health`、`/designs` | 重定向到 `/` |

## 调试台阶段（左侧 Tab）

| 阶段 | 内容 |
|------|------|
| 连接 | Cookie、URL、Mock、服务 health |
| 选稿 | 设计稿列表与上下文 |
| 分析 | 一键 analyze + **12 个分步 API 全暴露** |
| 转换 | Schema / Sketch 转换演示（HTML 预览） |
| 结果 | 请求日志 + **分组结果 Tab**（Analyze / 转换 / 原始 / 元信息） |
| 切图 | A/B 套下载 |

## 目录

```text
src/
├── api/                      # debug-api、parse-url
├── mock/data/                # 1.json–9.json（离线 Mock）
├── store/                    # RTK slices
├── features/
│   ├── workspace/            # 调试台主界面与 actions
│   └── slices-download/      # 切图下载工具
├── components/layout/        # AppShell
├── pages/
└── router.tsx
```

## 设计说明

- Schema 转换：**仅** `POST /api/designs/convert`（Mock 加载后亦走 server）
- 无浏览器内 `converter/` 本地转换

## list vs 一键 analyze

- **project/images**（`POST /api/designs/list`）→ 全项目设计稿列表，用于「选稿」。
- **一键 analyze**（`POST /api/designs/analyze`）→ 只深度分析**当前选中/URL 匹配的一张**，不会用 analyze 回填整份列表。
- 推荐顺序：连接 → **project/images** → 选稿 → analyze。详见 [`docs/MCP_DESIGN.md` §6](../../docs/MCP_DESIGN.md#6-list-与-analyze-的职责分工易混点)。
