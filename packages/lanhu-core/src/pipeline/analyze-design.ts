import { LanhuClient } from "../lanhu/client.js";
import {
  getDesignSchemaJson,
  getSketchJson,
  getSlices,
  listDesigns,
} from "../lanhu/designs.js";
import { pickDesign, pickDesigns, type DesignSelector } from "../lanhu/pick-design.js";
import { parseLanhuUrl } from "../lanhu/parse-url.js";
import { mapConcurrent } from "./concurrency.js";
import { convertLanhuSchema } from "../transform/convert-schema.js";
import { convertLanhuSketch, type ConvertSketchResult } from "../transform/convert-sketch.js";
import { extractDesignTokens } from "../transform/design-tokens.js";
import { extractLayoutSummary } from "../transform/layout-summary.js";
import { extractLayerTree } from "../transform/layer-tree.js";
import { extractFullAnnotationsFromSketch } from "../transform/sketch-annotations.js";
import { persistAnalyzeArtifacts } from "../persist/analyze-artifacts.js";
import type { AnalyzeArtifactsPaths } from "../persist/analyze-artifacts.js";
import { resolveLanhuDataDir } from "../persist/data-dir.js";
import { resolveDesignImageUrl, resolveDesignScale } from "../transform/sketch-utils.js";
import type { ConvertLanhuSchemaResult } from "../transform/convert-schema.js";
import type { LanhuDesignSummary, UnknownRecord } from "../types.js";
import type { SketchLayerAnnotation } from "../transform/sketch-to-html.js";

export type { DesignSelector } from "../lanhu/pick-design.js";
export { normalizeDesignQuotes, pickDesign, pickDesigns } from "../lanhu/pick-design.js";

export interface AnalyzePreviewImage {
  path?: string;
  contentType: string;
  base64: string;
}

export interface AnalyzeDesignOptions {
  url: string;
  design?: string;
  withSlices?: boolean;
  cookie?: string;
  ddsCookie?: string;
  /** 落盘到 `data/lanhu_designs/{projectId}/`（对齐 PY-MCP），默认 false */
  persistArtifacts?: boolean;
  /** 数据根目录，默认 `LANHU_DATA_DIR` 或 `./data` */
  dataDir?: string;
}

export interface AnalyzeDesignBatchOptions {
  url: string;
  /** 单稿、多稿名称/序号，或 `all` */
  design?: DesignSelector;
  withSlices?: boolean;
  cookie?: string;
  ddsCookie?: string;
  /** 并发上限，默认 5（对齐 TS-MCP） */
  concurrency?: number;
  persistArtifacts?: boolean;
  dataDir?: string;
}

export type ConvertSource = "schema" | "sketch";

export interface AnalyzeDesignResult {
  status: "success";
  params: ReturnType<typeof parseLanhuUrl>;
  projectName?: string;
  design: LanhuDesignSummary;
  convertSource?: ConvertSource;
  schema?: UnknownRecord;
  schemaMeta?: Awaited<ReturnType<typeof getDesignSchemaJson>>;
  convert?: ConvertLanhuSchemaResult | ConvertSketchResult;
  sketch?: UnknownRecord;
  sketchMeta?: Awaited<ReturnType<typeof getSketchJson>>;
  sketchConvert?: ConvertSketchResult;
  designTokens?: string;
  layerAnnotations?: SketchLayerAnnotation[];
  /** Schema 节点树布局摘要 */
  layoutSummary?: string;
  /** Sketch artboard 图层树 */
  layerTree?: string;
  /** Sketch 完整文本标注（PSD/board 与 artboard 双格式） */
  sketchAnnotations?: string;
  slices?: Awaited<ReturnType<typeof getSlices>>;
  /** 预览原图（落盘时含 path + base64，对齐 PY MCP Image） */
  previewImage?: AnalyzePreviewImage;
  /** 落盘文件路径（`persistArtifacts: true` 时） */
  artifacts?: AnalyzeArtifactsPaths;
  warnings: string[];
}

export interface AnalyzeDesignBatchItem {
  design: LanhuDesignSummary;
  status: "success" | "error";
  result?: AnalyzeDesignResult;
  error?: string;
}

export interface AnalyzeDesignBatchResult {
  status: "success";
  params: ReturnType<typeof parseLanhuUrl>;
  projectName?: string;
  totalRequested: number;
  totalSucceeded: number;
  totalFailed: number;
  items: AnalyzeDesignBatchItem[];
}

function pushWarning(warnings: string[], message: string): void {
  warnings.push(message);
}

