import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpConfig } from "../config.js";
import { registerLanhuDesignTool } from "./lanhu-design.js";

export function registerAllTools(server: McpServer, config: McpConfig): void {
  registerLanhuDesignTool(server, config);
}
