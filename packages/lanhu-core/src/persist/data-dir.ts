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

/** `data/axure_extract_{docId前8位}` */
export function resolveAxureOutputDir(dataDir: string, docId: string): string {
  const safeId = docId.trim().slice(0, 8) || "unknown";
  return join(resolveLanhuDataDir(dataDir), `axure_extract_${safeId}`);
}

/** `data/axure_extract_{docId前8位}_screenshots` */
export function resolveAxureScreenshotDir(dataDir: string, docId: string): string {
  const safeId = docId.trim().slice(0, 8) || "unknown";
  return join(resolveLanhuDataDir(dataDir), `axure_extract_${safeId}_screenshots`);
}

export function safeDesignFilename(name: string): string {
  const base = name.replace(/[/\\]/g, "_").trim();
  return base || "unnamed";
}

export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}
