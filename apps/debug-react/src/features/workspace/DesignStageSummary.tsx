import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppSelector } from "@/store/hooks";
import { selectSelectedDesign } from "./selectors";

export function DesignStageSummary() {
  const params = useAppSelector((s) => s.session.params);
  const designs = useAppSelector((s) => s.session.designs);
  const selected = useAppSelector(selectSelectedDesign);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">当前上下文</CardTitle>
      </CardHeader>
      <CardContent className="text-muted-foreground space-y-2 text-sm">
        {params ? (
          <p className="font-mono text-xs">
            project={params.project_id} · doc={params.doc_id || "—"} · team={params.team_id || "—"}
          </p>
        ) : (
          <p>尚未解析 URL 或拉取列表。请到「分析」阶段点击「解析 URL」或「project/images」。</p>
        )}
        {designs.length ? (
          <p>
            共 {designs.length} 张设计稿
            {selected ? ` · 当前 #${selected.index} ${selected.name}` : ""}
          </p>
        ) : (
          <p>暂无设计稿列表。</p>
        )}
      </CardContent>
    </Card>
  );
}
