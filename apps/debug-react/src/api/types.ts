export interface DesignItem {
  index: number;
  id: string;
  name: string;
  width: number;
  height: number;
  url: string;
}

export interface ServerParams {
  teamId?: string | null;
  projectId: string;
  docId?: string | null;
  imageId?: string | null;
  versionId?: string | null;
}

export interface ConvertAfter {
  css?: string;
  cssPreview?: string;
  cssRuleCount?: number;
  htmlBody?: string;
  htmlBodyPreview?: string;
  htmlPreviewDoc?: string;
  htmlFull?: string;
  htmlLength?: number;
  mapping?: Record<string, string>;
  mappingCount?: number;
  layerAnnotations?: unknown[];
  designScale?: unknown;
}

export interface ConvertDemo {
  ok: boolean;
  source?: string;
  before?: unknown;
  after: ConvertAfter;
}

export interface RequestLogEntry {
  id: number;
  ok: boolean;
  method: string;
  url: string;
  status: number;
  elapsedMs: number;
  note: string;
}

export type InspectResultKey =
  | "params"
  | "sectors"
  | "designs"
  | "preview"
  | "multiInfo"
  | "schemaRevise"
  | "schema"
  | "convertCss"
  | "convertHtml"
  | "convertHtmlFull"
  | "convertMapping"
  | "designDetail"
  | "sketch"
  | "analyze"
  | "warnings"
  | "designTokens"
  | "layoutSummary"
  | "layerTree"
  | "sketchAnnotations";

export type InspectResults = Partial<Record<InspectResultKey, unknown>>;
