/** 从 Sketch JSON 提取高风险元素的设计参数 */
import type { UnknownRecord } from "../types.js";
import { isSketchRecord } from "./sketch-utils.js";

const NOISE_TYPES = new Set(["color", "gradient", "colorStop", "colorControl"]);

function getDimensions(obj: UnknownRecord): [number, number, number, number] {
  const frame =
    (isSketchRecord(obj["ddsOriginFrame"]) ? obj["ddsOriginFrame"] : undefined) ??
    (isSketchRecord(obj["layerOriginFrame"]) ? obj["layerOriginFrame"] : undefined) ??
    {};
  const x = Number(frame["x"] ?? obj["left"] ?? 0) || 0;
  const y = Number(frame["y"] ?? obj["top"] ?? 0) || 0;
  const w = Number(frame["width"] ?? obj["width"] ?? 0) || 0;
  const h = Number(frame["height"] ?? obj["height"] ?? 0) || 0;
  return [x, y, w, h];
}

function simplifyFill(fill: UnknownRecord): string | undefined {
  if (fill["isEnabled"] === false) {
    return undefined;
  }
  const fillType = Number(fill["fillType"] ?? 0);
  if (fillType === 0) {
    const color = isSketchRecord(fill["color"]) ? fill["color"] : {};
    return `solid(${String(color["value"] ?? "unknown")})`;
  }
  if (fillType === 1) {
    const gradient = isSketchRecord(fill["gradient"]) ? fill["gradient"] : {};
    const stops = Array.isArray(gradient["colorStops"]) ? gradient["colorStops"] : [];
    const fromPt = isSketchRecord(gradient["from"]) ? gradient["from"] : {};
    const toPt = isSketchRecord(gradient["to"]) ? gradient["to"] : {};
    const dx = Number(toPt["x"] ?? 0.5) - Number(fromPt["x"] ?? 0.5);
    const dy = Number(toPt["y"] ?? 0) - Number(fromPt["y"] ?? 0);
    const angle = Math.round((Math.atan2(dx, dy) * 180) / Math.PI) % 360;
    const parts: string[] = [];
    for (const stop of stops) {
      if (!isSketchRecord(stop)) continue;
      const color = isSketchRecord(stop["color"]) ? stop["color"] : {};
      const position = Number(stop["position"] ?? 0);
      parts.push(`${String(color["value"] ?? "unknown")} ${Math.round(position * 100)}%`);
    }
    return `linear-gradient(${angle}deg, ${parts.join(", ")})`;
  }
  return undefined;
}

function simplifyBorder(border: UnknownRecord): string | undefined {
  if (border["isEnabled"] === false) {
    return undefined;
  }
  const color = isSketchRecord(border["color"]) ? border["color"] : {};
  const thickness = border["thickness"] ?? 1;
  const posMap: Record<string, string> = { 内边框: "inside", 外边框: "outside", 中心边框: "center" };
  const position = String(border["position"] ?? "center");
  const pos = posMap[position] ?? position;
  return `${thickness}px ${pos} ${String(color["value"] ?? "unknown")}`;
}

function simplifyShadow(shadow: UnknownRecord): string | undefined {
  if (shadow["isEnabled"] === false) {
    return undefined;
  }
  const color = isSketchRecord(shadow["color"]) ? shadow["color"] : {};
  const x = shadow["offsetX"] ?? 0;
  const y = shadow["offsetY"] ?? 0;
  const blur = shadow["blurRadius"] ?? 0;
  const spread = shadow["spread"] ?? 0;
  return `${String(color["value"] ?? "unknown")} ${x}px ${y}px ${blur}px ${spread}px`;
}

function hasOnlyTransparentSolid(fills: unknown[]): boolean {
  for (const fill of fills) {
    if (!isSketchRecord(fill) || fill["isEnabled"] === false) {
      continue;
    }
    if (Number(fill["fillType"] ?? 0) === 0) {
      const color = isSketchRecord(fill["color"]) ? fill["color"] : {};
      const val = String(color["value"] ?? "");
      if (val.includes("rgba") && val.replace(/\s/g, "").includes(",0)")) {
        continue;
      }
      const alpha = color["alpha"] ?? color["a"] ?? 1;
      if (alpha === 0) {
        continue;
      }
    }
    return false;
  }
  return true;
}

