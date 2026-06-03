/**
 * Sketch/PSD JSON → HTML+CSS（对标 lanhu-text-mcp `convert_sketch_to_html`）。
 */
import type { UnknownRecord } from "../types.js";
import { isSketchRecord } from "./sketch-utils.js";

export interface SketchLayerAnnotation {
  name: string;
  type: string;
  css: Record<string, string>;
  text?: string;
  slice_url?: string;
}

export interface ConvertSketchToHtmlResult {
  html: string;
  imageUrlMapping: Record<string, string>;
  layerAnnotations: SketchLayerAnnotation[];
}

function px(value: unknown, scale: number): number {
  if (value === null || value === undefined) {
    return 0;
  }
  return Math.round((Number(value) / scale) * 10) / 10;
}

function colorCss(color: unknown, opacity = 100): string | undefined {
  if (!isSketchRecord(color)) {
    return undefined;
  }
  if (typeof color["value"] === "string") {
    return color["value"];
  }
  const r = Math.round(Number(color["red"] ?? color["r"] ?? 0));
  const g = Math.round(Number(color["green"] ?? color["g"] ?? 0));
  const b = Math.round(Number(color["blue"] ?? color["b"] ?? 0));
  const a = opacity < 100 ? Math.round((opacity / 100) * 100) / 100 : 1;
  return a < 1 ? `rgba(${r},${g},${b},${a})` : `rgb(${r},${g},${b})`;
}

function getOpacity(layer: UnknownRecord): number {
  const blendOptions = isSketchRecord(layer["blendOptions"]) ? layer["blendOptions"] : {};
  if ("opacity" in blendOptions) {
    const op = blendOptions["opacity"];
    if (isSketchRecord(op)) {
      return Number(op["value"] ?? 100);
    }
    return Number(op ?? 100);
  }
  return 100;
}

function extractBorderRadius(layer: UnknownRecord, scale: number): string | undefined {
  const path = isSketchRecord(layer["path"]) ? layer["path"] : {};
  const comps = Array.isArray(path["pathComponents"]) ? path["pathComponents"] : [];
  if (comps.length === 0) {
    return undefined;
  }
  const origin = isSketchRecord(comps[0]?.["origin"]) ? comps[0]!["origin"] : {};
  const radii = origin["radii"];
  if (!Array.isArray(radii)) {
    return undefined;
  }
  const r = radii.map((value) => px(value, scale));
  if (new Set(r).size === 1 && r[0]! > 0) {
    return `${r[0]}px`;
  }
  if (r.some((value) => value > 0)) {
    return `${r[0]}px ${r[1]}px ${r[2]}px ${r[3]}px`;
  }
  return undefined;
}

function extractShadow(effects: UnknownRecord, scale: number): string | undefined {
  const shadows: string[] = [];
  for (const key of ["dropShadow", "innerShadow"] as const) {
    const fx = isSketchRecord(effects[key]) ? effects[key] : undefined;
    if (!fx || fx["enabled"] === false) {
      continue;
    }
    const c = isSketchRecord(fx["color"]) ? fx["color"] : {};
    let color = colorCss(c);
    if (!color) {
      continue;
    }
    const opObj = fx["opacity"];
    const opVal = isSketchRecord(opObj) ? Number(opObj["value"] ?? 100) : Number(opObj ?? 100);
    if (opVal < 100) {
      const r = Math.round(Number(c["red"] ?? c["r"] ?? 0));
      const g = Math.round(Number(c["green"] ?? c["g"] ?? 0));
      const b = Math.round(Number(c["blue"] ?? c["b"] ?? 0));
      color = `rgba(${r},${g},${b},${Math.round((opVal / 100) * 100) / 100})`;
    }

    const angleObj = fx["localLightingAngle"];
    const angleDeg = isSketchRecord(angleObj) ? Number(angleObj["value"] ?? 90) : 90;
    const angleRad = (angleDeg * Math.PI) / 180;
    const dist = px(fx["distance"] ?? 0, scale);
    const blur = px(fx["blur"] ?? 0, scale);
    const spread = px(fx["chokeMatte"] ?? 0, scale);
    const ox = Math.round(-dist * Math.cos(angleRad) * 10) / 10;
    const oy = Math.round(dist * Math.sin(angleRad) * 10) / 10;
    const inset = key === "innerShadow" ? "inset " : "";
    const spreadStr = spread ? ` ${spread}px` : "";
    shadows.push(`${inset}${ox}px ${oy}px ${blur}px${spreadStr} ${color}`);
  }
  return shadows.length > 0 ? shadows.join(",") : undefined;
}

