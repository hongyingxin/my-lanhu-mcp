import { Outlet } from "react-router-dom";

/** 极简壳：调试台占满主区域，无多余产品导航 */
export function AppShell() {
  return (
    <div className="bg-background min-h-screen">
      <Outlet />
    </div>
  );
}
