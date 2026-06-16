import {
  API_BASE,
  apiAnalyze,
  apiConvertDesign,
  apiConvertSketch,
  apiDesignDetail,
  apiDesignSchema,
  apiDesignSlices,
  apiDesignSketch,
  apiSketchAnnotations,
  apiSketchLayerAnnotations,
  apiDesignSectors,
  apiListDesigns,
  apiMultiInfo,
  apiParseUrl,
  apiPreview,
  apiSchemaRevise,
  setRequestCookie,
} from "@/api/debug-api";
import { parseLanhuUrl } from "@/api/parse-url";
import type { DesignItem } from "@/api/types";
import {
  downloadSliceFile,
  downloadSlicesZip,
} from "@/features/slices-download/slice-download";
import {
  buildMockAppState,
  getMockApiPayload,
  getMockPreviewBlob,
  MOCK_MANIFEST,
} from "@/mock/index";
import type { AppDispatch, RootState } from "@/store";
import { prependLog } from "@/store/logsSlice";
import {
  applyConvertResult,
  mergeResults,
  resetInspectArtifacts,
  setResult,
} from "@/store/inspectSlice";
import {
  applyMockSession,
  resetDesignArtifacts,
  resetLanhuContext,
  setDesignDetail,
  setDesigns,
  setParams,
  setPreviewObjectUrl,
  setSchemaJson,
  setSchemaRevise,
  setSectors,
  setSelectedDesignId,
  setSketchJson,
  setVersionId,
} from "@/store/sessionSlice";
import { persistToStorage, setHasEnvCookie, setLanhuUrl } from "@/store/settingsSlice";
import {
  resetSliceState,
  setSliceBData,
  setSliceDownloadProgress,
  setSlicePanelView,
  setSliceSource,
} from "@/store/slicesSlice";
import { setActiveTab, setLoading, setResultGroup, setToast } from "@/store/uiSlice";
import { resultGroupForTab } from "./constants";
import { applyAnalyzeResult, normalizeSketchConvert } from "./analyze/applyAnalyzeResult";
import { formatLayerAnnotationsText } from "./resultFormat";
import { mapServerParams } from "./mappers";
import {
  selectDesignFields,
  selectHasCookie,
  selectSelectedDesign,
  selectSliceDownloadOptions,
  selectSliceItems,
} from "./selectors";

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export function showToast(dispatch: AppDispatch, message: string) {
  dispatch(setToast(message));
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    dispatch(setToast(""));
  }, 2200);
}

function logServerCall(
  dispatch: AppDispatch,
  path: string,
  started: number,
  note: string,
  ok = true,
) {
  dispatch(
    prependLog({
      ok,
      method: "POST",
      url: `${API_BASE}${path}`,
      status: ok ? 200 : 502,
      elapsedMs: Math.round(performance.now() - started),
      note,
    }),
  );
}

function ensureCookie(state: RootState) {
  if (state.settings.useMock) return;
  if (!selectHasCookie(state)) {
    throw new Error("请在 server .env 配置 LANHU_COOKIE，或粘贴 Cookie");
  }
}

function ensureParams(state: RootState) {
  if (!state.session.params?.project_id) throw new Error("请先解析 URL");
}

function ensureDesign(state: RootState) {
  ensureParams(state);
  if (!selectSelectedDesign(state)) throw new Error("请先获取设计列表并选择设计稿");
}

function selectSketchApiFields(state: RootState) {
  const design = selectSelectedDesign(state)!;
  return {
    ...selectDesignFields(state),
    designName: design.name || "design",
    designImageUrl: design.url,
  };
}

function resetDownstreamArtifacts(dispatch: AppDispatch) {
  dispatch(resetDesignArtifacts());
  dispatch(resetInspectArtifacts());
  dispatch(resetSliceState());
}

/** URL 变更后清空选稿列表、分析/转换缓存 */
export function resetForLanhuUrlChange(dispatch: AppDispatch) {
  dispatch(resetLanhuContext());
  dispatch(resetInspectArtifacts());
  dispatch(resetSliceState());
}

export function changeLanhuUrl(dispatch: AppDispatch, newUrl: string, previousUrl: string) {
  dispatch(setLanhuUrl(newUrl));
  if (newUrl.trim() === previousUrl.trim()) return;

  resetForLanhuUrlChange(dispatch);

  const trimmed = newUrl.trim();
  if (!trimmed) return;

  try {
    const parsed = parseLanhuUrl(trimmed);
    dispatch(setParams(parsed));
    dispatch(setResult({ key: "params", data: parsed }));
  } catch {
    // 输入过程中 URL 可能不完整，仅清空旧上下文
  }
}

