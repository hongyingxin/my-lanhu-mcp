<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import {
  API_BASE,
  apiAnalyze,
  apiConvertDesign,
  apiDesignDetail,
  apiDesignSchema,
  apiDesignSlices,
  apiDesignSketch,
  apiDesignSectors,
  apiHealth,
  apiListDesigns,
  apiMultiInfo,
  apiParseUrl,
  apiPreview,
  apiSchemaRevise,
  setRequestCookie,
} from "./api/debug-api.js";
import { parseLanhuUrl } from "./api/parse-url.js";
import { convertLanhuSchema } from "./converter/index.js";
import {
  SLICE_FORMAT_OPTIONS,
  SLICE_SCALE_GROUPS,
  downloadSliceFile,
  downloadSlicesZip,
  mappingToSliceItems,
  resolveSliceDownloadUrl,
} from "./utils/slice-download.js";
import {
  MOCK_MANIFEST,
  buildMockAppState,
  getMockApiPayload,
  getMockPreviewBlob,
} from "./mock/index.js";

const STORAGE_KEY = "lanhu-debug-vue-config";

const cookie = ref("");
const lanhuUrl = ref("");
const useMock = ref(false);
const hasEnvCookie = ref(false);
const toast = ref("");
const logs = ref([]);
const activeTab = ref("params");
const loading = reactive({});

const params = ref(null);
const designs = ref([]);
const selectedDesignId = ref(null);
const sectors = ref(null);
const versionId = ref(null);
const schemaRevise = ref(null);
const schemaJson = ref(null);
const designDetail = ref(null);
const sketchJson = ref(null);
const previewObjectUrl = ref("");
const convertDemo = ref(null);
const analyzeResult = ref(null);
const analyzeWithSlices = ref(false);

const sliceSource = ref("scaleUrls");
const sliceScale = ref("1x");
const sliceFormat = ref("png");
const sliceDownloadProgress = ref(null);
const slicePanelView = ref("list");
/** B 套 getSlices 缓存，与右侧结果 Tab 解耦 */
const sliceBData = ref(null);

const results = reactive({
  params: null,
  sectors: null,
  designs: null,
  preview: null,
  multiInfo: null,
  schemaRevise: null,
  schema: null,
  convertCss: null,
  convertHtml: null,
  convertHtmlFull: null,
  convertMapping: null,
  designDetail: null,
  sketch: null,
  analyze: null,
  warnings: null,
  designTokens: null,
  layoutSummary: null,
  layerTree: null,
  sketchAnnotations: null,
});

function designFields() {
  return {
    projectId: params.value?.project_id,
    teamId: params.value?.team_id,
    imageId: selectedDesign.value?.id || params.value?.doc_id,
  };
}

function logServerCall(path, started, note, ok = true) {
  logs.value.unshift({
    id: Date.now() + Math.random(),
    ok,
    method: "POST",
    url: `${API_BASE}${path}`,
    status: ok ? 200 : 502,
    elapsedMs: Math.round(performance.now() - started),
    note,
  });
}

function mapServerParams(serverParams) {
  return {
    team_id: serverParams.teamId ?? null,
    project_id: serverParams.projectId,
    doc_id: serverParams.docId ?? serverParams.imageId ?? null,
    version_id: serverParams.versionId ?? null,
  };
}

function showToast(message) {
  toast.value = message;
  setTimeout(() => {
    if (toast.value === message) toast.value = "";
  }, 2200);
}

function persistConfig() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      cookie: cookie.value.trim(),
      url: lanhuUrl.value.trim(),
      useMock: useMock.value,
    }),
  );
}

function loadConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (saved.cookie) cookie.value = saved.cookie;
    if (saved.url) lanhuUrl.value = saved.url;
    if (saved.useMock) useMock.value = true;
  } catch {
    // ignore
  }
}

function saveConfig() {
  persistConfig();
  showToast("已保存到 localStorage");
}

const selectedDesign = computed(() => {
  if (!designs.value.length) return null;
  return (
    designs.value.find((d) => d.id === selectedDesignId.value) ||
    designs.value[0]
  );
});

const hasCookie = computed(() => Boolean(cookie.value.trim()) || hasEnvCookie.value);

const cookieStatusLabel = computed(() => {
  if (useMock.value) return "Mock 模式";
  if (cookie.value.trim()) return "页面 Cookie（优先）";
  if (hasEnvCookie.value) return "Server .env Cookie";
  return "未设置 Cookie";
});

const cookieStatusClass = computed(() => {
  if (useMock.value) return "mock";
  if (hasCookie.value) return "ok";
  return "muted";
});

function resetDesignArtifacts() {
  versionId.value = null;
  schemaRevise.value = null;
  schemaJson.value = null;
  convertDemo.value = null;
  designDetail.value = null;
  sketchJson.value = null;
  analyzeResult.value = null;

  if (previewObjectUrl.value) {
    URL.revokeObjectURL(previewObjectUrl.value);
    previewObjectUrl.value = "";
  }

  results.preview = null;
  results.multiInfo = null;
  results.schemaRevise = null;
  results.schema = null;
  results.convertCss = null;
  results.convertHtml = null;
  results.convertHtmlFull = null;
  results.convertMapping = null;
  results.designDetail = null;
  results.sketch = null;
  results.analyze = null;
  results.warnings = null;
  results.designTokens = null;
  results.layoutSummary = null;
  results.layerTree = null;
  results.sketchAnnotations = null;
  sliceBData.value = null;
  slicePanelView.value = "list";
  sliceDownloadProgress.value = null;
}

function ensureCookie() {
  if (useMock.value) return;
  if (!hasCookie.value && !hasEnvCookie.value) {
    throw new Error("请在 server .env 配置 LANHU_COOKIE，或粘贴 Cookie");
  }
}

function applyConvertResult(data) {
  convertDemo.value = data;
  results.convertCss = data.after.css ?? "";
  results.convertHtml = data.after.htmlBody ?? "";
  results.convertHtmlFull = data.after.htmlFull;
  results.convertMapping = data.after.mapping;
}

function normalizeSketchConvert(convert) {
  const htmlFull = convert.after.htmlFull ?? "";
  const bodyMatch = htmlFull.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const htmlBody = bodyMatch ? bodyMatch[1].trim() : htmlFull;
  return {
    ok: true,
    source: "sketch",
    before: null,
    after: {
      css: "",
      cssPreview: "（Sketch fallback · 无 Schema CSS 规则）",
      cssRuleCount: 0,
      htmlBody,
      htmlBodyPreview: htmlBody.slice(0, 2500),
      htmlPreviewDoc: htmlFull,
      htmlFull,
      htmlLength: convert.after.htmlLength ?? htmlFull.length,
      mapping: convert.after.mapping ?? {},
      mappingCount: convert.after.mappingCount ?? Object.keys(convert.after.mapping ?? {}).length,
      layerAnnotations: convert.after.layerAnnotations ?? [],
      designScale: convert.after.designScale,
    },
  };
}

