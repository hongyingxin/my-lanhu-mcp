import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { LanhuClient } from "../lanhu/client.js";
import type { AnalyzeInclude } from "../pipeline/analyze-include.js";
import type { AnalyzeDesignResult } from "../pipeline/analyze-design.js";
import type { ConvertLanhuSchemaResult } from "../transform/convert-schema.js";
import type { LanhuDesignSummary, LanhuDocumentInfo } from "../types.js";
import {
  ensureDir,
  resolveDesignOutputDir,
  safeDesignFilename,
} from "./data-dir.js";

export interface AnalyzeArtifactsPaths {
  outputDir: string;
  previewPng?: string;
  html?: string;
  htmlBody?: string;
  css?: string;
  sketchFallbackHtml?: string;
  imageMapping?: string;
  schemaJson?: string;
  sketchJson?: string;
  designTokens?: string;
  layoutSummary?: string;
  layerTree?: string;
  sketchAnnotations?: string;
  layerAnnotations?: string;
  warnings?: string;
  slices?: string;
  meta?: string;
}

export interface PersistAnalyzeArtifactsOptions {
  dataDir: string;
  projectId: string;
  /** 是否下载预览 PNG，默认 true */
  downloadPreview?: boolean;
  /** analyze 请求的 include，写入 meta */
  include?: AnalyzeInclude[];
  /** 是否请求 B 套切图元数据，写入 meta */
  withSlices?: boolean;
}

function isSchemaConvert(
  convert: AnalyzeDesignResult["convert"],
): convert is ConvertLanhuSchemaResult {
  return Boolean(convert && "before" in convert);
}

function getHtmlFull(result: AnalyzeDesignResult): string | undefined {
  const convert = result.convert;
  if (!convert || !("after" in convert)) {
    return undefined;
  }
  const after = convert.after as { htmlFull?: string };
  return typeof after.htmlFull === "string" ? after.htmlFull : undefined;
}

function getSchemaCss(result: AnalyzeDesignResult): string | undefined {
  if (!isSchemaConvert(result.convert)) {
    return undefined;
  }
  const css = result.convert.after.css;
  return typeof css === "string" && css.length > 0 ? css : undefined;
}

function getSchemaHtmlBody(result: AnalyzeDesignResult): string | undefined {
  if (!isSchemaConvert(result.convert)) {
    return undefined;
  }
  const body = result.convert.after.htmlBody;
  return typeof body === "string" && body.length > 0 ? body : undefined;
}

function getSketchFallbackHtml(result: AnalyzeDesignResult): string | undefined {
  if (result.convertSource !== "schema") {
    return undefined;
  }
  const sketchHtml = result.sketchConvert?.after.htmlFull;
  if (typeof sketchHtml !== "string" || sketchHtml.length === 0) {
    return undefined;
  }
  const mainHtml = getHtmlFull(result);
  if (mainHtml === sketchHtml) {
    return undefined;
  }
  return sketchHtml;
}

function getMapping(result: AnalyzeDesignResult): Record<string, string> | undefined {
  const convert = result.convert;
  if (!convert || !("after" in convert)) {
    return undefined;
  }
  const after = convert.after as { mapping?: Record<string, string> };
  return after.mapping;
}

function slimDocumentInfo(
  documentInfo: LanhuDocumentInfo | undefined,
): Pick<LanhuDocumentInfo, "id" | "name" | "type" | "width" | "height" | "update_time"> | undefined {
  if (!documentInfo) {
    return undefined;
  }
  return {
    id: documentInfo.id,
    name: documentInfo.name,
    type: documentInfo.type,
    width: documentInfo.width,
    height: documentInfo.height,
    update_time: documentInfo.update_time,
  };
}

async function writeText(path: string, content: string): Promise<void> {
  await writeFile(path, content, "utf8");
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, JSON.stringify(value, null, 2), "utf8");
}

