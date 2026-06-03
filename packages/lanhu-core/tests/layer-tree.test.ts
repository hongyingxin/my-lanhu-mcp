import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { extractLayerTree } from "../src/transform/layer-tree.js";

const mockDir = join(dirname(fileURLToPath(import.meta.url)), "../../../apps/debug-vue/src/mock");

describe("extractLayerTree", () => {
  it("extracts from PS board.layers (mock 9)", () => {
    const raw = JSON.parse(readFileSync(join(mockDir, "9.json"), "utf8"));
    const sketch = raw.data ?? raw;
    const tree = extractLayerTree(sketch);
    expect(tree).toContain("Board:");
    expect(tree).toContain("textLayer:");
    expect(tree).toContain("奖励自动发放");
  });
});
