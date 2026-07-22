import { resolve } from "node:path";
import { getRepoRoot, loadRepoEnvFile } from "@lanhu/core";

loadRepoEnvFile();

export function getServerPort(): number {
  return 3001;
}

export function getLanhuCookie(): string | undefined {
  const cookie = (process.env["LANHU_COOKIE"] ?? "").trim();
  return cookie || undefined;
}

/** 本地数据目录，默认仓库根目录 `data/` */
export function getLanhuDataDir(): string {
  const custom = (process.env["LANHU_DATA_DIR"] ?? "").trim();
  const repoRoot = getRepoRoot();
  return custom ? resolve(repoRoot, custom) : resolve(repoRoot, "data");
}
