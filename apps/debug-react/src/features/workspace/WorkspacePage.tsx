import { useEffect, useMemo } from "react";
import { useStore } from "react-redux";

import { Badge } from "@/components/ui/badge";
import { setRequestCookie } from "@/api/debug-api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import type { RootState } from "@/store";
import { fetchHealth } from "@/store/healthSlice";
import { loadFromStorage, persistToStorage, WORKSPACE_MODE_KEY } from "@/store/settingsSlice";
import { setWorkspaceMode, type WorkspaceMode } from "@/store/uiSlice";
import { cn } from "@/lib/utils";

import { ActionPanel } from "./ActionPanel";
import { ConnectionPanel } from "./ConnectionPanel";
import { ConvertPanel } from "./ConvertPanel";
import { DesignGrid } from "./DesignGrid";
import { DesignStageSummary } from "./DesignStageSummary";
import { MockPanel } from "./MockPanel";
import { PipelineToolbar } from "./PipelineToolbar";
import { PrototypeWorkspace } from "./PrototypeWorkspace";
import { RequestLogPanel } from "./RequestLogPanel";
import { ResultPanel } from "./ResultPanel";
import { ServerHealthCard } from "./ServerHealthCard";
import { SliceDownloadPanel } from "./SliceDownloadPanel";
import { StageNav, StagePanel } from "./StageNav";
import { buildApiActions, createActionRunners, groupActions } from "./workspaceActions";
import { selectHasCookie } from "./selectors";

export function WorkspacePage() {
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();
  const settings = useAppSelector((s) => s.settings);
  const workspaceMode = useAppSelector((s) => s.ui.workspaceMode);
  const toast = useAppSelector((s) => s.ui.toast);
  const hasCookie = useAppSelector(selectHasCookie);

  const runners = useMemo(
    () => createActionRunners(dispatch, () => store.getState()),
    [dispatch, store],
  );

  const state = useAppSelector((s) => s);
  const actions = useMemo(() => buildApiActions(state, runners), [state, runners]);
  const grouped = useMemo(() => groupActions(actions), [actions]);

  useEffect(() => {
    dispatch(loadFromStorage());
    const savedMode = localStorage.getItem(WORKSPACE_MODE_KEY);
    if (savedMode === "prototype" || savedMode === "design") {
      dispatch(setWorkspaceMode(savedMode));
    }
    void dispatch(fetchHealth(undefined));
  }, [dispatch]);

  useEffect(() => {
    setRequestCookie(settings.cookie);
  }, [settings.cookie]);

  const cookieStatusLabel = settings.useMock
    ? "Mock 模式"
    : settings.cookie.trim()
      ? "页面 Cookie（优先）"
      : settings.hasEnvCookie
        ? "Server .env Cookie"
        : "未设置 Cookie";

  const cookieVariant = settings.useMock ? "secondary" : hasCookie ? "default" : "outline";

  const switchMode = (mode: WorkspaceMode) => {
    dispatch(setWorkspaceMode(mode));
    localStorage.setItem(WORKSPACE_MODE_KEY, mode);
    dispatch(persistToStorage());
  };

  return (
    <div className="flex min-h-[calc(100vh-3rem)] flex-col">
      <header className="bg-background flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">蓝湖 API 调试台</h1>
            <p className="text-muted-foreground text-xs">React · server :3001</p>
          </div>
          <div className="bg-muted flex rounded-lg p-1">
            <button
              type="button"
              onClick={() => switchMode("design")}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                workspaceMode === "design"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              UI 设计稿
            </button>
            <button
              type="button"
              onClick={() => switchMode("prototype")}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                workspaceMode === "prototype"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              原型 / PRD
            </button>
          </div>
        </div>
        <Badge variant={cookieVariant as "default" | "secondary" | "outline"}>{cookieStatusLabel}</Badge>
      </header>

      {workspaceMode === "prototype" ? (
        <div className="min-w-0 flex-1 overflow-auto p-4 md:p-6">
          <PrototypeWorkspace />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <StageNav />
          <div className="min-w-0 flex-1 overflow-auto p-4 md:p-6">
            <StagePanel stage="connect">
              <ConnectionPanel />
              <ServerHealthCard />
              <MockPanel runners={runners} />
            </StagePanel>

            <StagePanel stage="design">
              <DesignStageSummary />
              <DesignGrid />
            </StagePanel>

            <StagePanel stage="pipeline">
              <PipelineToolbar />
              <ActionPanel grouped={grouped} />
            </StagePanel>

            <StagePanel stage="convert">
              <ConvertPanel />
            </StagePanel>

            <StagePanel stage="results">
              <div className="grid gap-4 xl:grid-cols-2">
                <RequestLogPanel />
                <ResultPanel />
              </div>
            </StagePanel>

            <StagePanel stage="slices">
              <SliceDownloadPanel runners={runners} />
            </StagePanel>
          </div>
        </div>
      )}

      {toast ? (
        <div className="bg-primary text-primary-foreground fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-2 text-sm shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