function applyAnalyzeResult(data) {
  analyzeResult.value = data;

  if (data.params) {
    params.value = mapServerParams(data.params);
    results.params = params.value;
  }

  if (data.design) {
    const item = {
      index: data.design.index ?? 1,
      id: data.design.id,
      name: data.design.name,
      width: data.design.width,
      height: data.design.height,
      url: data.design.url,
    };
    const others = designs.value.filter((d) => d.id !== item.id);
    designs.value = [item, ...others];
    selectedDesignId.value = item.id;
    results.designs = { total: designs.value.length, designs: designs.value };
  }

  if (data.schema) {
    schemaJson.value = data.schema;
    results.schema = data.schema;
    if (data.schemaMeta) {
      versionId.value = data.schemaMeta.versionId;
      schemaRevise.value = {
        code: "00000",
        data: {
          data_resource_url: data.schemaMeta.schemaUrl,
          version_id: data.schemaMeta.versionId,
        },
      };
    }
  }

  if (data.sketch) {
    sketchJson.value = data.sketch;
    results.sketch = data.sketch;
  }

  if (data.sketchMeta?.documentInfo) {
    designDetail.value = { code: "00000", result: data.sketchMeta.documentInfo };
    results.designDetail = designDetail.value;
  }

  if (data.convert) {
    const normalized =
      data.convertSource === "sketch" ? normalizeSketchConvert(data.convert) : data.convert;
    applyConvertResult(normalized);
  }

  results.analyze = {
    status: data.status,
    convertSource: data.convertSource,
    projectName: data.projectName,
    design: data.design,
    totalWarnings: data.warnings?.length ?? 0,
    artifacts: data.artifacts ?? null,
    previewImage: data.previewImage
      ? { path: data.previewImage.path, contentType: data.previewImage.contentType }
      : null,
  };
  results.warnings = data.warnings ?? [];
  results.designTokens = data.designTokens ?? null;
  results.layoutSummary = data.layoutSummary ?? null;
  results.layerTree = data.layerTree ?? null;
  results.sketchAnnotations = data.sketchAnnotations ?? null;
  if (data.slices) {
    sliceBData.value = data.slices;
    if (data.slices.slices?.length) {
      sliceSource.value = "scaleUrls";
      slicePanelView.value = "list";
    }
  }
}

async function runAnalyzeFlow() {
  if (useMock.value) {
    throw new Error("Mock 模式不支持 analyze，请关闭 Mock 并填写真实 URL");
  }
  const url = lanhuUrl.value.trim();
  if (!url) throw new Error("请先填写蓝湖 URL");
  ensureCookie();

  const started = performance.now();
  const designName = selectedDesign.value?.name || selectedDesign.value?.id;
  const data = await apiAnalyze({
    url,
    design: designName,
    withSlices: analyzeWithSlices.value,
  });
  if (!data.ok) throw new Error(data.error || "analyze 失败");

  applyAnalyzeResult(data);

  const source = data.convertSource ?? "none";
  const warnCount = data.warnings?.length ?? 0;
  logServerCall(
    "/api/designs/analyze",
    started,
    `source=${source} · warnings=${warnCount}`,
    true,
  );

  activeTab.value = data.convert ? "htmlPreview" : "analyze";
  const sliceNote = data.slices?.slices?.length
    ? ` · 切图 ${data.slices.totalSlices} 个已载入下载面板`
    : "";
  const diskNote = data.artifacts?.outputDir ? ` · 已落盘 ${data.artifacts.outputDir}` : "";
  showToast(
    (data.convert
      ? `analyze 完成（${source === "schema" ? "Schema" : "Sketch fallback"}）`
      : "analyze 完成（未生成 HTML，见 warnings）") +
      sliceNote +
      diskNote,
  );
}

async function ensureDesignContextFromUrl() {
  if (params.value?.project_id && selectedDesign.value?.id) {
    return;
  }

  const url = lanhuUrl.value.trim();
  if (!url) {
    throw new Error("请先填写蓝湖 URL，或先拉设计列表");
  }

  const started = performance.now();
  const data = await apiListDesigns(url);
  if (!data.ok) {
    throw new Error(data.error || "拉设计列表失败");
  }

  if (data.params) {
    params.value = {
      team_id: data.params.teamId ?? null,
      project_id: data.params.projectId,
      doc_id: data.params.docId ?? data.params.imageId ?? null,
      version_id: data.params.versionId ?? null,
    };
    results.params = params.value;
  }

  designs.value = (data.designs || []).map((item) => ({
    index: item.index,
    id: item.id,
    name: item.name,
    width: item.width,
    height: item.height,
    url: item.url,
  }));

  const nextId = params.value?.doc_id || selectedDesignId.value || designs.value[0]?.id || null;
  if (nextId !== selectedDesignId.value) {
    selectedDesignId.value = nextId;
    resetDesignArtifacts();
    selectedDesignId.value = nextId;
  } else if (!selectedDesignId.value) {
    selectedDesignId.value = nextId;
  }

  logServerCall(
    "/api/designs/list",
    started,
    `${data.totalDesigns ?? designs.value.length} designs（切图调试前置）`,
  );
}

/** 切图下载：拉取 B 套 scaleUrls 列表 */
async function loadSliceDownloadList() {
  if (useMock.value) {
    throw new Error("Mock 模式不支持，请关闭 Mock");
  }
  ensureCookie();
  await ensureDesignContextFromUrl();
  ensureDesign();

  const started = performance.now();
  const data = await apiDesignSlices(designFields());
  if (!data.ok) {
    throw new Error(data.error || "getSlices 失败");
  }

  sliceBData.value = data;
  sliceSource.value = "scaleUrls";
  slicePanelView.value = "list";
  logServerCall(
    "/api/designs/slices",
    started,
    `${data.totalSlices} slices · sliceScale=${data.sliceScale ?? "?"}`,
    true,
  );
  showToast(`已加载 ${data.totalSlices} 个切图（B 套 scaleUrls）`);
}

/** 切图下载：从 A 套 mapping 载入（需先 Schema 转换） */
function loadSliceFromMapping() {
  const mapping = results.convertMapping ?? convertDemo.value?.after?.mapping;
  if (!mapping || !Object.keys(mapping).length) {
    throw new Error("暂无 mapping，请先「一键 analyze」或「Schema → HTML」");
  }
  sliceSource.value = "mapping";
  slicePanelView.value = "list";
  showToast(`已从 mapping 载入 ${Object.keys(mapping).length} 条`);
}

const sliceDownloadOptions = computed(() => ({
  scale: sliceScale.value,
  format: sliceFormat.value,
  source: sliceSource.value,
  designName: selectedDesign.value?.name || sliceBData.value?.designName || "design",
}));

const sliceItems = computed(() => {
  if (sliceSource.value === "mapping") {
    const mapping = results.convertMapping ?? convertDemo.value?.after?.mapping;
    return mappingToSliceItems(mapping);
  }
  return sliceBData.value?.slices ?? [];
});

const sliceStatusLabel = computed(() => {
  if (sliceSource.value === "mapping") {
    const count = sliceItems.value.length;
    return count ? `A 套 mapping · ${count} 条` : "A 套 · 未载入";
  }
  if (!sliceBData.value) {
    return "B 套 · 未拉取";
  }
  const data = sliceBData.value;
  return `B 套 · ${data.totalSlices ?? 0} 个 · sliceScale=${data.sliceScale ?? "?"} · ${data.designName ?? ""}`;
});

const sliceJsonPreview = computed(() => {
  if (sliceSource.value === "mapping") {
    const mapping = results.convertMapping ?? convertDemo.value?.after?.mapping;
    return mapping ? JSON.stringify({ source: "mapping", mapping }, null, 2) : "暂无 mapping";
  }
  return sliceBData.value ? JSON.stringify(sliceBData.value, null, 2) : "请先拉取 B 套切图";
});

const sliceDownloadReady = computed(
  () =>
    !useMock.value &&
    Boolean(lanhuUrl.value.trim() || (params.value?.project_id && selectedDesign.value?.id)),
);

const sliceMappingReady = computed(() => {
  const mapping = results.convertMapping ?? convertDemo.value?.after?.mapping;
  return Boolean(mapping && Object.keys(mapping).length);
});

