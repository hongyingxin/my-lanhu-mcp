import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  SLICE_FORMAT_OPTIONS,
  SLICE_SCALE_GROUPS,
  resolveSliceDownloadUrl,
} from "@/features/slices-download/slice-download";
import {
  setSliceFormat,
  setSliceScale,
  setSliceSource,
  setSlicePanelView,
} from "@/store/slicesSlice";
import { useStore } from "react-redux";
import type { RootState } from "@/store";
import {
  downloadOneSlice,
  runWorkspaceAction,
  type ActionRunners,
} from "./workspaceActions";
import {
  previewUrlForSlice,
  selectSliceDownloadOptions,
  selectSliceItems,
  selectSliceMappingReady,
  selectSelectedDesign,
} from "./selectors";

interface Props {
  runners: ActionRunners;
}

export function SliceDownloadPanel({ runners }: Props) {
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();
  const settings = useAppSelector((s) => s.settings);
  const slices = useAppSelector((s) => s.slices);
  const params = useAppSelector((s) => s.session.params);
  const loading = useAppSelector((s) => s.ui.loading);
  const items = useAppSelector(selectSliceItems);
  const mappingReady = useAppSelector(selectSliceMappingReady);
  const selectedDesign = useAppSelector(selectSelectedDesign);
  const opts = useAppSelector(selectSliceDownloadOptions);

  const sliceDownloadReady =
    !settings.useMock &&
    Boolean(settings.lanhuUrl.trim() || (params?.project_id && selectedDesign?.id));

  const sliceStatusLabel =
    slices.sliceSource === "mapping"
      ? items.length
        ? `A 套 mapping · ${items.length} 条`
        : "A 套 · 未载入"
      : !slices.sliceBData
        ? "B 套 · 未拉取"
        : `B 套 · ${(slices.sliceBData as { totalSlices?: number }).totalSlices ?? 0} 个 · sliceScale=${(slices.sliceBData as { sliceScale?: string }).sliceScale ?? "?"} · ${(slices.sliceBData as { designName?: string }).designName ?? ""}`;

  const sliceScaleHint =
    slices.sliceSource !== "scaleUrls"
      ? "mapping 来源为 HTML 内原图 URL，不支持倍率切换"
      : !items.length
        ? "先获取切图列表"
        : `${items.filter((item) => item.scaleUrls?.[slices.sliceScale]).length}/${items.length} 个切图含 ${slices.sliceScale} URL`;

  const sliceJsonPreview =
    slices.sliceSource === "mapping"
      ? (() => {
          const mapping =
            store.getState().inspect.results.convertMapping ??
            store.getState().inspect.convertDemo?.after?.mapping;
          return mapping ? JSON.stringify({ source: "mapping", mapping }, null, 2) : "暂无 mapping";
        })()
      : slices.sliceBData
        ? JSON.stringify(slices.sliceBData, null, 2)
        : "请先拉取 B 套切图";

  function scaleAvailable(slice: (typeof items)[0], scale: string) {
    return slices.sliceSource !== "scaleUrls" || Boolean(slice.scaleUrls?.[scale]);
  }

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-2 pb-2">
        <div>
          <CardTitle className="text-base">切图下载</CardTitle>
          <p className="text-muted-foreground mt-1 text-xs">
            本面板独立管理切图数据，<strong>不会切换右侧 Tab</strong>。B 套走 scaleUrls，A 套走 convert mapping。
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${items.length ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}
        >
          {sliceStatusLabel}
        </span>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div>
          <div className="mb-2 text-xs font-medium">1 · 拉取数据</div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={!sliceDownloadReady || loading.sliceFetch}
              onClick={() => void runners.sliceFetch()}
            >
              {loading.sliceFetch ? "拉取中…" : "拉取切图（B 套）"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!mappingReady}
              onClick={() => void runners.sliceMappingLoad()}
            >
              载入 mapping（A 套）
            </Button>
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs font-medium">2 · 下载选项</div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">来源</span>
              <select
                className="border-input bg-background h-8 rounded-md border px-2 font-mono text-xs"
                value={slices.sliceSource}
                onChange={(e) =>
                  dispatch(setSliceSource(e.target.value as "scaleUrls" | "mapping"))
                }
              >
                <option value="scaleUrls">B · scaleUrls（getSlices）</option>
                <option value="mapping">A · mapping（convert）</option>
              </select>
            </label>
            <label className={`space-y-1 text-xs ${slices.sliceSource !== "scaleUrls" ? "opacity-50" : ""}`}>
              <span className="text-muted-foreground">倍率</span>
              <select
                className="border-input bg-background h-8 rounded-md border px-2 font-mono text-xs"
                value={slices.sliceScale}
                disabled={slices.sliceSource !== "scaleUrls"}
                onChange={(e) => dispatch(setSliceScale(e.target.value))}
              >
                {SLICE_SCALE_GROUPS.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.keys.map((key) => (
                      <option key={key} value={key}>
                        {key}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">格式</span>
              <select
                className="border-input bg-background h-8 rounded-md border px-2 font-mono text-xs"
                value={slices.sliceFormat}
                onChange={(e) => dispatch(setSliceFormat(e.target.value))}
              >
                {SLICE_FORMAT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <Button
              size="sm"
              disabled={!items.length || loading.sliceDownloadAll}
              onClick={() => void runners.sliceDownloadAll()}
            >
              {loading.sliceDownloadAll ? "打包中…" : `打包下载 (${items.length})`}
            </Button>
          </div>
          <p className="text-muted-foreground mt-2 text-xs">{sliceScaleHint}</p>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium">3 · 结果</span>
            {(items.length || slices.sliceBData || mappingReady) && (
              <div className="flex gap-1">
                <button
                  type="button"
                  className={`rounded px-2 py-0.5 text-xs ${slices.slicePanelView === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                  onClick={() => dispatch(setSlicePanelView("list"))}
                >
                  列表
                </button>
                <button
                  type="button"
                  className={`rounded px-2 py-0.5 text-xs ${slices.slicePanelView === "json" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                  onClick={() => dispatch(setSlicePanelView("json"))}
                >
                  原始 JSON
                </button>
              </div>
            )}
          </div>

          {slices.sliceDownloadProgress ? (
            <p className="text-muted-foreground text-xs">
              下载进度 {slices.sliceDownloadProgress.done}/{slices.sliceDownloadProgress.total}
              {slices.sliceDownloadProgress.current
                ? ` · ${slices.sliceDownloadProgress.current}`
                : ""}
            </p>
          ) : null}

          {slices.slicePanelView === "list" && items.length ? (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-2">名称</th>
                    <th className="p-2">尺寸</th>
                    {slices.sliceSource === "scaleUrls" ? <th className="p-2">倍率</th> : null}
                    <th className="p-2">下载 URL</th>
                    <th className="p-2" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((slice) => {
                    const id = slice.id || slice.name || slice.localPath || "";
                    return (
                      <tr key={id} className="border-t">
                        <td className="max-w-[120px] truncate p-2" title={slice.layerPath}>
                          {slice.name}
                        </td>
                        <td className="font-mono p-2">{slice.size || "—"}</td>
                        {slices.sliceSource === "scaleUrls" ? (
                          <td className="font-mono p-2">
                            {scaleAvailable(slice, slices.sliceScale) ? (
                              <span className="text-emerald-600">{slices.sliceScale}</span>
                            ) : (
                              <span className="text-amber-600" title="无此倍率，回退 downloadUrl">
                                fallback
                              </span>
                            )}
                          </td>
                        ) : null}
                        <td
                          className="max-w-[200px] truncate font-mono p-2"
                          title={resolveSliceDownloadUrl(slice, opts) || ""}
                        >
                          {previewUrlForSlice(store.getState(), slice)}
                        </td>
                        <td className="p-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={loading[`sliceOne_${id}`]}
                            onClick={() =>
                              runWorkspaceAction(dispatch, () => store.getState(), `sliceOne_${id}`, () =>
                                downloadOneSlice(dispatch, () => store.getState(), slice),
                              )
                            }
                          >
                            下载
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : slices.slicePanelView === "json" ? (
            <pre className="bg-muted max-h-64 overflow-auto rounded-md p-3 font-mono text-[11px]">
              {sliceJsonPreview}
            </pre>
          ) : (
            <p className="text-muted-foreground text-xs">
              暂无切图。B 套：填 Cookie + URL → 点「拉取切图」；或 analyze 勾选「含切图元数据」预载。 A 套：先 Schema
              转换 →「载入 mapping」。
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
