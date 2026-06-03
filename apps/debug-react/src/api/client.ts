import axios from "axios";

/** 开发默认走 Vite 代理 `/api`；生产或显式配置时用绝对地址 */
export const API_BASE =
  import.meta.env.VITE_API_BASE !== undefined && String(import.meta.env.VITE_API_BASE).length > 0
    ? String(import.meta.env.VITE_API_BASE).replace(/\/$/, "")
    : import.meta.env.DEV
      ? ""
      : "http://localhost:3001";

let requestCookie = "";

export function setRequestCookie(cookie: string) {
  requestCookie = (cookie || "").trim();
}

export async function post<T = unknown>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  const payload = { ...body };
  if (requestCookie) {
    payload.cookie = requestCookie;
  }
  const { data } = await axios.post<T>(`${API_BASE}${path}`, payload);
  return data;
}

export async function get<T = unknown>(path: string): Promise<T> {
  const { data } = await axios.get<T>(`${API_BASE}${path}`);
  return data;
}
