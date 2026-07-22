import { readFile } from "node:fs/promises";

import type { AnalyzeLocalPageResult, LanhuPagesListResult } from "@lanhu/core";

import type { ToolContent } from "../result.js";

function formatSinglePageText(item: AnalyzeLocalPageResult): string {
  const lines: string[] = [`--- ${item.page_name} ---`];

  if (!item.success) {
    lines.push(`Error: ${item.error ?? "unknown error"}`);
    return lines.join("\n");
  }

  if (item.page_text) {
    lines.push(item.page_text);
  }

  if (item.page_design_info_text) {
    lines.push("");
    lines.push("--- 设计样式参考 ---");
    lines.push(item.page_design_info_text);
  }

  if (item.from_cache) {
    lines.push("");
    lines.push("(from cache)");
  }

  return lines.join("\n").trim();
}

export function formatPageAnalyzeSummary(args: {
  document: LanhuPagesListResult;
  results: AnalyzeLocalPageResult[];
  pageSelection: string;
}): string {
  const { document, results, pageSelection } = args;
  const successful = results.filter((item) => item.success).length;

  const lines = [
    "蓝湖原型页面分析",
    `文档：${document.document_name}`,
    `页面选择：${pageSelection}`,
    `成功：${successful}/${results.length}`,
    "",
  ];

  for (const item of results) {
    lines.push(formatSinglePageText(item));
    lines.push("");
  }

  return lines.join("\n").trim();
}

export async function buildPageAnalyzeContent(
  results: AnalyzeLocalPageResult[],
): Promise<ToolContent[]> {
  const content: ToolContent[] = [];

  for (const item of results) {
    if (!item.success || !item.screenshot_path) {
      continue;
    }

    try {
      const bytes = await readFile(item.screenshot_path);
      content.push({
        type: "image",
        data: bytes.toString("base64"),
        mimeType: "image/png",
      });
    } catch {
      // skip missing screenshot files
    }
  }

  return content;
}
