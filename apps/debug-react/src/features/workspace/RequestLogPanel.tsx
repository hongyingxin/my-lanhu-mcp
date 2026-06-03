import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { clearLogs } from "@/store/logsSlice";

export function RequestLogPanel() {
  const dispatch = useAppDispatch();
  const logs = useAppSelector((s) => s.logs);

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">请求日志</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => dispatch(clearLogs())}>
          清空
        </Button>
      </CardHeader>
      <CardContent className="max-h-[480px] flex-1 overflow-auto">
        {logs.length ? (
          <div className="space-y-2">
            {logs.map((log) => (
              <div
                key={log.id}
                className={`rounded-md border p-2 text-xs ${log.ok ? "border-emerald-500/30" : "border-destructive/40"}`}
              >
                <div>
                  {log.ok ? "成功" : "失败"} · {log.elapsedMs}ms · HTTP {log.status || "—"}
                </div>
                <div className="text-muted-foreground font-mono break-all">{log.url}</div>
                <div className="text-muted-foreground">{log.note}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">点击上方按钮发起请求</p>
        )}
      </CardContent>
    </Card>
  );
}
