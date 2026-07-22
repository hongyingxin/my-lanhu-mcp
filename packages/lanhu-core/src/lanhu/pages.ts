import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { parseLanhuUrl, buildPrototypeDocumentUrl } from "./parse-url.js";
import type { FetchLike, UnknownRecord } from "../types.js";
import { fixHtmlFiles } from "../transform/fix-html-files.js";
import { renderPrototypePages } from "../transform/page-browser-analyzer.js";
import { formatPageDesignInfo } from "../transform/page-design-info-format.js";
import {
  extractPageContentFromFile,
  type ExtractedPageContent,
} from "../transform/page-static-extractor.js";

const BASE_URL = "https://lanhuapp.com";
const CDN_URL = "https://axure-file.lanhuapp.com";
const CACHE_META_FILE = ".lanhu-page-cache.json";

export interface LanhuPageEntry {
  index: number;
  name: string;
  filename: string;
  id: string;
  type: string;
  level: number;
  folder: string;
  path: string;
  has_children: boolean;
}

export interface LanhuPagesListResult extends UnknownRecord {
  document_id?: string;
  document_name: string;
  document_type: string;
  total_pages: number;
  max_level: number;
  pages_with_children: number;
  folder_statistics: Record<string, number>;
  pages: LanhuPageEntry[];
}

export interface DownloadResourcesResult {
  status: "downloaded" | "cached";
  version_id: string;
  reason: "first_download" | "version_changed" | "up_to_date" | "files_missing";
  output_dir: string;
}

export interface AnalyzeLocalPageResult {
  page_name: string;
  success: boolean;
  page_text?: string;
  page_design_info?: ExtractedPageContent["designInfo"];
  page_design_info_text?: string;
  title?: string;
  text_lines?: string[];
  screenshot_path?: string;
  from_cache?: boolean;
  size?: string;
  error?: string;
}

interface CacheMeta extends UnknownRecord {
  version_id?: string;
  document_id?: string;
  document_name?: string;
  download_time?: string;
  pages?: string[];
  total_files?: number;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toStringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {};
}

function buildUrl(url: string, params?: Record<string, string | number | undefined>): string {
  if (!params) {
    return url;
  }

  const built = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    built.searchParams.set(key, String(value));
  }

  return built.toString();
}

async function fetchJson(
  fetchImpl: FetchLike,
  url: string,
  params?: Record<string, string | number | undefined>,
): Promise<UnknownRecord> {
  const response = await fetchImpl(buildUrl(url, params));
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  return toRecord(payload);
}

