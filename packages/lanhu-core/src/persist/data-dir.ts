import { mkdir } from "node:fs/promises";
import { join } from "node:path";

/** 对齐 PY `DATA_DIR`，默认 `./data` */
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

export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

export function safeDesignFilename(name: string): string {
  const base = name.replace(/[/\\]/g, "_").trim();
  return base || "unnamed";
}
