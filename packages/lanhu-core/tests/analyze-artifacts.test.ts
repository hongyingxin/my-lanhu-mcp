import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { persistAnalyzeArtifacts } from "../src/persist/analyze-artifacts.js";
import type { AnalyzeDesignResult } from "../src/pipeline/analyze-design.js";
import type { LanhuDesignSummary } from "../src/types.js";

const mockClient = {
  fetchBinaryUrl: async () => {
    throw new Error("preview disabled in test");
  },
} as never;

function baseResult(overrides: Partial<AnalyzeDesignResult> = {}): AnalyzeDesignResult {
  return {
    status: "success",
    params: {
      rawUrl: "https://lanhu.example/stage",
      kind: "design",
      projectId: "pid-1",
      teamId: "team-1",
      rawParams: {},
    },
    projectName: "Demo Project",
    design: {
      id: "design-1",
      name: "首页",
      url: "https://cdn.example/preview.png",
    },
    convertSource: "schema",
    warnings: ["step failed: test"],
    ...overrides,
  };
}

describe("persistAnalyzeArtifacts", () => {
  let tempRoot = "";

  afterEach(async () => {
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true });
      tempRoot = "";
    }
  });

  it("writes B/C artifacts and extended meta", async () => {
    tempRoot = await mkdtemp(join(tmpdir(), "analyze-artifacts-"));
    const design: LanhuDesignSummary = {
      id: "design-1",
      name: "首页",
      url: "https://cdn.example/preview.png",
    };
    const result = baseResult({
      convert: {
        ok: true,
        before: {
          stats: { total: 1, byType: { div: 1 } },
          root: { type: "div" },
          matchedNodes: [],
          schemaPreview: "{}",
          schemaCharCount: 2,
        },
        after: {
          css: ".box { color: red; }",
          cssPreview: ".box { color: red; }",
          cssRuleCount: 1,
          htmlBody: "<div class=\"box\">Hi</div>",
          htmlBodyPreview: "<div class=\"box\">Hi</div>",
          htmlPreviewDoc: "<html></html>",
          htmlFull: "<!DOCTYPE html><html><body><div class=\"box\">Hi</div></body></html>",
          htmlLength: 64,
          mappingCount: 1,
          mappingPreview: { img_0: "https://cdn.example/a.png" },
          mapping: { img_0: "https://cdn.example/a.png" },
        },
      },
      sketchConvert: {
        ok: true,
        source: "sketch",
        after: {
          htmlFull: "<!DOCTYPE html><html><body><div>Sketch</div></body></html>",
          htmlLength: 55,
          mapping: {},
          mappingCount: 0,
          mappingPreview: {},
          layerAnnotations: [],
          designScale: 2,
        },
      },
      schemaMeta: {
        imageId: "design-1",
        versionId: "ver-1",
        schemaUrl: "https://dds.example/schema.json",
        schema: { type: "div" },
      },
      sketchMeta: {
        imageId: "design-1",
        jsonUrl: "https://cdn.example/sketch.json",
        documentInfo: {
          id: "design-1",
          name: "首页",
          width: 375,
          height: 812,
          update_time: "2026-08-17",
        },
        sketch: { type: "page" },
      },
      slices: {
        designId: "design-1",
        designName: "首页",
        totalSlices: 1,
        slices: [
          {
            name: "icon",
            downloadUrl: "https://cdn.example/icon.png",
            size: "24x24",
            format: "png",
          },
        ],
      },
    });

    const paths = await persistAnalyzeArtifacts(mockClient, design, result, {
      dataDir: tempRoot,
      projectId: "pid-1",
      downloadPreview: false,
      include: ["html", "layout"],
      withSlices: true,
    });

    expect(paths.css).toBeTruthy();
    expect(paths.htmlBody).toBeTruthy();
    expect(paths.sketchFallbackHtml).toBeTruthy();
    expect(paths.warnings).toBeTruthy();
    expect(paths.slices).toBeTruthy();

    const css = await readFile(paths.css!, "utf8");
    expect(css).toContain(".box");

    const body = await readFile(paths.htmlBody!, "utf8");
    expect(body).toContain("Hi");

    const fallback = await readFile(paths.sketchFallbackHtml!, "utf8");
    expect(fallback).toContain("Sketch");

    const warnings = JSON.parse(await readFile(paths.warnings!, "utf8")) as string[];
    expect(warnings).toEqual(["step failed: test"]);

    const meta = JSON.parse(await readFile(paths.meta!, "utf8")) as Record<string, unknown>;
    expect(meta.projectName).toBe("Demo Project");
    expect(meta.projectId).toBe("pid-1");
    expect(meta.teamId).toBe("team-1");
    expect(meta.include).toEqual(["html", "layout"]);
    expect(meta.withSlices).toBe(true);
    expect(meta.versionId).toBe("ver-1");
    expect(meta.schemaUrl).toBe("https://dds.example/schema.json");
    expect(meta.documentInfo).toMatchObject({ width: 375, height: 812 });
    expect(meta.warnings).toEqual(["step failed: test"]);
    expect(meta.files).toMatchObject({
      css: paths.css,
      htmlBody: paths.htmlBody,
      sketchFallbackHtml: paths.sketchFallbackHtml,
      warnings: paths.warnings,
      slices: paths.slices,
    });
  });

  it("skips schema-only extras for sketch convert", async () => {
    tempRoot = await mkdtemp(join(tmpdir(), "analyze-artifacts-"));
    const design: LanhuDesignSummary = { id: "design-2", name: "SketchOnly" };
    const result = baseResult({
      convertSource: "sketch",
      warnings: [],
      convert: {
        ok: true,
        source: "sketch",
        after: {
          htmlFull: "<html><body>Sketch main</body></html>",
          htmlLength: 30,
          mapping: {},
          mappingCount: 0,
          mappingPreview: {},
          layerAnnotations: [],
          designScale: 2,
        },
      },
    });

    const paths = await persistAnalyzeArtifacts(mockClient, design, result, {
      dataDir: tempRoot,
      projectId: "pid-1",
      downloadPreview: false,
    });

    expect(paths.css).toBeUndefined();
    expect(paths.htmlBody).toBeUndefined();
    expect(paths.sketchFallbackHtml).toBeUndefined();
    expect(paths.warnings).toBeUndefined();
  });
});
