import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import {
  LanhuClient,
  analyzeDesignWithInclude,
  DEFAULT_ANALYZE_INCLUDE,
  extractDesignTokens,
  getSketchJson,
  getSlices,
  listDesigns,
  mapConcurrent,
  parseLanhuUrl,
  pickDesigns,
  type AnalyzeInclude,
  type ConvertSketchResult,
  type ConvertLanhuSchemaResult,
  type DesignSelector,
  type LanhuDesignSummary,
} from "@lanhu/core";

import { type McpConfig, requireLanhuCookie } from "../config.js";
import { createToolError, createToolResult, type ToolContent } from "../result.js";

const IncludeOption = z.enum(["html", "image", "tokens", "layout", "layers", "slices"]);

function normalizeDesignNames(designNames: string | string[]): DesignSelector {
  if (typeof designNames === "string") {
    return designNames;
  }
  if (designNames.length === 1) {
    return designNames[0]!;
  }
  return designNames.map(String);
}

function createClient(config: McpConfig): LanhuClient {
  const cookie = requireLanhuCookie(config);
  return new LanhuClient({
    cookie,
    ddsCookie: config.ddsCookie ?? cookie,
  });
}

function getHtmlFromConvert(
  convert: ConvertLanhuSchemaResult | ConvertSketchResult | undefined,
): string | undefined {
  if (!convert || !("after" in convert)) {
    return undefined;
  }
  const after = convert.after as { htmlFull?: string; htmlBody?: string };
  return after.htmlFull ?? after.htmlBody;
}

function getMappingFromConvert(
  convert: ConvertLanhuSchemaResult | ConvertSketchResult | undefined,
): Record<string, string> | undefined {
  if (!convert || !("after" in convert)) {
    return undefined;
  }
  const after = convert.after as { mapping?: Record<string, string> };
  return after.mapping;
}

function formatAnalyzeSummary(
  projectName: string | undefined,
  slices: Awaited<ReturnType<typeof analyzeDesignWithInclude>>[],
  includeSet: Set<AnalyzeInclude>,
): string {
  const lines: string[] = ["Design Analysis Results"];
  lines.push(`Project: ${projectName ?? "Unknown"}`);

  if (includeSet.has("html")) {
    const success = slices.filter((s) => getHtmlFromConvert(s.convert)).length;
    const fallback = slices.filter((s) => s.convertSource === "sketch").length;
    lines.push(`${success}/${slices.length} HTML codes generated`);
    if (fallback > 0) {
      lines.push(`${fallback} design(s) using Sketch fallback`);
    }
  }

  for (const slice of slices) {
    lines.push("");
    lines.push(`--- ${slice.design.name} ---`);

    const html = getHtmlFromConvert(slice.convert);
    if (html && includeSet.has("html")) {
      lines.push("```html");
      lines.push(html);
      lines.push("```");
    } else if (includeSet.has("html") && !html) {
      lines.push(`Failed or skipped HTML (${slice.warnings.join("; ") || "no output"})`);
    }

    if (slice.layoutSummary && includeSet.has("layout")) {
      lines.push("\n--- Layout Summary ---");
      lines.push(slice.layoutSummary);
    }

    const mapping = getMappingFromConvert(slice.convert);
    if (mapping && Object.keys(mapping).length > 0 && includeSet.has("slices")) {
      lines.push(`\nImage assets (${Object.keys(mapping).length}):`);
      for (const [localPath, remoteUrl] of Object.entries(mapping)) {
        lines.push(`  ${localPath} <- ${remoteUrl}`);
      }
    }

    if (slice.layerTree && includeSet.has("layers")) {
      lines.push("\n--- Layer Structure ---");
      lines.push(slice.layerTree);
    }

    if (slice.designTokens && includeSet.has("tokens")) {
      lines.push("\n--- Design Tokens ---");
      lines.push(slice.designTokens);
    }

    if (slice.sketchAnnotations && includeSet.has("html")) {
      lines.push("\n--- Sketch Annotations ---");
      lines.push(slice.sketchAnnotations);
    }

    if (slice.warnings.length) {
      lines.push("\n--- Warnings ---");
      for (const w of slice.warnings) {
        lines.push(`- ${w}`);
      }
    }
  }

  return lines.join("\n").trim();
}

