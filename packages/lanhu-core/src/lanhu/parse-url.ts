import type { LanhuUrlKind, LanhuUrlParams } from "../types.js";

function detectUrlKind(route?: string): LanhuUrlKind {
  if (!route) {
    return "unknown";
  }
  if (route.includes("/invite")) {
    return "invite";
  }
  if (route.includes("/stage") || route.includes("/detailDetach")) {
    return "design";
  }
  if (route.includes("/product")) {
    return "prototype";
  }
  return "unknown";
}

export function parseLanhuUrl(input: string): LanhuUrlParams {
  const rawUrl = input.trim();
  if (!rawUrl) {
    throw new Error("Lanhu URL is required");
  }

  let route: string | undefined;
  let queryString = rawUrl;

  if (/^https?:\/\//i.test(rawUrl)) {
    const parsed = new URL(rawUrl);
    const fragment = parsed.hash.startsWith("#") ? parsed.hash.slice(1) : parsed.hash;

    if (fragment) {
      const [fragmentRoute, fragmentQuery = ""] = fragment.split("?", 2);
      route = fragmentRoute || undefined;
      queryString = fragmentQuery || "";
    } else {
      route = parsed.pathname || undefined;
      queryString = parsed.search.startsWith("?") ? parsed.search.slice(1) : parsed.search;
    }
  } else if (rawUrl.startsWith("?")) {
    queryString = rawUrl.slice(1);
  } else if (rawUrl.includes("?")) {
    const [inlineRoute, inlineQuery = ""] = rawUrl.split("?", 2);
    route = inlineRoute || undefined;
    queryString = inlineQuery;
  }

  const searchParams = new URLSearchParams(queryString);
  const rawParams = Object.fromEntries(searchParams.entries());
  const teamId = rawParams["tid"] ?? rawParams["teamId"] ?? rawParams["team_id"];
  const projectId = rawParams["pid"] ?? rawParams["project_id"];
  const docId = rawParams["docId"] ?? rawParams["image_id"];
  const pageId = rawParams["pageId"] ?? rawParams["page_id"];
  const versionId = rawParams["versionId"];

  if (!projectId) {
    throw new Error("URL parsing failed: missing required param pid (project_id)");
  }

  const kind = detectUrlKind(route);
  const isSingleDesignUrl = kind === "design" && route?.includes("/detailDetach") && docId;
  if (!teamId && !isSingleDesignUrl) {
    throw new Error("URL parsing failed: missing required param tid (team_id)");
  }

  return {
    rawUrl,
    route,
    kind,
    teamId,
    projectId,
    docId,
    imageId: docId,
    pageId,
    versionId,
    rawParams,
  };
}

/** 为仅有 tid/pid 的项目链接补上 docId，供 list/download/analyze 使用。 */
export function buildPrototypeDocumentUrl(inputUrl: string, docId: string): string {
  const parsed = parseLanhuUrl(inputUrl);
  const params = new URLSearchParams(parsed.rawParams);
  params.set("docId", docId);
  params.set("image_id", docId);
  const route = parsed.route ?? "/item/project/product";
  if (/^https?:\/\//i.test(parsed.rawUrl)) {
    const origin = parsed.rawUrl.split("#")[0] ?? "https://lanhuapp.com/web/";
    return `${origin}#${route}?${params.toString()}`;
  }
  return `#${route}?${params.toString()}`;
}

export function buildQuery(params: Record<string, string | number | boolean | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  }
  return search.toString();
}