export function runWorkspaceAction(
  dispatch: AppDispatch,
  getState: () => RootState,
  id: string,
  fn: () => Promise<void>,
) {
  dispatch(setLoading({ id, value: true }));
  setRequestCookie(getState().settings.cookie);
  dispatch(persistToStorage());
  return fn()
    .catch((error: Error) => {
      showToast(dispatch, error.message.split("\n")[0]!.slice(0, 120));
    })
    .finally(() => {
      dispatch(setLoading({ id, value: false }));
    });
}

export async function runAnalyzeFlow(dispatch: AppDispatch, getState: () => RootState) {
  const state = getState();
  if (state.settings.useMock) {
    throw new Error("Mock 模式不支持 analyze，请关闭 Mock 并填写真实 URL");
  }
  const url = state.settings.lanhuUrl.trim();
  if (!url) throw new Error("请先填写蓝湖 URL");
  ensureCookie(state);

  const started = performance.now();
  const design = selectSelectedDesign(state);
  const designName = design?.name || design?.id;
  const data = (await apiAnalyze({
    url,
    design: designName,
    withSlices: state.settings.analyzeWithSlices,
  })) as { ok?: boolean; error?: string; convert?: unknown; convertSource?: string; warnings?: unknown[]; slices?: { slices?: unknown[] }; artifacts?: { outputDir?: string } };

  if (!data.ok) throw new Error(data.error || "analyze 失败");

  applyAnalyzeResult(dispatch, data);
  const s2 = getState();
  if (s2.session.designs.length) {
    dispatch(
      setResult({
        key: "designs",
        data: { total: s2.session.designs.length, designs: s2.session.designs },
      }),
    );
  }

  const source = (data as { convertSource?: string }).convertSource ?? "none";
  const warnCount = data.warnings?.length ?? 0;
  logServerCall(dispatch, "/api/designs/analyze", started, `source=${source} · warnings=${warnCount}`);

  dispatch(setActiveTab(data.convert ? "htmlPreview" : "analyze"));
  const sliceNote = data.slices?.slices?.length
    ? ` · 切图 ${(data.slices as { totalSlices?: number }).totalSlices} 个已载入下载面板`
    : "";
  const diskNote = data.artifacts?.outputDir ? ` · 已落盘 ${data.artifacts.outputDir}` : "";
  showToast(
    dispatch,
    (data.convert
      ? `analyze 完成（${source === "schema" ? "Schema" : "Sketch fallback"}）`
      : "analyze 完成（未生成 HTML，见 warnings）") + sliceNote + diskNote,
  );
}

async function ensureDesignContextFromUrl(dispatch: AppDispatch, getState: () => RootState) {
  const state = getState();
  if (state.session.params?.project_id && selectSelectedDesign(state)?.id) {
    return;
  }
  const url = state.settings.lanhuUrl.trim();
  if (!url) throw new Error("请先填写蓝湖 URL，或先拉设计列表");

  const started = performance.now();
  const data = (await apiListDesigns(url)) as {
    ok?: boolean;
    error?: string;
    params?: { teamId?: string; projectId: string; docId?: string; imageId?: string; versionId?: string };
    designs?: DesignItem[];
    totalDesigns?: number;
  };
  if (!data.ok) throw new Error(data.error || "拉设计列表失败");

  if (data.params) {
    const parsed = mapServerParams(data.params);
    dispatch(setParams(parsed));
    dispatch(setResult({ key: "params", data: parsed }));
  }

  const designs = (data.designs || []).map((item) => ({
    index: item.index,
    id: item.id,
    name: item.name,
    width: item.width,
    height: item.height,
    url: item.url,
  }));
  dispatch(setDesigns(designs));

  const params = getState().session.params;
  const nextId = params?.doc_id || getState().session.selectedDesignId || designs[0]?.id || null;
  if (nextId !== getState().session.selectedDesignId) {
    dispatch(setSelectedDesignId(nextId));
    resetDownstreamArtifacts(dispatch);
    dispatch(setSelectedDesignId(nextId));
  } else if (!getState().session.selectedDesignId) {
    dispatch(setSelectedDesignId(nextId));
  }

  logServerCall(
    dispatch,
    "/api/designs/list",
    started,
    `${data.totalDesigns ?? designs.length} designs（切图调试前置）`,
  );
}

export async function loadSliceDownloadList(dispatch: AppDispatch, getState: () => RootState) {
  const state = getState();
  if (state.settings.useMock) throw new Error("Mock 模式不支持，请关闭 Mock");
  ensureCookie(state);
  await ensureDesignContextFromUrl(dispatch, getState);
  ensureDesign(getState());

  const started = performance.now();
  const data = (await apiDesignSlices(selectDesignFields(getState()))) as {
    ok?: boolean;
    error?: string;
    totalSlices?: number;
    sliceScale?: string;
  };
  if (!data.ok) throw new Error(data.error || "getSlices 失败");

  dispatch(setSliceBData(data));
  dispatch(setSliceSource("scaleUrls"));
  dispatch(setSlicePanelView("list"));
  logServerCall(
    dispatch,
    "/api/designs/slices",
    started,
    `${data.totalSlices} slices · sliceScale=${data.sliceScale ?? "?"}`,
  );
  showToast(dispatch, `已加载 ${data.totalSlices} 个切图（B 套 scaleUrls）`);
}

