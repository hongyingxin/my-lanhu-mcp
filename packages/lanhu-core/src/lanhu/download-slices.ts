import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { ensureDir } from "../persist/data-dir.js";
import {
  applyFormatToScaleUrl,
} from "../transform/slice-scale-urls.js";
import type { LanhuClient } from "./client.js";
import { getSlices } from "./designs.js";
import type { LanhuDesignSummary, LanhuSliceInfo, LanhuSlicesResult } from "../types.js";

export type SliceDownloadFormat = "png" | "webp" | "svg";

export interface DownloadDesignSlicesOptions {
  sliceFormat?: SliceDownloadFormat;
  sliceScale?: string;
  sliceNames?: string | string[];
  outputRoot: string;
}

export interface DownloadedSliceFile {
  sliceName: string;
  sliceId?: string;
  file: string;
  path: string;
  url: string;
  bytes: number;
  size?: string;
}

export interface DownloadDesignSlicesResult {
  status: "success";
  mode: "slices";
  designId: string;
  designName: string;
  outputRoot: string;
  outputDir: string;
  sliceFormat: SliceDownloadFormat;
  sliceScale: string;
  totalSlices: number;
  downloaded: number;
  failed: number;
  files: DownloadedSliceFile[];
  warnings: string[];
  slices: LanhuSlicesResult;
}

export class SliceNamesNotFoundError extends Error {
  readonly availableSlices: string[];

  readonly missing: string[];

  constructor(missing: string[], availableSlices: string[]) {
    super(`No matching slice found for: ${missing.join(", ")}`);
    this.name = "SliceNamesNotFoundError";
    this.missing = missing;
    this.availableSlices = availableSlices;
  }
}

export function sanitizeSliceFilename(name: string): string {
  const sanitized = (name || "slice")
    .replace(/[/\\]/g, "_")
    .replace(/[^\w\u4e00-\u9fa5.-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
  return sanitized || "slice";
}

export function extForSliceFormat(format: SliceDownloadFormat): string {
  if (format === "webp") {
    return ".webp";
  }
  if (format === "svg") {
    return ".svg";
  }
  return ".png";
}

export function resolveSlicesOutputPaths(outputRoot: string): {
  outputRoot: string;
  outputDir: string;
} {
  const root = resolve(outputRoot);
  return {
    outputRoot: root,
    outputDir: join(root, "assets", "slices"),
  };
}

export function resolveSliceDownloadUrl(
  slice: LanhuSliceInfo,
  options: { sliceScale: string; sliceFormat: SliceDownloadFormat },
): string | null {
  if (options.sliceFormat === "svg") {
    return slice.svgUrl || slice.downloadUrl || null;
  }

  const url = slice.scaleUrls?.[options.sliceScale] || slice.downloadUrl;
  if (!url) {
    return null;
  }

  if (options.sliceFormat === "png" && !url.includes("/format,")) {
    return url;
  }

  return applyFormatToScaleUrl(url, options.sliceFormat === "webp" ? "webp" : "png");
}

export function filterSlicesByNames(
  slices: LanhuSliceInfo[],
  sliceNames?: string | string[],
): { slices: LanhuSliceInfo[]; missing: string[] } {
  if (sliceNames === undefined) {
    return { slices, missing: [] };
  }

  const selectors = Array.isArray(sliceNames) ? sliceNames : [sliceNames];
  const matched: LanhuSliceInfo[] = [];
  const missing: string[] = [];

  for (const selector of selectors) {
    const found = slices.find((slice) => slice.name === selector || slice.id === selector);
    if (found) {
      if (!matched.some((item) => item === found)) {
        matched.push(found);
      }
    } else {
      missing.push(selector);
    }
  }

  return { slices: matched, missing };
}

function uniqueSliceFilename(base: string, ext: string, used: Set<string>): string {
  let candidate = `${base}${ext}`;
  if (!used.has(candidate)) {
    used.add(candidate);
    return candidate;
  }

  let index = 2;
  while (true) {
    candidate = `${base}_${index}${ext}`;
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
    index += 1;
  }
}

/** B 套切图：拉元数据、按 format/scale 下载到 `{outputRoot}/assets/slices/` */
export async function downloadDesignSlices(
  client: LanhuClient,
  ctx: { teamId?: string; projectId: string },
  design: LanhuDesignSummary,
  options: DownloadDesignSlicesOptions,
): Promise<DownloadDesignSlicesResult> {
  const sliceFormat = options.sliceFormat ?? "png";
  const sliceScale = options.sliceScale ?? "2x";
  const slicesResult = await getSlices(client, design.id, ctx.teamId, ctx.projectId, true);
  const { slices: filtered, missing } = filterSlicesByNames(slicesResult.slices, options.sliceNames);

  if (missing.length > 0) {
    throw new SliceNamesNotFoundError(
      missing,
      slicesResult.slices.map((slice) => slice.name),
    );
  }

  const { outputRoot, outputDir } = resolveSlicesOutputPaths(options.outputRoot);
  await ensureDir(outputDir);

  const files: DownloadedSliceFile[] = [];
  const warnings: string[] = [];
  const usedFilenames = new Set<string>();
  let failed = 0;

  for (const slice of filtered) {
    const url = resolveSliceDownloadUrl(slice, { sliceScale, sliceFormat });
    if (!url) {
      warnings.push(`${slice.name}: 无可用下载 URL`);
      failed += 1;
      continue;
    }

    const base = sanitizeSliceFilename(slice.name || slice.id || "slice");
    const filename = uniqueSliceFilename(base, extForSliceFormat(sliceFormat), usedFilenames);
    const filePath = join(outputDir, filename);

    try {
      const binary = await client.fetchBinaryUrl(url);
      const buffer = Buffer.from(binary.data, "base64");
      await writeFile(filePath, buffer);
      files.push({
        sliceName: slice.name,
        sliceId: slice.id,
        file: filename,
        path: filePath,
        url,
        bytes: buffer.length,
        size: slice.size,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`${slice.name}: ${message}`);
      failed += 1;
    }
  }

  return {
    status: "success",
    mode: "slices",
    designId: slicesResult.designId,
    designName: slicesResult.designName,
    outputRoot,
    outputDir,
    sliceFormat,
    sliceScale,
    totalSlices: filtered.length,
    downloaded: files.length,
    failed,
    files,
    warnings,
    slices: slicesResult,
  };
}
