import type { ResultTabGroup } from "@/store/uiSlice";

export const CONSOLE_STAGES = [
  { id: "connect" as const, label: "连接", desc: "Cookie · URL · Mock · 服务状态" },
  { id: "design" as const, label: "选稿", desc: "设计稿列表与切换" },
  { id: "pipeline" as const, label: "分析", desc: "一键 analyze · 分步 API（12 个）" },
  { id: "convert" as const, label: "转换", desc: "Schema / Sketch 转换演示" },
  { id: "results" as const, label: "结果", desc: "请求日志 · 分组检视" },
  { id: "slices" as const, label: "切图", desc: "A/B 套下载" },
] as const;

export const RESULT_TABS = [
  { key: "analyze", label: "Analyze", group: "analyze" as ResultTabGroup },
  { key: "warnings", label: "Warnings", group: "analyze" as ResultTabGroup },
  { key: "designTokens", label: "Design Tokens", group: "analyze" as ResultTabGroup },
  { key: "layoutSummary", label: "布局摘要", group: "analyze" as ResultTabGroup },
  { key: "layerTree", label: "图层树", group: "analyze" as ResultTabGroup },
  { key: "sketchAnnotations", label: "Sketch 标注", group: "analyze" as ResultTabGroup },
  { key: "htmlPreview", label: "页面预览", group: "convert" as ResultTabGroup },
  { key: "convertCss", label: "转换后 CSS", group: "convert" as ResultTabGroup },
  { key: "convertHtml", label: "HTML Body", group: "convert" as ResultTabGroup },
  { key: "convertHtmlFull", label: "完整 HTML", group: "convert" as ResultTabGroup },
  { key: "convertMapping", label: "切图映射", group: "convert" as ResultTabGroup },
  { key: "schema", label: "Schema", group: "raw" as ResultTabGroup },
  { key: "sketch", label: "Sketch", group: "raw" as ResultTabGroup },
  { key: "designDetail", label: "设计详情", group: "raw" as ResultTabGroup },
  { key: "multiInfo", label: "multi_info", group: "raw" as ResultTabGroup },
  { key: "schemaRevise", label: "schema_revise", group: "raw" as ResultTabGroup },
  { key: "sectors", label: "分组", group: "raw" as ResultTabGroup },
  { key: "params", label: "URL 参数", group: "meta" as ResultTabGroup },
  { key: "designs", label: "设计列表", group: "meta" as ResultTabGroup },
  { key: "preview", label: "预览图", group: "meta" as ResultTabGroup },
] as const;

export const RESULT_TAB_GROUPS: { id: ResultTabGroup; label: string }[] = [
  { id: "analyze", label: "Analyze 产出" },
  { id: "convert", label: "转换 / HTML" },
  { id: "raw", label: "原始数据" },
  { id: "meta", label: "元信息" },
];

export function resultGroupForTab(key: string): ResultTabGroup {
  const tab = RESULT_TABS.find((t) => t.key === key);
  return tab?.group ?? "meta";
}

export function firstTabInGroup(group: ResultTabGroup): string {
  return RESULT_TABS.find((t) => t.group === group)?.key ?? "params";
}