function isHighRisk(obj: UnknownRecord): boolean {
  const objType = String(obj["type"] ?? obj["ddsType"] ?? "").toLowerCase();
  if (NOISE_TYPES.has(objType)) {
    return false;
  }

  const [, , w, h] = getDimensions(obj);
  if (w < 2 && h < 2) {
    return false;
  }

  const fills = Array.isArray(obj["fills"]) ? obj["fills"] : [];
  let hasGradientFill = false;
  for (const fill of fills) {
    if (isSketchRecord(fill) && fill["isEnabled"] !== false && Number(fill["fillType"]) === 1) {
      hasGradientFill = true;
      break;
    }
  }
  if (hasGradientFill) {
    return true;
  }

  const borders = Array.isArray(obj["borders"]) ? obj["borders"] : [];
  for (const border of borders) {
    if (isSketchRecord(border) && border["isEnabled"] !== false) {
      return true;
    }
  }

  const radius = obj["radius"];
  if (Array.isArray(radius) && new Set(radius).size > 1) {
    return true;
  }

  const opacity = obj["opacity"];
  if (opacity !== undefined && Number(opacity) < 100) {
    if (
      hasOnlyTransparentSolid(fills) &&
      borders.length === 0 &&
      (!Array.isArray(obj["shadows"]) || obj["shadows"].length === 0)
    ) {
      return false;
    }
    return true;
  }

  const shadows = Array.isArray(obj["shadows"]) ? obj["shadows"] : [];
  for (const shadow of shadows) {
    if (isSketchRecord(shadow) && shadow["isEnabled"] !== false) {
      return true;
    }
  }

  return false;
}

function buildPath(parentPath: string, name: string): string {
  return parentPath ? `${parentPath}/${name}` : name;
}

function walkObject(obj: UnknownRecord, parentPath: string, tokens: string[]): void {
  if (obj["isVisible"] === false) {
    return;
  }

  const name = String(obj["name"] ?? "");
  const currentPath = buildPath(parentPath, name);

  if (isHighRisk(obj)) {
    const objType = String(obj["type"] ?? obj["ddsType"] ?? "unknown");
    const [x, y, w, h] = getDimensions(obj);
    const lines = [`[${objType}] "${name}" @(${Math.trunc(x)},${Math.trunc(y)}) ${Math.trunc(w)}x${Math.trunc(h)}`];
    if (parentPath) {
      lines[0] += `  path: ${currentPath}`;
    }

    const radius = obj["radius"];
    if (radius) {
      if (Array.isArray(radius)) {
        lines.push(
          new Set(radius).size === 1
            ? `  radius: ${radius[0]}`
            : `  radius: ${JSON.stringify(radius)}`,
        );
      } else {
        lines.push(`  radius: ${radius}`);
      }
    }

    const fills = Array.isArray(obj["fills"]) ? obj["fills"] : [];
    for (const fill of fills) {
      if (!isSketchRecord(fill)) continue;
      const simplified = simplifyFill(fill);
      if (simplified) {
        lines.push(`  fill: ${simplified}`);
      }
    }

    const borders = Array.isArray(obj["borders"]) ? obj["borders"] : [];
    for (const border of borders) {
      if (!isSketchRecord(border)) continue;
      const simplified = simplifyBorder(border);
      if (simplified) {
        lines.push(`  border: ${simplified}`);
      }
    }

    const objOpacity = obj["opacity"];
    if (objOpacity !== undefined && Number(objOpacity) < 100) {
      lines.push(`  opacity: ${objOpacity}%`);
    }

    const shadows = Array.isArray(obj["shadows"]) ? obj["shadows"] : [];
    for (const shadow of shadows) {
      if (!isSketchRecord(shadow)) continue;
      const simplified = simplifyShadow(shadow);
      if (simplified) {
        lines.push(`  shadow: ${simplified}`);
      }
    }

    tokens.push(lines.join("\n"));
  }

  const layers = Array.isArray(obj["layers"]) ? obj["layers"] : [];
  for (const child of layers) {
    if (isSketchRecord(child)) {
      walkObject(child, currentPath, tokens);
    }
  }
}

export function extractDesignTokens(sketchData: UnknownRecord): string {
  const tokens: string[] = [];

  const artboard = isSketchRecord(sketchData["artboard"]) ? sketchData["artboard"] : undefined;
  if (artboard && Array.isArray(artboard["layers"])) {
    for (const layer of artboard["layers"]) {
      if (isSketchRecord(layer)) {
        walkObject(layer, "", tokens);
      }
    }
  } else if (Array.isArray(sketchData["info"])) {
    for (const item of sketchData["info"]) {
      if (!isSketchRecord(item)) continue;
      walkObject(item, "", tokens);
      for (const value of Object.values(item)) {
        if (isSketchRecord(value)) {
          walkObject(value, "", tokens);
        } else if (Array.isArray(value)) {
          for (const nested of value) {
            if (isSketchRecord(nested)) {
              walkObject(nested, "", tokens);
            }
          }
        }
      }
    }
  }

  return tokens.length > 0 ? tokens.join("\n\n") : "";
}
