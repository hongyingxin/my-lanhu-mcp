import axios from "axios";

const BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3001";

let requestCookie = "";

/** 页面 Cookie 优先；每次请求会附带在 body.cookie */
export function setRequestCookie(cookie) {
  requestCookie = (cookie || "").trim();
}

async function post(path, body = {}) {
  const payload = { ...body };
  if (requestCookie) {
    payload.cookie = requestCookie;
  }
  const { data } = await axios.post(`${BASE}${path}`, payload);
  return data;
}

export async function apiHealth() {
  const { data } = await axios.get(`${BASE}/api/health`);
  return data;
}

export async function apiParseUrl(url) {
  return post("/api/parse-url", { url });
}

export async function apiListDesigns(url) {
  return post("/api/designs/list", { url });
}

export async function apiDesignSectors(projectId) {
  return post("/api/designs/sectors", { project_id: projectId });
}

export async function apiDesignDetail({ projectId, teamId, imageId }) {
  return post("/api/designs/detail", {
    project_id: projectId,
    team_id: teamId,
    image_id: imageId,
  });
}

export async function apiMultiInfo({ projectId, teamId }) {
  return post("/api/designs/multi-info", {
    project_id: projectId,
    team_id: teamId,
  });
}

export async function apiSchemaRevise(versionId) {
  return post("/api/designs/schema-revise", { version_id: versionId });
}

export async function apiDesignSchema({ projectId, teamId, imageId }) {
  return post("/api/designs/schema", {
    project_id: projectId,
    team_id: teamId,
    image_id: imageId,
  });
}

export async function apiDesignSketch({ projectId, teamId, imageId }) {
  return post("/api/designs/sketch", {
    project_id: projectId,
    team_id: teamId,
    image_id: imageId,
  });
}

export async function apiConvertDesign({ projectId, teamId, imageId, designName, schema }) {
  if (schema) {
    return post("/api/designs/convert", { schema, designName });
  }
  return post("/api/designs/convert", {
    project_id: projectId,
    team_id: teamId,
    image_id: imageId,
    designName,
  });
}

export async function apiPreview(url) {
  return post("/api/designs/preview", { url });
}

export async function apiDesignSlices({ projectId, teamId, imageId }) {
  return post("/api/designs/slices", {
    project_id: projectId,
    team_id: teamId,
    image_id: imageId,
  });
}

export async function apiAnalyze({ url, design, withSlices = false }) {
  return post("/api/designs/analyze", { url, design, withSlices });
}

export { BASE as API_BASE };
