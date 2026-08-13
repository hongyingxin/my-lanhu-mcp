import { describe, expect, it } from "vitest";

import { resolveDesignSelector } from "../src/tools/resolve-design-selector.js";
import type { LanhuDesignSummary } from "@lanhu/core";

const designs: LanhuDesignSummary[] = [
  {
    index: 1,
    id: "design-a",
    name: "首页",
    hasComment: false,
    source: "projectImages",
    raw: {},
  },
  {
    index: 2,
    id: "design-b",
    name: "详情页",
    hasComment: false,
    source: "projectImages",
    raw: {},
  },
];

describe("resolveDesignSelector", () => {
  it("uses explicit design_names when provided", () => {
    const result = resolveDesignSelector("首页", {}, { designs, totalDesigns: 2 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.selector).toBe("首页");
      expect(result.resolvedFrom).toBe("explicit");
    }
  });

  it("infers from URL image_id when design_names omitted", () => {
    const result = resolveDesignSelector(undefined, { imageId: "design-b" }, { designs, totalDesigns: 2 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.selector).toBe("design-b");
      expect(result.resolvedFrom).toBe("url.image_id");
    }
  });

  it("infers single design when list has one item", () => {
    const single = [designs[0]!];
    const result = resolveDesignSelector(undefined, {}, { designs: single, totalDesigns: 1 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.selector).toBe("design-a");
      expect(result.resolvedFrom).toBe("single_design");
    }
  });

  it("requires design_names for multi-design stage URLs without image_id", () => {
    const result = resolveDesignSelector(undefined, {}, { designs, totalDesigns: 2 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.autoSelectable).toBe(false);
      expect(result.availableDesigns).toHaveLength(2);
      expect(result.hint).toContain("design_names");
    }
  });

  it("prefers explicit design_names over URL image_id", () => {
    const result = resolveDesignSelector(
      "首页",
      { imageId: "design-b" },
      { designs, totalDesigns: 2 },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.selector).toBe("首页");
      expect(result.resolvedFrom).toBe("explicit");
    }
  });
});
