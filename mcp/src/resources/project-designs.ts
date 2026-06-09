import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LanhuClient, listDesigns } from "@lanhu/core";
import type { McpConfig } from "../config.js";
import { requireLanhuCookie } from "../config.js";

export function registerProjectDesignsResource(server: McpServer, config: McpConfig): void {
  server.resource(
    "project-designs",
    new ResourceTemplate("lanhu://project/{pid}/designs?tid={tid}", { list: undefined }),
    { description: "List all design images in a Lanhu project" },
    async (uri, { pid, tid }) => {
      const cookie = requireLanhuCookie(config);
      const client = new LanhuClient({
        cookie,
        ddsCookie: config.ddsCookie ?? cookie,
      });
      const url = `https://lanhuapp.com/web/#/item/project/stage?pid=${pid}&tid=${tid}`;
      const result = await listDesigns(client, url);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(
              {
                projectName: result.projectName,
                totalDesigns: result.totalDesigns,
                designs: result.designs.map((d) => ({
                  index: d.index,
                  id: d.id,
                  name: d.name,
                  width: d.width,
                  height: d.height,
                })),
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
