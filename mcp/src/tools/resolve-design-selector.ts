import type { DesignSelector, LanhuDesignListResult, LanhuUrlParams } from "@lanhu/core";

export type DesignSelectorResolvedFrom = "explicit" | "url.image_id" | "single_design";

export type AvailableDesignSummary = {
  index: number;
  id: string;
  name: string;
};

export type ResolveDesignSelectorResult =
  | {
      ok: true;
      selector: DesignSelector;
      resolvedFrom: DesignSelectorResolvedFrom;
    }
  | {
      ok: false;
      message: string;
      hint: string;
      autoSelectable: boolean;
      availableDesigns: AvailableDesignSummary[];
    };

function normalizeDesignNames(designNames: string | string[]): DesignSelector {
  if (typeof designNames === "string") {
    return designNames;
  }
  if (designNames.length === 1) {
    return designNames[0]!;
  }
  return designNames.map(String);
}

function hasDesignNames(designNames: string | string[] | undefined): boolean {
  if (designNames === undefined || designNames === null) {
    return false;
  }
  if (typeof designNames === "string") {
    return designNames.trim().length > 0;
  }
  return designNames.some((item) => String(item).trim().length > 0);
}

function mapAvailableDesigns(
  designs: LanhuDesignListResult["designs"],
): AvailableDesignSummary[] {
  return designs.map((design) => ({
    index: design.index,
    id: design.id,
    name: design.name,
  }));
}

/**
 * Resolve which design(s) to analyze.
 * Explicit design_names wins; otherwise infer from URL image_id or a single-design list.
 */
export function resolveDesignSelector(
  designNames: string | string[] | undefined,
  parsed: Pick<LanhuUrlParams, "imageId" | "docId">,
  listResult: Pick<LanhuDesignListResult, "designs" | "totalDesigns">,
): ResolveDesignSelectorResult {
  const availableDesigns = mapAvailableDesigns(listResult.designs);

  if (hasDesignNames(designNames)) {
    return {
      ok: true,
      selector: normalizeDesignNames(designNames as string | string[]),
      resolvedFrom: "explicit",
    };
  }

  const imageId = parsed.imageId ?? parsed.docId;
  if (imageId) {
    return {
      ok: true,
      selector: imageId,
      resolvedFrom: "url.image_id",
    };
  }

  if (listResult.totalDesigns === 1 && listResult.designs[0]) {
    return {
      ok: true,
      selector: listResult.designs[0].id,
      resolvedFrom: "single_design",
    };
  }

  const hintParts = [
    "stage 全项目链接须传 design_names（画板名 / 序号 / id / 'all'），或先 mode=list 查看 designs[]。",
  ];
  if (listResult.totalDesigns > 1) {
    hintParts.push(`当前共 ${listResult.totalDesigns} 张设计稿，无法自动选择。`);
  }

  return {
    ok: false,
    message:
      "design_names is required when the URL has no image_id and the project has multiple designs.",
    hint: hintParts.join(" "),
    autoSelectable: false,
    availableDesigns,
  };
}
