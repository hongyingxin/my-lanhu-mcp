import { minifyHtml } from "./schema-to-html.js";
import { convertSketchToHtml, type SketchLayerAnnotation } from "./sketch-to-html.js";
import {
  resolveDesignImageUrl,
  resolveDesignScale,
} from "./sketch-utils.js";
import type { UnknownRecord } from "../types.js";

export interface ConvertSketchResult {
  ok: true;
  source: "sketch";
  after: {
    htmlFull: string;
    htmlLength: number;
    mapping: Record<string, string>;
    mappingCount: number;
    mappingPreview: Record<string, string>;
    layerAnnotations: SketchLayerAnnotation[];
    designScale: number;
  };
}

export function convertLanhuSketch(
  sketch: UnknownRecord,
  options: {
    designName?: string;
    designImageUrl?: string;
    designScale?: number;
  } = {},
): ConvertSketchResult {
  void options.designName;

  const designScale = options.designScale ?? resolveDesignScale(sketch);
  const designImgUrl = resolveDesignImageUrl(options.designImageUrl);
  const { html, imageUrlMapping, layerAnnotations } = convertSketchToHtml(
    sketch,
    designScale,
    designImgUrl,
  );
  const htmlFull = minifyHtml(html);
  const mapping = imageUrlMapping;

  return {
    ok: true,
    source: "sketch",
    after: {
      htmlFull,
      htmlLength: htmlFull.length,
      mapping,
      mappingCount: Object.keys(mapping).length,
      mappingPreview: Object.fromEntries(Object.entries(mapping).slice(0, 8)),
      layerAnnotations,
      designScale,
    },
  };
}

export { convertSketchToHtml, type SketchLayerAnnotation } from "./sketch-to-html.js";
export { extractDesignTokens } from "./design-tokens.js";
export { resolveDesignScale, resolveDesignImageUrl } from "./sketch-utils.js";