export function registerLanhuDesignTool(server: McpServer, config: McpConfig): void {
  server.registerTool(
    "lanhu_design",
    {
      description:
        "Unified Lanhu design tool. Supports listing, analyzing, extracting tokens, and getting slices.\n\n" +
        "Workflow: mode=list (or Resource project-designs) → design_names → analyze/slices/tokens.\n\n" +
        "Modes:\n" +
        "  - list: List all designs in the project\n" +
        "  - analyze: Design analysis with HTML/CSS, tokens, layers (default)\n" +
        "  - slices: Extract slice/asset info (B set, first design only if multiple)\n" +
        "  - tokens: Extract design tokens only\n\n" +
        "For detailDetach URLs, pass design_names matching image_id or use list first.",
      inputSchema: {
        url: z.string().min(1).describe("Lanhu project URL (stage or detailDetach)."),
        mode: z
          .enum(["list", "analyze", "slices", "tokens"])
          .default("analyze")
          .describe("Operation mode. Default: analyze."),
        design_names: z
          .union([z.string(), z.array(z.string())])
          .optional()
          .describe("Required for analyze/slices/tokens. Index, id, name, or 'all'."),
        include: z
          .array(IncludeOption)
          .optional()
          .describe(
            "Analyze only. Default: ['html','tokens','layers','image','slices']. Use mode=slices for Scheme B.",
          ),
        with_slices: z
          .boolean()
          .optional()
          .describe("Analyze only: attach B-set slice metadata via getSlices."),
      },
    },
    async ({ url, mode, design_names, include, with_slices }) => {
      try {
        const client = createClient(config);
        const parsed = parseLanhuUrl(url);
        const listResult = await listDesigns(client, url);

        if (mode === "list") {
          return createToolResult(
            `Loaded ${listResult.totalDesigns} design(s)${listResult.projectName ? ` from ${listResult.projectName}` : ""}.`,
            {
              status: "success",
              mode: "list",
              projectName: listResult.projectName,
              totalDesigns: listResult.totalDesigns,
              designs: listResult.designs.map((d) => ({
                index: d.index,
                id: d.id,
                name: d.name,
                width: d.width,
                height: d.height,
                sectors: d.sectors,
              })),
            },
          );
        }

        if (!design_names) {
          return createToolResult(
            "design_names is required for analyze/slices/tokens mode.",
            {
              status: "error",
              hint: "Pass design_names='all' or a specific name/index/id.",
              available_designs: listResult.designs.map((d) => ({
                index: d.index,
                id: d.id,
                name: d.name,
              })),
            },
            true,
          );
        }

        const selector = normalizeDesignNames(design_names);
        const targetDesigns = pickDesigns(listResult.designs, selector, parsed.docId ?? parsed.imageId);

        if (!targetDesigns.length) {
          return createToolResult(
            "No matching design found.",
            {
              status: "error",
              available_designs: listResult.designs.map((d) => d.name),
            },
            true,
          );
        }

        const teamId = listResult.params.teamId;
        const projectId = listResult.params.projectId;

        if (mode === "slices") {
          if (!teamId && targetDesigns[0]!.source !== "detailDetach") {
            return createToolResult(
              "team_id is required for slices mode.",
              { status: "error", hint: "Use a Lanhu URL that includes tid/team_id." },
              true,
            );
          }

          const target = targetDesigns[0]!;
          const warning =
            targetDesigns.length > 1
              ? `slices mode uses only the first design: ${target.name}`
              : undefined;

          const slicesResult = await getSlices(client, target.id, teamId, projectId, true);
          return createToolResult(
            `Loaded ${slicesResult.totalSlices} slice(s) for ${target.name}.`,
            {
              status: "success",
              mode: "slices",
              warning,
              ...slicesResult,
            },
          );
        }

        if (mode === "tokens") {
          if (!teamId && targetDesigns.some((d) => d.source !== "detailDetach")) {
            return createToolResult(
              "team_id is required for tokens mode.",
              { status: "error", hint: "Use a Lanhu URL that includes tid/team_id." },
              true,
            );
          }

          const tokenResults = await mapConcurrent(
            targetDesigns,
            async (design: LanhuDesignSummary) => {
              const sketchResult = await getSketchJson(client, design.id, teamId, projectId);
              return {
                name: design.name,
                tokens: extractDesignTokens(sketchResult.sketch),
              };
            },
            5,
          );

          const sections: string[] = [];
          for (let i = 0; i < tokenResults.length; i++) {
            const entry = tokenResults[i]!;
            const design = targetDesigns[i]!;
            if (entry.status === "fulfilled") {
              sections.push(`--- ${entry.value.name} ---`);
              sections.push(entry.value.tokens || "(no tokens found)");
              sections.push("");
            } else {
              sections.push(`--- ${design.name} ---`);
              sections.push(
                `Error: ${entry.reason instanceof Error ? entry.reason.message : String(entry.reason)}`,
              );
              sections.push("");
            }
          }

          return createToolResult(sections.join("\n").trim(), {
            status: "success",
            mode: "tokens",
            total: targetDesigns.length,
          });
        }

        // analyze
        const includeList = (include as AnalyzeInclude[] | undefined) ?? [...DEFAULT_ANALYZE_INCLUDE];
        const includeSet = new Set(includeList);

        const analyzed = await mapConcurrent(
          targetDesigns,
          (design) =>
            analyzeDesignWithInclude(
              client,
              { teamId, projectId },
              design,
              { include: includeList, withSlices: Boolean(with_slices) },
            ),
          5,
        );

        const slices: Awaited<ReturnType<typeof analyzeDesignWithInclude>>[] = [];
        for (let i = 0; i < analyzed.length; i++) {
          const entry = analyzed[i]!;
          if (entry.status === "fulfilled") {
            slices.push(entry.value);
          } else {
            const design = targetDesigns[i]!;
            slices.push({
              design,
              warnings: [
                entry.reason instanceof Error ? entry.reason.message : String(entry.reason),
              ],
            });
          }
        }

        const content: ToolContent[] = [];
        for (const slice of slices) {
          if (slice.previewImage?.base64 && includeSet.has("image")) {
            content.push({
              type: "image",
              data: slice.previewImage.base64,
              mimeType: slice.previewImage.contentType || "image/png",
            });
          }
        }

        const summaryText = formatAnalyzeSummary(listResult.projectName, slices, includeSet);
        content.unshift({ type: "text", text: summaryText });

        const structuredDesigns = slices.map((slice) => ({
          name: slice.design.name,
          id: slice.design.id,
          convert_source: slice.convertSource ?? null,
          html_code: getHtmlFromConvert(slice.convert) ?? null,
          image_url_mapping: getMappingFromConvert(slice.convert) ?? null,
          layout_summary: slice.layoutSummary ?? null,
          layer_tree: slice.layerTree ?? null,
          design_tokens: slice.designTokens ?? null,
          sketch_annotations: slice.sketchAnnotations ?? null,
          preview_image: slice.previewImage
            ? { contentType: slice.previewImage.contentType, hasBase64: Boolean(slice.previewImage.base64) }
            : null,
          slices: slice.slices ?? null,
          warnings: slice.warnings,
        }));

        return {
          content,
          structuredContent: {
            status: "success",
            mode: "analyze",
            project_name: listResult.projectName ?? null,
            total_designs: targetDesigns.length,
            include: includeList,
            designs: structuredDesigns,
          },
        };
      } catch (error) {
        return createToolError(error, { url, mode });
      }
    },
  );
}
