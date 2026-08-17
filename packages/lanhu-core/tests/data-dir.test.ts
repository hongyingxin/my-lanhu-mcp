import { describe, expect, it } from "vitest";

import {
  resolveDesignDirSegment,
  resolveDesignOutputDir,
  resolveLanhuDataDir,
  resolveLanhuDataDirAnchored,
  safeDesignFilename,
} from "../src/persist/data-dir.js";
import { getRepoRoot } from "../src/env/repo-env.js";

describe("data-dir", () => {
  it("safeDesignFilename replaces path separators", () => {
    expect(safeDesignFilename("a/b")).toBe("a_b");
  });

  it("resolveDesignDirSegment combines id and slug", () => {
    expect(resolveDesignDirSegment("214c0a95-uuid", "画板 3")).toBe("214c0a95-uuid_画板 3");
  });

  it("resolveDesignOutputDir nests under lanhu_designs/{pid}/{id}_{slug}", () => {
    expect(resolveDesignOutputDir("/tmp/data", "pid-1", "id-1", "首页")).toBe(
      "/tmp/data/lanhu_designs/pid-1/id-1_首页",
    );
  });

  it("resolveLanhuDataDir prefers explicit path", () => {
    expect(resolveLanhuDataDir("/custom")).toBe("/custom");
  });

  it("resolveLanhuDataDirAnchored defaults to repoRoot/data", () => {
    const repoRoot = getRepoRoot();
    expect(resolveLanhuDataDirAnchored({})).toBe(`${repoRoot}/data`);
  });

  it("resolveLanhuDataDirAnchored resolves relative LANHU_DATA_DIR against repo root", () => {
    const repoRoot = getRepoRoot();
    expect(resolveLanhuDataDirAnchored({ LANHU_DATA_DIR: "./custom-data" })).toBe(
      `${repoRoot}/custom-data`,
    );
  });

  it("resolveLanhuDataDirAnchored keeps absolute LANHU_DATA_DIR", () => {
    expect(resolveLanhuDataDirAnchored({ LANHU_DATA_DIR: "/tmp/lanhu-data" })).toBe("/tmp/lanhu-data");
  });
});
