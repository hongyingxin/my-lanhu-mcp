import type { RootState } from "@/store";
import type {
  PrototypeAnalyzeResult,
  PrototypeAnalyzeResultItem,
  PrototypeDownloadSources,
  PrototypePageItem,
} from "@/api/types";
import type { AppDispatch } from "@/store";
import { setResult } from "@/store/inspectSlice";
import {
  extractDownloadSources,
} from "./prototypeDownloadSources";

export function pageFilenameStem(page: PrototypePageItem): string {
  return page.filename.replace(/\.html$/i, "");
}

export function resolvePrototypeAnalyzeResult(state: RootState): PrototypeAnalyzeResult | undefined {
  const data = state.inspect.results.prototypeAnalyze;
  if (!data || typeof data !== "object") {
    return undefined;
  }
  return data as PrototypeAnalyzeResult;
}

export function findPrototypePageResult(
  state: RootState,
  preferredName?: string | null,
): PrototypeAnalyzeResultItem | undefined {
  const analyze = resolvePrototypeAnalyzeResult(state);
  const results = analyze?.results?.filter((item) => item.success) ?? [];
  if (results.length === 0) {
    return undefined;
  }

  const selected = preferredName ?? state.session.selectedPrototypePageName;
  const pages = state.session.prototypePages;

  if (!selected) {
    return results[0];
  }

  const pageMeta = pages.find((page) => page.name === selected || pageFilenameStem(page) === selected);
  const candidates = new Set<string>([selected]);
  if (pageMeta) {
    candidates.add(pageMeta.name);
    candidates.add(pageFilenameStem(pageMeta));
  }

  return (
    results.find((item) => candidates.has(item.page_name))
    ?? results.find((item) => pages.some((page) => page.name === selected && pageFilenameStem(page) === item.page_name))
    ?? results[0]
  );
}

export function formatPrototypeDesignInfo(item: PrototypeAnalyzeResultItem | undefined): string {
  if (!item) {
    return "暂无数据";
  }

  if (typeof item.page_design_info_text === "string" && item.page_design_info_text.trim()) {
    return item.page_design_info_text;
  }

  if (item.page_design_info && typeof item.page_design_info === "object") {
    return JSON.stringify(item.page_design_info, null, 2);
  }

  return "暂无样式数据（请重新分析该页）";
}

export function resolvePrototypeDisplayName(
  state: RootState,
  result: PrototypeAnalyzeResultItem | undefined,
): string {
  if (!result) {
    return "—";
  }

  const pageMeta = state.session.prototypePages.find(
    (page) => pageFilenameStem(page) === result.page_name || page.name === result.page_name,
  );
  return pageMeta?.name ?? result.page_name;
}

export function resolvePrototypeDownloadSources(state: RootState): PrototypeDownloadSources | undefined {
  const cachedMapping = state.inspect.results.prototypeMappingSource;
  const cachedPages = state.inspect.results.prototypePageSources;
  if (cachedMapping && typeof cachedMapping === "object") {
    const mapping = cachedMapping as Omit<PrototypeDownloadSources, "pages">;
    if (mapping.json_url) {
      return {
        ...mapping,
        pages: Array.isArray(cachedPages) ? (cachedPages as PrototypeDownloadSources["pages"]) : [],
      };
    }
  }

  const fromDownload = extractDownloadSources(state.inspect.results.prototypeDownload);
  if (fromDownload) {
    return fromDownload;
  }

  const analyze = resolvePrototypeAnalyzeResult(state);
  return extractDownloadSources(analyze?.download);
}

export function storePrototypeDownloadSources(
  dispatch: AppDispatch,
  sources: PrototypeDownloadSources | undefined,
): void {
  if (!sources) {
    return;
  }

  dispatch(
    setResult({
      key: "prototypeMappingSource",
      data: {
        document_id: sources.document_id,
        document_name: sources.document_name,
        version_id: sources.version_id,
        json_url: sources.json_url,
      },
    }),
  );
  dispatch(setResult({ key: "prototypePageSources", data: sources.pages }));
}

export function formatPrototypeMappingSource(data: unknown): string {
  if (!data || typeof data !== "object") {
    return "暂无数据。请先点「2. 下载资源」或「3. 分析选中页面」。";
  }

  const source = data as {
    document_id?: string;
    document_name?: string;
    version_id?: string;
    json_url?: string;
  };

  const lines = [
    "=== 下载管线（与 core downloadResources 一致）===",
    "",
    "步骤 1 · 文档版本",
    "  GET /api/project/image?project_id=...&doc_id=...",
    "  → versions[0].json_url（项目 Mapping JSON，可能在 OSS）",
    "",
    "步骤 2 · 项目 Mapping",
    "  GET json_url",
    "  → pages[\"*.html\"].html.sign_md5",
    "  → pages[\"*.html\"].mapping_md5（可选，用于 styles/scripts/images）",
    "",
    "步骤 3 · Axure CDN",
    "  html_cdn_url = https://axure-file.lanhuapp.com/{sign_md5}",
    "",
    "─".repeat(48),
    `document_name: ${source.document_name ?? "—"}`,
    `document_id:   ${source.document_id ?? "—"}`,
    `version_id:    ${source.version_id ?? "—"}`,
    "",
    "json_url:",
    source.json_url ?? "—",
  ];

  return lines.join("\n");
}

export function formatPrototypePageSources(data: unknown): string {
  if (!Array.isArray(data) || data.length === 0) {
    return "暂无页面 CDN 源。请先点「2. 下载资源」或「3. 分析选中页面」。";
  }

  const lines = [`共 ${data.length} 页`, ""];

  for (const [index, item] of data.entries()) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const page = item as {
      html_filename?: string;
      html_sign_md5?: string;
      html_cdn_url?: string;
      mapping_md5?: string;
      mapping_cdn_url?: string;
    };

    lines.push(`[${index + 1}] ${page.html_filename ?? "—"}`);
    lines.push(`  html.sign_md5:  ${page.html_sign_md5 ?? "—"}`);
    lines.push(`  html_cdn_url:   ${page.html_cdn_url ?? "—"}`);
    if (page.mapping_md5) {
      lines.push(`  mapping_md5:    ${page.mapping_md5}`);
      lines.push(`  mapping_cdn_url:${page.mapping_cdn_url ?? "—"}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}
