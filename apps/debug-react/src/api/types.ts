export interface PrototypePageItem {
  index: number;
  name: string;
  filename: string;
  id: string;
  type: string;
  level: number;
  folder: string;
  path: string;
  has_children: boolean;
}

export interface PrototypeListResult {
  ok?: boolean;
  document_id?: string;
  document_name?: string;
  document_type?: string;
  total_pages?: number;
  pages?: PrototypePageItem[];
}

export interface ProductDocumentItem {
  doc_id: string;
  name: string;
  type: string;
  doc_url: string;
  create_time?: string;
  update_time?: string;
}

export interface ProductDocumentsListResult {
  ok?: boolean;
  total?: number;
  documents?: ProductDocumentItem[];
}

export interface PrototypeAnalyzeResultItem {
  page_name: string;
  success: boolean;
  page_text?: string;
  page_design_info?: unknown;
  page_design_info_text?: string;
  title?: string;
  text_lines?: string[];
  screenshot_path?: string;
  from_cache?: boolean;
  size?: string;
  error?: string;
}

export interface PrototypeAnalyzeResult {
  ok?: boolean;
  output_dir?: string;
  screenshot_output_dir?: string;
  total_requested?: number;
  successful?: number;
  failed?: number;
  document?: PrototypeListResult;
  download?: {
    status?: string;
    version_id?: string;
    reason?: string;
    output_dir?: string;
  };
  results?: PrototypeAnalyzeResultItem[];
}

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
  | "sketchAnnotations"
  | "sketchHtml"
  | "layerAnnotations"
  | "prototypeParams"
  | "prototypeList"
  | "prototypeDocuments"
  | "prototypeDownload"
  | "prototypeAnalyze"
  | "prototypePageText"
  | "prototypeDesignInfo"
  | "prototypeScreenshots";

export type InspectResults = Partial<Record<InspectResultKey, unknown>>;
