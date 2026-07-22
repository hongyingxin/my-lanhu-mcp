import { LanhuClient, pickNestedString } from "./client.js";
import {
  buildDesignListAiSuggestion,
  normalizeDesignSectors,
  sectorNamesForDesign,
} from "./design-sectors.js";
import { parseLanhuUrl } from "./parse-url.js";
import { buildPsScaleUrls, buildScaleUrls } from "../transform/slice-scale-urls.js";
import type {
  LanhuDesignListResult,
  LanhuDesignSchemaJsonResult,
  LanhuDesignSectorSummary,
  LanhuDesignSummary,
  LanhuDocumentInfo,
  LanhuProjectImageInfo,
  LanhuProjectImagesPayload,
  LanhuProjectMultiInfoImage,
  LanhuProjectMultiInfoPayload,
  LanhuSketchJsonResult,
  LanhuSliceInfo,
  LanhuSliceMetadata,
  LanhuSlicesResult,
  LanhuUrlParams,
  LanhuVersionInfo,
  UnknownRecord,
} from "../types.js";

const DETAIL_COVER_KEYS = [
  "XDCoverPNGORG",
  "XDCover",
  "url",
  "cb_src",
  "cover_url",
  "coverUrl",
  "imageUrl",
  "image_url",
] as const;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** PS 等稿的 layer/asset id 常为 number，Map 键需统一成 string */
function asIdKey(value: unknown): string | undefined {
  const text = asString(value);
  if (text) {
    return text;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function asBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}

function isDetailDetachUrl(params: LanhuUrlParams): boolean {
  return params.route?.includes("detailDetach") ?? false;
}

function getLatestVersionInfo(documentInfo: LanhuDocumentInfo): LanhuVersionInfo | undefined {
  return Array.isArray(documentInfo.versions) ? documentInfo.versions[0] : undefined;
}

function getProjectName(value: UnknownRecord): string | undefined {
  return asString(value["project_name"]) ?? asString(value["projectName"]) ?? asString(value["name"]);
}

function pickDesignCoverUrl(documentInfo: LanhuDocumentInfo): string | undefined {
  return pickNestedString(documentInfo, DETAIL_COVER_KEYS, 2);
}

function mapProjectImageToDesignSummary(
  image: LanhuProjectImageInfo,
  index: number,
  imageSectorMap?: Map<string, LanhuDesignSectorSummary[]>,
): LanhuDesignSummary {
  const designId = asString(image.id);
  if (!designId) {
    throw new Error(`Design item at index ${index} is missing id`);
  }

  const summary: LanhuDesignSummary = {
    index,
    id: designId,
    name: asString(image.name) ?? `design-${designId}`,
    width: asNumber(image.width),
    height: asNumber(image.height),
    url: asString(image.url),
    hasComment: asBoolean(image.has_comment),
    updateTime: asString(image.update_time),
    source: "projectImages",
    raw: image,
  };

  if (imageSectorMap) {
    const sectorNames = sectorNamesForDesign(imageSectorMap, designId);
    if (sectorNames.length) {
      summary.sectors = sectorNames;
    }
  }

  return summary;
}

function mapDetachedDesign(documentInfo: LanhuDocumentInfo, params: LanhuUrlParams): LanhuDesignSummary {
  const designId = asString(documentInfo.id) ?? params.docId ?? params.imageId;
  if (!designId) {
    throw new Error("Single design extraction failed: missing image id");
  }

  return {
    index: 1,
    id: designId,
    name: asString(documentInfo.name) ?? `design-${designId}`,
    width: asNumber(documentInfo.width),
    height: asNumber(documentInfo.height),
    url: pickDesignCoverUrl(documentInfo),
    hasComment: asBoolean(documentInfo.has_comment),
    updateTime: asString(documentInfo.update_time),
    source: "detailDetach",
    raw: documentInfo,
  };
}

function collectMetadata(node: UnknownRecord): LanhuSliceMetadata | undefined {
  const metadata: LanhuSliceMetadata = {};

  if (Array.isArray(node["fills"])) {
    metadata.fills = node["fills"] as unknown[];
  }

  if (Array.isArray(node["borders"])) {
    metadata.borders = node["borders"] as unknown[];
  } else if (Array.isArray(node["strokes"])) {
    metadata.borders = node["strokes"] as unknown[];
  }

  const opacity = asNumber(node["opacity"]);
  if (opacity !== undefined) {
    metadata.opacity = opacity;
  }

  const rotation = asNumber(node["rotation"]);
  if (rotation !== undefined) {
    metadata.rotation = rotation;
  }

  if (node["textStyle"] !== undefined) {
    metadata.text_style = node["textStyle"];
  }

  if (Array.isArray(node["shadows"])) {
    metadata.shadows = node["shadows"] as unknown[];
  }

  if (node["radius"] !== undefined) {
    metadata.border_radius = node["radius"];
  } else if (node["cornerRadius"] !== undefined) {
    metadata.border_radius = node["cornerRadius"];
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function resolveSliceScale(sketch: UnknownRecord): number {
  const meta = isRecord(sketch["meta"]) ? sketch["meta"] : {};
  const raw =
    sketch["sliceScale"] ??
    sketch["exportScale"] ??
    meta["sliceScale"] ??
    2;
  const scale = Number(raw);
  return Number.isFinite(scale) && scale > 0 ? scale : 2;
}

function isFigmaSketch(sketch: UnknownRecord): boolean {
  const meta = isRecord(sketch["meta"]) ? sketch["meta"] : {};
  const host = isRecord(meta["host"]) ? meta["host"] : {};
  return String(host["name"] ?? "") === "figma";
}

function resolveLogicalSize(
  imageData: UnknownRecord | undefined,
  frame: UnknownRecord,
): { logicalW: number; logicalH: number } {
  const imgSize = isRecord(imageData?.["size"]) ? imageData!["size"] : {};
  let logicalW = asNumber(imgSize["width"]) ?? 0;
  let logicalH = asNumber(imgSize["height"]) ?? 0;

  if (!logicalW || !logicalH) {
    logicalW = asNumber(frame["width"]) ?? 0;
    logicalH = asNumber(frame["height"]) ?? 0;
  }

  return { logicalW, logicalH };
}

function appendScaleFields(
  slice: LanhuSliceInfo,
  downloadUrl: string,
  logicalW: number,
  logicalH: number,
  sliceScale: number,
  hasPng: boolean,
): void {
  if (!hasPng || !logicalW) {
    return;
  }
  slice.scaleUrls = buildScaleUrls(downloadUrl, logicalW, logicalH, sliceScale);
  slice.logicalSize = {
    width: Math.trunc(logicalW),
    height: Math.trunc(logicalH),
    note: `1x logical px; stored at ${sliceScale}x = ${Math.trunc(logicalW * sliceScale)}x${Math.trunc(logicalH * sliceScale)}px`,
  };
}

function tryBuildImageSlice(
  node: UnknownRecord,
  currentName: string,
  currentPath: string,
  parentName: string,
  includeMetadata: boolean,
  isFigma: boolean,
  sliceScale: number,
): LanhuSliceInfo | undefined {
  const imageData = isRecord(node["image"]) ? node["image"] : undefined;
  if (!imageData) {
    return undefined;
  }

  const hasPng = Boolean(asString(imageData["imageUrl"]));
  const hasSvg = Boolean(asString(imageData["svgUrl"]));
  if (!hasPng && !hasSvg) {
    return undefined;
  }

  if (isFigma && !node["hasExportImage"]) {
    return undefined;
  }

  const downloadUrl = asString(imageData["imageUrl"]) ?? asString(imageData["svgUrl"]);
  if (!downloadUrl) {
    return undefined;
  }

  const frame =
    (isRecord(node["frame"]) ? node["frame"] : undefined) ??
    (isRecord(node["bounds"]) ? node["bounds"] : undefined) ??
    {};
  const { logicalW, logicalH } = resolveLogicalSize(imageData, frame);
  const sizeStr =
    logicalW && logicalH ? `${Math.trunc(logicalW)}x${Math.trunc(logicalH)}` : "unknown";

  const slice: LanhuSliceInfo = {
    id: asIdKey(node["id"]),
    name: currentName,
    type: asString(node["type"]) ?? asString(node["layerType"]) ?? "bitmap",
    downloadUrl,
    size: sizeStr,
    format: hasPng ? "png" : "svg",
    layerPath: currentPath,
    ...(parentName ? { parentName } : {}),
    ...(includeMetadata ? { metadata: collectMetadata(node) } : {}),
  };

  if (hasPng && hasSvg) {
    slice.svgUrl = asString(imageData["svgUrl"]);
  }

  const x = asNumber(frame["x"]) ?? asNumber(frame["left"]);
  const y = asNumber(frame["y"]) ?? asNumber(frame["top"]);
  if (x !== undefined || y !== undefined) {
    slice.position = { x: Math.trunc(x ?? 0), y: Math.trunc(y ?? 0) };
  }

  appendScaleFields(slice, downloadUrl, logicalW, logicalH, sliceScale, hasPng);
  return slice;
}

function tryBuildLegacyDdsSlice(
  node: UnknownRecord,
  currentName: string,
  currentPath: string,
  parentName: string,
  includeMetadata: boolean,
  isFigma: boolean,
  sliceScale: number,
): LanhuSliceInfo | undefined {
  if (isFigma) {
    return undefined;
  }

  const legacyImage = isRecord(node["ddsImage"]) ? node["ddsImage"] : undefined;
  const downloadUrl = legacyImage ? asString(legacyImage["imageUrl"]) : undefined;
  if (!legacyImage || !downloadUrl) {
    return undefined;
  }

  const ddsSize = isRecord(legacyImage["size"]) ? legacyImage["size"] : undefined;
  let logicalW = asNumber(ddsSize?.["width"]) ?? 0;
  let logicalH = asNumber(ddsSize?.["height"]) ?? 0;

  if (!logicalW || !logicalH) {
    const frame =
      (isRecord(node["frame"]) ? node["frame"] : undefined) ??
      (isRecord(node["bounds"]) ? node["bounds"] : undefined) ??
      {};
    logicalW = asNumber(frame["width"]) ?? 0;
    logicalH = asNumber(frame["height"]) ?? 0;
  }

  const sizeStr =
    logicalW && logicalH
      ? `${Math.trunc(logicalW)}x${Math.trunc(logicalH)}`
      : String(legacyImage["size"] ?? "unknown");

  const slice: LanhuSliceInfo = {
    id: asIdKey(node["id"]),
    name: currentName,
    type: asString(node["type"]) ?? asString(node["ddsType"]),
    downloadUrl,
    size: sizeStr,
    format: "png",
    position: {
      x: Math.trunc(asNumber(node["left"]) ?? 0),
      y: Math.trunc(asNumber(node["top"]) ?? 0),
    },
    layerPath: currentPath,
    ...(parentName ? { parentName } : {}),
    ...(includeMetadata ? { metadata: collectMetadata(node) } : {}),
  };

  appendScaleFields(slice, downloadUrl, logicalW, logicalH, sliceScale, true);
  return slice;
}

function findSlicesInNode(
  node: unknown,
  parentName: string,
  layerPath: string,
  slices: LanhuSliceInfo[],
  includeMetadata: boolean,
  isFigma: boolean,
  sliceScale: number,
): void {
  if (!isRecord(node)) {
    return;
  }

  const currentName = asString(node["name"]) ?? "";
  const currentPath = layerPath ? `${layerPath}/${currentName}` : currentName;

  const imageSlice = tryBuildImageSlice(
    node,
    currentName,
    currentPath,
    parentName,
    includeMetadata,
    isFigma,
    sliceScale,
  );
  if (imageSlice) {
    slices.push(imageSlice);
  } else {
    const legacySlice = tryBuildLegacyDdsSlice(
      node,
      currentName,
      currentPath,
      parentName,
      includeMetadata,
      isFigma,
      sliceScale,
    );
    if (legacySlice) {
      slices.push(legacySlice);
    }
  }

  for (const childKey of ["layers", "children"] as const) {
    const children = Array.isArray(node[childKey]) ? node[childKey] : [];
    for (const child of children) {
      if (isRecord(child)) {
        findSlicesInNode(child, currentName, currentPath, slices, includeMetadata, isFigma, sliceScale);
      }
    }
  }
}

function appendPhotoshopSlices(
  sketch: UnknownRecord,
  slices: LanhuSliceInfo[],
  includeMetadata: boolean,
): void {
  if (String(sketch["type"] ?? "").toLowerCase() !== "ps") {
    return;
  }

  const byId = new Map<string, UnknownRecord>();

  const indexPs = (obj: unknown): void => {
    if (!isRecord(obj)) {
      return;
    }
    const id = asIdKey(obj["id"]);
    if (id) {
      byId.set(id, obj);
    }
    for (const key of ["layers", "children"] as const) {
      const children = Array.isArray(obj[key]) ? obj[key] : [];
      for (const child of children) {
        indexPs(child);
      }
    }
  };

  const board = isRecord(sketch["board"]) ? sketch["board"] : undefined;
  if (board) {
    indexPs(board);
  }
  for (const section of Array.isArray(sketch["info"]) ? sketch["info"] : []) {
    indexPs(section);
  }

  const existingIds = new Set(slices.map((slice) => slice.id).filter(Boolean));

  for (const asset of Array.isArray(sketch["assets"]) ? sketch["assets"] : []) {
    if (!isRecord(asset) || !asset["isSlice"]) {
      continue;
    }
    const layerId = asIdKey(asset["id"]);
    if (!layerId || existingIds.has(layerId)) {
      continue;
    }

    const layer = byId.get(layerId);
    if (!layer) {
      continue;
    }

    const images = isRecord(layer["images"]) ? layer["images"] : {};
    const downloadUrl = asString(images["png_xxxhd"]) ?? asString(images["svg"]);
    if (!downloadUrl) {
      continue;
    }

    let baseW = asNumber(layer["width"]) ?? 0;
    let baseH = asNumber(layer["height"]) ?? 0;
    if (baseW <= 0 || baseH <= 0) {
      const bounds = isRecord(asset["bounds"]) ? asset["bounds"] : {};
      baseW = (asNumber(bounds["right"]) ?? 0) - (asNumber(bounds["left"]) ?? 0);
      baseH = (asNumber(bounds["bottom"]) ?? 0) - (asNumber(bounds["top"]) ?? 0);
    }
    baseW = Math.max(1, baseW);
    baseH = Math.max(1, baseH);
    const logicalW = Math.max(1, baseW / 2);
    const logicalH = Math.max(1, baseH / 2);

    const displayName = asString(asset["name"]) ?? asString(layer["name"]) ?? "slice";
    const slice: LanhuSliceInfo = {
      id: layerId,
      name: displayName,
      type: asString(layer["type"]) ?? "ps-slice",
      downloadUrl,
      size: `${Math.round(baseW)}x${Math.round(baseH)}`,
      format: images["png_xxxhd"] ? "png" : "svg",
      layerPath: displayName,
    };

    if (images["png_xxxhd"] && images["svg"]) {
      slice.svgUrl = asString(images["svg"]);
    }

    if ("left" in layer && "top" in layer) {
      slice.position = {
        x: Math.round(asNumber(layer["left"]) ?? 0),
        y: Math.round(asNumber(layer["top"]) ?? 0),
      };
    }

    if (includeMetadata) {
      slice.metadata = {
        source: "photoshop",
        asset_id: layerId,
        ...(asset["scaleType"] !== undefined ? { scaleType: asset["scaleType"] } : {}),
      };
    }

    if (images["png_xxxhd"]) {
      const scaleUrls = buildPsScaleUrls(downloadUrl, baseW, baseH);
      if (Object.keys(scaleUrls).length > 0) {
        slice.scaleUrls = scaleUrls;
      }
      slice.logicalSize = {
        width: Math.round(logicalW),
        height: Math.round(logicalH),
        note: "1x logical px; PS slice base px equals iOS @2x / Android xhdpi",
      };
      slice.baseSize = {
        width: Math.round(baseW),
        height: Math.round(baseH),
        note: "PS slice base px; equals iOS @2x / Android xhdpi",
      };
    }

    slices.push(slice);
    existingIds.add(layerId);
  }
}

/** 从 Sketch JSON 提取切图元数据与下载 URL（不下载文件） */
export function extractSlicesFromSketch(
  sketch: UnknownRecord,
  includeMetadata: boolean,
): { slices: LanhuSliceInfo[]; sliceScale: number } {
  const slices: LanhuSliceInfo[] = [];
  const isFigma = isFigmaSketch(sketch);
  const sliceScale = resolveSliceScale(sketch);

  const artboard = isRecord(sketch["artboard"]) ? sketch["artboard"] : undefined;
  if (artboard && Array.isArray(artboard["layers"])) {
    for (const layer of artboard["layers"]) {
      findSlicesInNode(layer, "", "", slices, includeMetadata, isFigma, sliceScale);
    }
  } else if (Array.isArray(sketch["info"])) {
    for (const item of sketch["info"]) {
      findSlicesInNode(item, "", "", slices, includeMetadata, isFigma, sliceScale);
    }
  }

  appendPhotoshopSlices(sketch, slices, includeMetadata);
  return { slices, sliceScale };
}

function requireVersionId(images: LanhuProjectMultiInfoImage[], imageId: string): string {
  for (const image of images) {
    if (asString(image.id) !== imageId) {
      continue;
    }

    const versionId = asString(image.latest_version);
    if (!versionId) {
      throw new Error(`Design ${imageId} is missing latest_version`);
    }

    return versionId;
  }

  throw new Error(`Unable to find design image_id=${imageId} in multi_info response`);
}

export async function listDesigns(
  client: LanhuClient,
  input: string | LanhuUrlParams,
): Promise<LanhuDesignListResult> {
  const params = typeof input === "string" ? parseLanhuUrl(input) : input;

  if (params.docId && isDetailDetachUrl(params)) {
    let projectInfo: LanhuProjectMultiInfoPayload | undefined;
    try {
      projectInfo = await client.getProjectMultiInfo(params.projectId, params.teamId, {
        img_limit: 1,
        detach: 1,
      });
    } catch {
      // detailDetach 无 tid 时 multi_info 可能失败，不影响单稿详情
    }
    const documentInfo = params.teamId
      ? await client.getDesignDocument(params.docId, params.teamId, params.projectId)
      : await client.getDocumentInfo(params.projectId, params.docId);
    return {
      status: "success",
      projectName: projectInfo
        ? getProjectName(projectInfo) ?? getProjectName(documentInfo)
        : getProjectName(documentInfo),
      totalDesigns: 1,
      designs: [mapDetachedDesign(documentInfo, params)],
      source: "detailDetach",
      params,
    };
  }

  if (!params.teamId) {
    throw new Error("URL parsing failed: missing required param tid (team_id)");
  }

  let sectorList: LanhuDesignSectorSummary[] = [];
  let imageSectorMap = new Map<string, LanhuDesignSectorSummary[]>();
  let sectorWarning: string | undefined;

  try {
    const sectorPayload = await client.getProjectSectors(params.projectId);
    const rawSectors = Array.isArray(sectorPayload["sectors"])
      ? (sectorPayload["sectors"] as UnknownRecord[])
      : [];
    [sectorList, imageSectorMap] = normalizeDesignSectors(rawSectors);
  } catch (error) {
    sectorWarning =
      error instanceof Error
        ? `Failed to load project sectors: ${error.message}`
        : `Failed to load project sectors: ${String(error)}`;
  }

  const payload = await client.getLanhuPayload<LanhuProjectImagesPayload>("/api/project/images", {
    project_id: params.projectId,
    team_id: params.teamId,
    dds_status: 1,
    position: 1,
    show_cb_src: 1,
    comment: 1,
  });

  const images = Array.isArray(payload.images) ? payload.images : [];
  const designs = images.map((image, index) =>
    mapProjectImageToDesignSummary(image, index + 1, imageSectorMap),
  );
  const ungroupedDesignCount = designs.filter((design) => !design.sectors?.length).length;

  const result: LanhuDesignListResult = {
    status: "success",
    projectName: asString(payload.name),
    totalDesigns: designs.length,
    designs,
    source: "projectImages",
    params,
    sectors: sectorList,
    totalSectors: sectorList.length,
    ungroupedDesignCount,
  };

  if (sectorWarning) {
    result.sectorWarning = sectorWarning;
  }

  if (designs.length > 8) {
    result.aiSuggestion = buildDesignListAiSuggestion(designs.length);
  }

  return result;
}

export async function getDesignSchemaJson(
  client: LanhuClient,
  imageId: string,
  teamId: string | undefined,
  projectId: string,
): Promise<LanhuDesignSchemaJsonResult> {
  const multiInfo = await client.getProjectMultiInfo(projectId, teamId, {
    img_limit: 500,
    detach: 1,
  });
  const images = Array.isArray(multiInfo.images) ? multiInfo.images : [];
  const versionId = requireVersionId(images, imageId);
  const revision = await client.getDdsSchemaRevision(versionId);
  const schemaUrl = asString(revision.data_resource_url);

  if (!schemaUrl) {
    throw new Error("store_schema_revise did not return data_resource_url");
  }

  const schema = await client.getJson<UnknownRecord>(schemaUrl, { dds: true, timeoutMs: 60_000 });
  if (!isRecord(schema)) {
    throw new Error("Schema JSON payload is not an object");
  }

  return {
    imageId,
    versionId,
    schemaUrl,
    schema,
  };
}

export async function getSketchJson(
  client: LanhuClient,
  imageId: string,
  teamId: string | undefined,
  projectId: string,
): Promise<LanhuSketchJsonResult> {
  const documentInfo = teamId
    ? await client.getDesignDocument(imageId, teamId, projectId)
    : await client.getDocumentInfo(projectId, imageId);
  const latestVersion = getLatestVersionInfo(documentInfo);
  const jsonUrl = asString(latestVersion?.json_url);

  if (!jsonUrl) {
    throw new Error(`Design ${imageId} is missing versions[0].json_url`);
  }

  const sketch = await client.getJson<UnknownRecord>(jsonUrl, { timeoutMs: 60_000 });
  if (!isRecord(sketch)) {
    throw new Error("Sketch JSON payload is not an object");
  }

  return {
    imageId,
    versionId: asString(latestVersion?.id),
    jsonUrl,
    documentInfo,
    sketch,
  };
}

export async function getSlices(
  client: LanhuClient,
  imageId: string,
  teamId: string | undefined,
  projectId: string,
  includeMetadata = true,
): Promise<LanhuSlicesResult> {
  const sketchResult = await getSketchJson(client, imageId, teamId, projectId);
  const latestVersion = getLatestVersionInfo(sketchResult.documentInfo);
  const { slices, sliceScale } = extractSlicesFromSketch(sketchResult.sketch, includeMetadata);

  return {
    designId: imageId,
    designName: asString(sketchResult.documentInfo.name) ?? `design-${imageId}`,
    version: asString(latestVersion?.version_info),
    sliceScale,
    canvasSize: {
      width: asNumber(sketchResult.documentInfo.width),
      height: asNumber(sketchResult.documentInfo.height),
    },
    totalSlices: slices.length,
    slices,
  };
}