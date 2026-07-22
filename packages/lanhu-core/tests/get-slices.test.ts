import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { extractSlicesFromSketch } from "../src/lanhu/designs.js";

const mockDir = join(dirname(fileURLToPath(import.meta.url)), "../../../apps/debug-vue/src/mock");

function loadSketch(path: string): Record<string, unknown> {
  const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  return (raw.data ?? raw) as Record<string, unknown>;
}

const SCALE_URL_KEYS = [
  "1x",
  "2x",
  "3x",
  "ios_1x",
  "ios_2x",
  "ios_3x",
  "android_mdpi",
  "android_hdpi",
  "android_xhdpi",
  "android_xxhdpi",
  "android_xxxhdpi",
] as const;

describe("extractSlicesFromSketch", () => {
  it("PS 惊喜奖励：17 条切图 + scaleUrls", () => {
    const sketch = loadSketch(join(mockDir, "9.json"));
    const { slices, sliceScale } = extractSlicesFromSketch(sketch, true);

    expect(sliceScale).toBe(2);
    expect(slices).toHaveLength(17);

    const names = slices.map((s) => s.name).sort();
    expect(names).toEqual([
      "?",
      "Active Star2",
      "button",
      "button 拷贝",
      "gift",
      "tab",
      "tab 拷贝",
      "title",
      "头图 拷贝",
      "房间背景",
      "播放",
      "框",
      "框 拷贝",
      "框 拷贝 2",
      "矩形 1201 拷贝",
      "矩形 5",
      "礼物盒",
    ]);

    for (const slice of slices) {
      expect(slice.downloadUrl).toMatch(/^https?:\/\//);
      expect(slice.format).toBe("png");
      expect(slice.scaleUrls).toBeDefined();
      for (const key of SCALE_URL_KEYS) {
        expect(slice.scaleUrls?.[key], `${slice.name} missing ${key}`).toMatch(/^https?:\/\//);
      }
      expect(slice.metadata?.source).toBe("photoshop");
    }
  });
});