function extractBorder(effects: UnknownRecord, scale: number): string | undefined {
  const stroke =
    (isSketchRecord(effects["frameFX"]) ? effects["frameFX"] : undefined) ??
    (isSketchRecord(effects["solidFill"]) ? effects["solidFill"] : undefined);
  if (!stroke || stroke["enabled"] === false) {
    return undefined;
  }
  const size = px(stroke["size"] ?? 1, scale);
  const c = isSketchRecord(stroke["color"]) ? stroke["color"] : {};
  const color = colorCss(c);
  return color ? `${size}px solid ${color}` : undefined;
}

function parseFontWeight(styleName: unknown): number | undefined {
  if (!styleName) {
    return undefined;
  }
  const match = String(styleName).match(/(\d+)/);
  return match ? Number(match[1]) : undefined;
}

function flattenLayers(sketchData: UnknownRecord, scale: number): {
  layers: UnknownRecord[];
  boardW: number;
  boardH: number;
} {
  const layers: UnknownRecord[] = [];
  let boardW = 375;
  let boardH = 667;

  const flatten = (layer: unknown, rawLayers: UnknownRecord[], artboardFormat: boolean): void => {
    if (!isSketchRecord(layer) || layer["visible"] === false) {
      return;
    }

    const lframe =
      (isSketchRecord(layer["frame"]) ? layer["frame"] : undefined) ??
      (isSketchRecord(layer["realFrame"]) ? layer["realFrame"] : undefined) ??
      {};
    const w = Number(lframe["width"] ?? layer["width"] ?? 0) || 0;
    const h = Number(lframe["height"] ?? layer["height"] ?? 0) || 0;

    if (w === 0 && h === 0) {
      const children = Array.isArray(layer["layers"]) ? layer["layers"] : [];
      for (const child of [...children].reverse()) {
        flatten(child, rawLayers, artboardFormat);
      }
      return;
    }

    const ltype = String(layer["type"] ?? "");
    const sectionTypes = artboardFormat
      ? new Set(["layerSection", "symbolInstence", "artboard"])
      : new Set(["layerSection"]);

    if (sectionTypes.has(ltype)) {
      const images = isSketchRecord(layer["images"]) ? layer["images"] : {};
      if (images["png_xxxhd"] || images["svg"]) {
        layers.push(layer);
      } else {
        const children = Array.isArray(layer["layers"]) ? layer["layers"] : [];
        for (const child of [...children].reverse()) {
          flatten(child, rawLayers, artboardFormat);
        }
      }
      return;
    }

    layers.push(layer);
  };

  if ("artboard" in sketchData) {
    const artboard = isSketchRecord(sketchData["artboard"]) ? sketchData["artboard"] : {};
    const artFrame =
      (isSketchRecord(artboard["frame"]) ? artboard["frame"] : undefined) ??
      (isSketchRecord(artboard["realFrame"]) ? artboard["realFrame"] : undefined) ??
      {};
    boardW = px(artFrame["width"] ?? 750, scale);
    boardH = px(artFrame["height"] ?? 1334, scale);
    const rawLayers = Array.isArray(artboard["layers"]) ? artboard["layers"] : [];
    for (const layer of [...rawLayers].reverse()) {
      flatten(layer, rawLayers, true);
    }
  } else if ("board" in sketchData) {
    const board = isSketchRecord(sketchData["board"]) ? sketchData["board"] : {};
    boardW = px(board["width"] ?? 750, scale);
    boardH = px(board["height"] ?? 1334, scale);
    const rawLayers = Array.isArray(board["layers"]) ? board["layers"] : [];
    for (const layer of [...rawLayers].reverse()) {
      flatten(layer, rawLayers, false);
    }
  }

  return { layers, boardW, boardH };
}

