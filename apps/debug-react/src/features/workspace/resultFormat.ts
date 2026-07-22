import type { RootState } from "@/store";
import type { ConvertDemo, InspectResultKey } from "@/api/types";
import {
  findPrototypePageResult,
  formatPrototypeDesignInfo,
  resolvePrototypeDisplayName,
} from "./prototypeResultUtils";

export function analyzeEmptyInsightHint(
  field: string,
  state: RootState,
): string {
  if (state.settings.useMock) {
    return "Mock 模式不会调用 analyze。请关闭 Mock，填写真实蓝湖 URL 与 Cookie 后点击「一键 analyze」。";
  }
  if (!state.inspect.analyzeResult) {
    return "尚未执行 analyze。请点顶部或左侧「一键 analyze」（POST /api/designs/analyze），不要只点分步「Schema JSON / Sketch JSON」。";
  }
  const hints: Record<string, string> = {
    layoutSummary:
      "响应无 layoutSummary：需 analyze 成功拉取 Schema（URL 含 teamId）。见 Warnings / Schema Tab。",
    layerTree:
      "响应无 layerTree：需 analyze 成功拉取 Sketch（board 或 artboard）。见 Warnings / Sketch Tab。",
    sketchAnnotations:
      "响应无 sketchAnnotations：需 analyze 成功拉取 Sketch，或点「Sketch 完整标注」。见 Warnings Tab。",
    layerAnnotations:
      "响应无 layerAnnotations：DDS 成功时 analyze 不会生成；请点「Sketch CSS 标注」或「Sketch → HTML」。",
    sketchHtml:
      "响应无 Sketch HTML：请点「Sketch → HTML」（POST /api/designs/convert-sketch），或 analyze 走 Sketch fallback。",
  };
  const warnings = state.inspect.results.warnings;
  const extra =
    Array.isArray(warnings) && warnings.length
      ? `\n\n最近 warnings：\n${(warnings as string[]).slice(0, 5).map((w, i) => `${i + 1}. ${w}`).join("\n")}`
      : "";
  return (hints[field] ?? "暂无数据") + extra;
}

export function formatResult(key: InspectResultKey | string, state: RootState): string {
  const { session, inspect } = state;

  if (key === "preview" && session.previewObjectUrl) {
    return JSON.stringify(inspect.results.preview, null, 2);
  }
  if (key === "htmlPreview") {
    return inspect.convertDemo
      ? `iframe 预览（远程切图 URL，共 ${inspect.convertDemo.after.cssRuleCount} 条 CSS 规则）`
      : "请先点击 Schema → HTML 或一键 analyze";
  }
  if (key === "schema" && session.schemaJson) {
    return JSON.stringify(session.schemaJson, null, 2);
  }
  if (key === "sketch" && session.sketchJson) {
    return JSON.stringify(session.sketchJson, null, 2);
  }
  if (key === "convertCss" && typeof inspect.results.convertCss === "string") {
    return inspect.results.convertCss;
  }
  if (key === "convertHtml" && typeof inspect.results.convertHtml === "string") {
    return inspect.results.convertHtml;
  }
  if (key === "convertHtmlFull" && typeof inspect.results.convertHtmlFull === "string") {
    return inspect.results.convertHtmlFull;
  }
  if (key === "convertMapping" && inspect.results.convertMapping) {
    return JSON.stringify(inspect.results.convertMapping, null, 2);
  }
  if (key === "analyze" && inspect.results.analyze) {
    return JSON.stringify(inspect.results.analyze, null, 2);
  }
  if (key === "warnings") {
    const w = inspect.results.warnings;
    if (!Array.isArray(w)) return "暂无数据";
    return w.length ? (w as string[]).map((item, i) => `${i + 1}. ${item}`).join("\n") : "无 warnings";
  }
  if (key === "designTokens" && inspect.results.designTokens) {
    return String(inspect.results.designTokens);
  }
  if (key === "layoutSummary") {
    if (inspect.results.layoutSummary) return String(inspect.results.layoutSummary);
    return analyzeEmptyInsightHint("layoutSummary", state);
  }
  if (key === "layerTree") {
    if (inspect.results.layerTree) return String(inspect.results.layerTree);
    return analyzeEmptyInsightHint("layerTree", state);
  }
  if (key === "sketchAnnotations") {
    if (inspect.results.sketchAnnotations) return String(inspect.results.sketchAnnotations);
    return analyzeEmptyInsightHint("sketchAnnotations", state);
  }
  if (key === "layerAnnotations") {
    if (inspect.results.layerAnnotations) return String(inspect.results.layerAnnotations);
    return analyzeEmptyInsightHint("layerAnnotations", state);
  }
  if (key === "sketchHtml") {
    if (typeof inspect.results.sketchHtml === "string") return inspect.results.sketchHtml;
    return analyzeEmptyInsightHint("sketchHtml", state);
  }

  if (key === "prototypePageText") {
    const item = findPrototypePageResult(state);
    if (!item?.page_text?.trim() || item.page_text.trim() === "undefined") {
      return "暂无页面文本。请重新分析（旧缓存可能无效）。";
    }
    const label = resolvePrototypeDisplayName(state, item);
    return `页面：${label}\n${"─".repeat(40)}\n${item.page_text}`;
  }

  if (key === "prototypeDesignInfo") {
    const item = findPrototypePageResult(state);
    const label = resolvePrototypeDisplayName(state, item);
    const body = formatPrototypeDesignInfo(item);
    if (body === "暂无数据") {
      return body;
    }
    return `页面：${label}\n${"─".repeat(40)}\n${body}`;
  }

  const data = inspect.results[key as InspectResultKey];
  if (data === null || data === undefined) return "暂无数据";
  return typeof data === "string" ? data : JSON.stringify(data, null, 2);
}

