export interface McpConfig {
  serverName: string;
  serverVersion: string;
  lanhuCookie?: string;
  ddsCookie?: string;
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): McpConfig {
  const lanhuCookie = env["LANHU_COOKIE"]?.trim() || undefined;
  const ddsCookie = env["DDS_COOKIE"]?.trim() || lanhuCookie;

  return {
    serverName: env["MCP_SERVER_NAME"]?.trim() || "lanhu-mcp-node",
    serverVersion: env["MCP_SERVER_VERSION"]?.trim() || "0.1.0",
    lanhuCookie,
    ddsCookie,
  };
}

export function requireLanhuCookie(config: McpConfig): string {
  if (!config.lanhuCookie) {
    throw new ConfigurationError(
      "LANHU_COOKIE is required. Set it in mcp.json env or the environment.",
    );
  }
  return config.lanhuCookie;
}
