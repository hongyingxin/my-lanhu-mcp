import { createBrowserRouter, Navigate } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { WorkspacePage } from "@/pages/WorkspacePage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <WorkspacePage /> },
      { path: "workspace", element: <Navigate to="/" replace /> },
      { path: "health", element: <Navigate to="/" replace /> },
      { path: "designs", element: <Navigate to="/" replace /> },
    ],
  },
]);
