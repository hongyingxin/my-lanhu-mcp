import type { LanhuDesignSummary } from "../types.js";

/** 弯引号 → 直引号，对齐 PY `get_design_slices` / MCP 选稿 */
export function normalizeDesignQuotes(value: string): string {
  return value
    .replace(/\u201c/g, '"')
    .replace(/\u201d/g, '"')
    .replace(/\u2018/g, "'")
    .replace(/\u2019/g, "'");
}

export function pickDesign(
  designs: LanhuDesignSummary[],
  selector: string | undefined,
  preferredId?: string,
): LanhuDesignSummary {
  if (!designs.length) {
    throw new Error("蓝湖没有返回任何设计图");
  }

  if (!selector) {
    if (preferredId) {
      for (const design of designs) {
        if (design.id === preferredId) {
          return design;
        }
      }
    }
    return designs[0]!;
  }

  const trimmed = selector.trim();
  if (/^\d+$/.test(trimmed)) {
    const index = Number(trimmed);
    for (const design of designs) {
      if (design.index === index) {
        return design;
      }
    }
    throw new Error(`没有找到 index=${index} 的设计图`);
  }

  for (const design of designs) {
    if (design.id === trimmed || design.name === trimmed) {
      return design;
    }
  }

  const normalizedInput = normalizeDesignQuotes(trimmed);
  for (const design of designs) {
    if (design.name && normalizeDesignQuotes(design.name) === normalizedInput) {
      return design;
    }
  }

  const fuzzy = designs.filter((design) => (design.name || "").includes(trimmed));
  if (fuzzy.length === 1) {
    return fuzzy[0]!;
  }
  if (fuzzy.length > 1) {
    throw new Error(`匹配到多个设计图: ${fuzzy.map((d) => d.name).join(", ")}`);
  }

  throw new Error(`没有找到设计图: ${trimmed}`);
}

export type DesignSelector = string | string[] | undefined;

/**
 * 解析 `all`、多名称/序号、或单个 selector；去重按 design.id。
 */
export function pickDesigns(
  designs: LanhuDesignSummary[],
  selector: DesignSelector,
  preferredId?: string,
): LanhuDesignSummary[] {
  if (!designs.length) {
    throw new Error("蓝湖没有返回任何设计图");
  }

  if (selector === undefined || selector === null || selector === "") {
    return [pickDesign(designs, undefined, preferredId)];
  }

  if (typeof selector === "string" && selector.trim().toLowerCase() === "all") {
    return [...designs];
  }

  const requested = typeof selector === "string" ? [selector] : selector;
  const selected: LanhuDesignSummary[] = [];
  const seen = new Set<string>();

  for (const raw of requested) {
    const item = String(raw).trim();
    if (!item) {
      continue;
    }
    const design = pickDesign(designs, item, preferredId);
    if (seen.has(design.id)) {
      continue;
    }
    seen.add(design.id);
    selected.push(design);
  }

  if (!selected.length) {
    throw new Error("没有匹配到任何设计图");
  }

  return selected;
}