const sliceScaleHint = computed(() => {
  if (sliceSource.value !== "scaleUrls") {
    return "mapping 来源为 HTML 内原图 URL，不支持倍率切换";
  }
  const items = sliceItems.value;
  if (!items.length) return "先获取切图列表";
  const withScale = items.filter((item) => item.scaleUrls?.[sliceScale.value]).length;
  return `${withScale}/${items.length} 个切图含 ${sliceScale.value} URL`;
});

function previewUrlForSlice(slice) {
  const url = resolveSliceDownloadUrl(slice, sliceDownloadOptions.value);
  if (!url) return "—";
  const clean = url.split("?")[0];
  return url.length > 72 ? `${clean.slice(0, 48)}…${url.slice(-16)}` : url;
}

function scaleAvailable(slice, scale) {
  return sliceSource.value !== "scaleUrls" || Boolean(slice.scaleUrls?.[scale]);
}

async function downloadOneSlice(slice) {
  ensureCookie();
  setRequestCookie(cookie.value);
  await downloadSliceFile(apiPreview, slice, sliceDownloadOptions.value);
  showToast(`已下载 ${slice.name || slice.id}`);
}

async function downloadAllSliceFiles() {
  if (!sliceItems.value.length) {
    throw new Error("切图列表为空，请先获取");
  }
  ensureCookie();
  setRequestCookie(cookie.value);

  sliceDownloadProgress.value = { done: 0, total: sliceItems.value.length, current: "" };
  const result = await downloadSlicesZip(
    apiPreview,
    sliceItems.value,
    sliceDownloadOptions.value,
    (progress) => {
      sliceDownloadProgress.value = progress;
    },
  );
  sliceDownloadProgress.value = null;

  if (result.failed) {
    showToast(`打包完成：成功 ${result.ok}，失败 ${result.failed}`);
  } else {
    showToast(`已打包下载 ${result.ok} 个切图`);
  }
}

function applyMockState(state) {
  resetDesignArtifacts();

  hasEnvCookie.value = state.hasEnvCookie;
  params.value = state.params;
  sectors.value = state.sectors;
  designs.value = state.designs;
  selectedDesignId.value = state.selectedDesignId;
  versionId.value = state.versionId;
  schemaRevise.value = state.schemaRevise;
  schemaJson.value = state.schemaJson;
  designDetail.value = state.designDetail;
  sketchJson.value = state.sketchJson;

  previewObjectUrl.value = URL.createObjectURL(state.previewBlob);
  Object.assign(results, state.results);

  logs.value.unshift({
    id: Date.now() + Math.random(),
    ok: true,
    method: "MOCK",
    url: "src/mock/*.json",
    status: 200,
    elapsedMs: 0,
    note: `已加载 ${MOCK_MANIFEST.length} 个 mock 文件`,
  });
}

async function loadMockData(autoConvert = true) {
  loading.loadMock = true;
  try {
    const state = buildMockAppState();
    applyMockState(state);

    if (autoConvert && state.schemaJson) {
      const started = performance.now();
      const data = convertLanhuSchema(
        state.schemaJson,
        state.selectedDesign?.name || "design",
      );
      applyConvertResult(data);
      logs.value.unshift({
        id: Date.now() + Math.random(),
        ok: true,
        method: "JS",
        url: "convertLanhuSchema()",
        status: 200,
        elapsedMs: Math.round(performance.now() - started),
        note: `css=${data.after.cssRuleCount} rules · html=${data.after.htmlLength} chars`,
      });
      activeTab.value = "htmlPreview";
    } else {
      activeTab.value = "schema";
    }

    showToast(autoConvert ? "Mock 已加载并完成 Schema 转换" : "Mock 数据已加载");
  } catch (error) {
    showToast(error.message.split("\n")[0].slice(0, 120));
  } finally {
    loading.loadMock = false;
  }
}

function ensureParams() {
  if (!params.value?.project_id) throw new Error("请先解析 URL");
}

function ensureDesign() {
  ensureParams();
  if (!selectedDesign.value) throw new Error("请先获取设计列表并选择设计稿");
}

function setResult(key, data, switchTab = true) {
  results[key] = data;
  if (switchTab) {
    activeTab.value = key;
  }
}

async function runAction(id, fn) {
  loading[id] = true;
  setRequestCookie(cookie.value);
  persistConfig();
  try {
    await fn();
  } catch (error) {
    showToast(error.message.split("\n")[0].slice(0, 120));
  } finally {
    loading[id] = false;
  }
}

