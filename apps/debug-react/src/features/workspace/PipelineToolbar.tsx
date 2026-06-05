import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setAnalyzeWithSlices } from "@/store/settingsSlice";
import { useStore } from "react-redux";
import type { RootState } from "@/store";
import { runWorkspaceAction, runAnalyzeFlow } from "./workspaceActions";

export function PipelineToolbar() {
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();
  const settings = useAppSelector((s) => s.settings);
  const params = useAppSelector((s) => s.session.params);
  const analyzeResult = useAppSelector((s) => s.inspect.analyzeResult);
  const convertDemo = useAppSelector((s) => s.inspect.convertDemo);
  const loadingAnalyze = useAppSelector((s) => s.ui.loading.analyze);

  const runAnalyze = () =>
    runWorkspaceAction(dispatch, () => store.getState(), "analyze", () =>
      runAnalyzeFlow(dispatch, () => store.getState()),
    );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">主流水线</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={settings.useMock || !settings.lanhuUrl.trim() || loadingAnalyze}
            onClick={() => void runAnalyze()}
          >
            {loadingAnalyze ? "分析中…" : "一键 analyze"}
          </Button>
          {params ? (
            <span className="text-muted-foreground font-mono text-xs">
              pid={params.project_id} · image={params.doc_id || "—"}
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">先在「连接」填写 URL，或在下方分步拉列表</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="text-muted-foreground inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.analyzeWithSlices}
              onChange={(e) => dispatch(setAnalyzeWithSlices(e.target.checked))}
            />
            含切图元数据（withSlices · 仅 URL，不下载文件）
          </label>
          {convertDemo?.source === "sketch" ||
          (analyzeResult as { convertSource?: string } | null)?.convertSource === "sketch" ? (
            <span className="text-muted-foreground text-xs">
              上次来源：<strong className="text-foreground">Sketch fallback</strong>
            </span>
          ) : (analyzeResult as { convertSource?: string } | null)?.convertSource === "schema" ? (
            <span className="text-muted-foreground text-xs">
              上次来源：<strong className="text-foreground">Schema</strong>
            </span>
          ) : null}
        </div>
        <p className="text-muted-foreground text-xs">
          <strong className="text-foreground font-normal">注意：</strong>
          一键 analyze 仅在服务端内嵌 list 用于选稿，<strong className="text-foreground font-normal">不会</strong>
          把全量设计稿写入「设计」选稿区（最多 prepend 当前分析的那 1 张）。要看完整列表请先点
          project/images，或到「设计」阶段切换后再 analyze。
        </p>
        <p className="text-muted-foreground text-xs">
          下方为全部分步接口（与 Vue 调试台一致，日常全部暴露）。有 HTML 后到「转换」预览；日志与 JSON 在「结果」「切图」。
        </p>
      </CardContent>
    </Card>
  );
}