async function fetchText(fetchImpl: FetchLike, url: string): Promise<string> {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

async function fetchBytes(fetchImpl: FetchLike, url: string): Promise<Uint8Array> {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return new Uint8Array(await response.arrayBuffer());
}

function isSuccessCode(code: unknown): boolean {
  return code === 0 || code === "0" || code === "00000";
}

function normalizeAssetUrl(signMd5: string): string {
  return signMd5.startsWith("http://") || signMd5.startsWith("https://")
    ? signMd5
    : `${CDN_URL}/${signMd5}`;
}

export interface ProductDocumentEntry {
  doc_id: string;
  name: string;
  type: string;
  last_version_num?: unknown;
  latest_version?: unknown;
  create_time?: string;
  update_time?: string;
  doc_url: string;
}

export interface ProductDocumentsListResult {
  default_group_id?: unknown;
  doc_can_download?: unknown;
  need_group?: unknown;
  total: number;
  documents: ProductDocumentEntry[];
}

function resolvePrototypeParams(url: string, docIdOverride?: string): {
  teamId: string;
  projectId: string;
  docId: string;
  versionId?: string;
  pageId?: string;
} {
  const parsed = parseLanhuUrl(url);
  if (!parsed.teamId) {
    throw new Error("URL parsing failed: missing required param tid (team_id)");
  }

  const docId = docIdOverride ?? parsed.docId;
  if (!docId) {
    throw new Error(
      "URL parsing failed: missing docId/image_id. Use listProductDocuments first when URL only has tid+pid.",
    );
  }

  return {
    teamId: parsed.teamId,
    projectId: parsed.projectId,
    docId,
    versionId: parsed.versionId,
    pageId: parsed.pageId,
  };
}

export function resolvePrototypeDocumentUrl(url: string, docIdOverride?: string): string {
  const parsed = parseLanhuUrl(url);
  const docId = docIdOverride ?? parsed.docId;
  if (!docId) {
    throw new Error("Missing docId/image_id for prototype document URL");
  }
  if (parsed.docId === docId) {
    return url;
  }
  return buildPrototypeDocumentUrl(url, docId);
}

export async function listProductDocuments(
  fetchImpl: FetchLike,
  teamId: string,
  projectId: string,
): Promise<ProductDocumentsListResult> {
  const payload = await fetchJson(fetchImpl, `${BASE_URL}/api/project/product_documents`, {
    team_id: teamId,
    project_id: projectId,
  });

  const code = payload['code'];
  if (!isSuccessCode(code)) {
    throw new Error(`API Error: ${String(payload['msg'] ?? "unknown error")} (code=${String(code)})`);
  }

  const result = toRecord(payload['data'] ?? payload['result']);
  const resources = Array.isArray(result['resources']) ? result['resources'] : [];
  const documents: ProductDocumentEntry[] = [];

  for (const item of resources) {
    const record = toRecord(item);
    const docId = toStringValue(record['id']);
    if (!docId) {
      continue;
    }

    documents.push({
      doc_id: docId,
      name: toStringValue(record['name']) || "Unknown",
      type: toStringValue(record['type']) || "axure",
      last_version_num: record['last_version_num'],
      latest_version: record['latest_version'],
      create_time: formatChinaTime(record['create_time']),
      update_time: formatChinaTime(record['update_time']),
      doc_url: `${BASE_URL}/web/#/item/project/product?tid=${teamId}&pid=${projectId}&docId=${docId}&image_id=${docId}`,
    });
  }

  return {
    default_group_id: result['default_group_id'],
    doc_can_download: result['doc_can_download'],
    need_group: result['need_group'],
    total: documents.length,
    documents,
  };
}

export async function getPrototypeDocumentInfo(
  fetchImpl: FetchLike,
  projectId: string,
  docId: string,
): Promise<UnknownRecord> {
  const payload = await fetchJson(fetchImpl, `${BASE_URL}/api/project/image`, {
    pid: projectId,
    image_id: docId,
  });

  const code = payload['code'];
  if (!isSuccessCode(code)) {
    throw new Error(`API Error: ${String(payload['msg'] ?? "unknown error")} (code=${String(code)})`);
  }

  return toRecord(payload['data'] ?? payload['result']);
}

function extractPagesFromSitemap(rootNodes: unknown): LanhuPageEntry[] {
  const pages: LanhuPageEntry[] = [];

  const visit = (
    nodes: unknown,
    parentPath = "",
    level = 0,
    parentFolder: string | undefined = undefined,
  ): void => {
    if (!Array.isArray(nodes)) {
      return;
    }

    for (const node of nodes) {
      const record = toRecord(node);
      const pageName = toStringValue(record['pageName']);
      const filename = toStringValue(record['url']);
      const nodeType = toStringValue(record['type']) || "Wireframe";
      const nodeId = toStringValue(record['id']);
      const children = Array.isArray(record['children']) ? record['children'] : [];
      const currentPath = parentPath ? `${parentPath}/${pageName}` : pageName;
      const isPureFolder = nodeType === "Folder" && !filename;

      if (pageName && filename) {
        pages.push({
          index: pages.length + 1,
          name: pageName,
          filename,
          id: nodeId,
          type: nodeType,
          level,
          folder: parentFolder ?? "root",
          path: currentPath,
          has_children: children.length > 0,
        });
      }

      if (children.length > 0) {
        visit(children, currentPath, level + 1, isPureFolder ? pageName : parentFolder);
      }
    }
  };

  visit(rootNodes);
  return pages;
}

function formatChinaTime(value: unknown): string | undefined {
  if (typeof value !== "string" || !value) {
    return undefined;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return formatter.format(date);
}

export async function listPages(fetchImpl: FetchLike, url: string): Promise<LanhuPagesListResult> {
  const params = resolvePrototypeParams(url);
  const docInfo = await getPrototypeDocumentInfo(fetchImpl, params.projectId, params.docId);

  let projectInfo: UnknownRecord | undefined;
  try {
    const payload = await fetchJson(fetchImpl, `${BASE_URL}/api/project/multi_info`, {
      project_id: params.projectId,
      team_id: params.teamId,
      doc_info: 1,
    });
    if (payload['code'] === "00000") {
      projectInfo = toRecord(payload['result']);
    }
  } catch {
    projectInfo = undefined;
  }

  const versions = Array.isArray(docInfo['versions']) ? docInfo['versions'] : [];
  if (versions.length === 0) {
    throw new Error("Document version info not found");
  }

  const latestVersion = toRecord(versions[0]);
  const jsonUrl = toStringValue(latestVersion['json_url']);
  if (!jsonUrl) {
    throw new Error("Mapping JSON URL not found");
  }

  const projectMapping = await fetchJson(fetchImpl, jsonUrl);
  const sitemap = toRecord(projectMapping['sitemap']);
  const pages = extractPagesFromSitemap(sitemap['rootNodes']);

  const folderStatistics: Record<string, number> = {};
  let maxLevel = 0;
  let pagesWithChildren = 0;

  for (const page of pages) {
    folderStatistics[page.folder] = (folderStatistics[page.folder] ?? 0) + 1;
    maxLevel = Math.max(maxLevel, page.level);
    if (page.has_children) {
      pagesWithChildren += 1;
    }
  }

  const result: LanhuPagesListResult = {
    document_id: params.docId,
    document_name: toStringValue(docInfo['name']) || "Unknown",
    document_type: toStringValue(docInfo['type']) || "axure",
    total_pages: pages.length,
    max_level: maxLevel,
    pages_with_children: pagesWithChildren,
    folder_statistics: folderStatistics,
    pages,
  };

  const createTime = formatChinaTime(docInfo['create_time']);
  if (createTime) {
    result['create_time'] = createTime;
  }

  const updateTime = formatChinaTime(docInfo['update_time']);
  if (updateTime) {
    result['update_time'] = updateTime;
  }

  result['total_versions'] = versions.length;
  const latestVersionInfo = latestVersion['version_info'];
  if (latestVersionInfo !== undefined) {
    result['latest_version'] = latestVersionInfo;
  }

  if (projectInfo) {
    if (projectInfo['creator_name'] !== undefined) {
      result['creator_name'] = projectInfo['creator_name'];
    }
    if (projectInfo['folder_name'] !== undefined) {
      result['folder_name'] = projectInfo['folder_name'];
    }
    if (projectInfo['save_path'] !== undefined) {
      result['project_path'] = projectInfo['save_path'];
    }
    if (projectInfo['member_cnt'] !== undefined) {
      result['member_count'] = projectInfo['member_cnt'];
    }
  }

  return result;
}

async function ensureParentDir(filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
}

async function saveJson(filePath: string, payload: unknown): Promise<void> {
  await ensureParentDir(filePath);
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function loadCacheMeta(outputDir: string): Promise<CacheMeta> {
  const metaPath = join(outputDir, CACHE_META_FILE);
  if (!existsSync(metaPath)) {
    return {};
  }

  try {
    const content = await readFile(metaPath, "utf8");
    const parsed = JSON.parse(content);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function saveCacheMeta(outputDir: string, meta: CacheMeta): Promise<void> {
  await saveJson(join(outputDir, CACHE_META_FILE), meta);
}

function collectExpectedFiles(projectMapping: UnknownRecord): string[] {
  const pages = toRecord(projectMapping['pages']);
  const expected = new Set<string>();

  for (const htmlFilename of Object.keys(pages)) {
    expected.add(htmlFilename);
  }

  for (const directory of ["data", "resources", "files", "images"]) {
    expected.add(directory);
  }

  return Array.from(expected);
}

function shouldUpdateCache(
  outputDir: string,
  projectMapping: UnknownRecord,
): {
  needUpdate: boolean;
  reason: DownloadResourcesResult["reason"];
  missingFiles: string[];
} {
  const metaPath = join(outputDir, CACHE_META_FILE);
  if (!existsSync(metaPath)) {
    return { needUpdate: true, reason: "first_download", missingFiles: [] };
  }

  const expectedFiles = collectExpectedFiles(projectMapping);
  const missingFiles = expectedFiles.filter((relativePath) => !existsSync(join(outputDir, relativePath)));

  return {
    needUpdate: missingFiles.length > 0,
    reason: missingFiles.length > 0 ? "files_missing" : "up_to_date",
    missingFiles,
  };
}

async function downloadFile(fetchImpl: FetchLike, url: string, localPath: string): Promise<void> {
  try {
    const bytes = await fetchBytes(fetchImpl, url);
    await ensureParentDir(localPath);
    await writeFile(localPath, bytes);
  } catch {
    // best-effort resource download
  }
}

async function downloadPageResources(
  fetchImpl: FetchLike,
  pageMapping: UnknownRecord,
  outputDir: string,
  skipDocumentJs: boolean,
): Promise<void> {
  const tasks: Promise<void>[] = [];

  const scheduleGroup = (groupName: "styles" | "scripts" | "images"): void => {
    const group = toRecord(pageMapping[groupName]);
    for (const [localPath, info] of Object.entries(group)) {
      const asset = toRecord(info);
      if (groupName === "scripts" && skipDocumentJs && localPath === "data/document.js") {
        continue;
      }

      const signMd5 = toStringValue(asset['sign_md5']);
      if (!signMd5) {
        continue;
      }

      tasks.push(downloadFile(fetchImpl, normalizeAssetUrl(signMd5), join(outputDir, localPath)));
    }
  };

  scheduleGroup("styles");
  scheduleGroup("scripts");
  scheduleGroup("images");

  await Promise.all(tasks);
}

export async function downloadResources(
  fetchImpl: FetchLike,
  url: string,
  outputDir: string,
  forceUpdate = false,
): Promise<DownloadResourcesResult> {
  const params = resolvePrototypeParams(url);
  const docInfo = await getPrototypeDocumentInfo(fetchImpl, params.projectId, params.docId);
  const versions = Array.isArray(docInfo['versions']) ? docInfo['versions'] : [];

  if (versions.length === 0) {
    throw new Error("Document version info not found");
  }

  const versionInfo = toRecord(versions[0]);
  const versionId = toStringValue(versionInfo['id']);
  const jsonUrl = toStringValue(versionInfo['json_url']);
  if (!jsonUrl) {
    throw new Error("Mapping JSON URL not found");
  }

  const projectMapping = await fetchJson(fetchImpl, jsonUrl);
  const outputExisted = existsSync(outputDir);

  if (!forceUpdate && outputExisted) {
    const cacheMeta = await loadCacheMeta(outputDir);
    if (cacheMeta.version_id === versionId) {
      const cacheState = shouldUpdateCache(outputDir, projectMapping);
      if (!cacheState.needUpdate) {
        return {
          status: "cached",
          version_id: versionId,
          reason: cacheState.reason,
          output_dir: outputDir,
        };
      }
    }
  }

  await mkdir(outputDir, { recursive: true });

  const pages = toRecord(projectMapping['pages']);
  let isFirstPage = true;
  const downloadedFiles: string[] = [];

  for (const [htmlFilename, pageInfo] of Object.entries(pages)) {
    const pageRecord = toRecord(pageInfo);
    const htmlData = toRecord(pageRecord['html']);
    const htmlFileWithMd5 = toStringValue(htmlData['sign_md5']);
    const pageMappingMd5 = toStringValue(pageRecord['mapping_md5']);

    if (!htmlFileWithMd5) {
      continue;
    }

    const htmlContent = await fetchText(fetchImpl, normalizeAssetUrl(htmlFileWithMd5));
    if (pageMappingMd5) {
      const pageMapping = await fetchJson(fetchImpl, normalizeAssetUrl(pageMappingMd5));
      await downloadPageResources(fetchImpl, pageMapping, outputDir, !isFirstPage);
      isFirstPage = false;
    }

    await ensureParentDir(join(outputDir, htmlFilename));
    await writeFile(join(outputDir, htmlFilename), htmlContent, "utf8");
    downloadedFiles.push(htmlFilename);
  }

  await saveCacheMeta(outputDir, {
    version_id: versionId,
    document_id: params.docId,
    document_name: toStringValue(docInfo['name']) || "Unknown",
    download_time: new Date().toISOString(),
    pages: Object.keys(pages),
    total_files: downloadedFiles.length,
  });

  await fixHtmlFiles(outputDir);

  return {
    status: "downloaded",
    version_id: versionId,
    reason: outputExisted ? "version_changed" : "first_download",
    output_dir: outputDir,
  };
}

export async function analyzeLocalPage(
  resourceDir: string,
  pageName: string,
): Promise<AnalyzeLocalPageResult> {
  const htmlPath = join(resourceDir, `${pageName}.html`);
  if (!existsSync(htmlPath)) {
    return {
      page_name: pageName,
      success: false,
      error: `Page ${pageName} does not exist`,
    };
  }

  try {
    const extracted = extractPageContentFromFile(htmlPath, { resourceDir });
    return {
      page_name: pageName,
      success: true,
      page_text: extracted.pageText,
      page_design_info: extracted.designInfo,
      title: extracted.title,
      text_lines: extracted.textLines,
    };
  } catch (error) {
    return {
      page_name: pageName,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function resolveTargetPageStems(
  document: LanhuPagesListResult,
  pageNames: string | string[],
): string[] {
  const pageMap = new Map(
    document.pages.map((page) => [page.name, page.filename.replace(/\.html$/i, "")]),
  );
  const requested = Array.isArray(pageNames) ? pageNames : [pageNames];

  if (requested.length === 1 && requested[0]?.toLowerCase() === "all") {
    return document.pages.map((page) => page.filename.replace(/\.html$/i, ""));
  }

  return requested.map((name) => pageMap.get(name) ?? name);
}

export async function analyzePrototypePages(
  fetchImpl: FetchLike,
  url: string,
  outputDir: string,
  pageNames: string | string[],
  options: {
    forceDownload?: boolean;
    screenshotOutputDir: string;
  },
): Promise<{
  document: LanhuPagesListResult;
  download: DownloadResourcesResult;
  screenshot_output_dir: string;
  results: AnalyzeLocalPageResult[];
}> {
  const download = await downloadResources(fetchImpl, url, outputDir, options.forceDownload ?? false);
  const document = await listPages(fetchImpl, url);
  const targetPages = resolveTargetPageStems(document, pageNames);
  const screenshotOutputDir = options.screenshotOutputDir;

  await fixHtmlFiles(outputDir);

  const rendered = await renderPrototypePages(outputDir, targetPages, screenshotOutputDir, {
    versionId: download.version_id,
    captureScreenshot: true,
  });

  const results: AnalyzeLocalPageResult[] = rendered.map((item) => ({
    page_name: item.page_name,
    success: item.success,
    page_text: item.page_text,
    page_design_info: item.page_design_info,
    page_design_info_text: item.page_design_info
      ? formatPageDesignInfo(item.page_design_info, outputDir)
      : undefined,
    screenshot_path: item.screenshot_path,
    from_cache: item.from_cache,
    size: item.size,
    error: item.error,
  }));

  return {
    document,
    download,
    screenshot_output_dir: screenshotOutputDir,
    results,
  };
}