export function loadSliceFromMapping(dispatch: AppDispatch, getState: () => RootState) {
  const state = getState();
  const mapping =
    state.inspect.results.convertMapping ?? state.inspect.convertDemo?.after?.mapping;
  if (!mapping || !Object.keys(mapping as object).length) {
    throw new Error("暂无 mapping，请先「一键 analyze」或「Schema → HTML」");
  }
  dispatch(setSliceSource("mapping"));
  dispatch(setSlicePanelView("list"));
  showToast(dispatch, `已从 mapping 载入 ${Object.keys(mapping as object).length} 条`);
}

export async function downloadOneSlice(
  dispatch: AppDispatch,
  getState: () => RootState,
  slice: import("@/features/slices-download/slice-download").SliceItem,
) {
  ensureCookie(getState());
  setRequestCookie(getState().settings.cookie);
  await downloadSliceFile(apiPreview, slice, selectSliceDownloadOptions(getState()));
  showToast(dispatch, `已下载 ${slice.name || slice.id}`);
}

export async function downloadAllSliceFiles(dispatch: AppDispatch, getState: () => RootState) {
  const items = selectSliceItems(getState());
  if (!items.length) throw new Error("切图列表为空，请先获取");
  ensureCookie(getState());
  setRequestCookie(getState().settings.cookie);

  dispatch(setSliceDownloadProgress({ done: 0, total: items.length, current: "" }));
  const result = await downloadSlicesZip(
    apiPreview,
    items,
    selectSliceDownloadOptions(getState()),
    (progress) => dispatch(setSliceDownloadProgress(progress)),
  );
  dispatch(setSliceDownloadProgress(null));

  if (result.failed) {
    showToast(dispatch, `打包完成：成功 ${result.ok}，失败 ${result.failed}`);
  } else {
    showToast(dispatch, `已打包下载 ${result.ok} 个切图`);
  }
}

export async function loadMockData(
  dispatch: AppDispatch,
  getState: () => RootState,
  autoConvert: boolean,
) {
  const state = buildMockAppState();
  resetDownstreamArtifacts(dispatch);
  dispatch(setHasEnvCookie(state.hasEnvCookie));
  dispatch(
    applyMockSession({
      params: state.params,
      sectors: state.sectors,
      designs: state.designs,
      selectedDesignId: state.selectedDesignId,
      versionId: state.versionId,
      schemaRevise: state.schemaRevise,
      schemaJson: state.schemaJson,
      designDetail: state.designDetail,
      sketchJson: state.sketchJson,
      previewObjectUrl: URL.createObjectURL(state.previewBlob),
    }),
  );
  dispatch(mergeResults(state.results));

  dispatch(
    prependLog({
      ok: true,
      method: "MOCK",
      url: "MOCK_DATA",
      status: 200,
      elapsedMs: 0,
      note: `已加载 ${MOCK_MANIFEST.length} 个 mock 文件`,
    }),
  );

  if (autoConvert && state.schemaJson) {
    const started = performance.now();
    const convertRes = (await apiConvertDesign({
      schema: state.schemaJson,
      designName: state.selectedDesign?.name || "design",
    })) as { ok?: boolean; error?: string; convert?: import("@/api/types").ConvertDemo };
    const convert = convertRes.convert ?? convertRes;
    if (!(convert as { ok?: boolean }).ok) {
      throw new Error(convertRes.error || "Schema 转换失败");
    }
    dispatch(applyConvertResult(convert as import("@/api/types").ConvertDemo));
    dispatch(
      prependLog({
        ok: true,
        method: "POST",
        url: `${API_BASE}/api/designs/convert`,
        status: 200,
        elapsedMs: Math.round(performance.now() - started),
        note: `css=${(convert as import("@/api/types").ConvertDemo).after.cssRuleCount} rules`,
      }),
    );
    dispatch(setResultGroup("convert"));
    dispatch(setActiveTab("htmlPreview"));
    showToast(dispatch, "Mock 已加载并完成 Schema 转换（server）");
  } else {
    dispatch(setActiveTab("schema"));
    showToast(dispatch, autoConvert ? "Mock 已加载" : "Mock 数据已加载");
  }
  void getState;
}