function extractArtboardShadow(effects: UnknownRecord, scale: number): string | undefined {
  const shadowsList = Array.isArray(effects["shadows"]) ? effects["shadows"] : [];
  const shadowParts: string[] = [];
  for (const shadow of shadowsList) {
    if (!isSketchRecord(shadow) || shadow["isEnabled"] === false) {
      continue;
    }
    const sc = isSketchRecord(shadow["color"]) ? shadow["color"] : {};
    const sColor =
      typeof sc["value"] === "string" ? sc["value"] : colorCss(sc);
    if (!sColor) {
      continue;
    }
    const sx = px(shadow["x"] ?? 0, scale);
    const sy = px(shadow["y"] ?? 0, scale);
    const sblur = px(shadow["blur"] ?? 0, scale);
    const sspread = px(shadow["spread"] ?? 0, scale);
    const inset = shadow["inset"] ? "inset " : "";
    const spreadStr = sspread ? ` ${sspread}px` : "";
    shadowParts.push(`${inset}${sx}px ${sy}px ${sblur}px${spreadStr} ${sColor}`);
  }
  return shadowParts.length > 0 ? shadowParts.join(",") : undefined;
}

function extractArtboardBorder(effects: UnknownRecord, scale: number): string | undefined {
  const bordersList = Array.isArray(effects["borders"]) ? effects["borders"] : [];
  for (const border of bordersList) {
    if (!isSketchRecord(border) || border["isEnabled"] === false) {
      continue;
    }
    const bsize = px(border["size"] ?? 1, scale);
    const bc = isSketchRecord(border["color"]) ? border["color"] : {};
    const bColor = typeof bc["value"] === "string" ? bc["value"] : colorCss(bc);
    if (bColor) {
      return `${bsize}px solid ${bColor}`;
    }
  }
  return undefined;
}

function appendTextLayerBoard(
  L: UnknownRecord,
  ti: UnknownRecord,
  opacity: number,
  scale: number,
  props: string[],
  annot: SketchLayerAnnotation,
): string {
  const textContent = String(ti["text"] ?? "");
  annot.text = textContent;
  props.push("z-index:10");

  const textColor = colorCss(ti["color"], opacity);
  if (textColor) {
    props.push(`color:${textColor}`);
    annot.css["color"] = textColor;
  }

  const fontSize = px(ti["size"] ?? 0, scale);
  if (fontSize) {
    props.push(`font-size:${fontSize}px`);
    annot.css["font-size"] = `${fontSize}px`;
  }

  const fontName = String(ti["fontPostScriptName"] ?? ti["fontName"] ?? "");
  if (fontName) {
    props.push(
      `font-family:"${fontName}","PingFang SC","Microsoft YaHei","Hiragino Sans GB",sans-serif`,
    );
    annot.css["font-family"] = fontName;
  }

  const fontStyleName = ti["fontStyleName"];
  const fw = parseFontWeight(fontStyleName);
  if (fw) {
    props.push(`font-weight:${fw}`);
    annot.css["font-weight"] = String(fw);
  } else if (fontStyleName) {
    annot.css["font-weight"] = String(fontStyleName);
  }
  if (ti["bold"] && !fw) {
    props.push("font-weight:bold");
  }
  if (ti["italic"]) {
    props.push("font-style:italic");
  }

  const just = String(ti["justification"] ?? "left");
  if (just !== "left") {
    props.push(`text-align:${just}`);
    annot.css["text-align"] = just;
  }

  const lines = textContent.split("\r").filter(Boolean);
  const lineCount = Math.max(lines.length, 1);
  const h = px(
    (isSketchRecord(L["frame"]) ? L["frame"] : {})["height"] ?? L["height"] ?? 0,
    scale,
  );
  if (lineCount > 1 && h > 0 && fontSize > 0) {
    const lh = Math.round((h / lineCount) * 10) / 10;
    props.push(`line-height:${lh}px`);
  } else {
    props.push("line-height:1");
  }
  props.push("white-space:pre-wrap", "overflow:hidden", "word-break:break-all");
  return textContent;
}

