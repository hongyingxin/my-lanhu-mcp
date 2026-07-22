import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  setPrototypeActiveTab,
  setPrototypeResultGroup,
  type PrototypeResultTabGroup,
} from "@/store/uiSlice";
import {
  PROTOTYPE_RESULT_TAB_GROUPS,
  PROTOTYPE_RESULT_TABS,
  firstPrototypeTabInGroup,
} from "./constants";
import { formatResult, resultMeta } from "./resultFormat";
import { findPrototypePageResult, resolvePrototypeDisplayName } from "./prototypeResultUtils";

interface PrototypeScreenshotItem {
  page_name: string;
  screenshot_path: string;
  screenshot_url: string;
  from_cache?: boolean;
  size?: string;
}

export function PrototypeResultPanel() {
  const dispatch = useAppDispatch();
  const state = useAppSelector((s) => s);
  const resultGroup = useAppSelector((s) => s.ui.prototypeResultGroup);
  const activeTab = useAppSelector((s) => s.ui.prototypeActiveTab);

  const tabsInGroup = PROTOTYPE_RESULT_TABS.filter((t) => t.group === resultGroup);
  const activePage = findPrototypePageResult(state);
  const activePageLabel = resolvePrototypeDisplayName(state, activePage);
  const meta =
    activeTab === "prototypeScreenshots"
      ? ""
      : activeTab === "prototypePageText" || activeTab === "prototypeDesignInfo"
        ? activePage
          ? `当前页：${activePageLabel}`
          : ""
        : resultMeta(activeTab, state);
  const text = formatResult(activeTab, state);
  const screenshots = Array.isArray(state.inspect.results.prototypeScreenshots)
    ? (state.inspect.results.prototypeScreenshots as PrototypeScreenshotItem[])
    : [];

  const selectGroup = (group: PrototypeResultTabGroup) => {
    dispatch(setPrototypeResultGroup(group));
    const inGroup = PROTOTYPE_RESULT_TABS.some((t) => t.key === activeTab && t.group === group);
    if (!inGroup) {
      dispatch(setPrototypeActiveTab(firstPrototypeTabInGroup(group)));
    }
  };

  return (
    <Card className="flex min-h-[420px] flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">原型结果</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="flex flex-wrap gap-1 border-b pb-2">
          {PROTOTYPE_RESULT_TAB_GROUPS.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => selectGroup(g.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                resultGroup === g.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
        <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto">
          {tabsInGroup.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => dispatch(setPrototypeActiveTab(tab.key))}
              className={`rounded px-2 py-1 text-xs transition-colors ${
                activeTab === tab.key
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {meta ? <p className="text-muted-foreground text-xs">{meta}</p> : null}
        {activeTab === "prototypeScreenshots" ? (
          screenshots.length > 0 ? (
            <div className="grid min-h-[320px] flex-1 gap-4 overflow-auto">
              {screenshots.map((item) => (
                <div key={item.screenshot_path} className="space-y-2 rounded-md border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <strong>{item.page_name}</strong>
                    <span className="text-muted-foreground">
                      {item.from_cache ? "缓存" : "新渲染"}
                      {item.size ? ` · ${item.size}` : ""}
                    </span>
                  </div>
                  <img
                    src={item.screenshot_url}
                    alt={item.page_name}
                    className="bg-muted max-h-[720px] w-full rounded border object-contain"
                  />
                  <p className="text-muted-foreground font-mono text-[11px] break-all">{item.screenshot_path}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">暂无截图。请先执行分析。</p>
          )
        ) : (
          <pre className="bg-muted min-h-[320px] flex-1 overflow-auto rounded-md p-3 font-mono text-[11px] whitespace-pre-wrap">
            {text}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}
