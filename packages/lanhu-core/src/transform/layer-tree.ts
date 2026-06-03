/**
 * 从 Sketch JSON 提取图层树（Figma `artboard` + 蓝湖 PS `board`）。
 */
import type { UnknownRecord } from "../types.js";
import { isSketchRecord } from "./sketch-utils.js";

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

interface LayerStyle {
  fills?: Array<{ isEnabled?: boolean; color?: { value?: string }; gradient?: { type?: string } }>;
  borders?: Array<{ isEnabled?: boolean }>;
  shadows?: Array<{ isEnabled?: boolean }>;
}

interface TreeLayer {
  name?: string;
  type?: string;
  visible?: boolean;
  frame?: { width?: number; height?: number; x?: number; y?: number };
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  style?: LayerStyle;
  text?: { value?: string };
  textInfo?: { text?: string };
  layers?: TreeLayer[];
}

function layerBox(layer: TreeLayer): { w: number; h: number; x: number; y: number } {
  const frame = layer.frame ?? {};
  if (frame.width != null || frame.height != null) {
    return {
      w: asNumber(frame.width),
      h: asNumber(frame.height),
      x: asNumber(frame.x),
      y: asNumber(frame.y),
    };
  }
  return {
    w: asNumber(layer.width),
    h: asNumber(layer.height),
    x: asNumber(layer.left),
    y: asNumber(layer.top),
  };
}

export function extractLayerTree(sketch: UnknownRecord, maxDepth = 4): string {
  const lines: string[] = [];

  const formatStyleBrief = (style: LayerStyle): string => {
    const parts: string[] = [];
    const fills = Array.isArray(style.fills) ? style.fills : [];
    for (const fill of fills) {
      if (fill.isEnabled === false) continue;
      const color = fill.color ?? {};
      if (Object.keys(color).length > 0) {
        parts.push(`fill:${asString(color.value) || "rgba(?)"}`);
      }
      if (fill.gradient) {
        parts.push(`gradient:${asString(fill.gradient.type) || "linear"}`);
      }
    }
    const borders = Array.isArray(style.borders) ? style.borders : [];
    if (borders.some((border) => border.isEnabled !== false)) {
      parts.push(`border:${borders.length}`);
    }
    const shadows = Array.isArray(style.shadows) ? style.shadows : [];
    if (shadows.some((shadow) => shadow.isEnabled !== false)) {
      parts.push(`shadow:${shadows.length}`);
    }
    return parts.join(" ");
  };

  const walk = (layer: TreeLayer, depth = 0): void => {
    if (depth > maxDepth || layer.visible === false) {
      return;
    }
    const { w, h, x, y } = layerBox(layer);
    const type = asString(layer.type) || "?";
    const name = asString(layer.name) || "?";
    const sublayers = Array.isArray(layer.layers) ? layer.layers : [];
    const style = layer.style ?? {};
    let line = `${"  ".repeat(depth)}${type}: ${name} (${Math.round(w)}x${Math.round(h)} @${Math.round(x)},${Math.round(y)})`;

    if (type === "textLayer") {
      const rawValue = asString(layer.text?.value ?? layer.textInfo?.text);
      const clipped = rawValue.length > 40 ? `${rawValue.slice(0, 40)}...` : rawValue;
      if (clipped) {
        line += ` "${clipped}"`;
      }
    }

    const styleBrief = formatStyleBrief(style);
    if (styleBrief) {
      line += ` [${styleBrief}]`;
    }
    if (sublayers.length > 0) {
      line += ` (${sublayers.length} children)`;
    }
    lines.push(line);

    for (const child of sublayers) {
      walk(child, depth + 1);
    }
  };

  const artboardRaw = isSketchRecord(sketch["artboard"]) ? sketch["artboard"] : undefined;
  if (artboardRaw) {
    const artboard = artboardRaw as TreeLayer & { layers?: TreeLayer[] };
    const frame = artboard.frame ?? {};
    lines.push(
      `Artboard: ${asString(artboard.name) || "?"} (${Math.round(asNumber(frame.width))}x${Math.round(asNumber(frame.height))})`,
    );
    const layers = Array.isArray(artboard.layers) ? artboard.layers : [];
    lines.push(`Total layers: ${layers.length}`);
    lines.push("");
    for (const layer of layers) {
      walk(layer);
    }
    return lines.join("\n");
  }

  const boardRaw = isSketchRecord(sketch["board"]) ? sketch["board"] : undefined;
  if (boardRaw) {
    const board = boardRaw as TreeLayer & { layers?: TreeLayer[] };
    const boardMeta = isSketchRecord(boardRaw["artboard"]) ? boardRaw["artboard"] : {};
    const rect = isSketchRecord(boardMeta["artboardRect"]) ? boardMeta["artboardRect"] : {};
    const bw =
      "right" in rect && "left" in rect
        ? asNumber(rect["right"]) - asNumber(rect["left"])
        : asNumber(boardRaw["width"]);
    const bh =
      "bottom" in rect && "top" in rect
        ? asNumber(rect["bottom"]) - asNumber(rect["top"])
        : asNumber(boardRaw["height"]);
    lines.push(`Board: ${asString(board.name) || "?"} (${Math.round(bw)}x${Math.round(bh)})`);
    const layers = Array.isArray(board.layers) ? board.layers : [];
    lines.push(`Total layers: ${layers.length}`);
    lines.push("");
    for (const layer of layers) {
      walk(layer);
    }
    return lines.join("\n");
  }

  return "";
}