async function analyzeOneDesign(
  client: LanhuClient,
  params: ReturnType<typeof parseLanhuUrl>,
  projectName: string | undefined,
  design: LanhuDesignSummary,
  withSlices: boolean,
  persistOptions?: { persistArtifacts: boolean; dataDir: string },
): Promise<AnalyzeDesignResult> {
  const warnings: string[] = [];
  const teamId = params.teamId;

  const result: AnalyzeDesignResult = {
    status: "success",
    params,
    projectName,
    design,
    warnings,
  };

  let schemaConvert: ConvertLanhuSchemaResult | undefined;

  if (teamId) {
    try {
      const schemaMeta = await getDesignSchemaJson(client, design.id, teamId, params.projectId);
      result.schemaMeta = schemaMeta;
      result.schema = schemaMeta.schema;
      schemaConvert = convertLanhuSchema(schemaMeta.schema, design.name);
      result.convert = schemaConvert;
      result.convertSource = "schema";
      try {
        const summary = extractLayoutSummary(schemaMeta.schema);
        if (summary.trim()) {
          result.layoutSummary = summary;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        pushWarning(warnings, `布局摘要提取失败: ${message}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      pushWarning(warnings, `DDS Schema 转换失败，将尝试 Sketch fallback: ${message}`);
    }
  } else {
    pushWarning(warnings, "URL 缺少 teamId，跳过 Schema 转换，将尝试 Sketch fallback");
  }

  try {
    result.sketchMeta = await getSketchJson(client, design.id, teamId, params.projectId);
    result.sketch = result.sketchMeta.sketch;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    pushWarning(warnings, `获取 Sketch JSON 失败: ${message}`);
  }

  if (result.sketch) {
    const designScale = resolveDesignScale(result.sketch);
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
    try {
      const tree = extractLayerTree(result.sketch);
      if (tree.trim()) {
        result.layerTree = tree;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      pushWarning(warnings, `图层树提取失败: ${message}`);
    }
    try {
      const annotations = extractFullAnnotationsFromSketch(result.sketch, designScale);
      if (annotations.trim()) {
        result.sketchAnnotations = annotations;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      pushWarning(warnings, `Sketch 完整标注提取失败: ${message}`);
    }
  }

  if (!schemaConvert && result.sketch) {
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
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      pushWarning(warnings, `Sketch fallback 转换失败: ${message}`);
    }
  } else if (schemaConvert) {
    pushWarning(warnings, "DDS Schema HTML 可用，已跳过 Sketch fallback");
  }

  if (withSlices) {
    try {
      result.slices = await getSlices(client, design.id, teamId, params.projectId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      pushWarning(warnings, `切图元数据提取失败: ${message}`);
    }
  }

  if (persistOptions?.persistArtifacts) {
    try {
      await persistAnalyzeArtifacts(client, design, result, {
        dataDir: persistOptions.dataDir,
        projectId: params.projectId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      pushWarning(warnings, `analyze 产物落盘失败: ${message}`);
    }
  }

  return result;
}

export async function analyzeDesign(options: AnalyzeDesignOptions): Promise<AnalyzeDesignResult> {
  const client = new LanhuClient({
    cookie: options.cookie,
    ddsCookie: options.ddsCookie,
  });

  const params = parseLanhuUrl(options.url);
  const listResult = await listDesigns(client, params);
  const design = pickDesign(
    listResult.designs,
    options.design,
    params.docId ?? params.imageId,
  );

  const persistOpts = resolvePersistOptions(options);

  return analyzeOneDesign(
    client,
    params,
    listResult.projectName,
    design,
    Boolean(options.withSlices),
    persistOpts,
  );
}

function resolvePersistOptions(
  options: Pick<AnalyzeDesignOptions, "persistArtifacts" | "dataDir">,
): { persistArtifacts: boolean; dataDir: string } | undefined {
  if (!options.persistArtifacts) {
    return undefined;
  }
  return {
    persistArtifacts: true,
    dataDir: resolveLanhuDataDir(options.dataDir),
  };
}

export async function analyzeDesignBatch(
  options: AnalyzeDesignBatchOptions,
): Promise<AnalyzeDesignBatchResult> {
  const client = new LanhuClient({
    cookie: options.cookie,
    ddsCookie: options.ddsCookie,
  });

  const params = parseLanhuUrl(options.url);
  const listResult = await listDesigns(client, params);
  const targets = pickDesigns(
    listResult.designs,
    options.design,
    params.docId ?? params.imageId,
  );

  const concurrency = options.concurrency ?? 5;
  const withSlices = Boolean(options.withSlices);

  const persistOpts = resolvePersistOptions(options);

  const settled = await mapConcurrent(
    targets,
    (design) =>
      analyzeOneDesign(
        client,
        params,
        listResult.projectName,
        design,
        withSlices,
        persistOpts,
      ),
    concurrency,
  );

  const items: AnalyzeDesignBatchItem[] = targets.map((design, index) => {
    const entry = settled[index]!;
    if (entry.status === "fulfilled") {
      return { design, status: "success", result: entry.value };
    }
    const reason = entry.reason;
    return {
      design,
      status: "error",
      error: reason instanceof Error ? reason.message : String(reason),
    };
  });

  const totalSucceeded = items.filter((item) => item.status === "success").length;

  return {
    status: "success",
    params,
    projectName: listResult.projectName,
    totalRequested: items.length,
    totalSucceeded,
    totalFailed: items.length - totalSucceeded,
    items,
  };
}