export function selectDesign(dispatch: AppDispatch, getState: () => RootState, id: string) {
  if (getState().session.selectedDesignId === id) return;
  dispatch(setSelectedDesignId(id));
  resetDownstreamArtifacts(dispatch);
  showToast(dispatch, "已切换设计稿，预览/Schema/Sketch 状态已重置");
}

function setResultAndTab(
  dispatch: AppDispatch,
  key: import("@/api/types").InspectResultKey,
  data: unknown,
  switchTab = true,
) {
  dispatch(setResult({ key, data }));
  if (switchTab) {
    dispatch(setResultGroup(resultGroupForTab(key)));
    dispatch(setActiveTab(key));
  }
}

export function createActionRunners(dispatch: AppDispatch, getState: () => RootState) {
  return {
    analyze: () => runWorkspaceAction(dispatch, getState, "analyze", () => runAnalyzeFlow(dispatch, getState)),

    parseUrl: () =>
      runWorkspaceAction(dispatch, getState, "parseUrl", async () => {
        const state = getState();
        if (state.settings.useMock && state.settings.lanhuUrl.trim()) {
          const parsed = parseLanhuUrl(state.settings.lanhuUrl.trim());
          dispatch(setParams(parsed));
          setResultAndTab(dispatch, "params", parsed);
          showToast(dispatch, "URL 解析成功");
          return;
        }
        const started = performance.now();
        const data = (await apiParseUrl(state.settings.lanhuUrl.trim())) as {
          ok?: boolean;
          error?: string;
          params?: import("@/api/types").ServerParams;
        };
        if (!data.ok) throw new Error(data.error || "URL 解析失败");
        const parsed = mapServerParams(data.params!);
        const docChanged = state.session.params?.doc_id !== parsed.doc_id;
        dispatch(setParams(parsed));
        logServerCall(dispatch, "/api/parse-url", started, `pid=${parsed.project_id}`);
        if (parsed.doc_id) {
          if (parsed.doc_id !== state.session.selectedDesignId) {
            dispatch(setSelectedDesignId(parsed.doc_id));
            resetDownstreamArtifacts(dispatch);
          }
        } else if (docChanged) {
          resetDownstreamArtifacts(dispatch);
        }
        setResultAndTab(dispatch, "params", parsed);
        showToast(dispatch, "URL 解析成功");
      }),

    sectors: () =>
      runWorkspaceAction(dispatch, getState, "sectors", async () => {
        const state = getState();
        if (state.settings.useMock) {
          const data = getMockApiPayload("sectors");
          dispatch(setSectors(data));
          setResultAndTab(dispatch, "sectors", data);
          return;
        }
        ensureCookie(state);
        ensureParams(state);
        const started = performance.now();
        const data = await apiDesignSectors(state.session.params!.project_id);
        if (!(data as { ok?: boolean }).ok) throw new Error((data as { error?: string }).error || "project_sectors 失败");
        logServerCall(dispatch, "/api/designs/sectors", started, "project_sectors");
        dispatch(setSectors(data));
        setResultAndTab(dispatch, "sectors", data);
      }),

    images: () =>
      runWorkspaceAction(dispatch, getState, "images", async () => {
        const state = getState();
        if (state.settings.useMock) {
          const data = getMockApiPayload("images") as { code?: string; msg?: string; data?: { id?: string; images?: Array<Record<string, unknown>> } };
          if (data.code !== "00000") throw new Error(data.msg || "获取设计列表失败");
          if (!state.session.params?.project_id && data.data?.id) {
            dispatch(
              setParams({
                ...(state.session.params || { team_id: null, project_id: "", doc_id: null, version_id: null }),
                project_id: data.data.id,
                source: "mock",
              }),
            );
          }
          const designs = (data.data?.images || []).map((item, index) => ({
            index: index + 1,
            id: String(item.id),
            name: String(item.name),
            width: Number(item.width),
            height: Number(item.height),
            url: String(item.url),
          }));
          dispatch(setDesigns(designs));
        } else {
          const url = state.settings.lanhuUrl.trim();
          if (!url) throw new Error("请先填写蓝湖 URL");
          const started = performance.now();
          const data = (await apiListDesigns(url)) as {
            ok?: boolean;
            error?: string;
            params?: import("@/api/types").ServerParams;
            designs?: DesignItem[];
            totalDesigns?: number;
          };
          if (!data.ok) throw new Error(data.error || "获取设计列表失败");
          dispatch(
            prependLog({
              ok: true,
              method: "POST",
              url: `${API_BASE}/api/designs/list`,
              status: 200,
              elapsedMs: Math.round(performance.now() - started),
              note: `${data.totalDesigns ?? data.designs?.length ?? 0} designs`,
            }),
          );
          if (data.params) {
            const parsed = mapServerParams(data.params);
            dispatch(setParams(parsed));
            dispatch(setResult({ key: "params", data: parsed }));
          }
          dispatch(
            setDesigns(
              (data.designs || []).map((item) => ({
                index: item.index,
                id: item.id,
                name: item.name,
                width: item.width,
                height: item.height,
                url: item.url,
              })),
            ),
          );
        }

        const s = getState();
        const nextId = s.session.params?.doc_id || s.session.selectedDesignId || s.session.designs[0]?.id || null;
        if (nextId !== s.session.selectedDesignId) {
          dispatch(setSelectedDesignId(nextId));
          resetDownstreamArtifacts(dispatch);
        } else if (!s.session.selectedDesignId) {
          dispatch(setSelectedDesignId(nextId));
        }
        setResultAndTab(dispatch, "designs", {
          total: getState().session.designs.length,
          designs: getState().session.designs,
        });
      }),

    preview: () =>
      runWorkspaceAction(dispatch, getState, "preview", async () => {
        const state = getState();
        const design = selectSelectedDesign(state);
        if (state.settings.useMock) {
          const blob = await getMockPreviewBlob();
          dispatch(setPreviewObjectUrl(URL.createObjectURL(blob)));
          setResultAndTab(dispatch, "preview", {
            name: design?.name || "mock",
            url: design?.url?.split("?")[0] || "mock://preview.png",
          });
          return;
        }
        ensureCookie(state);
        ensureDesign(state);
        const started = performance.now();
        const data = (await apiPreview(design!.url)) as {
          ok?: boolean;
          error?: string;
          data?: string;
          contentType?: string;
        };
        if (!data.ok) throw new Error(data.error || "预览图下载失败");
        const binary = Uint8Array.from(atob(data.data!), (c) => c.charCodeAt(0));
        const blob = new Blob([binary], { type: data.contentType || "image/png" });
        logServerCall(dispatch, "/api/designs/preview", started, "preview png");
        dispatch(setPreviewObjectUrl(URL.createObjectURL(blob)));
        setResultAndTab(dispatch, "preview", {
          name: design!.name,
          url: design!.url.split("?")[0],
        });
      }),

    multiInfo: () =>
      runWorkspaceAction(dispatch, getState, "multiInfo", async () => {
        const state = getState();
        if (state.settings.useMock) {
          const data = getMockApiPayload("multiInfo") as {
            code?: string;
            msg?: string;
            result?: { images?: Array<{ id: string; latest_version?: string }> };
          };
          if (data.code !== "00000") throw new Error(data.msg || "multi_info 失败");
          const designId = selectSelectedDesign(state)?.id || state.session.params?.doc_id;
          const matched =
            (data.result?.images || []).find((item) => item.id === designId) ||
            (data.result?.images || [])[0];
          if (!matched?.latest_version) throw new Error("未找到 latest_version");
          dispatch(setVersionId(matched.latest_version));
          setResultAndTab(dispatch, "multiInfo", {
            image_id: matched.id,
            version_id: matched.latest_version,
            raw: data,
          });
          return;
        }
        ensureCookie(state);
        ensureParams(state);
        ensureDesign(state);
        const started = performance.now();
        const data = (await apiMultiInfo({
          projectId: state.session.params!.project_id,
          teamId: state.session.params!.team_id,
        })) as {
          ok?: boolean;
          code?: string;
          error?: string;
          msg?: string;
          result?: { images?: Array<{ id: string; latest_version?: string }> };
        };
        if (!data.ok || data.code !== "00000") throw new Error(data.error || data.msg || "multi_info 失败");
        logServerCall(dispatch, "/api/designs/multi-info", started, "multi_info");
        const designId = selectSelectedDesign(state)?.id || state.session.params?.doc_id;
        const matched = (data.result?.images || []).find((item) => item.id === designId);
        if (!matched?.latest_version) throw new Error("未找到 latest_version");
        dispatch(setVersionId(matched.latest_version));
        setResultAndTab(dispatch, "multiInfo", {
          image_id: matched.id,
          version_id: matched.latest_version,
          raw: data,
        });
      }),

    schemaRevise: () =>
      runWorkspaceAction(dispatch, getState, "schemaRevise", async () => {
        const state = getState();
        if (state.settings.useMock) {
          const data = getMockApiPayload("schemaRevise") as { code?: string; msg?: string; data?: { version_id?: string } };
          if (data.code !== "00000") throw new Error(data.msg || "store_schema_revise 失败");
          dispatch(setSchemaRevise(data));
          if (data.data?.version_id) dispatch(setVersionId(data.data.version_id));
          setResultAndTab(dispatch, "schemaRevise", data);
          return;
        }
        ensureCookie(state);
        if (!state.session.versionId) throw new Error("请先调用 multi_info");
        const started = performance.now();
        const data = (await apiSchemaRevise(state.session.versionId)) as { ok?: boolean; code?: string; error?: string; msg?: string };
        if (!data.ok || data.code !== "00000") throw new Error(data.error || data.msg || "store_schema_revise 失败");
        logServerCall(dispatch, "/api/designs/schema-revise", started, "schema_revise");
        dispatch(setSchemaRevise(data));
        setResultAndTab(dispatch, "schemaRevise", data);
      }),

    schemaJson: () =>
      runWorkspaceAction(dispatch, getState, "schemaJson", async () => {
        const state = getState();
        if (state.settings.useMock) {
          const data = getMockApiPayload("schemaJson");
          dispatch(setSchemaJson(data));
          setResultAndTab(dispatch, "schema", data);
          return;
        }
        ensureCookie(state);
        ensureDesign(state);
        const started = performance.now();
        const data = (await apiDesignSchema(selectDesignFields(state))) as {
          ok?: boolean;
          error?: string;
          schema?: unknown;
          versionId?: string;
          schemaUrl?: string;
        };
        if (!data.ok) throw new Error(data.error || "Schema 下载失败");
        logServerCall(dispatch, "/api/designs/schema", started, "schema json");
        dispatch(setSchemaJson(data.schema));
        dispatch(setVersionId(data.versionId ?? null));
        dispatch(
          setSchemaRevise({
            code: "00000",
            data: { data_resource_url: data.schemaUrl, version_id: data.versionId },
          }),
        );
        setResultAndTab(dispatch, "schema", data.schema);
      }),

    convertSchema: () =>
      runWorkspaceAction(dispatch, getState, "convertSchema", async () => {
        const state = getState();
        if (!state.session.schemaJson) throw new Error("请先下载 Schema JSON");
        const started = performance.now();
        const data = (await apiConvertDesign({
          schema: state.session.schemaJson,
          designName: selectSelectedDesign(state)?.name || "design",
        })) as { ok?: boolean; error?: string; convert?: import("@/api/types").ConvertDemo };
        const convert = data.convert ?? data;
        if (!(convert as { ok?: boolean }).ok) throw new Error(data.error || "Schema 转换失败");
        dispatch(applyConvertResult(convert as import("@/api/types").ConvertDemo));
        logServerCall(
          dispatch,
          "/api/designs/convert",
          started,
          `css=${(convert as import("@/api/types").ConvertDemo).after.cssRuleCount} rules`,
        );
        dispatch(setResultGroup("convert"));
        dispatch(setActiveTab("htmlPreview"));
        showToast(dispatch, "Schema 转换完成");
      }),

    designDetail: () =>
      runWorkspaceAction(dispatch, getState, "designDetail", async () => {
        const state = getState();
        if (state.settings.useMock) {
          const data = getMockApiPayload("designDetail") as { code?: string; msg?: string };
          if (data.code !== "00000") throw new Error(data.msg || "获取设计稿详情失败");
          dispatch(setDesignDetail(data));
          setResultAndTab(dispatch, "designDetail", data);
          return;
        }
        ensureCookie(state);
        ensureDesign(state);
        const started = performance.now();
        const data = (await apiDesignDetail(selectDesignFields(state))) as { ok?: boolean; code?: string; error?: string; msg?: string };
        if (!data.ok || data.code !== "00000") throw new Error(data.error || data.msg || "获取设计稿详情失败");
        logServerCall(dispatch, "/api/designs/detail", started, "project/image");
        dispatch(setDesignDetail(data));
        setResultAndTab(dispatch, "designDetail", data);
      }),

    sketchJson: () =>
      runWorkspaceAction(dispatch, getState, "sketchJson", async () => {
        const state = getState();
        if (state.settings.useMock) {
          const data = getMockApiPayload("sketchJson");
          dispatch(setSketchJson(data));
          setResultAndTab(dispatch, "sketch", data);
          return;
        }
        ensureCookie(state);
        ensureDesign(state);
        const started = performance.now();
        const data = (await apiDesignSketch(selectDesignFields(state))) as {
          ok?: boolean;
          error?: string;
          sketch?: unknown;
          sketchJson?: unknown;
          documentInfo?: unknown;
        };
        if (!data.ok) throw new Error(data.error || "Sketch 下载失败");
        logServerCall(dispatch, "/api/designs/sketch", started, "sketch json");
        const sketch = data.sketch ?? data.sketchJson;
        dispatch(setSketchJson(sketch));
        dispatch(setDesignDetail({ code: "00000", result: data.documentInfo }));
        setResultAndTab(dispatch, "sketch", sketch);
      }),

    convertSketch: () =>
      runWorkspaceAction(dispatch, getState, "convertSketch", async () => {
        const state = getState();
        ensureCookie(state);
        ensureDesign(state);
        const started = performance.now();
        const data = (await apiConvertSketch(selectSketchApiFields(state))) as {
          ok?: boolean;
          error?: string;
          sketch?: unknown;
          sketchMeta?: { documentInfo?: unknown };
          convert?: import("@/api/types").ConvertDemo;
        };
        if (!data.ok || !data.convert) throw new Error(data.error || "Sketch 转换失败");
        if (data.sketch) {
          dispatch(setSketchJson(data.sketch));
          dispatch(setResult({ key: "sketch", data: data.sketch }));
        }
        if (data.sketchMeta?.documentInfo) {
          const detail = { code: "00000", result: data.sketchMeta.documentInfo };
          dispatch(setDesignDetail(detail));
          dispatch(setResult({ key: "designDetail", data: detail }));
        }
        const normalized = normalizeSketchConvert(data.convert);
        dispatch(applyConvertResult(normalized));
        const htmlFull = normalized.after.htmlFull ?? "";
        dispatch(setResult({ key: "sketchHtml", data: htmlFull }));
        const layerText = formatLayerAnnotationsText(normalized.after.layerAnnotations ?? []);
        if (layerText !== "暂无 layerAnnotations") {
          dispatch(setResult({ key: "layerAnnotations", data: layerText }));
        }
        logServerCall(
          dispatch,
          "/api/designs/convert-sketch",
          started,
          `html=${htmlFull.length} · layers=${normalized.after.layerAnnotations?.length ?? 0}`,
        );
        dispatch(setResultGroup("convert"));
        dispatch(setActiveTab("sketchHtml"));
        showToast(dispatch, "Sketch → HTML 完成");
      }),

    sketchLayerAnnotations: () =>
      runWorkspaceAction(dispatch, getState, "sketchLayerAnnotations", async () => {
        const state = getState();
        ensureCookie(state);
        ensureDesign(state);
        const started = performance.now();
        const data = (await apiSketchLayerAnnotations(selectSketchApiFields(state))) as {
          ok?: boolean;
          error?: string;
          layerAnnotations?: unknown[];
          designScale?: number;
        };
        if (!data.ok) throw new Error(data.error || "Sketch CSS 标注提取失败");
        const text = formatLayerAnnotationsText(data.layerAnnotations ?? []);
        dispatch(setResult({ key: "layerAnnotations", data: text }));
        logServerCall(
          dispatch,
          "/api/designs/sketch-layer-annotations",
          started,
          `scale=${data.designScale ?? "?"} · layers=${data.layerAnnotations?.length ?? 0}`,
        );
        dispatch(setResultGroup("analyze"));
        dispatch(setActiveTab("layerAnnotations"));
        showToast(dispatch, "Sketch CSS 标注已提取");
      }),

    sketchAnnotations: () =>
      runWorkspaceAction(dispatch, getState, "sketchAnnotations", async () => {
        const state = getState();
        ensureCookie(state);
        ensureDesign(state);
        const started = performance.now();
        const data = (await apiSketchAnnotations(selectDesignFields(state))) as {
          ok?: boolean;
          error?: string;
          sketchAnnotations?: string;
          designScale?: number;
        };
        if (!data.ok) throw new Error(data.error || "Sketch 完整标注提取失败");
        dispatch(setResult({ key: "sketchAnnotations", data: data.sketchAnnotations ?? "" }));
        logServerCall(
          dispatch,
          "/api/designs/sketch-annotations",
          started,
          `scale=${data.designScale ?? "?"} · chars=${data.sketchAnnotations?.length ?? 0}`,
        );
        dispatch(setResultGroup("analyze"));
        dispatch(setActiveTab("sketchAnnotations"));
        showToast(dispatch, "Sketch 完整标注已提取");
      }),

    sliceFetch: () =>
      runWorkspaceAction(dispatch, getState, "sliceFetch", () => loadSliceDownloadList(dispatch, getState)),

    sliceMappingLoad: () =>
      runWorkspaceAction(dispatch, getState, "sliceMappingLoad", async () => {
        loadSliceFromMapping(dispatch, getState);
      }),

    sliceDownloadAll: () =>
      runWorkspaceAction(dispatch, getState, "sliceDownloadAll", () =>
        downloadAllSliceFiles(dispatch, getState),
      ),

    loadMock: (autoConvert: boolean) =>
      runWorkspaceAction(dispatch, getState, "loadMock", () => loadMockData(dispatch, getState, autoConvert)),
  };
}

