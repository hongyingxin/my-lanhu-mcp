export type LanhuUrlKind = "design" | "prototype" | "invite" | "unknown";

export type UnknownRecord = Record<string, unknown>;

export type LanhuApiSuccessCode = 0 | "0" | "00000";

export type LanhuApiCode = LanhuApiSuccessCode | number | string;

export interface LanhuApiEnvelope<T> {
  code?: LanhuApiCode;
  msg?: string;
  data?: T;
  result?: T;
}

export interface LanhuUrlParams {
  rawUrl: string;
  route?: string;
  kind: LanhuUrlKind;
  teamId?: string;
  projectId: string;
  docId?: string;
  imageId?: string;
  pageId?: string;
  versionId?: string;
  rawParams: Record<string, string>;
}

export interface LanhuVersionInfo extends UnknownRecord {
  id?: string;
  version_info?: string;
  json_url?: string;
}

export interface LanhuDocumentInfo extends UnknownRecord {
  id?: string;
  name?: string;
  type?: string;
  url?: string;
  width?: number;
  height?: number;
  update_time?: string;
  has_comment?: boolean;
  versions?: LanhuVersionInfo[];
}

export interface LanhuProjectImageInfo extends UnknownRecord {
  id?: string;
  name?: string;
  width?: number;
  height?: number;
  url?: string;
  has_comment?: boolean;
  update_time?: string;
  latest_version?: string;
}

export interface LanhuProjectImagesPayload extends UnknownRecord {
  name?: string;
  images?: LanhuProjectImageInfo[];
}

export interface LanhuProjectMultiInfoImage extends UnknownRecord {
  id?: string;
  latest_version?: string;
}

export interface LanhuProjectMultiInfoPayload extends UnknownRecord {
  images?: LanhuProjectMultiInfoImage[];
  project_name?: string;
  projectName?: string;
  name?: string;
}

export interface LanhuSchemaRevisionPayload extends UnknownRecord {
  data_resource_url?: string;
}

export interface LanhuDesignSectorSummary {
  id: string;
  parentId?: string | null;
  name?: string;
  path: string;
  order: number;
  imageCount: number;
}

export interface LanhuDesignListAiSuggestion {
  notice: string;
  recommendation: string;
  userPromptTemplate: string;
  languageNote: string;
}

export interface LanhuDesignSummary {
  index: number;
  id: string;
  name: string;
  width?: number;
  height?: number;
  url?: string;
  hasComment: boolean;
  updateTime?: string;
  /** 设计所属分组名（来自 project_sectors，仅 projectImages 列表） */
  sectors?: string[];
  source: "projectImages" | "detailDetach";
  raw: UnknownRecord;
}

export interface LanhuDesignListResult {
  status: "success";
  projectName?: string;
  totalDesigns: number;
  designs: LanhuDesignSummary[];
  source: "projectImages" | "detailDetach";
  params: LanhuUrlParams;
  sectors?: LanhuDesignSectorSummary[];
  totalSectors?: number;
  ungroupedDesignCount?: number;
  sectorWarning?: string;
  aiSuggestion?: LanhuDesignListAiSuggestion;
}

export interface LanhuDesignSchemaJsonResult {
  imageId: string;
  versionId: string;
  schemaUrl: string;
  schema: UnknownRecord;
}

export interface LanhuSketchJsonResult {
  imageId: string;
  versionId?: string;
  jsonUrl: string;
  documentInfo: LanhuDocumentInfo;
  sketch: UnknownRecord;
}

export interface LanhuSliceMetadata extends UnknownRecord {
  fills?: unknown[];
  borders?: unknown[];
  opacity?: number;
  rotation?: number;
  text_style?: unknown;
  shadows?: unknown[];
  border_radius?: unknown;
}

export interface LanhuSliceLogicalSize {
  width: number;
  height: number;
  note: string;
}

export interface LanhuSliceInfo {
  id?: string;
  name: string;
  type?: string;
  downloadUrl: string;
  size: string;
  format: "png" | "svg";
  svgUrl?: string;
  scaleUrls?: Record<string, string>;
  logicalSize?: LanhuSliceLogicalSize;
  baseSize?: LanhuSliceLogicalSize;
  position?: {
    x: number;
    y: number;
  };
  parentName?: string;
  layerPath: string;
  metadata?: LanhuSliceMetadata;
}

export interface LanhuSlicesResult {
  designId: string;
  designName: string;
  version?: string;
  sliceScale?: number;
  canvasSize: {
    width?: number;
    height?: number;
  };
  totalSlices: number;
  slices: LanhuSliceInfo[];
}

export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface LanhuClientOptions {
  baseUrl?: string;
  ddsBaseUrl?: string;
  cookie?: string;
  ddsCookie?: string;
  fetchImpl?: FetchLike;
}
