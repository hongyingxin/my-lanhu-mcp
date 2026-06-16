import type { UnknownRecord } from "../types.js";

export function isSketchRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function resolveDesignScale(sketch: UnknownRecord): number {
  // const device = String(sketch["device"] ?? "");
  // if (device.includes("@3x")) {
  //   return 3;
  // }
  // if (device.includes("@1x")) {
  //   return 1;
  // }
  // return 2;
  // 6月16日，确保sketch和schema一致，这里不做缩放处理
  return 1
}

export function resolveDesignImageUrl(designUrl?: string): string {
  return (designUrl ?? "").split("?")[0] ?? "";
}