export type ActionRunners = ReturnType<typeof createActionRunners>;

export function buildApiActions(state: RootState, runners: ActionRunners) {
  const mockReady = state.settings.useMock;
  const lanhuUrl = state.settings.lanhuUrl.trim();

  return [
    {
      id: "analyze",
      group: "流水线",
      label: "一键 analyze",
      desc: "POST /api/designs/analyze · 服务端内嵌 list 选稿→schema/sketch→HTML · 不写全量选稿列表（请先 project/images）",
      ready: !mockReady && Boolean(lanhuUrl),
      done: Boolean(state.inspect.analyzeResult),
      run: runners.analyze,
    },
    {
      id: "parseUrl",
      group: "基础",
      label: "解析 URL",
      desc: "从蓝湖链接提取 pid / image_id / tid",
      ready: Boolean(lanhuUrl),
      done: Boolean(state.session.params),
      run: runners.parseUrl,
    },
    {
      id: "sectors",
      group: "设计列表",
      label: "project_sectors",
      desc: "GET /api/project/project_sectors",
      ready: mockReady || Boolean(state.session.params?.project_id),
      done: Boolean(state.session.sectors),
      run: runners.sectors,
    },
    {
      id: "images",
      group: "设计列表",
      label: "project/images",
      desc: "POST Node /api/designs/list · 获取设计稿列表",
      ready: mockReady || Boolean(state.session.params?.project_id) || Boolean(lanhuUrl),
      done: state.session.designs.length > 0,
      run: runners.images,
    },
    {
      id: "preview",
      group: "资源",
      label: "预览图 CDN",
      desc: "GET design.url · 下载预览 PNG",
      ready: mockReady || Boolean(selectSelectedDesign(state)?.url),
      done: Boolean(state.session.previewObjectUrl),
      run: runners.preview,
    },
    {
      id: "multiInfo",
      group: "Schema",
      label: "multi_info",
      desc: "GET /api/project/multi_info · 查 version_id",
      ready: mockReady || Boolean(state.session.params?.project_id),
      done: Boolean(state.session.versionId),
      run: runners.multiInfo,
    },
    {
      id: "schemaRevise",
      group: "Schema",
      label: "store_schema_revise",
      desc: "GET dds.../store_schema_revise · 拿 schema 地址",
      ready: mockReady || Boolean(state.session.versionId),
      done: Boolean(state.session.schemaRevise),
      run: runners.schemaRevise,
    },
    {
      id: "schemaJson",
      group: "Schema",
      label: "下载 Schema JSON",
      desc: "POST Node /api/designs/schema · DDS 结构化数据",
      ready: mockReady || Boolean(selectSelectedDesign(state)?.id && state.session.params?.project_id),
      done: Boolean(state.session.schemaJson),
      run: runners.schemaJson,
    },
    {
      id: "convertSchema",
      group: "转换",
      label: "Schema → HTML",
      desc: "POST Node /api/designs/convert · @lanhu/core 转换",
      ready: Boolean(state.session.schemaJson),
      done: Boolean(state.inspect.convertDemo),
      run: runners.convertSchema,
    },
    {
      id: "designDetail",
      group: "Sketch",
      label: "project/image",
      desc: "GET /api/project/image · 设计稿详情",
      ready: mockReady || Boolean(selectSelectedDesign(state)?.id),
      done: Boolean(state.session.designDetail),
      run: runners.designDetail,
    },
    {
      id: "sketchJson",
      group: "Sketch",
      label: "下载 Sketch JSON",
      desc: "POST Node /api/designs/sketch · 图层标注数据",
      ready: mockReady || Boolean(selectSelectedDesign(state)?.id && state.session.params?.project_id),
      done: Boolean(state.session.sketchJson),
      run: runners.sketchJson,
    },
    {
      id: "convertSketch",
      group: "Sketch",
      label: "Sketch → HTML",
      desc: "POST Node /api/designs/convert-sketch · convertLanhuSketch",
      ready: mockReady || Boolean(selectSelectedDesign(state)?.id && state.session.params?.project_id),
      done: Boolean(state.inspect.results.sketchHtml),
      run: runners.convertSketch,
    },
    {
      id: "sketchLayerAnnotations",
      group: "Sketch",
      label: "Sketch CSS 标注",
      desc: "POST Node /api/designs/sketch-layer-annotations · layerAnnotations",
      ready: mockReady || Boolean(selectSelectedDesign(state)?.id && state.session.params?.project_id),
      done: Boolean(state.inspect.results.layerAnnotations),
      run: runners.sketchLayerAnnotations,
    },
    {
      id: "sketchAnnotations",
      group: "Sketch",
      label: "Sketch 完整标注",
      desc: "POST Node /api/designs/sketch-annotations · extractFullAnnotationsFromSketch",
      ready: mockReady || Boolean(selectSelectedDesign(state)?.id && state.session.params?.project_id),
      done: Boolean(state.inspect.results.sketchAnnotations),
      run: runners.sketchAnnotations,
    },
  ];
}

export function groupActions(actions: ReturnType<typeof buildApiActions>) {
  const groups: Record<string, typeof actions> = {};
  for (const action of actions) {
    if (!groups[action.group]) groups[action.group] = [];
    groups[action.group]!.push(action);
  }
  return groups;
}
