import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpConfig } from "../config.js";
import { registerLanhuDesignTool } from "./lanhu-design.js";
import { registerLanhuPageTool } from "./lanhu-page.js";

export function registerAllTools(server: McpServer, config: McpConfig): void {
  registerLanhuDesignTool(server, config);
  registerLanhuPageTool(server, config);
}
