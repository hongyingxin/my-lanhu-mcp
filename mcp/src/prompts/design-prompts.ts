import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";

export function registerDesignPrompts(server: McpServer): void {
  server.registerPrompt(
    "frontend-dev",
    {
      description: "分析蓝湖设计稿并生成像素级前端代码",
      argsSchema: { url: z.string(), design_name: z.string().optional() },
    },
    ({ url, design_name }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text:
              `请分析蓝湖设计稿：${url}${
                design_name ? `（画板：「${design_name}」）` : ""
              }，并生成像素级还原的前端代码。\n\n` +
              "要求：\n" +
              "1. 字体、字号、颜色、间距等样式必须与设计稿一致\n" +
              "2. 将所有图片资源下载到项目本地路径后再引用\n" +
              "3. 布局结构与设计稿精确对齐",
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "design-review",
    {
      description: "审查蓝湖设计稿的一致性与可实现性",
      argsSchema: { url: z.string(), design_name: z.string().optional() },
    },
    ({ url, design_name }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text:
              `请审查蓝湖设计稿：${url}${
                design_name ? `（画板：「${design_name}」）` : ""
              }，关注以下方面：\n` +
              "1. 字体使用是否一致（字体族、字号、字重）\n" +
              "2. 色板是否统一、是否符合设计规范\n" +
              "3. 间距、圆角等样式模式是否一致\n" +
              "4. 标出潜在的实现难点或风险\n\n" +
              "数据获取：请先调用 lanhu_design，推荐参数：\n" +
              '- mode: "analyze"\n' +
              `- design_names: ${design_name ? `"${design_name}"` : "<画板名>"}\n` +
              '- include: ["layout", "layers", "image", "tokens"]\n' +
              "- workflow_guide: false\n\n" +
              "说明：审查场景不要 include html，以节省 token；视觉对照依赖 image 预览图与 tokens/layers。",
          },
        },
      ],
    }),
  );
}
