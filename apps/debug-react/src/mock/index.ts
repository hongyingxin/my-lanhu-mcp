import type { LanhuParams } from "@/api/parse-url";
import type { DesignItem } from "@/api/types";

const MOCK_DATA: Record<string, unknown> = {
  health: {},
  sectors: {},
  images: { data: { images: [] } },
  preview: { data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==", contentType: "image/png" },
  multiInfo: { result: { images: [] } },
  schemaRevise: { data: {} },
  schema: {},
  designDetail: { result: {} },
  sketch: {},
};

export const MOCK_MANIFEST = [] as const;

function unwrapProxyResponse(mock: unknown): unknown {
  if (mock && typeof mock === "object" && "ok" in mock && "data" in mock) {
    return (mock as Record<string, unknown>).data;
  }
  return mock;
}

interface PreviewPayload {
  data?: string;
  contentType?: string;
}

function loadMockFile(key: string) {
  const mock = MOCK_DATA[key];
  if (!mock) throw new Error(`未知 mock: ${key}`);
  return mock;
}

function previewBlobFromMock(mock: unknown) {
  const payload = mock as PreviewPayload;
  if (!payload?.data || typeof payload.data !== "string") {
    throw new Error("Mock 预览图缺少 base64 data");
  }
  const binary = Uint8Array.from(atob(payload.data), (char) => char.charCodeAt(0));
  return new Blob([binary], { type: payload.contentType || "image/png" });
}

function mapDesigns(images: Array<Record<string, unknown>> = []): DesignItem[] {
  return images.map((item, index) => ({
    index: index + 1,
    id: String(item.id),
    name: String(item.name),
    width: Number(item.width),
    height: Number(item.height),
    url: String(item.url),
  }));
}

function findDesignInMultiInfo(
  multiInfoData: { result?: { images?: Array<{ id: string; latest_version?: string }> } },
  designId: string,
) {
  return (multiInfoData.result?.images || []).find((item) => item.id === designId) as
    | { id: string; latest_version?: string }
    | undefined;
}

export function loadMockEntry(key: string) {
  const raw = loadMockFile(key);
  if (key === "preview") {
    return { blob: previewBlobFromMock(raw as { data?: string; contentType?: string }), meta: raw };
  }
  return unwrapProxyResponse(raw);
}

export interface MockAppState {
  hasEnvCookie: boolean;
  params: LanhuParams;
  sectors: unknown;
  designs: DesignItem[];
  selectedDesignId: string | null;
  selectedDesign: DesignItem | null;
  versionId: string | null;
  schemaRevise: unknown;
  schemaJson: unknown;
  designDetail: unknown;
  sketchJson: unknown;
  previewBlob: Blob;
  results: Record<string, unknown>;
}

export function buildMockAppState(): MockAppState {
  const healthRaw = loadMockFile("health") as { hasEnvCookie?: boolean };
  const sectorsData = loadMockEntry("sectors");
  const imagesData = loadMockEntry("images") as { data?: { id?: string; images?: Array<Record<string, unknown>> } };
  const previewRaw = loadMockFile("preview");
  const multiInfoData = loadMockEntry("multiInfo") as { result?: { images?: Array<{ id: string; latest_version?: string }> } };
  const schemaReviseWrap = loadMockEntry("schemaRevise") as { data?: { project_id?: string; image_id?: string; version_id?: string } };
  const schemaJson = loadMockEntry("schema");
  const designDetailData = loadMockEntry("designDetail") as { result?: { id?: string; name?: string; width?: number; height?: number; url?: string; latest_version?: string } };
  const sketchJson = loadMockEntry("sketch");

  const projectId =
    imagesData.data?.id ||
    schemaReviseWrap.data?.project_id ||
    designDetailData.result?.id ||
    "unknown-project";

  const images = imagesData.data?.images || [];
  const targetDesignId =
    schemaReviseWrap.data?.image_id ||
    designDetailData.result?.id ||
    (images[0]?.id as string) ||
    null;

  const multiMatched = targetDesignId ? findDesignInMultiInfo(multiInfoData, targetDesignId) : null;

  const versionId =
    schemaReviseWrap.data?.version_id ||
    multiMatched?.latest_version ||
    designDetailData.result?.latest_version ||
    null;

  const designs = mapDesigns(images);
  const selected =
    designs.find((item) => item.id === targetDesignId) ||
    (designDetailData.result?.id === targetDesignId
      ? {
          index: 1,
          id: String(designDetailData.result.id),
          name: String(designDetailData.result.name),
          width: Number(designDetailData.result.width),
          height: Number(designDetailData.result.height),
          url: String(designDetailData.result.url),
        }
      : null);

  const params: LanhuParams = {
    project_id: String(projectId),
    doc_id: targetDesignId,
    team_id: null,
    version_id: null,
    source: "mock",
  };

  const previewBlob = previewBlobFromMock(previewRaw as { data?: string; contentType?: string });

  return {
    hasEnvCookie: Boolean(healthRaw.hasEnvCookie),
    params,
    sectors: sectorsData,
    designs,
    selectedDesignId: targetDesignId,
    selectedDesign: selected,
    versionId,
    schemaRevise: schemaReviseWrap,
    schemaJson,
    designDetail: designDetailData,
    sketchJson,
    previewBlob,
    results: {
      params,
      sectors: sectorsData,
      designs: { total: designs.length, designs },
      preview: selected
        ? { name: selected.name, url: (selected.url || "").split("?")[0] }
        : null,
      multiInfo: targetDesignId
        ? { image_id: targetDesignId, version_id: versionId, raw: multiInfoData }
        : null,
      schemaRevise: schemaReviseWrap,
      schema: schemaJson,
      designDetail: designDetailData,
      sketch: sketchJson,
    },
  };
}

const ACTION_MOCK_MAP: Record<string, string> = {
  sectors: "sectors",
  images: "images",
  multiInfo: "multiInfo",
  schemaRevise: "schemaRevise",
  schemaJson: "schema",
  designDetail: "designDetail",
  sketchJson: "sketch",
};

export function getMockApiPayload(actionId: string) {
  const key = ACTION_MOCK_MAP[actionId];
  if (!key) return null;
  return loadMockEntry(key);
}

export function getMockPreviewBlob() {
  return previewBlobFromMock(loadMockFile("preview") as { data?: string; contentType?: string });
}
