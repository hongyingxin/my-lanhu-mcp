import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { persistToStorage, setCookie } from "@/store/settingsSlice";

import { PrototypePanel } from "./PrototypePanel";
import { PrototypeResultPanel } from "./PrototypeResultPanel";
import { RequestLogPanel } from "./RequestLogPanel";
import { ServerHealthCard } from "./ServerHealthCard";
import { showToast } from "./workspaceActions";

export function PrototypeWorkspace() {
  const dispatch = useAppDispatch();
  const settings = useAppSelector((s) => s.settings);

  const saveCookie = () => {
    dispatch(persistToStorage());
    showToast(dispatch, "Cookie 已保存");
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">连接</CardTitle>
            <p className="text-muted-foreground text-xs">原型模块独立配置，与设计稿调试互不影响。</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="block space-y-1 text-sm">
              <span className="text-muted-foreground">蓝湖 Cookie</span>
              <textarea
                className="border-input bg-background min-h-[72px] w-full rounded-md border px-3 py-2 font-mono text-xs"
                rows={3}
                value={settings.cookie}
                onChange={(e) => dispatch(setCookie(e.target.value))}
                placeholder="调试 Cookie（随请求发给 server）；留空则用 server .env"
              />
            </label>
            <Button variant="secondary" size="sm" onClick={saveCookie}>
              保存 Cookie
            </Button>
          </CardContent>
        </Card>
        <ServerHealthCard />
      </div>

      <PrototypePanel />

      <div className="grid gap-4 xl:grid-cols-2">
        <RequestLogPanel />
        <PrototypeResultPanel />
      </div>
    </div>
  );
}
