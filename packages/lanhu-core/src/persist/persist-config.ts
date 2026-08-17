import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** 解析 `LANHU_PERSIST_ARTIFACTS`；未设置时默认 `true`（写入 `LANHU_DATA_DIR`） */
export function resolveLanhuPersistArtifacts(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env["LANHU_PERSIST_ARTIFACTS"]?.trim().toLowerCase();
  if (!raw) {
    return true;
  }
  if (raw === "false" || raw === "0" || raw === "no") {
    return false;
  }
  if (raw === "true" || raw === "1" || raw === "yes") {
    return true;
  }
  return true;
}

/** 不落盘到 `data/` 时，原型 analyze 等使用的临时工作目录 */
export async function createLanhuEphemeralWorkDir(prefix = "lanhu-work-"): Promise<string> {
  const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, "-");
  return mkdtemp(join(tmpdir(), safePrefix));
}

export async function removeLanhuEphemeralWorkDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}
