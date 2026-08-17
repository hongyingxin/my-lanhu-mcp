import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  extForSliceFormat,
  filterSlicesByNames,
  resolveSliceDownloadUrl,
  resolveSlicesOutputPaths,
  sanitizeSliceFilename,
} from "../src/lanhu/download-slices.js";
import type { LanhuSliceInfo } from "../src/types.js";

function mockSlice(overrides: Partial<LanhuSliceInfo> = {}): LanhuSliceInfo {
  return {
    name: "title",
    id: "slice-1",
    downloadUrl: "https://cdn.example.com/title.png",
    scaleUrls: {
      "1x": "https://cdn.example.com/title.png?x-oss-process=image/resize,w_100,h_50/format,png",
      "2x": "https://cdn.example.com/title.png?x-oss-process=image/resize,w_200,h_100/format,png",
    },
    svgUrl: "https://cdn.example.com/title.svg",
    ...overrides,
  };
}

describe("sanitizeSliceFilename", () => {
  it("保留中文并替换非法字符", () => {
    expect(sanitizeSliceFilename("702 拷贝 3")).toBe("702_拷贝_3");
    expect(sanitizeSliceFilename("foo/bar")).toBe("foo_bar");
  });

  it("空名回退 slice", () => {
    expect(sanitizeSliceFilename("")).toBe("slice");
  });
});

describe("extForSliceFormat", () => {
  it("按 format 返回扩展名", () => {
    expect(extForSliceFormat("png")).toBe(".png");
    expect(extForSliceFormat("webp")).toBe(".webp");
    expect(extForSliceFormat("svg")).toBe(".svg");
  });
});

describe("resolveSlicesOutputPaths", () => {
  it("在 root 下追加 assets/slices", () => {
    const { outputRoot, outputDir } = resolveSlicesOutputPaths("/tmp/lanhu_designs/pid");
    expect(outputRoot).toBe(resolve("/tmp/lanhu_designs/pid"));
    expect(outputDir).toBe(resolve("/tmp/lanhu_designs/pid/assets/slices"));
  });
});

describe("resolveSliceDownloadUrl", () => {
  it("svg 优先 svgUrl", () => {
    const slice = mockSlice();
    expect(resolveSliceDownloadUrl(slice, { sliceScale: "2x", sliceFormat: "svg" })).toBe(
      "https://cdn.example.com/title.svg",
    );
  });

  it("按 scale 取 scaleUrls", () => {
    const slice = mockSlice();
    expect(resolveSliceDownloadUrl(slice, { sliceScale: "2x", sliceFormat: "png" })).toContain(
      "w_200,h_100",
    );
  });

  it("webp 追加 format 参数", () => {
    const slice = mockSlice();
    const url = resolveSliceDownloadUrl(slice, { sliceScale: "2x", sliceFormat: "webp" });
    expect(url).toContain("/format,webp");
  });

  it("无 URL 时返回 null", () => {
    const slice = mockSlice({ scaleUrls: undefined, downloadUrl: undefined, svgUrl: undefined });
    expect(resolveSliceDownloadUrl(slice, { sliceScale: "2x", sliceFormat: "png" })).toBeNull();
  });
});

describe("filterSlicesByNames", () => {
  const slices = [
    mockSlice({ name: "title", id: "slice-1" }),
    mockSlice({ name: "button", id: "slice-2" }),
  ];

  it("未传 sliceNames 时返回全部", () => {
    expect(filterSlicesByNames(slices).slices).toHaveLength(2);
  });

  it("按 name 或 id 匹配", () => {
    const byName = filterSlicesByNames(slices, "button");
    expect(byName.slices).toHaveLength(1);
    expect(byName.slices[0]?.name).toBe("button");

    const byId = filterSlicesByNames(slices, "slice-1");
    expect(byId.slices[0]?.name).toBe("title");
  });

  it("记录未匹配项", () => {
    const result = filterSlicesByNames(slices, ["title", "missing"]);
    expect(result.slices).toHaveLength(1);
    expect(result.missing).toEqual(["missing"]);
  });
});
