import type { DownloadedSliceFile } from "@lanhu/core";

/** 切图清单行：MCP 填事实列，Agent 补全说明与修改后名称 */
export interface SliceInventoryRow {
  lanhu_name: string;
  size: string;
  description: string;
  renamed_file: string;
  disk_file: string;
  path: string;
}

export function formatSliceDisplaySize(size?: string): string {
  if (!size?.trim()) {
    return "";
  }
  return size.trim().replace(/x/gi, "×");
}

export function buildSliceInventoryRows(files: DownloadedSliceFile[]): SliceInventoryRow[] {
  return files.map((file) => ({
    lanhu_name: file.sliceName,
    size: formatSliceDisplaySize(file.size),
    description: "",
    renamed_file: "",
    disk_file: file.file,
    path: file.path,
  }));
}

function escapeMarkdownTableCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export function formatSliceInventoryTable(rows: SliceInventoryRow[]): string {
  if (rows.length === 0) {
    return "## 切图清单\n\n（无成功下载的切图）";
  }

  const lines = [
    "## 切图清单",
    "",
    "请补全「说明」与「修改后名称」，再按映射将「落盘文件」重命名并更新项目引用。",
    "落盘目录见上方摘要；当前文件名见 structured JSON 的 `inventory[].disk_file`。",
    "",
    "| 蓝湖文件名 | 尺寸 | 说明 | 修改后名称 |",
    "|------------|------|------|------------|",
  ];

  for (const row of rows) {
    lines.push(
      `| ${escapeMarkdownTableCell(row.lanhu_name)} | ${escapeMarkdownTableCell(row.size)} | | |`,
    );
  }

  return lines.join("\n");
}

export function formatSliceInventorySection(files: DownloadedSliceFile[]): string {
  return formatSliceInventoryTable(buildSliceInventoryRows(files));
}