function appendTextLayerArtboard(
  L: UnknownRecord,
  artText: UnknownRecord,
  scale: number,
  props: string[],
  annot: SketchLayerAnnotation,
): string {
  const textContent = String(artText["value"] ?? "");
  annot.text = textContent;
  props.push("z-index:10");

  const artStyle = isSketchRecord(artText["style"]) ? artText["style"] : {};
  const artColor = isSketchRecord(artStyle["color"]) ? artStyle["color"] : {};
  if (typeof artColor["value"] === "string") {
    props.push(`color:${artColor["value"]}`);
    annot.css["color"] = artColor["value"];
  }

  const artFont = isSketchRecord(artStyle["font"]) ? artStyle["font"] : {};
  const fontSize = px(artFont["size"] ?? 0, scale);
  if (fontSize) {
    props.push(`font-size:${fontSize}px`);
    annot.css["font-size"] = `${fontSize}px`;
  }

  const fontPsName = String(artFont["postScriptName"] ?? "");
  const fontName = String(artFont["name"] ?? "") || fontPsName;
  if (fontName) {
    props.push(
      `font-family:"${fontName}","PingFang SC","Microsoft YaHei","Hiragino Sans GB",sans-serif`,
    );
    annot.css["font-family"] = fontName;
  }

  const fontWeight = Number(artFont["fontWeight"] ?? 0);
  if (fontWeight) {
    props.push(`font-weight:${fontWeight}`);
    annot.css["font-weight"] = String(fontWeight);
  }
  const fontType = artFont["type"];
  const fw = parseFontWeight(fontType);
  if (fw && !fontWeight) {
    props.push(`font-weight:${fw}`);
    annot.css["font-weight"] = String(fw);
  }

  const align = String(artFont["align"] ?? "left");
  if (align && align !== "left") {
    props.push(`text-align:${align}`);
    annot.css["text-align"] = align;
  }

  const lineHeight = artFont["lineHeight"];
  const lhPx =
    isSketchRecord(lineHeight) && lineHeight["value"] !== undefined
      ? px(lineHeight["value"], scale)
      : 0;
  props.push(lhPx ? `line-height:${lhPx}px` : "line-height:1");
  props.push("white-space:pre-wrap", "overflow:hidden", "word-break:break-all");
  return textContent;
}

