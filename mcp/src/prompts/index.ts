import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerDesignPrompts } from "./design-prompts.js";

export function registerAllPrompts(server: McpServer): void {
  registerDesignPrompts(server);
}
