export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getDesignSelector(
  body: unknown,
): string | string[] | undefined {
  if (!isRecord(body)) {
    return undefined;
  }

  const raw = body["design"] ?? body["designs"] ?? body["design_names"];
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item)).filter((item) => item.trim());
  }
  if (typeof raw === "string" && raw.trim()) {
    return raw.trim();
  }
  return undefined;
}

export function isBatchDesignSelector(selector: string | string[] | undefined): boolean {
  if (Array.isArray(selector)) {
    return selector.length > 0;
  }
  return typeof selector === "string" && selector.toLowerCase() === "all";
}

export function getStringField(body: unknown, key: string): string | undefined {
  if (!isRecord(body)) {
    return undefined;
  }
  const value = body[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function getBooleanField(body: unknown, key: string): boolean {
  return isRecord(body) && body[key] === true;
}

/** analyze 落盘默认开启，仅 `persistArtifacts: false` 时关闭 */
export function resolvePersistArtifacts(body: unknown): boolean {
  if (!isRecord(body)) {
    return true;
  }
  return body["persistArtifacts"] !== false;
}

export function getNumberField(body: unknown, key: string): number | undefined {
  if (!isRecord(body)) {
    return undefined;
  }
  const value = body[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function getDesignFields(body: unknown): {
  projectId: string;
  teamId?: string;
  imageId: string;
} | undefined {
  if (!isRecord(body)) {
    return undefined;
  }

  const projectId = getStringField(body, "projectId") ?? getStringField(body, "project_id");
  const teamId = getStringField(body, "teamId") ?? getStringField(body, "team_id");
  const imageId = getStringField(body, "imageId") ?? getStringField(body, "image_id");

  if (!projectId || !imageId) {
    return undefined;
  }

  return { projectId, teamId, imageId };
}

export function resolveRequestCookie(body: unknown, envCookie?: string): string | undefined {
  const fromBody = getStringField(body, "cookie");
  const cookie = (fromBody || envCookie || "").trim();
  return cookie || undefined;
}

export function resolveRequestDdsCookie(
  body: unknown,
  envDdsCookie: string | undefined,
  cookie: string,
): string {
  const fromBody = getStringField(body, "ddsCookie") ?? getStringField(body, "dds_cookie");
  return (fromBody || envDdsCookie || cookie).trim();
}

export const COOKIE_REQUIRED_MESSAGE =
  "Cookie 为空：请在页面粘贴 Cookie，或在 server 根目录 .env 配置 LANHU_COOKIE";

export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
