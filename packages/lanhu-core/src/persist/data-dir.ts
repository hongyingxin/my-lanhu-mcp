import { mkdir } from "node:fs/promises";
import { join } from "node:path";

/** 本地数据目录，默认 `./data`（可通过 `LANHU_DATA_DIR` 覆盖） */
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

/** `data/lanhu_designs/{projectId}` */
export function resolveDesignOutputDir(dataDir: string, projectId: string): string {
  return join(resolveLanhuDataDir(dataDir), "lanhu_designs", projectId);
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

export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

export function safeDesignFilename(name: string): string {
  const base = name.replace(/[/\\]/g, "_").trim();
  return base || "unnamed";
}
