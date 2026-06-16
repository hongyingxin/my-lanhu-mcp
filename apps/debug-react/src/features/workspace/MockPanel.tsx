import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { MOCK_MANIFEST } from "@/mock/index";
import { persistToStorage, setUseMock } from "@/store/settingsSlice";
import type { ActionRunners } from "./workspaceActions";

interface Props {
  runners: ActionRunners;
}

export function MockPanel({ runners }: Props) {
  const dispatch = useAppDispatch();
  const useMock = useAppSelector((s) => s.settings.useMock);
  const loading = useAppSelector((s) => s.ui.loading.loadMock);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
        <CardTitle className="text-base">Mock 调试</CardTitle>
        <label className="text-muted-foreground inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={useMock}
            onChange={(e) => {
              dispatch(setUseMock(e.target.checked));
              dispatch(persistToStorage());
            }}
          />
          启用 Mock 模式（单步按钮也读本地 JSON，无需 Cookie）
        </label>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-xs">
          启用 Mock 模式后可跳过网络请求，直接加载本地 Mock 数据；Schema 转换走 server。
        </p>
        <div className="flex flex-wrap gap-2">
          {MOCK_MANIFEST.map((item) => (
            <span
              key={item.key}
              className="bg-muted text-muted-foreground rounded-md px-2 py-1 font-mono text-[11px]"
            >
              {item.file} · {item.label}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={loading} onClick={() => void runners.loadMock(true)}>
            {loading ? "加载中…" : "一键加载 Mock + 转换"}
          </Button>
          <Button variant="secondary" disabled={loading} onClick={() => void runners.loadMock(false)}>
            仅加载 Mock 数据
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
