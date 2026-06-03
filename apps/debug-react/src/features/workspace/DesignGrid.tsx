import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { useStore } from "react-redux";
import type { RootState } from "@/store";
import { selectDesign } from "./workspaceActions";

export function DesignGrid() {
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();
  const designs = useAppSelector((s) => s.session.designs);
  const selectedDesignId = useAppSelector((s) => s.session.selectedDesignId);

  if (!designs.length) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">设计稿选择</CardTitle>
        <p className="text-muted-foreground text-xs">
          切换设计稿会重置预览图、Schema、Sketch 等下游接口状态
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {designs.map((design) => (
            <button
              key={design.id}
              type="button"
              onClick={() => selectDesign(dispatch, () => store.getState(), design.id)}
              className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                selectedDesignId === design.id
                  ? "border-primary bg-primary/5"
                  : "border-input hover:bg-accent"
              }`}
            >
              <strong className="block truncate">
                #{design.index} {design.name}
              </strong>
              <small className="text-muted-foreground block">
                {design.width}×{design.height}
              </small>
              <small className="text-muted-foreground font-mono block truncate text-[11px]">
                {design.id}
              </small>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