const apiActions = computed(() => {
  const mockReady = useMock.value;

  return [
  {
    id: "analyze",
    group: "流水线",
    label: "一键 analyze",
    desc: "POST /api/designs/analyze · 服务端内嵌 list 选稿→schema/sketch→HTML · 不写全量选稿列表（请先 project/images）",
    ready: !mockReady && Boolean(lanhuUrl.value.trim()),
    done: Boolean(analyzeResult.value),
    run: () => runAction("analyze", runAnalyzeFlow),
  },
  {
    id: "parseUrl",
    group: "基础",
    label: "解析 URL",
    desc: "从蓝湖链接提取 pid / image_id / tid",
    ready: Boolean(lanhuUrl.value.trim()),
    done: Boolean(params.value),
    run: () =>
      runAction("parseUrl", async () => {
        if (useMock.value && lanhuUrl.value.trim()) {
          const parsed = parseLanhuUrl(lanhuUrl.value.trim());
          params.value = parsed;
          setResult("params", parsed);
          showToast("URL 解析成功");
          return;
        }
        const started = performance.now();
        const data = await apiParseUrl(lanhuUrl.value.trim());
        if (!data.ok) throw new Error(data.error || "URL 解析失败");
        const parsed = mapServerParams(data.params);
        const docChanged = params.value?.doc_id !== parsed.doc_id;
        params.value = parsed;
        logServerCall("/api/parse-url", started, `pid=${parsed.project_id}`);
        if (parsed.doc_id) {
          if (parsed.doc_id !== selectedDesignId.value) {
            selectedDesignId.value = parsed.doc_id;
            resetDesignArtifacts();
          }
        } else if (docChanged) {
          resetDesignArtifacts();
        }
        setResult("params", parsed);
        showToast("URL 解析成功");
      }),
  },
  {
    id: "sectors",
    group: "设计列表",
    label: "project_sectors",
    desc: "GET /api/project/project_sectors",
    ready: mockReady || Boolean(params.value?.project_id),
    done: Boolean(sectors.value),
    run: () =>
      runAction("sectors", async () => {
        if (useMock.value) {
          const data = await getMockApiPayload("sectors");
          sectors.value = data;
          setResult("sectors", data);
          return;
        }
        ensureCookie();
        ensureParams();
        const started = performance.now();
        const data = await apiDesignSectors(params.value.project_id);
        if (!data.ok) throw new Error(data.error || "project_sectors 失败");
        logServerCall("/api/designs/sectors", started, "project_sectors");
        sectors.value = data;
        setResult("sectors", data);
      }),
  },
  {
    id: "images",
    group: "设计列表",
    label: "project/images",
    desc: "POST Node /api/designs/list · 获取设计稿列表",
    ready: mockReady || Boolean(params.value?.project_id) || Boolean(lanhuUrl.value.trim()),
    done: designs.value.length > 0,
    run: () =>
      runAction("images", async () => {
        if (useMock.value) {
          const data = await getMockApiPayload("images");
          if (data.code !== "00000") throw new Error(data.msg || "获取设计列表失败");
          if (mockReady && !params.value?.project_id && data.data?.id) {
            params.value = {
              ...(params.value || {}),
              project_id: data.data.id,
              source: "mock",
            };
          }
          designs.value = (data.data?.images || []).map((item, index) => ({
            index: index + 1,
            id: item.id,
            name: item.name,
            width: item.width,
            height: item.height,
            url: item.url,
          }));
        } else {
          const url = lanhuUrl.value.trim();
          if (!url) throw new Error("请先填写蓝湖 URL");
          const started = performance.now();
          const data = await apiListDesigns(url);
          if (!data.ok) throw new Error(data.error || "获取设计列表失败");

          logs.value.unshift({
            id: Date.now() + Math.random(),
            ok: true,
            method: "POST",
            url: `${API_BASE}/api/designs/list`,
            status: 200,
            elapsedMs: Math.round(performance.now() - started),
            note: `${data.totalDesigns ?? data.designs?.length ?? 0} designs`,
          });

          if (data.params) {
            params.value = {
              team_id: data.params.teamId ?? null,
              project_id: data.params.projectId,
              doc_id: data.params.docId ?? data.params.imageId ?? null,
              version_id: data.params.versionId ?? null,
            };
            results.params = params.value;
          }

          designs.value = (data.designs || []).map((item) => ({
            index: item.index,
            id: item.id,
            name: item.name,
            width: item.width,
            height: item.height,
            url: item.url,
          }));
        }

        const nextId = params.value.doc_id || selectedDesignId.value || designs.value[0]?.id || null;
        if (nextId !== selectedDesignId.value) {
          selectedDesignId.value = nextId;
          resetDesignArtifacts();
        } else if (!selectedDesignId.value) {
          selectedDesignId.value = nextId;
        }
        setResult("designs", { total: designs.value.length, designs: designs.value });
      }),
  },
  {
    id: "preview",
    group: "资源",
    label: "预览图 CDN",
    desc: "GET design.url · 下载预览 PNG",
    ready: mockReady || Boolean(selectedDesign.value?.url),
    done: Boolean(previewObjectUrl.value),
    run: () =>
      runAction("preview", async () => {
        if (useMock.value) {
          const blob = await getMockPreviewBlob();
          if (previewObjectUrl.value) URL.revokeObjectURL(previewObjectUrl.value);
          previewObjectUrl.value = URL.createObjectURL(blob);
          setResult("preview", {
            name: selectedDesign.value?.name || "mock",
            url: selectedDesign.value?.url?.split("?")[0] || "mock://preview.png",
          });
          return;
        }
        ensureCookie();
        ensureDesign();
        const started = performance.now();
        const data = await apiPreview(selectedDesign.value.url);
        if (!data.ok) throw new Error(data.error || "预览图下载失败");
        const binary = Uint8Array.from(atob(data.data), (c) => c.charCodeAt(0));
        const blob = new Blob([binary], { type: data.contentType || "image/png" });
        logServerCall("/api/designs/preview", started, "preview png");
        if (previewObjectUrl.value) URL.revokeObjectURL(previewObjectUrl.value);
        previewObjectUrl.value = URL.createObjectURL(blob);
        setResult("preview", {
          name: selectedDesign.value.name,
          url: selectedDesign.value.url.split("?")[0],
        });
      }),
  },
  {
    id: "multiInfo",
    group: "Schema",
    label: "multi_info",
    desc: "GET /api/project/multi_info · 查 version_id",
    ready: mockReady || Boolean(params.value?.project_id),
    done: Boolean(versionId.value),
    run: () =>
      runAction("multiInfo", async () => {
        if (useMock.value) {
          const data = await getMockApiPayload("multiInfo");
          if (data.code !== "00000") throw new Error(data.msg || "multi_info 失败");
          const designId = selectedDesign.value?.id || params.value?.doc_id;
          const matched =
            (data.result?.images || []).find((item) => item.id === designId) ||
            (data.result?.images || [])[0];
          if (!matched?.latest_version) throw new Error("未找到 latest_version");
          versionId.value = matched.latest_version;
          setResult("multiInfo", { image_id: matched.id, version_id: versionId.value, raw: data });
          return;
        }
        ensureCookie();
        ensureParams();
        ensureDesign();
        const started = performance.now();
        const data = await apiMultiInfo({
          projectId: params.value.project_id,
          teamId: params.value.team_id,
        });
        if (!data.ok || data.code !== "00000") throw new Error(data.error || data.msg || "multi_info 失败");
        logServerCall("/api/designs/multi-info", started, "multi_info");
        const designId = selectedDesign.value?.id || params.value?.doc_id;
        const matched = (data.result?.images || []).find((item) => item.id === designId);
        if (!matched?.latest_version) throw new Error("未找到 latest_version");
        versionId.value = matched.latest_version;
        setResult("multiInfo", { image_id: matched.id, version_id: versionId.value, raw: data });
      }),
  },
  {
    id: "schemaRevise",
    group: "Schema",
    label: "store_schema_revise",
    desc: "GET dds.../store_schema_revise · 拿 schema 地址",
    ready: mockReady || Boolean(versionId.value),
    done: Boolean(schemaRevise.value),
    run: () =>
      runAction("schemaRevise", async () => {
        if (useMock.value) {
          const data = await getMockApiPayload("schemaRevise");
          if (data.code !== "00000") throw new Error(data.msg || "store_schema_revise 失败");
          schemaRevise.value = data;
          if (data.data?.version_id) versionId.value = data.data.version_id;
          setResult("schemaRevise", data);
          return;
        }
        ensureCookie();
        if (!versionId.value) throw new Error("请先调用 multi_info");
        const started = performance.now();
        const data = await apiSchemaRevise(versionId.value);
        if (!data.ok || data.code !== "00000") throw new Error(data.error || data.msg || "store_schema_revise 失败");
        logServerCall("/api/designs/schema-revise", started, "schema_revise");
        schemaRevise.value = data;
        setResult("schemaRevise", data);
      }),
  },
  {
    id: "schemaJson",
    group: "Schema",
    label: "下载 Schema JSON",
    desc: "POST Node /api/designs/schema · DDS 结构化数据",
    ready: mockReady || Boolean(selectedDesign.value?.id && params.value?.project_id),
    done: Boolean(schemaJson.value),
    run: () =>
      runAction("schemaJson", async () => {
        if (useMock.value) {
          const data = await getMockApiPayload("schemaJson");
          schemaJson.value = data;
          setResult("schema", data);
          return;
        }
        ensureCookie();
        ensureDesign();
        const fields = designFields();
        const started = performance.now();
        const data = await apiDesignSchema(fields);
        if (!data.ok) throw new Error(data.error || "Schema 下载失败");
        logServerCall("/api/designs/schema", started, "schema json");
        schemaJson.value = data.schema;
        versionId.value = data.versionId;
        schemaRevise.value = { code: "00000", data: { data_resource_url: data.schemaUrl, version_id: data.versionId } };
        setResult("schema", data.schema);
      }),
  },
  {
    id: "convertSchema",
    group: "转换",
    label: "Schema → HTML",
    desc: "POST Node /api/designs/convert · @lanhu/core 转换",
    ready: Boolean(schemaJson.value),
    done: Boolean(convertDemo.value),
    run: () =>
      runAction("convertSchema", async () => {
        if (!schemaJson.value) throw new Error("请先下载 Schema JSON");
        const started = performance.now();
        const data = useMock.value
          ? convertLanhuSchema(schemaJson.value, selectedDesign.value?.name || "design")
          : await apiConvertDesign({
              schema: schemaJson.value,
              designName: selectedDesign.value?.name || "design",
            });
        const convert = data.convert ?? data;
        if (!convert?.ok) throw new Error(data.error || "Schema 转换失败");
        applyConvertResult(convert);
        logServerCall("/api/designs/convert", started, `css=${convert.after.cssRuleCount} rules`, true);
        activeTab.value = "htmlPreview";
        showToast("Schema 转换完成");
      }),
  },
  {
    id: "designDetail",
    group: "Sketch",
    label: "project/image",
    desc: "GET /api/project/image · 设计稿详情",
    ready: mockReady || Boolean(selectedDesign.value?.id),
    done: Boolean(designDetail.value),
    run: () =>
      runAction("designDetail", async () => {
        if (useMock.value) {
          const data = await getMockApiPayload("designDetail");
          if (data.code !== "00000") throw new Error(data.msg || "获取设计稿详情失败");
          designDetail.value = data;
          setResult("designDetail", data);
          return;
        }
        ensureCookie();
        ensureDesign();
        const started = performance.now();
        const data = await apiDesignDetail(designFields());
        if (!data.ok || data.code !== "00000") throw new Error(data.error || data.msg || "获取设计稿详情失败");
        logServerCall("/api/designs/detail", started, "project/image");
        designDetail.value = data;
        setResult("designDetail", data);
      }),
  },
  {
    id: "sketchJson",
    group: "Sketch",
    label: "下载 Sketch JSON",
    desc: "POST Node /api/designs/sketch · 图层标注数据",
    ready: mockReady || Boolean(selectedDesign.value?.id && params.value?.project_id),
    done: Boolean(sketchJson.value),
    run: () =>
      runAction("sketchJson", async () => {
        if (useMock.value) {
          const data = await getMockApiPayload("sketchJson");
          sketchJson.value = data;
          setResult("sketch", data);
          return;
        }
        ensureCookie();
        ensureDesign();
        const started = performance.now();
        const data = await apiDesignSketch(designFields());
        if (!data.ok) throw new Error(data.error || "Sketch 下载失败");
        logServerCall("/api/designs/sketch", started, "sketch json");
        sketchJson.value = data.sketch ?? data.sketchJson;
        designDetail.value = { code: "00000", result: data.documentInfo };
        setResult("sketch", sketchJson.value);
      }),
  },
];
});

