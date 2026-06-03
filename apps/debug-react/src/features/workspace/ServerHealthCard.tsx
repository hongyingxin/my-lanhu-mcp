import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchHealth } from "@/store/healthSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

export function ServerHealthCard() {
  const dispatch = useAppDispatch();
  const { data, status, error } = useAppSelector((s) => s.health);
  const hasEnvCookie = useAppSelector((s) => s.settings.hasEnvCookie);

  const refresh = () => {
    void dispatch(fetchHealth(true));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <div>
          <CardTitle className="text-base">服务状态</CardTitle>
          <CardDescription>
            <code className="text-xs">GET /api/health</code>
            {hasEnvCookie ? " · server 已配置 LANHU_COOKIE" : " · server 未配置 Cookie"}
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" disabled={status === "loading"} onClick={refresh}>
          {status === "loading" ? "…" : "刷新"}
        </Button>
      </CardHeader>
      <CardContent>
        {error ? <p className="text-destructive mb-2 text-xs">{error}</p> : null}
        {data ? (
          <pre className="bg-muted max-h-40 overflow-auto rounded-md p-3 font-mono text-[11px]">
            {JSON.stringify(data, null, 2)}
          </pre>
        ) : status === "idle" ? (
          <p className="text-muted-foreground text-sm">加载中…</p>
        ) : (
          <p className="text-muted-foreground text-sm">请先启动 npm run dev:server（:3001）</p>
        )}
      </CardContent>
    </Card>
  );
}
