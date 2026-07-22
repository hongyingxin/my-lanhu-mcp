import type { LanhuDesignSectorSummary, UnknownRecord } from "../types.js";

export type { LanhuDesignSectorSummary };

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

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

/** 规范化设计稿分组：分组路径 + image_id → 所属分组列表。 */
export function normalizeDesignSectors(
  sectors: UnknownRecord[],
): [LanhuDesignSectorSummary[], Map<string, LanhuDesignSectorSummary[]>] {
  const sectorById = new Map<string, UnknownRecord>();
  for (const sector of sectors) {
    if (!isRecord(sector)) {
      continue;
    }
    const sectorId = asString(sector["id"]);
    if (sectorId) {
      sectorById.set(sectorId, sector);
    }
  }

  const sectorPathCache = new Map<string, string>();

  function buildSectorPath(sectorId: string, trail = new Set<string>()): string {
    if (!sectorId) {
      return "";
    }
    const cached = sectorPathCache.get(sectorId);
    if (cached !== undefined) {
      return cached;
    }

    const sector = sectorById.get(sectorId) ?? {};
    const sectorName = asString(sector["name"]) ?? sectorId;
    const parentId = asString(sector["parent_id"]) ?? "";

    if (trail.has(sectorId)) {
      sectorPathCache.set(sectorId, sectorName);
      return sectorName;
    }

    let path = sectorName;
    if (parentId && sectorById.has(parentId)) {
      const parentPath = buildSectorPath(parentId, new Set(trail).add(sectorId));
      path = parentPath ? `${parentPath}/${sectorName}` : sectorName;
    }

    sectorPathCache.set(sectorId, path);
    return path;
  }

  const normalizedSectors: LanhuDesignSectorSummary[] = [];
  const imageSectorMap = new Map<string, LanhuDesignSectorSummary[]>();

  for (const sector of sectors) {
    if (!isRecord(sector)) {
      continue;
    }
    const sectorId = asString(sector["id"]);
    if (!sectorId) {
      continue;
    }

    const images = Array.isArray(sector["images"]) ? sector["images"] : [];
    const normalized: LanhuDesignSectorSummary = {
      id: sectorId,
      parentId: asString(sector["parent_id"]) ?? null,
      name: asString(sector["name"]),
      path: buildSectorPath(sectorId),
      order: asNumber(sector["order"]),
      imageCount: images.length,
    };
    normalizedSectors.push(normalized);

    for (const imageId of images) {
      const key = asString(imageId);
      if (!key) {
        continue;
      }
      const list = imageSectorMap.get(key) ?? [];
      list.push({ ...normalized });
      imageSectorMap.set(key, list);
    }
  }

  return [normalizedSectors, imageSectorMap];
}

export function sectorNamesForDesign(
  imageSectorMap: Map<string, LanhuDesignSectorSummary[]>,
  designId: string,
): string[] {
  const names: string[] = [];
  for (const sector of imageSectorMap.get(designId) ?? []) {
    if (sector.name) {
      names.push(sector.name);
    }
  }
  return names;
}

export function buildDesignListAiSuggestion(totalDesigns: number): {
  notice: string;
  recommendation: string;
  userPromptTemplate: string;
  languageNote: string;
} {
  return {
    notice: `This project contains ${totalDesigns} design images, which is quite a lot`,
    recommendation: "Ask user whether to download all designs or specific ones first.",
    userPromptTemplate:
      `该项目包含 ${totalDesigns} 个设计图。请选择：\n` +
      `1. 下载全部 ${totalDesigns} 个设计图（完整查看所有UI）\n` +
      "2. 下载关键设计图（请指定需要的设计图）",
    languageNote: "Respond in Chinese when talking to user",
  };
}
