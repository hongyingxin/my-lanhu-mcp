import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setConsoleStage, type ConsoleStage } from "@/store/uiSlice";
import { CONSOLE_STAGES } from "./constants";

export function StageNav() {
  const dispatch = useAppDispatch();
  const stage = useAppSelector((s) => s.ui.consoleStage);

  return (
    <nav className="bg-card flex w-44 shrink-0 flex-col gap-0.5 border-r p-2 md:w-48">
      <p className="text-muted-foreground px-2 py-1 text-[10px] font-medium uppercase tracking-wider">
        阶段
      </p>
      {CONSOLE_STAGES.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => dispatch(setConsoleStage(item.id))}
          className={cn(
            "rounded-md px-3 py-2.5 text-left transition-colors",
            stage === item.id
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
          )}
        >
          <div className="text-sm font-medium">{item.label}</div>
          <div
            className={cn(
              "mt-0.5 text-[10px] leading-snug",
              stage === item.id ? "text-primary-foreground/80" : "text-muted-foreground",
            )}
          >
            {item.desc}
          </div>
        </button>
      ))}
    </nav>
  );
}

export function StagePanel({ stage, children }: { stage: ConsoleStage; children: ReactNode }) {
  const current = useAppSelector((s) => s.ui.consoleStage);
  if (current !== stage) return null;
  return <div className="min-w-0 flex-1 space-y-4">{children}</div>;
}
