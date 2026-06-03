import { COMMON_CSS_FOR_DESIGN, UNITLESS_PROPERTIES } from "./constants.js";

function camelToKebab(value) {
  return value.replace(/([A-Z])/g, (_, ch) => `-${ch.toLowerCase()}`);
}

function formatCssValue(key, value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    if (value === 0) return "0";
    return UNITLESS_PROPERTIES.has(key) ? String(value) : `${value}px`;
  }
  if (typeof value === "string") {
    if (value.includes("rgba(")) {
      return value.replace(
        /rgba\(([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)\)/g,
        (_, r, g, b, a) => {
          const alpha = a.includes(".") ? parseFloat(a) : parseInt(a, 10);
          return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        },
      );
    }
    if (/^\d+$/.test(value) && !UNITLESS_PROPERTIES.has(key)) {
      return value === "0" ? "0" : `${value}px`;
    }
  }
  return String(value);
}

function mergePadding(styles) {
  const pt = styles.paddingTop;
  const pr = styles.paddingRight;
  const pb = styles.paddingBottom;
  const pl = styles.paddingLeft;

  if (pt !== undefined && pr !== undefined && pb !== undefined && pl !== undefined) {
    const ptVal = pt || 0;
    const prVal = pr || 0;
    const pbVal = pb || 0;
    const plVal = pl || 0;

    if (ptVal === pbVal && plVal === prVal) {
      styles.padding = ptVal === plVal ? `${ptVal}px` : `${ptVal}px ${prVal}px`;
    } else {
      styles.padding = `${ptVal}px ${prVal}px ${pbVal}px ${plVal}px`;
    }

    delete styles.paddingTop;
    delete styles.paddingRight;
    delete styles.paddingBottom;
    delete styles.paddingLeft;
  }
}

function mergeMargin(styles) {
  const mt = styles.marginTop;
  const mr = styles.marginRight;
  const mb = styles.marginBottom;
  const ml = styles.marginLeft;

  if (mt !== undefined || mr !== undefined || mb !== undefined || ml !== undefined) {
    const mtVal = mt || 0;
    const mrVal = mr || 0;
    const mbVal = mb || 0;
    const mlVal = ml || 0;

    if (!(mtVal === 0 && mrVal === 0 && mbVal === 0 && mlVal === 0)) {
      if (mtVal === mbVal && mlVal === mrVal) {
        styles.margin = mtVal === mlVal ? `${mtVal}px` : `${mtVal}px ${mrVal}px`;
      } else {
        styles.margin = `${mtVal}px ${mrVal}px ${mbVal}px ${mlVal}px`;
      }
    }

    delete styles.marginTop;
    delete styles.marginRight;
    delete styles.marginBottom;
    delete styles.marginLeft;
  }
}

function shouldUseFlex(node) {
  if (!node) return false;
  const nodeStyle = node.style || {};
  const nodeProps = node.props || {};
  const nodePropsStyle = nodeProps.style || {};
  const style = { ...nodeStyle, ...nodePropsStyle };
  return style.display === "flex" || style.flexDirection !== undefined;
}

function getFlexClasses(node) {
  const classes = [];
  if (!shouldUseFlex(node)) return classes;

  const nodeStyle = node.style || {};
  const nodeProps = node.props || {};
  const nodePropsStyle = nodeProps.style || {};
  const style = { ...nodeStyle, ...nodePropsStyle };
  const className = nodeProps.className || "";

  const flexDirection = style.flexDirection;
  if (flexDirection === "column" || className.includes("flex-col")) {
    classes.push("flex-col");
  } else if (flexDirection === "row" || className.includes("flex-row")) {
    classes.push("flex-row");
  }

  const justify =
    node.alignJustify?.justifyContent || style.justifyContent;
  if (justify === "space-between") classes.push("justify-between");
  else if (justify === "center") classes.push("justify-center");
  else if (justify === "flex-end") classes.push("justify-end");
  else if (justify === "flex-start") classes.push("justify-start");
  else if (justify === "space-around") classes.push("justify-around");
  else if (justify === "space-evenly") classes.push("justify-evenly");

  const align = node.alignJustify?.alignItems || style.alignItems;
  if (align === "flex-start") classes.push("align-start");
  else if (align === "center") classes.push("align-center");
  else if (align === "flex-end") classes.push("align-end");

  return classes;
}

function cleanStyles(node, flexClasses) {
  const nodeProps = node.props || {};
  const propsStyle = { ...(nodeProps.style || {}) };
  const styles = {};

  const standardJustify = new Set([
    "flex-start",
    "center",
    "flex-end",
    "space-between",
    "space-around",
    "space-evenly",
  ]);
  const standardAlign = new Set(["flex-start", "center", "flex-end"]);

  for (const [key, value] of Object.entries(propsStyle)) {
    if ((key === "display" || key === "flexDirection") && flexClasses.length) continue;
    if (key === "justifyContent" && flexClasses.length && standardJustify.has(value)) continue;
    if (key === "alignItems" && flexClasses.length && standardAlign.has(value)) continue;
    if (key === "position" && value === "static") continue;
    if (key === "overflow" && value === "visible") continue;
    styles[key] = value;
  }

  if (["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"].some((k) => k in styles)) {
    mergePadding(styles);
  }
  if (["marginTop", "marginRight", "marginBottom", "marginLeft"].some((k) => k in styles)) {
    mergeMargin(styles);
  }

  return styles;
}

