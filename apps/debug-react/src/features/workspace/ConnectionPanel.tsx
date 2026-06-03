import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { persistToStorage, setCookie } from "@/store/settingsSlice";
import { changeLanhuUrl, showToast } from "./workspaceActions";

export function ConnectionPanel() {
  const dispatch = useAppDispatch();
  const settings = useAppSelector((s) => s.settings);

  const saveConfig = () => {
    dispatch(persistToStorage());
    showToast(dispatch, "已保存到 localStorage");
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">连接配置</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="block space-y-1 text-sm">
          <span className="text-muted-foreground">蓝湖 Cookie</span>
          <textarea
            className="border-input bg-background min-h-[72px] w-full rounded-md border px-3 py-2 font-mono text-xs"
            rows={3}
            value={settings.cookie}
            onChange={(e) => dispatch(setCookie(e.target.value))}
            placeholder="调试 Cookie（随请求发给 server，优先于 .env）；留空则用 server 根目录 LANHU_COOKIE"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-muted-foreground">蓝湖设计稿 URL</span>
          <input
            className="border-input bg-background h-9 w-full rounded-md border px-3 font-mono text-xs"
            value={settings.lanhuUrl}
            onChange={(e) => changeLanhuUrl(dispatch, e.target.value, settings.lanhuUrl)}
            placeholder="https://lanhuapp.com/web/#/item/project/detailDetach?pid=...&image_id=..."
          />
        </label>
        <Button variant="secondary" size="sm" onClick={saveConfig}>
          保存配置
        </Button>
      </CardContent>
    </Card>
  );
}
