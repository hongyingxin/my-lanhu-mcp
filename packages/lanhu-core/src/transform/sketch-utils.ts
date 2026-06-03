import type { UnknownRecord } from "../types.js";

export function isSketchRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function resolveDesignScale(sketch: UnknownRecord): number {
  const device = String(sketch["device"] ?? "");
  if (device.includes("@3x")) {
    return 3;
  }
  if (device.includes("@1x")) {
    return 1;
  }
  return 2;
}

export function resolveDesignImageUrl(designUrl?: string): string {
  return (designUrl ?? "").split("?")[0] ?? "";
}
