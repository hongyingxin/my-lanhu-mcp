import { describe, expect, it } from "vitest";
import {
  DEFAULT_ANALYZE_INCLUDE,
  resolveAnalyzeInclude,
} from "../src/pipeline/analyze-include.js";

describe("resolveAnalyzeInclude", () => {
  it("uses TS-aligned default when omitted", () => {
    const set = resolveAnalyzeInclude();
    expect([...set].sort()).toEqual([...DEFAULT_ANALYZE_INCLUDE].sort());
    expect(DEFAULT_ANALYZE_INCLUDE).toEqual([
      "html",
      "tokens",
      "layers",
      "layout",
      "image",
      "slices",
    ]);
  });

  it("respects explicit include list", () => {
    const set = resolveAnalyzeInclude(["html", "tokens"]);
    expect(set.has("html")).toBe(true);
    expect(set.has("tokens")).toBe(true);
    expect(set.has("image")).toBe(false);
    expect(set.has("layers")).toBe(false);
  });
});
