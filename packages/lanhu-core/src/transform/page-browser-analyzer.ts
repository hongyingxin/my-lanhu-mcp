/// <reference lib="dom" />
import { createServer, type Server } from "node:http";
import { existsSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

import { chromium, type Page } from "playwright";

import type { PageDesignInfo } from "./page-static-extractor.js";

const CACHE_META_FILE = ".screenshot_cache.json";
const DEFAULT_VIEWPORT_WIDTH = Number(process.env["VIEWPORT_WIDTH"] ?? "1920");
const DEFAULT_VIEWPORT_HEIGHT = Number(process.env["VIEWPORT_HEIGHT"] ?? "1080");

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".json": "application/json; charset=utf-8",
};

export interface RenderPrototypePageResult {
  page_name: string;
  success: boolean;
  screenshot_path?: string;
  page_text?: string;
  page_design_info?: PageDesignInfo;
  size?: string;
  from_cache?: boolean;
  error?: string;
}

export interface RenderPrototypePagesOptions {
  versionId?: string;
  captureScreenshot?: boolean;
  viewportWidth?: number;
  viewportHeight?: number;
}

interface ScreenshotCacheMeta {
  version_id?: string;
  cached_pages?: string[];
}

function extractPageTextInBrowser(): string {
  const sections: string[] = [];

  const redTexts = Array.from(document.querySelectorAll("*")).filter((el) => {
    const style = window.getComputedStyle(el);
    const color = style.color;
    return (
      color &&
      (color.includes("rgb(255, 0, 0)") ||
        color.includes("rgb(255,0,0)") ||
        color === "red")
    );
  });

  if (redTexts.length > 0) {
    const redContent = redTexts
      .map((el) => el.textContent?.trim() ?? "")
      .filter((text) => text.length > 0 && text.length < 200)
      .filter((value, index, array) => array.indexOf(value) === index);
    if (redContent.length > 0) {
      sections.push(`[Important Tips/Warnings]\n${redContent.join("\n")}`);
    }
  }

  const axureShapes = document.querySelectorAll('[id^="u"], .ax_shape, .shape, [class*="shape"]');
  const shapeTexts: string[] = [];
  axureShapes.forEach((el) => {
    const text = el.textContent?.trim() ?? "";
    if (text && text.length > 0 && text.length < 100) {
      shapeTexts.push(text);
    }
  });

  if (shapeTexts.length > 5) {
    const uniqueShapes = [...new Set(shapeTexts)];
    sections.push(`[Flowchart/Component Text]\n${uniqueShapes.slice(0, 20).join(" | ")}`);
  }

  const bodyText = document.body?.innerText ?? "";
  if (bodyText.trim()) {
    sections.push(`[Full Page Text]\n${bodyText.trim()}`);
  }

  if (sections.length === 0) {
    return "⚠️ Page text is empty or cannot be extracted (please refer to visual output)";
  }

  return sections.join("\n\n");
}

function extractPageDesignInfoInBrowser(): PageDesignInfo {
  const allEls = document.querySelectorAll("*");
  const textColors: Record<string, number> = {};
  const bgColors: Record<string, number> = {};
  const fontSpecs: Record<string, number> = {};
  const images: PageDesignInfo["images"] = [];

  allEls.forEach((el) => {
    const cs = window.getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") {
      return;
    }
    const rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) {
      return;
    }

    const hasDirectText = Array.from(el.childNodes).some(
      (node) => node.nodeType === 3 && (node.textContent?.trim().length ?? 0) > 0,
    );
    if (hasDirectText) {
      const color = cs.color;
      if (color) {
        textColors[color] = (textColors[color] ?? 0) + 1;
      }
      const key = `${cs.fontSize}|${cs.fontWeight}|${color}`;
      fontSpecs[key] = (fontSpecs[key] ?? 0) + 1;
    }

    const bg = cs.backgroundColor;
    if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") {
      bgColors[bg] = (bgColors[bg] ?? 0) + 1;
    }

    const bgImg = cs.backgroundImage;
    if (bgImg && bgImg !== "none") {
      const match = bgImg.match(/url\("?([^")]*?)"?\)/);
      if (match?.[1] && !match[1].startsWith("data:")) {
        images.push({
          src: match[1],
          type: "bg",
          w: String(Math.round(rect.width)),
          h: String(Math.round(rect.height)),
        });
      }
    }
  });

  document.querySelectorAll("img").forEach((img) => {
    if (img.src && img.naturalWidth > 0 && !img.src.startsWith("data:")) {
      images.push({
        src: img.src,
        type: "img",
        w: String(img.naturalWidth),
        h: String(img.naturalHeight),
      });
    }
  });

  const sortObj = (obj: Record<string, number>) =>
    Object.entries(obj)
      .sort((left, right) => right[1] - left[1])
      .map(([value, count]) => [value, count] as [string, number]);

  return {
    textColors: sortObj(textColors).slice(0, 15),
    bgColors: sortObj(bgColors).slice(0, 10),
    fontSpecs: sortObj(fontSpecs).slice(0, 15),
    images: images.slice(0, 30),
  };
}

