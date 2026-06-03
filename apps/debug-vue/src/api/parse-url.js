export function parseLanhuUrl(url) {
  let query = url;

  if (url.startsWith("http")) {
    const hashIndex = url.indexOf("#");
    if (hashIndex === -1) throw new Error("Invalid Lanhu URL: missing fragment part");
    const fragment = url.slice(hashIndex + 1);
    query = fragment.includes("?") ? fragment.split("?", 2)[1] : fragment;
  }

  if (query.startsWith("?")) query = query.slice(1);

  const params = {};
  for (const part of query.split("&")) {
    if (!part.includes("=")) continue;
    const [key, value] = part.split("=", 2);
    params[key] = decodeURIComponent(value);
  }

  const projectId = params.pid;
  if (!projectId) throw new Error("URL parsing failed: missing required param pid");

  return {
    team_id: params.tid || null,
    project_id: projectId,
    doc_id: params.docId || params.image_id || null,
    version_id: params.versionId || null,
  };
}

export function buildQuery(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  }
  return search.toString();
}
