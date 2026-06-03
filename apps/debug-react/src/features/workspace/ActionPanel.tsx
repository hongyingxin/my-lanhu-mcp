import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppSelector } from "@/store/hooks";
import type { buildApiActions } from "./workspaceActions";

type Grouped = Record<string, ReturnType<typeof buildApiActions>>;

interface Props {
  grouped: Grouped;
}

export function ActionPanel({ grouped }: Props) {
  const loading = useAppSelector((s) => s.ui.loading);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">接口调用</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(grouped).map(([group, actions]) => (
          <div key={group}>
            <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
              {group}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {actions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  disabled={!action.ready || loading[action.id]}
                  onClick={() => void action.run()}
                  className={`rounded-lg border p-3 text-left text-sm transition-colors disabled:opacity-50 ${
                    action.done
                      ? "border-2 border-emerald-500 bg-emerald-500/5 shadow-sm"
                      : "border-input hover:bg-accent border"
                  }`}
                >
                  <div className="font-medium">{action.label}</div>
                  <div className="text-muted-foreground mt-1 text-xs">{action.desc}</div>
                  <div className="text-muted-foreground mt-2 text-[11px]">
                    {loading[action.id]
                      ? "请求中…"
                      : action.done
                        ? "已完成"
                        : action.ready
                          ? "可调用"
                          : "缺少前置条件"}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
