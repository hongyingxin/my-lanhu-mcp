import { loadRepoEnvFile } from "@lanhu/core";

loadRepoEnvFile();

export interface McpConfig {
  serverName: string;
  serverVersion: string;
  lanhuCookie?: string;
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): McpConfig {
  const lanhuCookie = env["LANHU_COOKIE"]?.trim() || undefined;

  return {
    serverName: env["MCP_SERVER_NAME"]?.trim() || "lanhu-mcp-node",
    serverVersion: env["MCP_SERVER_VERSION"]?.trim() || "0.1.0",
    lanhuCookie,
  };
}

export function requireLanhuCookie(config: McpConfig): string {
  if (!config.lanhuCookie) {
    throw new ConfigurationError(
      "LANHU_COOKIE is required. Set it in the repo root .env, mcp.json env, or the environment.",
    );
  }
  return config.lanhuCookie;
}
