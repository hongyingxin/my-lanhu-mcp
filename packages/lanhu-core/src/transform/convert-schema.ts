import {
  convertLanhuToHtml,
  extractBody,
  extractCss,
  minifyHtml,
} from "./schema-to-html.js";
import { localizeImageUrls } from "./localize-image-urls.js";
import type { UnknownRecord } from "../types.js";

function nodeSnapshot(node: UnknownRecord | null): UnknownRecord | null {
  if (!node) return null;
  const props = (node["props"] as UnknownRecord | undefined) ?? {};
  return {
    type: node["type"],
    className: props["className"],
    data: node["data"],
    style: props["style"] ?? node["style"],
    src: props["src"],
  };
}

function collectSchemaStats(schema: UnknownRecord) {
  let total = 0;
  const byType: Record<string, number> = {};

  function walk(node: UnknownRecord | undefined): void {
    if (!node) return;
    total += 1;
    const type = String(node["type"] ?? "unknown");
    byType[type] = (byType[type] ?? 0) + 1;
    const children = node["children"];
    if (Array.isArray(children)) {
      for (const child of children) {
        if (child && typeof child === "object") {
          walk(child as UnknownRecord);
        }
      }
    }
  }

  walk(schema);
  return { total, byType };
}

function extractCssClassNames(cssPreview: string): string[] {
  return [...cssPreview.matchAll(/(\.[\w-]+)\s*\{/g)].map((match) => match[1]!.slice(1));
}

function findNodeByClassName(schema: UnknownRecord, className: string): UnknownRecord | null {
  const props = (schema["props"] as UnknownRecord | undefined) ?? {};
  if (props["className"] === className) return schema;
  const children = schema["children"];
  if (!Array.isArray(children)) return null;
  for (const child of children) {
    if (child && typeof child === "object") {
      const found = findNodeByClassName(child as UnknownRecord, className);
      if (found) return found;
    }
  }
  return null;
}

function buildBeforePreview(schema: UnknownRecord, cssPreview: string) {
  const props = (schema["props"] as UnknownRecord | undefined) ?? {};
  const rootStyle = (props["style"] as UnknownRecord | undefined) ?? (schema["style"] as UnknownRecord | undefined) ?? {};
  const schemaText = JSON.stringify(schema, null, 2);
  const matchedNodes = extractCssClassNames(cssPreview).map((className) => ({
    className,
    node: nodeSnapshot(findNodeByClassName(schema, className)),
  }));

  return {
    stats: collectSchemaStats(schema),
    root: {
      type: schema["type"],
      className: props["className"],
      width: rootStyle["width"],
      height: rootStyle["height"],
    },
    matchedNodes,
    schemaPreview: schemaText.slice(0, 2500),
    schemaCharCount: schemaText.length,
  };
}

export interface ConvertLanhuSchemaResult {
  ok: true;
  before: ReturnType<typeof buildBeforePreview>;
  after: {
    css: string;
    cssPreview: string;
    cssRuleCount: number;
    htmlBody: string;
    htmlBodyPreview: string;
    htmlPreviewDoc: string;
    htmlFull: string;
    htmlLength: number;
    mappingCount: number;
    mappingPreview: Record<string, string>;
    mapping: Record<string, string>;
  };
}

export function convertLanhuSchema(
  schema: UnknownRecord,
  designName = "design",
): ConvertLanhuSchemaResult {
  if (!schema || typeof schema !== "object") {
    throw new Error("schema 必须是对象");
  }

  void designName;

  const htmlRaw = convertLanhuToHtml(schema);
  const { html: htmlLocalized, mapping: rawMapping } = localizeImageUrls(htmlRaw);
  const mapping = rawMapping as Record<string, string>;
  const htmlFinal = minifyHtml(htmlLocalized);

  const css = extractCss(htmlRaw);
  const body = extractBody(htmlRaw);
  const cssRules = [...css.matchAll(/(\.[\w-]+\s*\{[^}]+\})/g)].map((match) => match[1]!);
  const cssPreview = cssRules.slice(0, 8).join("\n\n");

  return {
    ok: true,
    before: buildBeforePreview(schema, cssPreview),
    after: {
      css,
      cssPreview,
      cssRuleCount: cssRules.length,
      htmlBody: body,
      htmlBodyPreview: body.slice(0, 2500),
      htmlPreviewDoc: htmlRaw,
      htmlFull: htmlFinal,
      htmlLength: htmlFinal.length,
      mappingCount: Object.keys(mapping).length,
      mappingPreview: Object.fromEntries(Object.entries(mapping).slice(0, 8)) as Record<string, string>,
      mapping,
    },
  };
}

export { convertLanhuToHtml, localizeImageUrls, minifyHtml };