function getLoopArr(node) {
  if (!node) return [];
  const arr = node.loop || node.loopData;
  return Array.isArray(arr) ? arr : [];
}

function generateCss(node, cssRules, loopSuffixes = null) {
  if (!node) return;

  const loopArr = node.loopType ? getLoopArr(node) : [];
  let suffixes = loopSuffixes;
  if (loopArr.length && !suffixes) {
    suffixes = loopArr.map((_, index) => String(index));
  }

  const nodeProps = node.props || {};
  const className = nodeProps.className;
  if (className) {
    const flexClasses = getFlexClasses(node);
    const styles = cleanStyles(node, flexClasses);
    const styleEntries = Object.entries(styles);
    let content = "";

    if (styleEntries.length || node.type === "lanhutext") {
      const cssProps = [];
      for (const [key, value] of styleEntries) {
        const cssValue = formatCssValue(key, value);
        if (cssValue) cssProps.push(`  ${camelToKebab(key)}: ${cssValue};`);
      }
      content = cssProps.join("\n");
    }

    if (suffixes) {
      for (const suffix of suffixes) {
        cssRules[`${className}-${suffix}`] = content;
      }
    } else {
      cssRules[className] = content;
    }
  }

  for (const child of node.children || []) {
    generateCss(child, cssRules, suffixes);
  }
}

function resolveLoopPlaceholder(value, loopItem) {
  if (!value || typeof loopItem !== "object") return value || "";
  const text = String(value).trim();
  const match = text.match(/^this\.item\.(\w+)$/);
  return match ? loopItem[match[1]] ?? "" : value;
}

function generateHtml(node, indent = 2, loopContext = null) {
  if (!node) return "";

  const loopItem = loopContext ? loopContext[0][loopContext[1]] : null;
  const loopIndex = loopContext ? loopContext[1] : null;
  const spaces = " ".repeat(indent);
  const flexClasses = getFlexClasses(node);
  const nodeProps = node.props || {};
  let className = nodeProps.className || "";
  if (loopIndex !== null && loopIndex !== undefined && className) {
    className = `${className}-${loopIndex}`;
  }
  const allClasses = [className, ...flexClasses].filter(Boolean).join(" ");
  const nodeType = node.type;

  if (nodeType === "lanhutext") {
    let text = node.data?.value || nodeProps.text || "";
    if (loopItem !== null && text && /^this\.item\.\w+$/.test(String(text).trim())) {
      text = resolveLoopPlaceholder(text, loopItem);
    } else if (text && /^this\.item\.\w+$/.test(String(text).trim())) {
      text = "";
    }
    return `${spaces}<span class="${allClasses}">${text}</span>`;
  }

  if (nodeType === "lanhuimage") {
    let src = node.data?.value || nodeProps.src || "";
    if (loopItem !== null && src && /^this\.item\.\w+$/.test(String(src).trim())) {
      src = resolveLoopPlaceholder(src, loopItem);
    } else if (src && /^this\.item\.\w+$/.test(String(src).trim())) {
      src = "";
    }
    return `${spaces}<img\n${spaces}  class="${allClasses}"\n${spaces}  referrerpolicy="no-referrer"\n${spaces}  src="${src}"\n${spaces}/>`;
  }

  if (nodeType === "lanhubutton") {
    const childrenHtml = (node.children || [])
      .map((child) => generateHtml(child, indent + 2, loopContext))
      .join("\n");
    return `${spaces}<button class="${allClasses}">\n${childrenHtml}\n${spaces}</button>`;
  }

  const tag = "div";
  const children = node.children || [];
  const loopArr = node.loopType ? getLoopArr(node) : [];

  if (loopArr.length && loopContext === null) {
    const parts = [];
    for (let i = 0; i < loopArr.length; i += 1) {
      const ctx = [loopArr, i];
      for (const child of children) {
        parts.push(generateHtml(child, indent + 2, ctx));
      }
    }
    return `${spaces}<${tag} class="${allClasses}">\n${parts.join("\n")}\n${spaces}</${tag}>`;
  }

  if (children.length) {
    const childrenHtml = children
      .map((child) => generateHtml(child, indent + 2, loopContext))
      .join("\n");
    return `${spaces}<${tag} class="${allClasses}">\n${childrenHtml}\n${spaces}</${tag}>`;
  }

  return `${spaces}<${tag} class="${allClasses}"></${tag}>`;
}

export function convertLanhuToHtml(jsonData) {
  const cssRules = {};
  generateCss(jsonData, cssRules);

  const cssParts = Object.entries(cssRules).map(([className, props]) =>
    props ? `.${className} {\n${props}\n}` : `.${className} {\n}`,
  );

  const cssString = `${cssParts.join("\n\n")}${COMMON_CSS_FOR_DESIGN}`;
  const bodyHtml = generateHtml(jsonData, 4);

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Document</title>
    <style>
${cssString}
    </style>
  </head>
  <body>
${bodyHtml}
  </body>
</html>`;
}

export function extractCss(html) {
  const match = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  return match ? match[1].trim() : "";
}

export function extractBody(html) {
  const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return match ? match[1].trim() : "";
}

export function minifyHtml(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/>\s+</g, "><")
    .replace(/\n\s*/g, " ")
    .trim();
}