function isValidCachedText(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length > 0 && trimmed !== "undefined";
}

function isValidCachedDesignInfo(info: PageDesignInfo | undefined): info is PageDesignInfo {
  return Boolean(info && Array.isArray(info.textColors) && Array.isArray(info.fontSpecs));
}

function pageOutputBaseName(pageName: string): string {
  // 与 Axure HTML 文件名 stem 一致，仅去掉文件系统非法字符
  return pageName.replace(/[/\\:*?"<>|\0]/g, "_");
}

/** @deprecated 旧版会把中文替换成 `_`，多页会冲突；仅用于读取历史缓存 */
function legacySafePageFileName(pageName: string): string {
  return pageName.replace(/[^\w\s-]/g, "_");
}

interface PageArtifactPaths {
  screenshot: string;
  text: string;
  styles: string;
}

function pageArtifactPaths(outputDir: string, pageName: string): PageArtifactPaths {
  const baseName = pageOutputBaseName(pageName);
  return {
    screenshot: join(outputDir, `${baseName}.png`),
    text: join(outputDir, `${baseName}.txt`),
    styles: join(outputDir, `${baseName}_styles.json`),
  };
}

function resolvePageArtifactPaths(outputDir: string, pageName: string): PageArtifactPaths {
  const paths = pageArtifactPaths(outputDir, pageName);

  if (existsSync(paths.text)) {
    return paths;
  }

  const legacyBase = legacySafePageFileName(pageName);
  if (legacyBase === pageOutputBaseName(pageName)) {
    return paths;
  }

  const legacyPaths: PageArtifactPaths = {
    screenshot: join(outputDir, `${legacyBase}.png`),
    text: join(outputDir, `${legacyBase}.txt`),
    styles: join(outputDir, `${legacyBase}_styles.json`),
  };
  if (existsSync(legacyPaths.text)) {
    return legacyPaths;
  }

  return paths;
}

function resolveHtmlFileName(resourceDir: string, pageName: string): string | null {
  const directPath = join(resourceDir, `${pageName}.html`);
  if (existsSync(directPath)) {
    return `${pageName}.html`;
  }

  return null;
}

async function loadScreenshotCache(outputDir: string): Promise<ScreenshotCacheMeta> {
  const cachePath = join(outputDir, CACHE_META_FILE);
  if (!existsSync(cachePath)) {
    return {};
  }

  try {
    const content = await readFile(cachePath, "utf8");
    const parsed = JSON.parse(content) as ScreenshotCacheMeta;
    return parsed ?? {};
  } catch {
    return {};
  }
}

async function saveScreenshotCache(outputDir: string, meta: ScreenshotCacheMeta): Promise<void> {
  await writeFile(join(outputDir, CACHE_META_FILE), `${JSON.stringify(meta, null, 2)}\n`, "utf8");
}

async function startStaticServer(rootDir: string): Promise<{ port: number; close: () => Promise<void> }> {
  const absRoot = resolve(rootDir);
  let server: Server | undefined;

  const close = async (): Promise<void> => {
    if (!server) {
      return;
    }

    await new Promise<void>((resolveClose, rejectClose) => {
      server?.close((error) => {
        if (error) {
          rejectClose(error);
          return;
        }
        resolveClose();
      });
    });
  };

  return new Promise((resolveServer, rejectServer) => {
    server = createServer(async (request, response) => {
      try {
        const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
        const relativePath = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, "") || "index.html";
        const filePath = resolve(absRoot, relativePath);

        if (!filePath.startsWith(absRoot)) {
          response.writeHead(403);
          response.end("Forbidden");
          return;
        }

        if (!existsSync(filePath)) {
          response.writeHead(404);
          response.end("Not Found");
          return;
        }

        const bytes = await readFile(filePath);
        const mimeType = MIME_TYPES[extname(filePath).toLowerCase()] ?? "application/octet-stream";
        response.writeHead(200, { "Content-Type": mimeType });
        response.end(bytes);
      } catch {
        response.writeHead(500);
        response.end("Internal Server Error");
      }
    });

    server.on("error", rejectServer);
    server.listen(0, "127.0.0.1", () => {
      const address = server?.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolveServer({ port, close });
    });
  });
}

async function renderSinglePage(
  page: Page,
  port: number,
  resourceDir: string,
  pageName: string,
  outputDir: string,
  captureScreenshot: boolean,
): Promise<RenderPrototypePageResult> {
  const htmlFile = resolveHtmlFileName(resourceDir, pageName);
  if (!htmlFile) {
    return {
      page_name: pageName,
      success: false,
      error: `Page ${pageName} does not exist`,
    };
  }

  const pageUrl = `http://127.0.0.1:${port}/${htmlFile}`;
  await page.goto(pageUrl, { waitUntil: "networkidle", timeout: 30_000 });
  await page.waitForTimeout(2_000);

  const pageText = await page.evaluate(extractPageTextInBrowser);
  const pageDesignInfo = await page.evaluate(extractPageDesignInfoInBrowser);

  const { screenshot: screenshotPath, text: textPath, styles: stylesPath } = pageArtifactPaths(
    outputDir,
    pageName,
  );

  let screenshotBytes: Buffer | undefined;
  if (captureScreenshot) {
    screenshotBytes = await page.screenshot({ fullPage: true });
    await writeFile(screenshotPath, screenshotBytes);
  }

  await writeFile(textPath, pageText, "utf8");
  await writeFile(stylesPath, `${JSON.stringify(pageDesignInfo, null, 2)}\n`, "utf8");

  return {
    page_name: pageName,
    success: true,
    screenshot_path: captureScreenshot ? screenshotPath : undefined,
    page_text: pageText,
    page_design_info: pageDesignInfo,
    size: screenshotBytes ? `${(screenshotBytes.length / 1024).toFixed(1)}KB` : undefined,
    from_cache: false,
  };
}

/** 浏览器渲染原型页并提取文本/样式/截图 */
export async function renderPrototypePages(
  resourceDir: string,
  pageNames: string[],
  outputDir: string,
  options: RenderPrototypePagesOptions = {},
): Promise<RenderPrototypePageResult[]> {
  const captureScreenshot = options.captureScreenshot ?? true;
  const versionId = options.versionId;
  const viewportWidth = options.viewportWidth ?? DEFAULT_VIEWPORT_WIDTH;
  const viewportHeight = options.viewportHeight ?? DEFAULT_VIEWPORT_HEIGHT;

  await mkdir(outputDir, { recursive: true });

  const cacheMeta = await loadScreenshotCache(outputDir);
  const cachedVersion = cacheMeta.version_id;
  const cachedPages = new Set(cacheMeta.cached_pages ?? []);
  const pagesToRender: string[] = [];
  const results: RenderPrototypePageResult[] = [];

  for (const pageName of pageNames) {
    const { screenshot: screenshotFile, text: textFile, styles: stylesFile } = resolvePageArtifactPaths(
      outputDir,
      pageName,
    );

    const isListedInCache = cachedPages.has(pageName);
    const canUseCache =
      versionId &&
      cachedVersion === versionId &&
      isListedInCache &&
      existsSync(textFile) &&
      (!captureScreenshot || existsSync(screenshotFile));

    if (canUseCache) {
      let pageText = "";
      try {
        pageText = await readFile(textFile, "utf8");
      } catch {
        pageText = "";
      }

      let pageDesignInfo: PageDesignInfo | undefined;
      if (existsSync(stylesFile)) {
        try {
          pageDesignInfo = JSON.parse(await readFile(stylesFile, "utf8")) as PageDesignInfo;
        } catch {
          pageDesignInfo = undefined;
        }
      }

      if (!isValidCachedText(pageText) || !isValidCachedDesignInfo(pageDesignInfo)) {
        pagesToRender.push(pageName);
        continue;
      }

      let size: string | undefined;
      if (captureScreenshot && existsSync(screenshotFile)) {
        size = `${(statSync(screenshotFile).size / 1024).toFixed(1)}KB`;
      }

      results.push({
        page_name: pageName,
        success: true,
        screenshot_path: captureScreenshot ? screenshotFile : undefined,
        page_text: pageText || "(Cached result)",
        page_design_info: pageDesignInfo,
        size,
        from_cache: true,
      });
      continue;
    }

    pagesToRender.push(pageName);
  }

  if (pagesToRender.length === 0) {
    return results;
  }

  const staticServer = await startStaticServer(resourceDir);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: viewportWidth, height: viewportHeight },
  });

  try {
    for (const pageName of pagesToRender) {
      try {
        const rendered = await renderSinglePage(
          page,
          staticServer.port,
          resourceDir,
          pageName,
          outputDir,
          captureScreenshot,
        );
        results.push(rendered);
      } catch (error) {
        results.push({
          page_name: pageName,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } finally {
    await page.close();
    await browser.close();
    await staticServer.close();
  }

  if (versionId) {
    const newlyCached = results.filter((item) => item.success).map((item) => item.page_name);
    await saveScreenshotCache(outputDir, {
      version_id: versionId,
      cached_pages: [...new Set([...cachedPages, ...newlyCached])],
    });
  }

  return results;
}