/** 将 analyze 结果落盘到 `DATA_DIR/lanhu_designs/{pid}/{designId}_{slug}/` */
export async function persistAnalyzeArtifacts(
  client: LanhuClient,
  design: LanhuDesignSummary,
  result: AnalyzeDesignResult,
  options: PersistAnalyzeArtifactsOptions,
): Promise<AnalyzeArtifactsPaths> {
  const outputDir = resolveDesignOutputDir(
    options.dataDir,
    options.projectId,
    design.id,
    design.name,
  );
  await ensureDir(outputDir);

  const slug = safeDesignFilename(design.name);
  const paths: AnalyzeArtifactsPaths = { outputDir };

  if (options.downloadPreview !== false && design.url) {
    try {
      const binary = await client.fetchBinaryUrl(design.url);
      const previewPath = join(outputDir, `${slug}.png`);
      await writeFile(previewPath, Buffer.from(binary.data, "base64"));
      paths.previewPng = previewPath;
      result.previewImage = {
        path: previewPath,
        contentType: binary.contentType,
        base64: binary.data,
      };
    } catch {
      // 预览图失败不阻断 analyze
    }
  }

  const htmlFull = getHtmlFull(result);
  if (htmlFull) {
    const htmlPath = join(outputDir, `${slug}.html`);
    await writeText(htmlPath, htmlFull);
    paths.html = htmlPath;
  }

  const css = getSchemaCss(result);
  if (css) {
    const cssPath = join(outputDir, `${slug}.css`);
    await writeText(cssPath, css);
    paths.css = cssPath;
  }

  const htmlBody = getSchemaHtmlBody(result);
  if (htmlBody) {
    const bodyPath = join(outputDir, `${slug}.body.html`);
    await writeText(bodyPath, htmlBody);
    paths.htmlBody = bodyPath;
  }

  const sketchFallbackHtml = getSketchFallbackHtml(result);
  if (sketchFallbackHtml) {
    const fallbackPath = join(outputDir, `${slug}.sketch-fallback.html`);
    await writeText(fallbackPath, sketchFallbackHtml);
    paths.sketchFallbackHtml = fallbackPath;
  }

  const mapping = getMapping(result);
  if (mapping && Object.keys(mapping).length > 0) {
    const mappingPath = join(outputDir, `${slug}.image-mapping.json`);
    await writeJson(mappingPath, mapping);
    paths.imageMapping = mappingPath;
  }

  if (result.schema) {
    const schemaPath = join(outputDir, `${slug}.schema.json`);
    await writeJson(schemaPath, result.schema);
    paths.schemaJson = schemaPath;
  }

  if (result.sketch) {
    const sketchPath = join(outputDir, `${slug}.sketch.json`);
    await writeJson(sketchPath, result.sketch);
    paths.sketchJson = sketchPath;
  }

  if (result.designTokens) {
    const tokensPath = join(outputDir, `${slug}.tokens.txt`);
    await writeText(tokensPath, result.designTokens);
    paths.designTokens = tokensPath;
  }

  if (result.layoutSummary) {
    const p = join(outputDir, `${slug}.layout-summary.txt`);
    await writeText(p, result.layoutSummary);
    paths.layoutSummary = p;
  }

  if (result.layerTree) {
    const p = join(outputDir, `${slug}.layer-tree.txt`);
    await writeText(p, result.layerTree);
    paths.layerTree = p;
  }

  if (result.sketchAnnotations) {
    const p = join(outputDir, `${slug}.sketch-annotations.txt`);
    await writeText(p, result.sketchAnnotations);
    paths.sketchAnnotations = p;
  }

  if (result.layerAnnotations?.length) {
    const p = join(outputDir, `${slug}.layer-annotations.json`);
    await writeJson(p, result.layerAnnotations);
    paths.layerAnnotations = p;
  }

  if (result.warnings.length > 0) {
    const warningsPath = join(outputDir, `${slug}.warnings.json`);
    await writeJson(warningsPath, result.warnings);
    paths.warnings = warningsPath;
  }

  if (result.slices) {
    const slicesPath = join(outputDir, `${slug}.slices.json`);
    await writeJson(slicesPath, result.slices);
    paths.slices = slicesPath;
  }

  const meta = {
    designId: design.id,
    designName: design.name,
    projectName: result.projectName,
    projectId: options.projectId,
    teamId: result.params.teamId,
    convertSource: result.convertSource,
    include: options.include,
    withSlices: options.withSlices,
    versionId: result.schemaMeta?.versionId,
    schemaUrl: result.schemaMeta?.schemaUrl,
    documentInfo: slimDocumentInfo(result.sketchMeta?.documentInfo),
    warnings: result.warnings,
    warningCount: result.warnings.length,
    savedAt: new Date().toISOString(),
    files: paths,
  };
  const metaPath = join(outputDir, `${slug}.analyze-meta.json`);
  await writeJson(metaPath, meta);
  paths.meta = metaPath;

  result.artifacts = paths;
  return paths;
}
