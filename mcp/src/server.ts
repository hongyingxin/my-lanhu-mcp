#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { loadConfig } from "./config.js";
import { registerProjectDesignsResource } from "./resources/project-designs.js";
import { registerAllTools } from "./tools/index.js";

export function createServer(): McpServer {
  const config = loadConfig();
  const server = new McpServer({
    name: config.serverName,
    version: config.serverVersion,
  });

  registerAllTools(server, config);
  registerProjectDesignsResource(server, config);

  return server;
}

export async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

export function isDirectExecution(
  entrypoint = process.argv[1],
  moduleUrl = import.meta.url,
): boolean {
  if (entrypoint == null) {
    return false;
  }
  try {
    return moduleUrl === pathToFileURL(realpathSync(path.resolve(entrypoint))).href;
  } catch {
    return false;
  }
}

if (isDirectExecution()) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Lanhu MCP failed to start: ${message}`);
    process.exitCode = 1;
  });
}
