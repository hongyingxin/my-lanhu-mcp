import { describe, expect, it } from "vitest";

import {
  formatAnalyzePersistEntries,
  formatPersistLocationBlock,
  formatPrototypePersistEntries,
} from "../src/format/persist-location.js";

describe("formatPersistLocationBlock", () => {
  it("returns empty when persist is false", () => {
    expect(formatPersistLocationBlock(false, [{ dir: "/data/foo" }])).toBe("");
  });

  it("formats single path without label", () => {
    expect(formatPersistLocationBlock(true, [{ dir: "/data/designs/pid/id_slug" }])).toBe(
      "\n--- 落盘路径 ---\n/data/designs/pid/id_slug",
    );
  });

  it("formats multiple labeled paths", () => {
    const text = formatPersistLocationBlock(true, [
      { label: "画板A", dir: "/data/a" },
      { label: "画板B", dir: "/data/b" },
    ]);
    expect(text).toContain("画板A：/data/a");
    expect(text).toContain("画板B：/data/b");
  });
});

describe("formatAnalyzePersistEntries", () => {
  it("maps design names to output dirs", () => {
    const entries = formatAnalyzePersistEntries(
      [{ design: { name: "惊喜奖励" } }, { design: { name: "首页" } }],
      [{ outputDir: "/data/a" }, undefined],
    );
    expect(entries).toEqual([{ label: "惊喜奖励", dir: "/data/a" }]);
  });
});

describe("formatPrototypePersistEntries", () => {
  it("includes screenshot dir when different", () => {
    const entries = formatPrototypePersistEntries("/data/proto", "/data/proto/screenshots");
    expect(entries).toHaveLength(2);
    expect(entries[1]?.note).toBe("screenshots");
  });
});
