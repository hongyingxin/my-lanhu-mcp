import { API_BASE, get, post, setRequestCookie } from "./client";

export { API_BASE, setRequestCookie };

export async function apiHealth() {
  return get<{ ok?: boolean; hasEnvCookie?: boolean }>("/api/health");
}

export async function apiParseUrl(url: string) {
  return post("/api/parse-url", { url });
}

export async function apiListDesigns(url: string) {
  return post("/api/designs/list", { url });
}

export async function apiDesignSectors(projectId: string) {
  return post("/api/designs/sectors", { project_id: projectId });
}

export async function apiDesignDetail(fields: {
  projectId: string;
  teamId: string | null;
  imageId: string;
}) {
  return post("/api/designs/detail", {
    project_id: fields.projectId,
    team_id: fields.teamId,
    image_id: fields.imageId,
  });
}

export async function apiMultiInfo(fields: { projectId: string; teamId: string | null }) {
  return post("/api/designs/multi-info", {
    project_id: fields.projectId,
    team_id: fields.teamId,
  });
}

export async function apiSchemaRevise(versionId: string) {
  return post("/api/designs/schema-revise", { version_id: versionId });
}

export async function apiDesignSchema(fields: {
  projectId: string;
  teamId: string | null;
  imageId: string;
}) {
  return post("/api/designs/schema", {
    project_id: fields.projectId,
    team_id: fields.teamId,
    image_id: fields.imageId,
  });
}

export async function apiDesignSketch(fields: {
  projectId: string;
  teamId: string | null;
  imageId: string;
}) {
  return post("/api/designs/sketch", {
    project_id: fields.projectId,
    team_id: fields.teamId,
    image_id: fields.imageId,
  });
}

export async function apiConvertSketch(fields: {
  projectId: string;
  teamId: string | null;
  imageId: string;
  designName?: string;
  designImageUrl?: string;
}) {
  return post("/api/designs/convert-sketch", {
    project_id: fields.projectId,
    team_id: fields.teamId,
    image_id: fields.imageId,
    designName: fields.designName,
    designImageUrl: fields.designImageUrl,
  });
}

export async function apiSketchLayerAnnotations(fields: {
  projectId: string;
  teamId: string | null;
  imageId: string;
  designName?: string;
  designImageUrl?: string;
}) {
  return post("/api/designs/sketch-layer-annotations", {
    project_id: fields.projectId,
    team_id: fields.teamId,
    image_id: fields.imageId,
    designName: fields.designName,
    designImageUrl: fields.designImageUrl,
  });
}

export async function apiSketchAnnotations(fields: {
  projectId: string;
  teamId: string | null;
  imageId: string;
}) {
  return post("/api/designs/sketch-annotations", {
    project_id: fields.projectId,
    team_id: fields.teamId,
    image_id: fields.imageId,
  });
}

export async function apiConvertDesign(args: {
  projectId?: string;
  teamId?: string | null;
  imageId?: string;
  designName?: string;
  schema?: unknown;
}) {
  if (args.schema) {
    return post("/api/designs/convert", { schema: args.schema, designName: args.designName });
  }
  return post("/api/designs/convert", {
    project_id: args.projectId,
    team_id: args.teamId,
    image_id: args.imageId,
    designName: args.designName,
  });
}

export async function apiPreview(url: string) {
  return post("/api/designs/preview", { url });
}

export async function apiDesignSlices(fields: {
  projectId: string;
  teamId: string | null;
  imageId: string;
}) {
  return post("/api/designs/slices", {
    project_id: fields.projectId,
    team_id: fields.teamId,
    image_id: fields.imageId,
  });
}

export async function apiAnalyze(args: { url: string; design?: string; withSlices?: boolean }) {
  return post("/api/designs/analyze", {
    url: args.url,
    design: args.design,
    withSlices: args.withSlices,
  });
}
