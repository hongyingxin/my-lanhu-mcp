import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";

export function registerDesignPrompts(server: McpServer): void {
  server.prompt(
    "frontend-dev",
    "分析蓝湖设计稿并生成像素级前端代码",
    { url: z.string(), design_name: z.string().optional() },
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

  server.prompt(
    "design-review",
    "审查蓝湖设计稿的一致性与可实现性",
    { url: z.string() },
    ({ url }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text:
              `请审查蓝湖设计稿：${url}，关注以下方面：\n` +
              "1. 字体使用是否一致（字体族、字号、字重）\n" +
              "2. 色板是否统一、是否符合设计规范\n" +
              "3. 间距、圆角等样式模式是否一致\n" +
              "4. 标出潜在的实现难点或风险",
          },
        },
      ],
    }),
  );
}
