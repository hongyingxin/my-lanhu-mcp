import { describe, expect, it } from "vitest";

import { extractLayoutSummary } from "../src/transform/layout-summary.js";

const sampleSchema = {
  type: "div",
  props: {
    className: "screen",
    style: {
      width: 375,
      height: 812,
      display: "flex",
      flexDirection: "column",
      paddingTop: 16,
      paddingRight: 16,
      paddingBottom: 16,
      paddingLeft: 16,
    },
  },
  children: [
    {
      type: "lanhutext",
      props: {
        className: "title",
        style: {
          fontSize: 18,
          lineHeight: 26,
          fontWeight: 600,
          color: "#111111",
        },
      },
      data: {
        value: "待发车详情",
      },
      children: [],
    },
  ],
} as const;

const ddsSchema = {
  type: "lanhupage",
  eleName: "page",
  style: { width: 750, height: 3199, display: "flex", flexDirection: "column" },
  children: [
    {
      type: "lanhublock",
      eleName: "col___39378",
      style: { width: 750, height: 305, marginTop: 928 },
      children: [],
    },
  ],
} as const;

describe("extractLayoutSummary", () => {
  it("extracts layout lines from schema nodes", () => {
    const summary = extractLayoutSummary(sampleSchema);
    expect(summary).toContain("[div] .screen w:375 h:812 flex-col pad:16px");
    expect(summary).toContain('[lanhutext] "待发车详情" .title font:18px/26px 600 #111111');
  });

  it("supports DDS schema with top-level eleName and style", () => {
    const summary = extractLayoutSummary(ddsSchema);
    expect(summary).toContain("[lanhupage] .page w:750 h:3199 flex-col");
    expect(summary).toContain("[lanhublock] .col___39378 w:750 h:305 margin:928px");
  });
});
