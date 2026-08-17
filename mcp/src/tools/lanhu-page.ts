import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";

import {
  analyzePrototypePages,
  createLanhuFetch,
  listPages,
  listProductDocuments,
  parseLanhuUrl,
  resolveAxureOutputDir,
  resolveAxureScreenshotDir,
  resolvePrototypeDocumentUrl,
  type LanhuUrlParams,
} from "@lanhu/core";

import { buildPageAnalyzeContent, formatPageAnalyzeSummary } from "../format/page-result.js";
import { type McpConfig, requireLanhuCookie } from "../config.js";
import { createToolError, createToolResult, type ToolContent } from "../result.js";

function parseStandardPrototypeUrl(input: string): LanhuUrlParams {
  const url = input.trim();
  if (!url) {
    throw new Error("URL is required");
  }
  if (!/^https:\/\/lanhuapp\.com\//i.test(url)) {
    throw new Error("URL must start with https://lanhuapp.com/");
  }
  if (!url.includes("#/item/project/product")) {
    throw new Error("URL must be a prototype link (#/item/project/product?tid=...&pid=...)");
  }

  const parsed = parseLanhuUrl(url);
  if (parsed.kind !== "prototype") {
    throw new Error("URL is not a prototype/PRD link");
  }
  if (!parsed.projectId) {
    throw new Error("Missing required param pid");
  }
  if (!parsed.teamId) {
    throw new Error("Missing required param tid");
  }

  return parsed;
}

function createFetch(config: McpConfig) {
  return createLanhuFetch({ cookie: requireLanhuCookie(config) });
}

function resolvePageNamesForAnalyze(
  document: Awaited<ReturnType<typeof listPages>>,
  pageId?: string,
): { pageNames: string | "all"; pageSelection: string } {
  if (!pageId) {
    return { pageNames: "all", pageSelection: "all pages" };
  }

  const matched = document.pages.find((page) => page.id === pageId);
  if (!matched) {
    const available = document.pages.map((page) => page.name);
    throw new Error(
      `Invalid pageId: ${pageId}. Available pages: ${available.join(", ") || "(none)"}`,
    );
  }

  return { pageNames: matched.name, pageSelection: matched.name };
}

export function registerLanhuPageTool(server: McpServer, config: McpConfig): void {
  server.registerTool(
    "lanhu_page",
    {
      description:
        "蓝湖原型/PRD 统一工具。\n\n" +
        "入参仅 url（标准链接 https://lanhuapp.com/web/#/item/project/product?...）。\n\n" +
        "行为：\n" +
        "  - 无 docId：返回项目文档列表，请用户选择 doc_url 后再调用\n" +
        "  - 有 docId + pageId：分析并截图该页\n" +
        "  - 有 docId、无 pageId：分析文档内全部页面\n" +
        "  - pageId 无效：报错并返回可用页面名列表\n\n" +
        "USE WHEN: 需求文档, PRD, 原型, 交互稿, Axure\n" +
        "DO NOT USE FOR: UI设计图 (use lanhu_design)",
      inputSchema: {
        url: z
          .string()
          .min(1)
          .describe(
            "标准蓝湖原型链接。示例: https://lanhuapp.com/web/#/item/project/product?tid=...&pid=...&docId=...&pageId=...",
          ),
      },
    },
    async ({ url }) => {
      try {
        const parsed = parseStandardPrototypeUrl(url);
        const fetchImpl = createFetch(config);

        if (!parsed.docId) {
          const result = await listProductDocuments(fetchImpl, parsed.teamId!, parsed.projectId);
          return createToolResult(
            [
              "当前 URL 未包含 docId，请先选择一份 PRD/原型文档。",
              "将所选文档的 doc_url 作为 url 再次调用 lanhu_page。",
              "",
              ...result.documents.map(
                (doc, index) => `${index + 1}. ${doc.name} (${doc.doc_id})\n   ${doc.doc_url}`,
              ),
            ].join("\n"),
            {
              status: "need_document_selection",
              total: result.total,
              documents: result.documents,
            },
          );
        }

        const documentUrl = resolvePrototypeDocumentUrl(url, parsed.docId);
        const document = await listPages(fetchImpl, documentUrl);
        const { pageNames, pageSelection } = resolvePageNamesForAnalyze(document, parsed.pageId);

        const outputDir = resolveAxureOutputDir(
          config.dataDir,
          parsed.projectId!,
          parsed.docId,
          document.document_name,
        );
        const screenshotOutputDir = resolveAxureScreenshotDir(
          config.dataDir,
          parsed.projectId!,
          parsed.docId,
          document.document_name,
        );

        const analyzed = await analyzePrototypePages(fetchImpl, documentUrl, outputDir, pageNames, {
          screenshotOutputDir,
        });

        const summaryText = formatPageAnalyzeSummary({
          document: analyzed.document,
          results: analyzed.results,
          pageSelection,
        });

        const images = await buildPageAnalyzeContent(analyzed.results);
        const content: ToolContent[] = [{ type: "text", text: summaryText }, ...images];

        const successful = analyzed.results.filter((item) => item.success).length;

        return {
          content,
          structuredContent: {
            status: "success",
            document_id: parsed.docId,
            document_name: analyzed.document.document_name,
            page_selection: pageSelection,
            page_id: parsed.pageId ?? null,
            total_pages: analyzed.document.total_pages,
            total_requested: analyzed.results.length,
            successful,
            failed: analyzed.results.length - successful,
            output_dir: outputDir,
            screenshot_output_dir: analyzed.screenshot_output_dir,
            download: analyzed.download,
            pages: analyzed.document.pages.map((page) => ({
              id: page.id,
              name: page.name,
              filename: page.filename,
            })),
            results: analyzed.results.map((item) => ({
              page_name: item.page_name,
              success: item.success,
              page_text: item.page_text ?? null,
              page_design_info_text: item.page_design_info_text ?? null,
              screenshot_path: item.screenshot_path ?? null,
              from_cache: item.from_cache ?? false,
              error: item.error ?? null,
            })),
          },
        };
      } catch (error) {
        if (error instanceof Error && error.message.startsWith("Invalid pageId:")) {
          const availableMatch = error.message.match(/Available pages: (.+)$/);
          const availablePages = availableMatch?.[1]?.split(", ").filter(Boolean) ?? [];
          return createToolResult(error.message, {
            status: "error",
            error: "invalid_page_id",
            available_pages: availablePages,
            url,
          }, true);
        }

        return createToolError(error, { url });
      }
    },
  );
}