const groupedActions = computed(() => {
  const groups = {};
  for (const action of apiActions.value) {
    if (!groups[action.group]) groups[action.group] = [];
    groups[action.group].push(action);
  }
  return groups;
});

const resultTabs = [
  { key: "analyze", label: "Analyze" },
  { key: "warnings", label: "Warnings" },
  { key: "designTokens", label: "Design Tokens" },
  { key: "layoutSummary", label: "布局摘要" },
  { key: "layerTree", label: "图层树" },
  { key: "sketchAnnotations", label: "Sketch 标注" },
  { key: "params", label: "URL 参数" },
  { key: "sectors", label: "分组" },
  { key: "designs", label: "设计列表" },
  { key: "preview", label: "预览图" },
  { key: "multiInfo", label: "multi_info" },
  { key: "schemaRevise", label: "schema_revise" },
  { key: "schema", label: "Schema" },
  { key: "convertCss", label: "转换后 CSS" },
  { key: "convertHtml", label: "HTML Body" },
  { key: "convertHtmlFull", label: "完整 HTML" },
  { key: "htmlPreview", label: "页面预览" },
  { key: "convertMapping", label: "切图映射" },
  { key: "designDetail", label: "设计详情" },
  { key: "sketch", label: "Sketch" },
];

function analyzeEmptyInsightHint(field) {
  if (useMock.value) {
    return "Mock 模式不会调用 analyze。请关闭 Mock，填写真实蓝湖 URL 与 Cookie 后点击「一键 analyze」。";
  }
  if (!analyzeResult.value) {
    return "尚未执行 analyze。请点顶部或左侧「一键 analyze」（POST /api/designs/analyze），不要只点分步「Schema JSON / Sketch JSON」。";
  }
  const hints = {
    layoutSummary:
      "响应无 layoutSummary：需 analyze 成功拉取 Schema（URL 含 teamId）。见 Warnings / Schema Tab。",
    layerTree:
      "响应无 layerTree：需 analyze 成功拉取 Sketch（board 或 artboard）。见 Warnings / Sketch Tab。",
    sketchAnnotations:
      "响应无 sketchAnnotations：需 analyze 成功拉取 Sketch。见 Warnings Tab。",
  };
  const extra = Array.isArray(results.warnings) && results.warnings.length
    ? `\n\n最近 warnings：\n${results.warnings.slice(0, 5).map((w, i) => `${i + 1}. ${w}`).join("\n")}`
    : "";
  return (hints[field] ?? "暂无数据") + extra;
}

function formatResult(key) {
  if (key === "preview" && previewObjectUrl.value) {
    return JSON.stringify(results.preview, null, 2);
  }
  if (key === "htmlPreview") {
    return convertDemo.value
      ? `iframe 预览（远程切图 URL，共 ${convertDemo.value.after.cssRuleCount} 条 CSS 规则）`
      : "请先点击 Schema → HTML";
  }

  if (key === "schema" && schemaJson.value) {
    return JSON.stringify(schemaJson.value, null, 2);
  }
  if (key === "sketch" && sketchJson.value) {
    return JSON.stringify(sketchJson.value, null, 2);
  }
  if (key === "convertCss" && typeof results.convertCss === "string") {
    return results.convertCss;
  }
  if (key === "convertHtml" && typeof results.convertHtml === "string") {
    return results.convertHtml;
  }
  if (key === "convertHtmlFull" && typeof results.convertHtmlFull === "string") {
    return results.convertHtmlFull;
  }
  if (key === "convertMapping" && results.convertMapping) {
    return JSON.stringify(results.convertMapping, null, 2);
  }
  if (key === "analyze" && results.analyze) {
    return JSON.stringify(results.analyze, null, 2);
  }
  if (key === "warnings") {
    if (!Array.isArray(results.warnings)) return "暂无数据";
    return results.warnings.length
      ? results.warnings.map((w, i) => `${i + 1}. ${w}`).join("\n")
      : "无 warnings";
  }
  if (key === "designTokens" && results.designTokens) {
    return results.designTokens;
  }
  if (key === "layoutSummary") {
    if (results.layoutSummary) return results.layoutSummary;
    return analyzeEmptyInsightHint("layoutSummary");
  }
  if (key === "layerTree") {
    if (results.layerTree) return results.layerTree;
    return analyzeEmptyInsightHint("layerTree");
  }
  if (key === "sketchAnnotations") {
    if (results.sketchAnnotations) return results.sketchAnnotations;
    return analyzeEmptyInsightHint("sketchAnnotations");
  }

  const data = results[key];
  if (data === null || data === undefined) return "暂无数据";
  return typeof data === "string" ? data : JSON.stringify(data, null, 2);
}

function formatConvertBefore(before) {
  if (!before) return "暂无数据";

  const typeSummary = Object.entries(before.stats?.byType || {})
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => `${type}×${count}`)
    .join(", ");

  const lines = [
    `整棵 Schema 共 ${before.stats?.total ?? 0} 个节点（${typeSummary}）`,
    `根节点: ${before.root?.type || "—"} · .${before.root?.className || "—"} · ${before.root?.width ?? "—"}×${before.root?.height ?? "—"}`,
    "",
    "与右侧 CSS 摘要一一对应的节点:",
  ];

  for (const item of before.matchedNodes || []) {
    lines.push("", `--- .${item.className} ---`);
    lines.push(JSON.stringify(item.node, null, 2));
  }

  lines.push(
    "",
    `完整 Schema JSON（${before.schemaCharCount?.toLocaleString?.() ?? before.schemaCharCount} 字符，见右侧「Schema」Tab）:`,
    before.schemaPreview || "",
  );

  if ((before.schemaPreview || "").length < (before.schemaCharCount || 0)) {
    lines.push("", "…（Schema 摘要已截断）");
  }

  return lines.join("\n");
}

