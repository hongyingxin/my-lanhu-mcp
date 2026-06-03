import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");

function loadEnvFile(): void {
  const envPath = resolve(repoRoot, ".env");
  if (!existsSync(envPath)) {
    return;
  }

  const text = readFileSync(envPath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      continue;
    }

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

export function getServerPort(): number {
  const raw = process.env["SERVER_PORT"] ?? "3001";
  const port = Number.parseInt(raw, 10);
  return Number.isFinite(port) ? port : 3001;
}

export function getLanhuCookie(): string | undefined {
  const cookie = (process.env["LANHU_COOKIE"] ?? "").trim();
  return cookie || undefined;
}

export function getDdsCookie(): string | undefined {
  const cookie = (process.env["DDS_COOKIE"] ?? "").trim();
  return cookie || undefined;
}

/** 对齐 PY `DATA_DIR`，默认仓库根目录 `data/` */
export function getLanhuDataDir(): string {
  const custom = (process.env["LANHU_DATA_DIR"] ?? "").trim();
  return custom ? resolve(repoRoot, custom) : resolve(repoRoot, "data");
}
