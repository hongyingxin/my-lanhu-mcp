import type { RootState } from "@/store";
import type { PrototypeAnalyzeResult, PrototypeAnalyzeResultItem, PrototypePageItem } from "@/api/types";

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