function resultMeta(key) {
  const text = formatResult(key);
  if (text === "暂无数据" || text.startsWith("请先") || text.startsWith("iframe")) return "";
  const lines = text.split("\n").length;
  return `${text.length.toLocaleString()} 字符 · ${lines.toLocaleString()} 行`;
}

function selectDesign(id) {
  if (selectedDesignId.value === id) return;
  selectedDesignId.value = id;
  resetDesignArtifacts();
  showToast("已切换设计稿，预览/Schema/Sketch 状态已重置");
}

function clearLogs() {
  logs.value = [];
}

async function checkHealth() {
  try {
    const data = await apiHealth();
    hasEnvCookie.value = Boolean(data.hasEnvCookie);
  } catch {
    hasEnvCookie.value = false;
  }
}

onMounted(() => {
  loadConfig();
  setRequestCookie(cookie.value);
  checkHealth();
});
</script>

<template>
  <div class="app">
    <header class="header">
      <div>
        <h1>蓝湖 API 调试台</h1>
        <p class="subtitle">Vue 3 · Node 服务 :3001 · Mock 离线调试</p>
      </div>
      <div class="badges">
        <span class="badge" :class="cookieStatusClass">
          {{ cookieStatusLabel }}
        </span>
      </div>
    </header>

    <section class="panel">
      <div class="panel-title">连接配置</div>
      <label class="field">
        <span>蓝湖 Cookie</span>
        <textarea v-model="cookie" rows="3" placeholder="调试 Cookie（随请求发给 server，优先于 .env）；留空则用 server 根目录 LANHU_COOKIE" />
      </label>
      <label class="field">
        <span>蓝湖设计稿 URL</span>
        <input v-model="lanhuUrl" placeholder="https://lanhuapp.com/web/#/item/project/detailDetach?pid=...&image_id=..." />
      </label>
      <div class="row">
        <button class="btn secondary" @click="saveConfig">保存配置</button>
        <button
          class="btn analyze-btn"
          :disabled="useMock || !lanhuUrl.trim() || loading.analyze"
          @click="runAction('analyze', runAnalyzeFlow)"
        >
          {{ loading.analyze ? "分析中…" : "一键 analyze" }}
        </button>
        <span v-if="params" class="hint mono">pid={{ params.project_id }} · image={{ params.doc_id || "—" }}</span>
      </div>
      <p class="hint analyze-hint">
        一键 analyze 仅在服务端内嵌 list 用于选稿，不会把全量设计稿写入选稿区（最多保留当前分析的 1 张）。要看完整列表请先点
        project/images。
      </p>
      <div class="row analyze-options">
        <label class="mock-toggle">
          <input v-model="analyzeWithSlices" type="checkbox" />
          含切图元数据（withSlices · 仅 URL，不下载文件）
        </label>
        <span v-if="convertDemo?.source === 'sketch' || analyzeResult?.convertSource === 'sketch'" class="hint">
          上次来源：<strong>Sketch fallback</strong>
        </span>
        <span v-else-if="analyzeResult?.convertSource === 'schema'" class="hint">
          上次来源：<strong>Schema</strong>
        </span>
      </div>
    </section>

    <section class="panel slice-download-panel">
      <div class="panel-head slice-panel-head">
        <div>
          <div class="panel-title">切图下载</div>
          <p class="design-hint slice-panel-desc">
            本面板独立管理切图数据，<strong>不会切换右侧 Tab</strong>。B 套走 scaleUrls，A 套走 convert mapping。
          </p>
        </div>
        <span class="slice-status" :class="{ ok: sliceItems.length }">{{ sliceStatusLabel }}</span>
      </div>

      <div class="slice-step">
        <div class="slice-step-label">1 · 拉取数据</div>
        <div class="row slice-download-actions">
          <button
            class="btn primary"
            :disabled="!sliceDownloadReady || loading.sliceFetch"
            @click="runAction('sliceFetch', loadSliceDownloadList)"
          >
            {{ loading.sliceFetch ? "拉取中…" : "拉取切图（B 套）" }}
          </button>
          <button
            class="btn secondary"
            :disabled="!sliceMappingReady"
            @click="runAction('sliceMappingLoad', loadSliceFromMapping)"
          >
            载入 mapping（A 套）
          </button>
        </div>
      </div>

      <div class="slice-step">
        <div class="slice-step-label">2 · 下载选项</div>
        <div class="slice-download-controls">
          <label class="slice-field">
            <span>来源</span>
            <select v-model="sliceSource" class="slice-select">
              <option value="scaleUrls">B · scaleUrls（getSlices）</option>
              <option value="mapping">A · mapping（convert）</option>
            </select>
          </label>

          <label class="slice-field" :class="{ disabled: sliceSource !== 'scaleUrls' }">
            <span>倍率</span>
            <select
              v-model="sliceScale"
              class="slice-select"
              :disabled="sliceSource !== 'scaleUrls'"
            >
              <optgroup v-for="group in SLICE_SCALE_GROUPS" :key="group.label" :label="group.label">
                <option v-for="key in group.keys" :key="key" :value="key">{{ key }}</option>
              </optgroup>
            </select>
          </label>

          <label class="slice-field">
            <span>格式</span>
            <select v-model="sliceFormat" class="slice-select">
              <option
                v-for="opt in SLICE_FORMAT_OPTIONS"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </option>
            </select>
          </label>

          <button
            class="btn download-all slice-download-btn"
            :disabled="!sliceItems.length || loading.sliceDownloadAll"
            @click="runAction('sliceDownloadAll', downloadAllSliceFiles)"
          >
            {{ loading.sliceDownloadAll ? "打包中…" : `打包下载 (${sliceItems.length})` }}
          </button>
        </div>
        <p class="slice-scale-hint">{{ sliceScaleHint }}</p>
      </div>

      <div class="slice-step">
        <div class="slice-step-head">
          <div class="slice-step-label">3 · 结果</div>
          <div v-if="sliceItems.length || sliceBData || sliceMappingReady" class="slice-view-tabs">
            <button
              type="button"
              class="slice-view-tab"
              :class="{ active: slicePanelView === 'list' }"
              @click="slicePanelView = 'list'"
            >
              列表
            </button>
            <button
              type="button"
              class="slice-view-tab"
              :class="{ active: slicePanelView === 'json' }"
              @click="slicePanelView = 'json'"
            >
              原始 JSON
            </button>
          </div>
        </div>

        <div v-if="sliceDownloadProgress" class="slice-progress">
          下载进度 {{ sliceDownloadProgress.done }}/{{ sliceDownloadProgress.total }}
          <span v-if="sliceDownloadProgress.current"> · {{ sliceDownloadProgress.current }}</span>
        </div>

        <div v-if="slicePanelView === 'list' && sliceItems.length" class="slice-table-wrap">
          <table class="slice-table">
            <thead>
              <tr>
                <th>名称</th>
                <th>尺寸</th>
                <th v-if="sliceSource === 'scaleUrls'">倍率</th>
                <th>下载 URL（当前选项）</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="slice in sliceItems" :key="slice.id || slice.name || slice.localPath">
                <td class="slice-name" :title="slice.layerPath">{{ slice.name }}</td>
                <td class="mono">{{ slice.size || "—" }}</td>
                <td v-if="sliceSource === 'scaleUrls'" class="mono">
                  <span v-if="scaleAvailable(slice, sliceScale)" class="scale-ok">{{ sliceScale }}</span>
                  <span v-else class="scale-fallback" title="该切图无此倍率，将回退 downloadUrl">fallback</span>
                </td>
                <td class="mono url-cell" :title="resolveSliceDownloadUrl(slice, sliceDownloadOptions)">
                  {{ previewUrlForSlice(slice) }}
                </td>
                <td>
                  <button
                    class="btn sm"
                    :disabled="loading[`sliceOne_${slice.id || slice.name}`]"
                    @click="runAction(`sliceOne_${slice.id || slice.name}`, () => downloadOneSlice(slice))"
                  >
                    下载
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <pre v-else-if="slicePanelView === 'json'" class="result slice-json">{{ sliceJsonPreview }}</pre>
        <p v-else class="design-hint empty-slice-hint">
          暂无切图。B 套：填 Cookie + URL → 点「拉取切图」；或 analyze 勾选「含切图元数据」预载。
          A 套：先 Schema 转换 →「载入 mapping」。
        </p>
      </div>
    </section>

    <section class="panel mock-panel">
      <div class="panel-head">
        <div class="panel-title">Mock 调试</div>
        <label class="mock-toggle">
          <input v-model="useMock" type="checkbox" @change="persistConfig" />
          启用 Mock 模式（单步按钮也读本地 JSON，无需 Cookie）
        </label>
      </div>
      <p class="design-hint">
        接口数据已保存在 <code>src/mock/1.json</code> ~ <code>9.json</code>，一键加载后可跳过网络请求，直接调试 Schema 与转换。
      </p>
      <div class="mock-map">
        <span v-for="item in MOCK_MANIFEST" :key="item.key" class="mock-chip">{{ item.file }} · {{ item.label }}</span>
      </div>
      <div class="row">
        <button class="btn" :disabled="loading.loadMock" @click="loadMockData(true)">
          {{ loading.loadMock ? "加载中…" : "一键加载 Mock + 转换" }}
        </button>
        <button class="btn secondary" :disabled="loading.loadMock" @click="loadMockData(false)">
          仅加载 Mock 数据
        </button>
      </div>
    </section>

    <section v-if="designs.length" class="panel">
      <div class="panel-title">设计稿选择</div>
      <p class="design-hint">切换设计稿会重置预览图、Schema、Sketch 等下游接口状态</p>
      <div class="design-grid">
        <button
          v-for="design in designs"
          :key="design.id"
          type="button"
          class="design-card"
          :class="{ active: selectedDesignId === design.id }"
          @click="selectDesign(design.id)"
        >
          <strong>#{{ design.index }} {{ design.name }}</strong>
          <small>{{ design.width }}×{{ design.height }}</small>
          <small class="mono">{{ design.id }}</small>
        </button>
      </div>
    </section>

    <section class="panel">
      <div class="panel-title">接口调用</div>
      <div v-for="(actions, group) in groupedActions" :key="group" class="action-group">
        <div class="group-label">{{ group }}</div>
        <div class="action-grid">
          <button
            v-for="action in actions"
            :key="action.id"
            class="action-btn"
            :class="{ done: action.done, loading: loading[action.id] }"
            :disabled="!action.ready || loading[action.id]"
            @click="action.run()"
          >
            <span class="action-name">{{ action.label }}</span>
            <span class="action-desc">{{ action.desc }}</span>
            <span class="action-state">
              {{ loading[action.id] ? "请求中…" : action.done ? "已完成" : action.ready ? "可调用" : "缺少前置条件" }}
            </span>
          </button>
        </div>
      </div>
    </section>

    <section v-if="convertDemo" class="panel convert-panel">
      <div class="panel-title">
        {{ convertDemo?.source === "sketch" ? "Sketch Fallback 转换" : "Schema 转换演示" }}
      </div>
      <p v-if="convertDemo?.source === 'sketch'" class="design-hint">
        Schema 不可用，已使用 Sketch fallback。完整 HTML 见右侧「完整 HTML」Tab；layer-annotations 在 analyze 响应中。
      </p>
      <p v-else class="design-hint">
        左侧列出与右侧 CSS 摘要对应的 Schema 节点；整棵 Schema 树才是转换输入，完整 JSON 见右侧「Schema」Tab
      </p>
      <div v-if="convertDemo.before" class="convert-grid">
        <div class="convert-col">
          <div class="convert-label">转换前 · 与 CSS 摘要对应的 Schema 节点</div>
          <pre class="result">{{ formatConvertBefore(convertDemo.before) }}</pre>
        </div>
        <div class="convert-col">
          <div class="convert-label">转换后 · CSS（摘要，完整内容见右侧「转换后 CSS」Tab）</div>
          <pre class="result mono">{{ convertDemo.after.cssPreview }}</pre>
        </div>
      </div>
      <div class="convert-grid">
        <div class="convert-col">
          <div class="convert-label">转换后 · HTML Body（摘要，完整内容见右侧 Tab）</div>
          <pre class="result mono">{{ convertDemo.after.htmlBodyPreview }}</pre>
        </div>
        <div class="convert-col">
          <div class="convert-label">转换后 · 页面预览</div>
          <iframe
            class="html-preview-frame"
            :srcdoc="convertDemo.after.htmlPreviewDoc || convertDemo.after.htmlFull"
            sandbox="allow-same-origin"
            title="html preview"
          />
        </div>
      </div>
    </section>

    <div class="split">
      <section class="panel">
        <div class="panel-head">
          <div class="panel-title">请求日志</div>
          <button class="btn ghost sm" @click="clearLogs">清空</button>
        </div>
        <div class="log-list">
          <div v-for="log in logs" :key="log.id" class="log-item" :class="log.ok ? 'ok' : 'err'">
            <div>{{ log.ok ? "成功" : "失败" }} · {{ log.elapsedMs }}ms · HTTP {{ log.status || "—" }}</div>
            <div class="mono url">{{ log.url }}</div>
            <div class="note">{{ log.note }}</div>
          </div>
          <div v-if="!logs.length" class="empty">点击上方按钮发起请求</div>
        </div>
      </section>

      <section class="panel">
        <div class="tabs">
          <button
            v-for="tab in resultTabs"
            :key="tab.key"
            class="tab"
            :class="{ active: activeTab === tab.key }"
            @click="activeTab = tab.key"
          >
            {{ tab.label }}
          </button>
        </div>
        <div v-if="resultMeta(activeTab)" class="result-meta">{{ resultMeta(activeTab) }}</div>
        <div v-if="activeTab === 'preview' && previewObjectUrl" class="preview-box">
          <img :src="previewObjectUrl" alt="preview" />
        </div>
        <iframe
          v-else-if="activeTab === 'htmlPreview' && convertDemo"
          class="html-preview-frame result-frame"
          :srcdoc="convertDemo.after.htmlPreviewDoc || convertDemo.after.htmlFull"
          sandbox="allow-same-origin"
          title="html preview"
        />
        <pre v-else class="result">{{ formatResult(activeTab) }}</pre>
      </section>
    </div>

    <div v-if="toast" class="toast">{{ toast }}</div>
  </div>
