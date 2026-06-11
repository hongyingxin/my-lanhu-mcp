import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  LanhuClient,
  analyzeDesignWithInclude,
  DEFAULT_ANALYZE_INCLUDE,
  resolveAnalyzeInclude,
  parseLanhuUrl,
  listDesigns,
  pickDesign,
  type AnalyzeInclude,
} from "@lanhu/core";
import type { McpConfig } from "../config.js";
import { requireLanhuCookie } from "../config.js";

export function registerDesignResource(server: McpServer, config: McpConfig): void {
  server.registerResource(
    "design",
    new ResourceTemplate("lanhu://project/{pid}/design/{design_id}?tid={tid}", {
      list: undefined,
    }),
    { description: "获取单张蓝湖设计稿的详细分析（HTML、tokens、图层、切图等）。" },
    async (uri, { pid, tid, design_id }) => {
      const cookie = requireLanhuCookie(config);
      const client = new LanhuClient({
        cookie,
        ddsCookie: config.ddsCookie ?? cookie,
      });

      const url = `https://lanhuapp.com/web/#/item/project/stage?pid=${pid}&tid=${tid}`;
      const parsed = parseLanhuUrl(url);
      const listResult = await listDesigns(client, url);
      const designId = Array.isArray(design_id) ? design_id[0] : design_id;
      const design = pickDesign(
        listResult.designs,
        designId,
        parsed.docId ?? parsed.imageId,
      );

      if (!design) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify(
                {
                  status: "error",
                  error: `未找到设计稿：${designId ?? design_id}`,
                  available_designs: listResult.designs.map((d) => ({
                    id: d.id,
                    name: d.name,
                  })),
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      const include: AnalyzeInclude[] = [
        "html",
        "tokens",
        "layers",
        "layout",
        "image",
        "slices",
      ];
      const includeSet = resolveAnalyzeInclude(include);

      const teamId = listResult.params.teamId;
      const projectId = listResult.params.projectId;

      try {
        const result = await analyzeDesignWithInclude(
          client,
          { teamId, projectId },
          design,
          { include, withSlices: true },
        );

        const response = {
          status: "success",
          project_name: listResult.projectName,
          design: {
            id: design.id,
            name: design.name,
            index: design.index,
            width: design.width,
            height: design.height,
            convert_source: result.convertSource ?? null,
            html_code: result.convert?.after?.htmlFull ?? null,
            image_url_mapping: result.convert?.after?.mapping ?? null,
            layout_summary: result.layoutSummary ?? null,
            layer_tree: result.layerTree ?? null,
            design_tokens: result.designTokens ?? null,
            sketch_annotations: result.sketchAnnotations ?? null,
            preview_image: result.previewImage
              ? {
                  contentType: result.previewImage.contentType,
                  hasBase64: Boolean(result.previewImage.base64),
                }
              : null,
            slices: result.slices ?? null,
            warnings: result.warnings,
          },
          include: [...includeSet],
        };

        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify(
                {
                  status: "error",
                  error: error instanceof Error ? error.message : String(error),
                  design: {
                    id: design.id,
                    name: design.name,
                  },
                },
                null,
                2,
              ),
            },
          ],
        };
      }
    },
  );
}