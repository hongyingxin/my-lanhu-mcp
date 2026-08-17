import { LanhuClient } from "../lanhu/client.js";
import { listDesigns } from "../lanhu/designs.js";
import { pickDesign, pickDesigns, type DesignSelector } from "../lanhu/pick-design.js";
import { parseLanhuUrl } from "../lanhu/parse-url.js";
import { mapConcurrent } from "./concurrency.js";
import {
  analyzeDesignWithInclude,
  type AnalyzeInclude,
  DEFAULT_ANALYZE_INCLUDE,
} from "./analyze-include.js";
import { persistAnalyzeArtifacts } from "../persist/analyze-artifacts.js";
import type { AnalyzeArtifactsPaths } from "../persist/analyze-artifacts.js";
import { resolveLanhuDataDir } from "../persist/data-dir.js";
import type { ConvertLanhuSchemaResult } from "../transform/convert-schema.js";
import type { ConvertSketchResult } from "../transform/convert-sketch.js";
import type { LanhuDesignSummary, UnknownRecord } from "../types.js";
import type { SketchLayerAnnotation } from "../transform/sketch-to-html.js";
import type { getDesignSchemaJson, getSketchJson, getSlices } from "../lanhu/designs.js";

export type { DesignSelector } from "../lanhu/pick-design.js";
export { normalizeDesignQuotes, pickDesign, pickDesigns } from "../lanhu/pick-design.js";
export type { AnalyzeInclude } from "./analyze-include.js";
export { DEFAULT_ANALYZE_INCLUDE, analyzeDesignWithInclude, resolveAnalyzeInclude } from "./analyze-include.js";

export interface AnalyzePreviewImage {
  path?: string;
  contentType: string;
  base64: string;
}

export interface AnalyzeDesignOptions {
  url: string;
  design?: string;
  include?: AnalyzeInclude[];
  withSlices?: boolean;
  cookie?: string;
  ddsCookie?: string;
  persistArtifacts?: boolean;
  dataDir?: string;
}

export interface AnalyzeDesignBatchOptions {
  url: string;
  design?: DesignSelector;
  include?: AnalyzeInclude[];
  withSlices?: boolean;
  cookie?: string;
  ddsCookie?: string;
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
  layoutSummary?: string;
  layerTree?: string;
  sketchAnnotations?: string;
  slices?: Awaited<ReturnType<typeof getSlices>>;
  previewImage?: AnalyzePreviewImage;
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
  options: { include?: AnalyzeInclude[]; withSlices: boolean },
  persistOptions?: { persistArtifacts: boolean; dataDir: string },
): Promise<AnalyzeDesignResult> {
  const slice = await analyzeDesignWithInclude(
    client,
    { teamId: params.teamId, projectId: params.projectId },
    design,
    { include: options.include, withSlices: options.withSlices },
  );

  const result: AnalyzeDesignResult = {
    status: "success",
    params,
    projectName,
    ...slice,
  };

  if (persistOptions?.persistArtifacts) {
    try {
      await persistAnalyzeArtifacts(client, design, result, {
        dataDir: persistOptions.dataDir,
        projectId: params.projectId,
        include: options.include,
        withSlices: options.withSlices,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      pushWarning(result.warnings, `analyze 产物落盘失败: ${message}`);
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
    { include: options.include, withSlices: Boolean(options.withSlices) },
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
  const persistOpts = resolvePersistOptions(options);

  const settled = await mapConcurrent(
    targets,
    (design) =>
      analyzeOneDesign(
        client,
        params,
        listResult.projectName,
        design,
        { include: options.include, withSlices: Boolean(options.withSlices) },
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
