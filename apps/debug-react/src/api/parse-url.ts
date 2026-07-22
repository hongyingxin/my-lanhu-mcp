export interface LanhuParams {
  team_id: string | null;
  project_id: string;
  doc_id: string | null;
  page_id: string | null;
  version_id: string | null;
  source?: string;
}

export function parseLanhuUrl(url: string): LanhuParams {
  let query = url;

  if (url.startsWith("http")) {
    const hashIndex = url.indexOf("#");
    if (hashIndex === -1) throw new Error("Invalid Lanhu URL: missing fragment part");
    const fragment = url.slice(hashIndex + 1);
    query = fragment.includes("?") ? fragment.split("?", 2)[1]! : fragment;
  }

  if (query.startsWith("?")) query = query.slice(1);

  const params: Record<string, string> = {};
  for (const part of query.split("&")) {
    if (!part.includes("=")) continue;
    const [key, value] = part.split("=", 2);
    params[key!] = decodeURIComponent(value!);
  }

  const projectId = params.pid;
  if (!projectId) throw new Error("URL parsing failed: missing required param pid");

  return {
    team_id: params.tid || null,
    project_id: projectId,
    doc_id: params.docId || params.image_id || null,
    page_id: params.pageId || null,
    version_id: params.versionId || null,
  };
}