export function resultMeta(key: string, state: RootState): string {
  const text = formatResult(key, state);
  if (text === "暂无数据" || text.startsWith("请先") || text.startsWith("iframe")) return "";
  const lines = text.split("\n").length;
  return `${text.length.toLocaleString()} 字符 · ${lines.toLocaleString()} 行`;
}

export function formatLayerAnnotationsText(annotations: unknown): string {
  if (!Array.isArray(annotations) || annotations.length === 0) {
    return "暂无 layerAnnotations";
  }
  const lines: string[] = [`CSS annotations (${annotations.length} layers):`];
  for (const item of annotations) {
    if (!item || typeof item !== "object") continue;
    const la = item as {
      type?: string;
      name?: string;
      css?: Record<string, string>;
      text?: string;
      slice_url?: string;
    };
    const cssStr = Object.entries(la.css ?? {})
      .map(([k, v]) => `${k}: ${v}`)
      .join("; ");
    let line = `  [${la.type ?? "layer"}] ${la.name ?? "—"}: ${cssStr}`;
    if (la.text) line += ` | text="${la.text.slice(0, 50)}"`;
    if (la.slice_url) line += ` | slice=${la.slice_url}`;
    lines.push(line);
  }
  return lines.join("\n");
}

export function formatConvertBefore(before: ConvertDemo["before"]): string {
  if (!before || typeof before !== "object") return "暂无数据";
  const b = before as {
    stats?: { total?: number; byType?: Record<string, number> };
    root?: { type?: string; className?: string; width?: number; height?: number };
    matchedNodes?: Array<{ className?: string; node?: unknown }>;
    schemaCharCount?: number;
    schemaPreview?: string;
  };

  const typeSummary = Object.entries(b.stats?.byType || {})
    .sort((a, c) => c[1] - a[1])
    .map(([type, count]) => `${type}×${count}`)
    .join(", ");

  const lines = [
    `整棵 Schema 共 ${b.stats?.total ?? 0} 个节点（${typeSummary}）`,
    `根节点: ${b.root?.type || "—"} · .${b.root?.className || "—"} · ${b.root?.width ?? "—"}×${b.root?.height ?? "—"}`,
    "",
    "与右侧 CSS 摘要一一对应的节点:",
  ];

  for (const item of b.matchedNodes || []) {
    lines.push("", `--- .${item.className} ---`);
    lines.push(JSON.stringify(item.node, null, 2));
  }

  lines.push(
    "",
    `完整 Schema JSON（${b.schemaCharCount?.toLocaleString?.() ?? b.schemaCharCount} 字符，见右侧「Schema」Tab）:`,
    b.schemaPreview || "",
  );

  if ((b.schemaPreview || "").length < (b.schemaCharCount || 0)) {
    lines.push("", "…（Schema 摘要已截断）");
  }

  return lines.join("\n");
}
