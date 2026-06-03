import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setActiveTab, setResultGroup, type ResultTabGroup } from "@/store/uiSlice";
import { RESULT_TAB_GROUPS, RESULT_TABS, firstTabInGroup } from "./constants";
import { formatResult, resultMeta } from "./resultFormat";

export function ResultPanel() {
  const dispatch = useAppDispatch();
  const state = useAppSelector((s) => s);
  const resultGroup = useAppSelector((s) => s.ui.resultGroup);
  const activeTab = useAppSelector((s) => s.ui.activeTab);
  const convertDemo = useAppSelector((s) => s.inspect.convertDemo);
  const previewObjectUrl = useAppSelector((s) => s.session.previewObjectUrl);

  const tabsInGroup = RESULT_TABS.filter((t) => t.group === resultGroup);
  const meta = resultMeta(activeTab, state);
  const text = formatResult(activeTab, state);

  const selectGroup = (group: ResultTabGroup) => {
    dispatch(setResultGroup(group));
    const inGroup = RESULT_TABS.some((t) => t.key === activeTab && t.group === group);
    if (!inGroup) {
      dispatch(setActiveTab(firstTabInGroup(group)));
    }
  };

  return (
    <Card className="flex min-h-[520px] flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">检视结果</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="flex flex-wrap gap-1 border-b pb-2">
          {RESULT_TAB_GROUPS.map((g) => (
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
        <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto">
          {tabsInGroup.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => dispatch(setActiveTab(tab.key))}
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
        {activeTab === "preview" && previewObjectUrl ? (
          <div className="bg-muted/30 flex flex-1 justify-center rounded-md border p-4">
            <img src={previewObjectUrl} alt="preview" className="max-h-96 max-w-full object-contain" />
          </div>
        ) : activeTab === "htmlPreview" && convertDemo ? (
          <iframe
            className="bg-background min-h-[400px] flex-1 w-full rounded-md border"
            srcDoc={convertDemo.after.htmlPreviewDoc || convertDemo.after.htmlFull}
            sandbox="allow-same-origin"
            title="html preview"
          />
        ) : (
          <pre className="bg-muted min-h-[400px] flex-1 overflow-auto rounded-md p-3 font-mono text-[11px] whitespace-pre-wrap">
            {text}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}
