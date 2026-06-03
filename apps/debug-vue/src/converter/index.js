import {
  convertLanhuToHtml,
  extractBody,
  extractCss,
  minifyHtml,
} from "./lanhu-to-html.js";
import { localizeImageUrls } from "./localize-image-urls.js";

function nodeSnapshot(node) {
  if (!node) return null;
  const props = node.props || {};
  return {
    type: node.type,
    className: props.className,
    data: node.data,
    style: props.style || node.style,
    src: props.src,
  };
}

function collectSchemaStats(schema) {
  let total = 0;
  const byType = {};

  function walk(node) {
    if (!node) return;
    total += 1;
    const type = node.type || "unknown";
    byType[type] = (byType[type] || 0) + 1;
    for (const child of node.children || []) walk(child);
  }

  walk(schema);
  return { total, byType };
}

function extractCssClassNames(cssPreview) {
  return [...cssPreview.matchAll(/(\.[\w-]+)\s*\{/g)].map((match) => match[1].slice(1));
}

function findNodeByClassName(schema, className) {
  const props = schema.props || {};
  if (props.className === className) return schema;
  for (const child of schema.children || []) {
    const found = findNodeByClassName(child, className);
    if (found) return found;
  }
  return null;
}

function buildBeforePreview(schema, cssPreview) {
  const props = schema.props || {};
  const rootStyle = props.style || schema.style || {};
  const schemaText = JSON.stringify(schema, null, 2);
  const matchedNodes = extractCssClassNames(cssPreview).map((className) => ({
    className,
    node: nodeSnapshot(findNodeByClassName(schema, className)),
  }));

  return {
    stats: collectSchemaStats(schema),
    root: {
      type: schema.type,
      className: props.className,
      width: rootStyle.width,
      height: rootStyle.height,
    },
    matchedNodes,
    schemaPreview: schemaText.slice(0, 2500),
    schemaCharCount: schemaText.length,
  };
}

/**
 * 浏览器内直接转换 Schema，逻辑与 lanhu_mcp_server.convert_lanhu_to_html 对齐。
 */
export function convertLanhuSchema(schema, designName = "design") {
  if (!schema || typeof schema !== "object") {
    throw new Error("schema 必须是对象");
  }

  const htmlRaw = convertLanhuToHtml(schema);
  const { html: htmlLocalized, mapping } = localizeImageUrls(htmlRaw);
  const htmlFinal = minifyHtml(htmlLocalized);

  const css = extractCss(htmlRaw);
  const body = extractBody(htmlRaw);
  const cssRules = [...css.matchAll(/(\.[\w-]+\s*\{[^}]+\})/g)].map((match) => match[1]);
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
      mappingPreview: Object.fromEntries(Object.entries(mapping).slice(0, 8)),
      mapping,
    },
  };
}

export { convertLanhuToHtml, localizeImageUrls, minifyHtml };
