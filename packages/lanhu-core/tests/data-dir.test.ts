import { describe, expect, it } from "vitest";

import {
  resolveDesignOutputDir,
  resolveLanhuDataDir,
  safeDesignFilename,
} from "../src/persist/data-dir.js";

describe("data-dir", () => {
  it("safeDesignFilename replaces path separators", () => {
    expect(safeDesignFilename("a/b")).toBe("a_b");
  });

  it("resolveDesignOutputDir nests under lanhu_designs", () => {
    expect(resolveDesignOutputDir("/tmp/data", "pid-1")).toBe("/tmp/data/lanhu_designs/pid-1");
  });

  it("resolveLanhuDataDir prefers explicit path", () => {
    expect(resolveLanhuDataDir("/custom")).toBe("/custom");
  });
});