</template>

<style scoped>
.app {
  max-width: 1280px;
  margin: 0 auto;
  padding: 24px;
}

.header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

h1 {
  margin: 0 0 6px;
  font-size: 28px;
}

.subtitle {
  margin: 0;
  color: var(--muted);
  font-size: 14px;
}

.badge {
  display: inline-flex;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
}

.badge.ok {
  background: rgba(16, 185, 129, 0.15);
  color: #6ee7b7;
}

.badge.muted {
  background: var(--surface-2);
  color: var(--muted);
}

.badge.mock {
  background: rgba(99, 102, 241, 0.18);
  color: #a5b4fc;
}

.mock-panel .panel-title {
  margin-bottom: 0;
}

.mock-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--muted);
}

.mock-map {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0;
}

.mock-chip {
  padding: 4px 8px;
  border-radius: 999px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  font-size: 11px;
  color: var(--muted);
}

.panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  margin-bottom: 14px;
}

.panel-title {
  font-weight: 600;
  margin-bottom: 12px;
}

.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
}

.field span {
  font-size: 13px;
  color: var(--muted);
}

input,
textarea {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-2);
  color: var(--text);
  padding: 10px 12px;
}

.row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.hint {
  color: var(--muted);
  font-size: 12px;
}

.btn {
  border: 0;
  border-radius: 8px;
  padding: 8px 14px;
}

