import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppSelector } from "@/store/hooks";
import { formatConvertBefore } from "./resultFormat";

export function ConvertPanel() {
  const convertDemo = useAppSelector((s) => s.inspect.convertDemo);

  if (!convertDemo) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Schema 转换演示</CardTitle>
          <p className="text-muted-foreground text-xs">
            暂无转换结果。请到「分析」执行「一键 analyze」、「Schema → HTML」或「Sketch → HTML」。
          </p>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            生成 HTML 后会在此展示转换前后摘要与页面预览；完整 JSON / CSS 见「结果」阶段。
          </p>
        </CardContent>
      </Card>
    );
  }

  const isSketch = convertDemo.source === "sketch";
  const iframeSrcDoc = convertDemo.after.htmlPreviewDoc || convertDemo.after.htmlFull;
  console.log("[ConvertPanel iframe]", {
    htmlPreviewDoc: convertDemo.after.htmlPreviewDoc,
    htmlFull: convertDemo.after.htmlFull,
    srcDoc: iframeSrcDoc,
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          {isSketch ? "Sketch Fallback 转换" : "Schema 转换演示"}
        </CardTitle>
        <p className="text-muted-foreground text-xs">
          {isSketch
            ? "Schema 不可用，已使用 Sketch fallback。完整 HTML 见「结果」→ 转换 / HTML。"
            : "左侧为与 CSS 摘要对应的 Schema 节点；完整 JSON 见「结果」→ 原始数据 → Schema。"}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {convertDemo.before ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <div className="mb-1 text-xs font-medium">转换前 · 与 CSS 摘要对应的 Schema 节点</div>
              <pre className="bg-muted h-128 min-h-128 overflow-auto rounded-md p-3 font-mono text-[11px]">
                {formatConvertBefore(convertDemo.before)}
              </pre>
            </div>
            <div>
              <div className="mb-1 text-xs font-medium">转换后 · CSS（摘要）</div>
              <pre className="bg-muted h-128 min-h-128 overflow-auto rounded-md p-3 font-mono text-[11px]">
                {convertDemo.after.cssPreview}
              </pre>
            </div>
          </div>
        ) : null}
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <div className="mb-1 text-xs font-medium">转换后 · HTML Body（摘要）</div>
            <pre className="bg-muted h-96 min-h-96 overflow-auto rounded-md p-3 font-mono text-[11px]">
              {convertDemo.after.htmlBodyPreview}
            </pre>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium">转换后 · 页面预览</div>
            <iframe
              className="bg-background h-128 w-full rounded-md border"
              srcDoc={iframeSrcDoc}
              sandbox="allow-same-origin"
              title="html preview"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
