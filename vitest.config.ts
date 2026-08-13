import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/lanhu-core/tests/**/*.test.ts", "mcp/tests/**/*.test.ts"],
    passWithNoTests: true,
  },
});