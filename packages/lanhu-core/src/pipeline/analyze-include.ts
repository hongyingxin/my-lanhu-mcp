import { LanhuClient } from "../lanhu/client.js";
import {
  getDesignSchemaJson,
  getSketchJson,
  getSlices,
} from "../lanhu/designs.js";
import { convertLanhuSchema } from "../transform/convert-schema.js";
import { convertLanhuSketch, type ConvertSketchResult } from "../transform/convert-sketch.js";
import { extractDesignTokens } from "../transform/design-tokens.js";
import { extractLayoutSummary } from "../transform/layout-summary.js";
import { extractLayerTree } from "../transform/layer-tree.js";
import { extractFullAnnotationsFromSketch } from "../transform/sketch-annotations.js";
import { resolveDesignImageUrl, resolveDesignScale } from "../transform/sketch-utils.js";
import type { ConvertLanhuSchemaResult } from "../transform/convert-schema.js";
import type { LanhuDesignSummary, UnknownRecord } from "../types.js";
import type { SketchLayerAnnotation } from "../transform/sketch-to-html.js";

export type AnalyzeInclude = "html" | "image" | "tokens" | "layout" | "layers" | "slices";

export const DEFAULT_ANALYZE_INCLUDE: AnalyzeInclude[] = [
  "html",
  "tokens",
  "layers",
  "image",
  "slices",
];

export function resolveAnalyzeInclude(include?: AnalyzeInclude[]): Set<AnalyzeInclude> {
  return new Set(include ?? DEFAULT_ANALYZE_INCLUDE);
}

export interface AnalyzeDesignWithIncludeOptions {
  include?: AnalyzeInclude[];
  withSlices?: boolean;
}

/** 单稿 analyze 产物（不含 list 级 params / projectName） */
export interface AnalyzeDesignSliceResult {
  design: LanhuDesignSummary;
  convertSource?: "schema" | "sketch";
  schema?: UnknownRecord;
  schemaMeta?: Awaited<ReturnType<typeof getDesignSchemaJson>>;
  convert?: ConvertLanhuSchemaResult | ConvertSketchResult;
  sketch?: UnknownRecord;
  sketchMeta?: Awaited<ReturnType<typeof getSketchJson>>;
  sketchConvert?: ConvertSketchResult;
  designTokens?: string;
  layerAnnotations?: SketchLayerAnnotation[];
  layoutSummary?: string;
  layerTree?: string;
  sketchAnnotations?: string;
  slices?: Awaited<ReturnType<typeof getSlices>>;
  previewImage?: { path?: string; contentType: string; base64: string };
  warnings: string[];
}

function pushWarning(warnings: string[], message: string): void {
  warnings.push(message);
}

function inferPreviewMimeType(url: string): string {
  const lower = url.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  return "image/png";
}

/**
 * 按 `include` 分析单张设计稿（对齐 TS MCP `processDesign` + includeSet）。
 */
export async function analyzeDesignWithInclude(
  client: LanhuClient,
  ctx: { teamId?: string; projectId: string },
  design: LanhuDesignSummary,
  options: AnalyzeDesignWithIncludeOptions = {},
): Promise<AnalyzeDesignSliceResult> {
  const includeSet = resolveAnalyzeInclude(options.include);
  const withSlices = Boolean(options.withSlices);
  const warnings: string[] = [];
  const teamId = ctx.teamId;

  const result: AnalyzeDesignSliceResult = {
    design,
    warnings,
  };

  if (includeSet.has("image") && design.url) {
    try {
      const binary = await client.fetchBinaryUrl(design.url.split("?")[0]!);
      result.previewImage = {
        contentType: binary.contentType || inferPreviewMimeType(design.url),
        base64: binary.data,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      pushWarning(warnings, `预览图下载失败: ${message}`);
    }
  }

  let schemaConvert: ConvertLanhuSchemaResult | undefined;

  if ((includeSet.has("html") || includeSet.has("slices")) && teamId) {
    try {
      const schemaMeta = await getDesignSchemaJson(client, design.id, teamId, ctx.projectId);
      result.schemaMeta = schemaMeta;
      result.schema = schemaMeta.schema;
      schemaConvert = convertLanhuSchema(schemaMeta.schema, design.name);
      result.convert = schemaConvert;
      result.convertSource = "schema";

      if (includeSet.has("layout")) {
        try {
          const summary = extractLayoutSummary(schemaMeta.schema);
          if (summary.trim()) {
            result.layoutSummary = summary;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          pushWarning(warnings, `布局摘要提取失败: ${message}`);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      pushWarning(warnings, `DDS Schema 转换失败，将尝试 Sketch fallback: ${message}`);
    }
  } else if (includeSet.has("html") && !teamId) {
    pushWarning(warnings, "URL 缺少 teamId，跳过 Schema 转换，将尝试 Sketch fallback");
  }

  const needsSketch =
    includeSet.has("tokens") || includeSet.has("layers") || includeSet.has("html") || includeSet.has("slices");

  if (needsSketch) {
    try {
      result.sketchMeta = await getSketchJson(client, design.id, teamId, ctx.projectId);
      result.sketch = result.sketchMeta.sketch;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      pushWarning(warnings, `获取 Sketch JSON 失败: ${message}`);
    }
  }

  if (result.sketch) {
    const designScale = resolveDesignScale(result.sketch);

    if (includeSet.has("tokens")) {
      try {
        const tokens = extractDesignTokens(result.sketch);
        if (tokens) {
          result.designTokens = tokens;
        } else {
          pushWarning(warnings, "Design Tokens 为空（Sketch 中未找到高风险元素）");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        pushWarning(warnings, `Design Tokens 提取失败: ${message}`);
      }
    }

    if (includeSet.has("layers")) {
      try {
        const tree = extractLayerTree(result.sketch);
        if (tree.trim()) {
          result.layerTree = tree;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        pushWarning(warnings, `图层树提取失败: ${message}`);
      }
    }

    if ((includeSet.has("html") || includeSet.has("slices")) && !schemaConvert) {
      try {
        const sketchConvert = convertLanhuSketch(result.sketch, {
          designName: design.name,
          designImageUrl: resolveDesignImageUrl(design.url),
        });
        result.sketchConvert = sketchConvert;
        result.convert = sketchConvert;
        result.convertSource = "sketch";
        result.layerAnnotations = sketchConvert.after.layerAnnotations;
        pushWarning(warnings, "Schema 不可用，已使用 Sketch fallback 生成 HTML");

        try {
          const annotations = extractFullAnnotationsFromSketch(result.sketch, designScale);
          if (annotations.trim()) {
            result.sketchAnnotations = annotations;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          pushWarning(warnings, `Sketch 完整标注提取失败: ${message}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        pushWarning(warnings, `Sketch fallback 转换失败: ${message}`);
      }
    } else if (schemaConvert) {
      pushWarning(warnings, "DDS Schema HTML 可用，已跳过 Sketch fallback");
    }
  }

  if (withSlices) {
    try {
      result.slices = await getSlices(client, design.id, teamId, ctx.projectId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      pushWarning(warnings, `切图元数据提取失败: ${message}`);
    }
  }

  return result;
}
