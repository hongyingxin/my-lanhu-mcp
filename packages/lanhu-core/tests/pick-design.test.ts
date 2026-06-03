import { describe, expect, it } from "vitest";
import { normalizeDesignQuotes, pickDesign, pickDesigns } from "../src/lanhu/pick-design.js";
import type { LanhuDesignSummary } from "../src/types.js";

function mockDesign(
  index: number,
  id: string,
  name: string,
): LanhuDesignSummary {
  return {
    index,
    id,
    name,
    hasComment: false,
    source: "projectImages",
    raw: {},
  };
}

const designs = [
  mockDesign(1, "id-a", "首页"),
  mockDesign(2, "id-b", "活动\u201c弹窗\u201d"),
];

describe("normalizeDesignQuotes", () => {
  it("maps curly quotes to ascii quotes", () => {
    expect(normalizeDesignQuotes("活动\u201c弹窗\u201d")).toBe('活动"弹窗"');
  });
});

describe("pickDesign", () => {
  it("matches design name after quote normalization", () => {
    const picked = pickDesign(designs, '活动"弹窗"');
    expect(picked.id).toBe("id-b");
  });

  it("matches by index", () => {
    expect(pickDesign(designs, "2").id).toBe("id-b");
  });
});

describe("pickDesigns", () => {
  it("returns all designs for all selector", () => {
    expect(pickDesigns(designs, "all")).toHaveLength(2);
  });

  it("dedupes by id when multiple selectors hit same design", () => {
    expect(pickDesigns(designs, ["1", "id-a"])).toHaveLength(1);
  });
});
