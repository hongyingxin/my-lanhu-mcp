import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";

import { getRepoRoot } from "../env/repo-env.js";

/** 本地数据目录，默认 `./data`（可通过 `LANHU_DATA_DIR` 覆盖；不锚定仓库根） */
export function resolveLanhuDataDir(explicit?: string): string {
  const trimmed = explicit?.trim();
  if (trimmed) {
    return trimmed;
  }
  const fromEnv = process.env["LANHU_DATA_DIR"]?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  return "data";
}

/**
 * 解析 `LANHU_DATA_DIR`：相对路径锚定 monorepo 仓库根；未设置时 `{repoRoot}/data`。
 * MCP / server 等独立进程应使用此函数，避免相对路径随 cwd 漂移。
 */
export function resolveLanhuDataDirAnchored(env: NodeJS.ProcessEnv = process.env): string {
  const custom = env["LANHU_DATA_DIR"]?.trim();
  const repoRoot = getRepoRoot();
  return custom ? resolve(repoRoot, custom) : resolve(repoRoot, "data");
}

/** `{designId}_{slug}`，如 `214c0a95-..._画板3` */
export function resolveDesignDirSegment(designId: string, designName: string): string {
  const id = designId.trim();
  if (!id) {
    throw new Error("designId is required for design output directory");
  }
  return `${id}_${safeDesignFilename(designName)}`;
}

/** `data/lanhu_designs/{projectId}/{designId}_{slug}/` */
export function resolveDesignOutputDir(
  dataDir: string,
  projectId: string,
  designId: string,
  designName: string,
): string {
  return join(
    resolveLanhuDataDir(dataDir),
    "lanhu_designs",
    projectId,
    resolveDesignDirSegment(designId, designName),
  );
}

/** `{docId}_{slug}`，如 `077bbf6d-..._【FAHA】首充活动` */
export function resolvePrototypeDirSegment(docId: string, documentName: string): string {
  const id = docId.trim();
  if (!id) {
    throw new Error("docId is required for prototype output directory");
  }
  return `${id}_${safeDesignFilename(documentName)}`;
}

/** `data/lanhu_prototypes/{projectId}/{docId}_{slug}/` — Axure 下载包根目录 */
export function resolvePrototypeOutputDir(
  dataDir: string,
  projectId: string,
  docId: string,
  documentName: string,
): string {
  return join(
    resolveLanhuDataDir(dataDir),
    "lanhu_prototypes",
    projectId,
    resolvePrototypeDirSegment(docId, documentName),
  );
}

/** `data/lanhu_prototypes/{projectId}/{docId}_{slug}/screenshots/` */
export function resolvePrototypeScreenshotDir(
  dataDir: string,
  projectId: string,
  docId: string,
  documentName: string,
): string {
  return join(resolvePrototypeOutputDir(dataDir, projectId, docId, documentName), "screenshots");
}

/** Axure 下载包根目录（`resolvePrototypeOutputDir` 别名，保留旧导出名） */
export function resolveAxureOutputDir(
  dataDir: string,
  projectId: string,
  docId: string,
  documentName: string,
): string {
  return resolvePrototypeOutputDir(dataDir, projectId, docId, documentName);
}

/** Playwright 分析产物目录（`resolvePrototypeScreenshotDir` 别名） */
export function resolveAxureScreenshotDir(
  dataDir: string,
  projectId: string,
  docId: string,
  documentName: string,
): string {
  return resolvePrototypeScreenshotDir(dataDir, projectId, docId, documentName);
}

export function safeDesignFilename(name: string): string {
  const base = name.replace(/[/\\]/g, "_").trim();
  return base || "unnamed";
}

export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}
