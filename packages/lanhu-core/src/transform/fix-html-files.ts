import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import * as cheerio from "cheerio";

const MAPPING_SCRIPT = `
// 蓝湖Axure映射数据处理函数
function lanhu_Axure_Mapping_Data(data) {
    return data;
}
`;

function cleanBodyStyle(style: string): string | undefined {
  const cleaned = style
    .replace(/display\s*:\s*none\s*;?/gi, "")
    .replace(/opacity\s*:\s*0\s*;?/gi, "")
    .trim();
  return cleaned || undefined;
}

function fixHtmlContent(content: string): string {
  const $ = cheerio.load(content);

  $("img[data-src], script[data-src]").each((_, element) => {
    const tag = $(element);
    const dataSrc = tag.attr("data-src");
    if (dataSrc) {
      tag.attr("src", dataSrc);
      tag.removeAttr("data-src");
    }
  });

  $("link[data-src]").each((_, element) => {
    const tag = $(element);
    const dataSrc = tag.attr("data-src");
    if (dataSrc) {
      tag.attr("href", dataSrc);
      tag.removeAttr("data-src");
    }
  });

  const body = $("body");
  if (body.length > 0) {
    const style = body.attr("style");
    if (style) {
      const cleaned = cleanBodyStyle(style);
      if (cleaned) {
        body.attr("style", cleaned);
      } else {
        body.removeAttr("style");
      }
    }
  }

  $("script").each((_, element) => {
    const tag = $(element);
    const scriptText = tag.html() ?? "";
    if (scriptText.includes("alistatic.lanhuapp.com")) {
      tag.remove();
    }
  });

  const head = $("head");
  if (head.length > 0) {
    const mappingScript = $("<script></script>").text(MAPPING_SCRIPT);
    const firstScript = head.find("script").first();
    if (firstScript.length > 0) {
      firstScript.before(mappingScript);
    } else {
      head.append(mappingScript);
    }
  }

  return $.html();
}

/** 修复 Axure HTML 中的资源路径与脚本引用 */
export async function fixHtmlFiles(directory: string): Promise<number> {
  const entries = await readdir(directory, { withFileTypes: true });
  let fixedCount = 0;

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".html")) {
      continue;
    }

    const filePath = join(directory, entry.name);
    const content = await readFile(filePath, "utf8");
    const fixed = fixHtmlContent(content);
    if (fixed !== content) {
      await writeFile(filePath, fixed, "utf8");
    }
    fixedCount += 1;
  }

  return fixedCount;
}
