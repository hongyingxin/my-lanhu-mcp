/**
 * 本地 Mock 数据映射（按接口调用顺序编号）：
 * 1.json  /api/health
 * 2.json  project_sectors
 * 3.json  project/images
 * 4.json  预览图 CDN（base64 PNG）
 * 5.json  multi_info
 * 6.json  store_schema_revise
 * 7.json  Schema JSON（整棵 DDS 树）
 * 8.json  project/image
 * 9.json  Sketch JSON
 */

import healthMock from "./1.json";
import sectorsMock from "./2.json";
import imagesMock from "./3.json";
import previewMock from "./4.json";
import multiInfoMock from "./5.json";
import schemaReviseMock from "./6.json";
import schemaMock from "./7.json";
import designDetailMock from "./8.json";
import sketchMock from "./9.json";

const MOCK_DATA = {
  health: healthMock,
  sectors: sectorsMock,
  images: imagesMock,
  preview: previewMock,
  multiInfo: multiInfoMock,
  schemaRevise: schemaReviseMock,
  schema: schemaMock,
  designDetail: designDetailMock,
  sketch: sketchMock,
};

export const MOCK_MANIFEST = [
  { key: "health", file: "1.json", label: "/api/health" },
  { key: "sectors", file: "2.json", label: "project_sectors" },
  { key: "images", file: "3.json", label: "project/images" },
  { key: "preview", file: "4.json", label: "预览图 CDN" },
  { key: "multiInfo", file: "5.json", label: "multi_info" },
  { key: "schemaRevise", file: "6.json", label: "store_schema_revise" },
  { key: "schema", file: "7.json", label: "Schema JSON" },
  { key: "designDetail", file: "8.json", label: "project/image" },
  { key: "sketch", file: "9.json", label: "Sketch JSON" },
];

function unwrapProxyResponse(mock) {
  if (mock && mock.ok !== undefined && Object.prototype.hasOwnProperty.call(mock, "data")) {
    return mock.data;
  }
  return mock;
}

function loadMockFile(key) {
  const mock = MOCK_DATA[key];
  if (!mock) throw new Error(`未知 mock: ${key}`);
  return mock;
}

function previewBlobFromMock(mock) {
  const payload = mock?.data && typeof mock.data === "string" ? mock : mock;
  if (!payload?.data || typeof payload.data !== "string") {
    throw new Error("Mock 预览图缺少 base64 data");
  }
  const binary = Uint8Array.from(atob(payload.data), (char) => char.charCodeAt(0));
  return new Blob([binary], { type: payload.contentType || "image/png" });
}

function mapDesigns(images = []) {
  return images.map((item, index) => ({
    index: index + 1,
    id: item.id,
    name: item.name,
    width: item.width,
    height: item.height,
    url: item.url,
  }));
}

function findDesignInMultiInfo(multiInfoData, designId) {
  return (multiInfoData.result?.images || []).find((item) => item.id === designId);
}

export function loadMockEntry(key) {
  const raw = loadMockFile(key);
  if (key === "preview") {
    return { blob: previewBlobFromMock(raw), meta: raw };
  }
  if (key === "schema") {
    return unwrapProxyResponse(raw);
  }
  return unwrapProxyResponse(raw);
}

export function buildMockAppState() {
  const healthRaw = loadMockFile("health");
  const sectorsData = loadMockEntry("sectors");
  const imagesData = loadMockEntry("images");
  const previewRaw = loadMockFile("preview");
  const multiInfoData = loadMockEntry("multiInfo");
  const schemaReviseWrap = loadMockEntry("schemaRevise");
  const schemaJson = loadMockEntry("schema");
  const designDetailData = loadMockEntry("designDetail");
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
    images[0]?.id ||
    null;

  const multiMatched = targetDesignId
    ? findDesignInMultiInfo(multiInfoData, targetDesignId)
    : null;

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
          id: designDetailData.result.id,
          name: designDetailData.result.name,
          width: designDetailData.result.width,
          height: designDetailData.result.height,
          url: designDetailData.result.url,
        }
      : null);

  const params = {
    project_id: projectId,
    doc_id: targetDesignId,
    team_id: null,
    image_id: targetDesignId,
    source: "mock",
  };

  const previewBlob = previewBlobFromMock(previewRaw);

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

export function getMockApiPayload(actionId) {
  const map = {
    sectors: "sectors",
    images: "images",
    multiInfo: "multiInfo",
    schemaRevise: "schemaRevise",
    schemaJson: "schema",
    designDetail: "designDetail",
    sketchJson: "sketch",
  };
  const key = map[actionId];
  if (!key) return null;
  return loadMockEntry(key);
}

export function getMockPreviewBlob() {
  return previewBlobFromMock(loadMockFile("preview"));
}
