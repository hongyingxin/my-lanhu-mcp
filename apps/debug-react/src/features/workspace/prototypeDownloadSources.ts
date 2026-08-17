import type { InspectResults, PrototypeDownloadSources } from "@/api/types";

export function extractDownloadSources(payload: unknown): PrototypeDownloadSources | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const record = payload as { sources?: PrototypeDownloadSources };
  return record.sources;
}

export function applyPrototypeDownloadSourcesToResults(
  results: InspectResults,
  payload: unknown,
): void {
  const sources = extractDownloadSources(payload);
  if (!sources) {
    return;
  }

  results.prototypeMappingSource = {
    document_id: sources.document_id,
    document_name: sources.document_name,
    version_id: sources.version_id,
    json_url: sources.json_url,
  };
  results.prototypePageSources = sources.pages;
}