export function convertSketchToHtml(
  sketchData: UnknownRecord,
  designScale = 2,
  designImgUrl = "",
): ConvertSketchToHtmlResult {
  const scale = designScale || 2;
  const { layers, boardW, boardH } = flattenLayers(sketchData, scale);

  const cssRules: string[] = [];
  const htmlParts: string[] = [];
  const imageUrlMapping: Record<string, string> = {};
  const layerAnnotations: SketchLayerAnnotation[] = [];

  for (const [idx, L] of layers.entries()) {
    const cls = `el${idx + 1}`;
    const ltype = String(L["type"] ?? "");
    const name = String(L["name"] ?? "");
    const lframe =
      (isSketchRecord(L["frame"]) ? L["frame"] : undefined) ??
      (isSketchRecord(L["realFrame"]) ? L["realFrame"] : undefined) ??
      {};
    const left = px(lframe["left"] ?? L["left"] ?? 0, scale);
    const top = px(lframe["top"] ?? L["top"] ?? 0, scale);
    const w = px(lframe["width"] ?? L["width"] ?? 0, scale);
    const h = px(lframe["height"] ?? L["height"] ?? 0, scale);

    const opacity = getOpacity(L);
    const effects =
      (isSketchRecord(L["layerEffects"]) ? L["layerEffects"] : undefined) ??
      (isSketchRecord(L["style"]) ? L["style"] : undefined) ??
      {};

    const annot: SketchLayerAnnotation = {
      name,
      type: ltype,
      css: {
        position: "absolute",
        left: `${left}px`,
        top: `${top}px`,
        width: `${w}px`,
        height: `${h}px`,
      },
    };

    const props = [
      "position:absolute",
      `left:${left}px`,
      `top:${top}px`,
      `width:${w}px`,
      `height:${h}px`,
    ];

    if (opacity < 100) {
      const opCss = Math.round((opacity / 100) * 100) / 100;
      props.push(`opacity:${opCss}`);
      annot.css["opacity"] = String(opCss);
    }

    const br = extractBorderRadius(L, scale);
    if (br) {
      props.push(`border-radius:${br}`, "overflow:hidden");
      annot.css["border-radius"] = br;
    }

    let shadow = extractShadow(effects, scale) ?? extractArtboardShadow(effects, scale);
    if (shadow) {
      annot.css["box-shadow"] = shadow;
      props.push(`box-shadow:${shadow}`);
    }

    let border = extractBorder(effects, scale) ?? extractArtboardBorder(effects, scale);
    if (border) {
      annot.css["border"] = border;
      props.push(`border:${border}`);
    }

    let textContent = "";
    let isSlice = false;
    let sliceUrl = "";

    const images = isSketchRecord(L["images"]) ? L["images"] : {};
    if (images["png_xxxhd"] || images["svg"]) {
      isSlice = true;
      sliceUrl = String(images["png_xxxhd"] ?? images["svg"] ?? "");
      const localName = `${name.replace(/\//g, "_").replace(/ /g, "_")}.png`;
      const localPath = `./assets/slices/${localName}`;
      imageUrlMapping[localPath] = sliceUrl;
      annot.slice_url = sliceUrl;
    }

    if (ltype === "textLayer" && (L["textInfo"] || L["text"])) {
      const ti = isSketchRecord(L["textInfo"]) ? L["textInfo"] : undefined;
      const artText = isSketchRecord(L["text"]) ? L["text"] : undefined;
      if (ti) {
        textContent = appendTextLayerBoard(L, ti, opacity, scale, props, annot);
      } else if (artText) {
        textContent = appendTextLayerArtboard(L, artText, scale, props, annot);
      }
    } else if (isSlice) {
      props.push("z-index:5");
    } else {
      const fill = isSketchRecord(L["fill"]) ? L["fill"] : {};
      let fillColor = colorCss(isSketchRecord(fill["color"]) ? fill["color"] : undefined, opacity);
      if (!fillColor && isSketchRecord(effects)) {
        const fills = Array.isArray(effects["fills"]) ? effects["fills"] : [];
        for (const fItem of fills) {
          if (!isSketchRecord(fItem) || fItem["isEnabled"] === false || fItem["type"] !== "color") {
            continue;
          }
          const fc = isSketchRecord(fItem["color"]) ? fItem["color"] : {};
          if (typeof fc["value"] === "string") {
            fillColor = fc["value"];
            break;
          }
          fillColor = colorCss(fc, opacity);
          if (fillColor) {
            break;
          }
        }
      }
      if (fillColor) {
        annot.css["background-color"] = fillColor;
        props.push(`background-color:${fillColor}`);
      }
    }

    cssRules.push(`.${cls}{${props.join(";")}}`);

    const safeName = name.replace(/"/g, "&quot;");
    const cssData = Object.entries(annot.css)
      .map(([key, value]) => `${key}: ${value}`)
      .join("; ");
    const safeCss = cssData.replace(/"/g, "&quot;");

    if (textContent) {
      const safeText = textContent
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\r/g, "\n");
      htmlParts.push(
        `<div class="${cls}" title="${safeName}" data-css="${safeCss}">${safeText}</div>`,
      );
    } else if (isSlice) {
      htmlParts.push(
        `<img class="${cls}" title="${safeName}" data-css="${safeCss}" src="${sliceUrl}" referrerpolicy="no-referrer" />`,
      );
    } else {
      htmlParts.push(`<div class="${cls}" title="${safeName}" data-css="${safeCss}"></div>`);
    }

    layerAnnotations.push(annot);
  }

  const backgroundStyle = designImgUrl
    ? `;background:url(${designImgUrl}) no-repeat;background-size:${boardW}px ${boardH}px`
    : "";

  const html =
    `<!DOCTYPE html><html><head><meta charset="UTF-8">` +
    `<meta name="referrer" content="no-referrer">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1.0">` +
    `<title>Design</title><style>` +
    `*{margin:0;padding:0;box-sizing:border-box}img{display:block}` +
    `.design{position:relative;width:${boardW}px;height:${boardH}px;overflow:hidden;margin:0 auto${backgroundStyle}}` +
    `\n${cssRules.join("\n")}` +
    `</style></head><body><div class="design">\n` +
    `${htmlParts.join("\n")}\n` +
    `</div></body></html>`;

  return { html, imageUrlMapping, layerAnnotations };
}
