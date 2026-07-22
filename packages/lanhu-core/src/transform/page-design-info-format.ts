import { existsSync } from "node:fs";
import { join } from "node:path";

import type { PageDesignInfo } from "./page-static-extractor.js";

/** 格式化页面设计信息为可读文本 */
export function formatPageDesignInfo(designInfo: PageDesignInfo | undefined, resourceDir = ""): string {
  if (!designInfo) {
    return "";
  }

  const lines = ["[设计样式参考 - 用于生成代码时匹配原型视觉效果]"];

  if (designInfo.textColors.length > 0) {
    lines.push("  文字颜色 (按使用频率):");
    for (const [colorVal, count] of designInfo.textColors) {
      lines.push(`    ${colorVal} (x${count})`);
    }
  }

  if (designInfo.bgColors.length > 0) {
    lines.push("  背景颜色:");
    for (const [colorVal, count] of designInfo.bgColors) {
      lines.push(`    ${colorVal} (x${count})`);
    }
  }

  if (designInfo.fontSpecs.length > 0) {
    lines.push("  字体规格 (字号/字重/颜色):");
    for (const [specKey, count] of designInfo.fontSpecs) {
      const parts = specKey.split("|");
      if (parts.length === 3) {
        lines.push(`    ${parts[0]} / ${parts[1]} / ${parts[2]} (x${count})`);
      } else {
        lines.push(`    ${specKey} (x${count})`);
      }
    }
  }

  if (designInfo.images.length > 0) {
    lines.push("  页面图片资源 (切图):");
    const seen = new Set<string>();
    for (const img of designInfo.images) {
      let src = img.src;
      if (!src || seen.has(src)) {
        continue;
      }
      seen.add(src);

      if (src.includes("localhost") || src.includes("127.0.0.1")) {
        try {
          src = new URL(src).pathname.replace(/^\/+/, "");
        } catch {
          // keep original src
        }
      }

      const label = img.type === "bg" ? "背景图" : "图片";
      let localNote = "";
      if (resourceDir) {
        const localFile = join(resourceDir, src);
        if (existsSync(localFile)) {
          localNote = ` [本地: ${localFile}]`;
        }
      }

      lines.push(`    [${label}] ${src} (${img.w}x${img.h})${localNote}`);
    }
  }

  return lines.length > 1 ? lines.join("\n") : "";
}