.btn.secondary {
  background: var(--surface-2);
  color: var(--text);
  border: 1px solid var(--border);
}

.btn.analyze-btn {
  background: #2563eb;
  color: #fff;
  font-weight: 600;
}

.btn.analyze-btn:disabled {
  opacity: 0.55;
}

.analyze-options {
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 8px;
}

.slice-download-panel {
  border: 1px solid var(--border);
}

.slice-panel-head {
  align-items: flex-start;
  margin-bottom: 12px;
}

.slice-panel-desc {
  margin: 4px 0 0;
}

.slice-status {
  flex-shrink: 0;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--muted);
  border: 1px solid var(--border);
}

.slice-status.ok {
  background: rgba(16, 185, 129, 0.12);
  color: #6ee7b7;
  border-color: rgba(16, 185, 129, 0.25);
}

.slice-step {
  padding: 12px 0;
  border-top: 1px solid var(--border);
}

.slice-step:first-of-type {
  border-top: 0;
  padding-top: 0;
}

.slice-step-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
  margin-bottom: 8px;
}

.slice-step-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.slice-step-head .slice-step-label {
  margin-bottom: 0;
}

.slice-view-tabs {
  display: inline-flex;
  gap: 4px;
  padding: 2px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border);
}

.slice-view-tab {
  border: 0;
  background: transparent;
  color: var(--muted);
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
}

.slice-view-tab.active {
  background: var(--surface-2);
  color: var(--text);
}

.slice-json {
  max-height: 360px;
  overflow: auto;
  margin: 0;
}

.slice-download-btn {
  align-self: flex-end;
}

.slice-download-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 16px;
  align-items: flex-end;
}

.slice-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--muted);
}

.slice-field.disabled {
  opacity: 0.55;
}

.slice-select {
  min-width: 180px;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--panel);
  color: inherit;
  font-size: 13px;
}

.slice-scale-hint {
  margin: 0 0 10px;
  font-size: 12px;
  color: var(--muted);
}

.slice-download-actions {
  gap: 10px;
  flex-wrap: wrap;
}

.btn.primary {
  background: #2563eb;
  color: #fff;
  font-weight: 600;
}

.btn.download-all {
  background: #0d9488;
  color: #fff;
  font-weight: 600;
}

.slice-progress {
  margin-bottom: 10px;
  font-size: 12px;
  color: #6ee7b7;
}

.slice-table-wrap {
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: 8px;
}

.slice-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.slice-table th,
.slice-table td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
  text-align: left;
  vertical-align: middle;
}

.slice-table th {
  background: rgba(255, 255, 255, 0.03);
  color: var(--muted);
  font-weight: 600;
}

.slice-name {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.url-cell {
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--muted);
}

.scale-ok {
  color: #6ee7b7;
}

.scale-fallback {
  color: #fbbf24;
}

.empty-slice-hint {
  margin: 8px 0 0;
}

.btn.ghost {
  background: transparent;
  color: var(--muted);
}

.btn.sm {
  font-size: 12px;
  padding: 4px 8px;
}

.design-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
  max-height: 240px;
  overflow-y: auto;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: rgba(11, 18, 32, 0.45);
}

.design-grid::-webkit-scrollbar {
  width: 8px;
}

.design-grid::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 999px;
}

.design-hint {
  margin: -4px 0 10px;
  font-size: 12px;
  color: var(--muted);
}

.design-card {
  text-align: left;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px;
  color: var(--text);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.design-card.active {
  border-color: var(--primary);
  box-shadow: 0 0 0 1px var(--primary);
}

.design-card small {
  color: var(--muted);
  word-break: break-all;
}

.action-group + .action-group {
  margin-top: 14px;
}

.group-label {
  font-size: 12px;
  color: var(--muted);
  margin-bottom: 8px;
}

.action-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 10px;
}

.action-btn {
  text-align: left;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px;
  color: var(--text);
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: border-color 0.15s, transform 0.15s;
}

.action-btn:not(:disabled):hover {
  border-color: var(--primary);
  transform: translateY(-1px);
}

.action-btn.done {
  border-color: rgba(16, 185, 129, 0.5);
}

.action-btn.loading {
  border-color: var(--warn);
}

.action-name {
  font-weight: 600;
}

.action-desc {
  font-size: 12px;
  color: var(--muted);
  line-height: 1.4;
}

.action-state {
  font-size: 11px;
  color: #93c5fd;
}

.split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

@media (max-width: 960px) {
  .split {
    grid-template-columns: 1fr;
  }
}

.log-list {
  max-height: 360px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.log-item {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 12px;
  background: var(--surface-2);
}

.log-item.ok {
  border-left: 3px solid var(--success);
}

.log-item.err {
  border-left: 3px solid var(--danger);
}

.log-item .url {
  margin-top: 4px;
  word-break: break-all;
  color: var(--muted);
}

.log-item .note {
  margin-top: 4px;
  color: var(--muted);
}

.empty {
  color: var(--muted);
  font-size: 13px;
}

.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}

.tab {
  border: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
  border-radius: 999px;
  padding: 5px 10px;
  font-size: 12px;
}

.tab.active {
  background: var(--primary);
  border-color: var(--primary);
  color: white;
}

.result {
  margin: 0;
  max-height: 520px;
  overflow: auto;
  padding: 12px;
  border-radius: 8px;
  background: #0b1220;
  border: 1px solid var(--border);
  font-family: var(--mono);
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.result-meta {
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--muted);
}

.preview-box img {
  max-width: 100%;
  border-radius: 8px;
  border: 1px solid var(--border);
}

.convert-panel {
  border-color: rgba(59, 130, 246, 0.35);
}

.convert-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-bottom: 14px;
}

.convert-col {
  min-width: 0;
}

.convert-label {
  font-size: 12px;
  color: #93c5fd;
  margin-bottom: 8px;
}

.html-preview-frame {
  width: 100%;
  height: 420px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: white;
}

.result-frame {
  max-height: none;
  height: 420px;
  padding: 0;
}

@media (max-width: 960px) {
  .convert-grid {
    grid-template-columns: 1fr;
  }
}

.toast {
  position: fixed;
  right: 24px;
  bottom: 24px;
  background: #111827;
  border: 1px solid var(--border);
  color: var(--text);
  padding: 10px 14px;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  max-width: 360px;
  font-size: 13px;
}
</style>
