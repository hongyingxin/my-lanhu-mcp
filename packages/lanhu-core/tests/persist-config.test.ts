import { describe, expect, it } from "vitest";

import { resolveLanhuPersistArtifacts } from "../src/persist/persist-config.js";

describe("resolveLanhuPersistArtifacts", () => {
  it("defaults to true when unset", () => {
    expect(resolveLanhuPersistArtifacts({})).toBe(true);
  });

  it("parses false values", () => {
    expect(resolveLanhuPersistArtifacts({ LANHU_PERSIST_ARTIFACTS: "false" })).toBe(false);
    expect(resolveLanhuPersistArtifacts({ LANHU_PERSIST_ARTIFACTS: "0" })).toBe(false);
    expect(resolveLanhuPersistArtifacts({ LANHU_PERSIST_ARTIFACTS: "no" })).toBe(false);
  });

  it("parses true values", () => {
    expect(resolveLanhuPersistArtifacts({ LANHU_PERSIST_ARTIFACTS: "true" })).toBe(true);
    expect(resolveLanhuPersistArtifacts({ LANHU_PERSIST_ARTIFACTS: "1" })).toBe(true);
  });
});
