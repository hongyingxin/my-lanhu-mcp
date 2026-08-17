import { describe, expect, it } from "vitest";

import {
  buildSliceInventoryRows,
  formatSliceDisplaySize,
  formatSliceInventoryTable,
} from "../src/slices-inventory-table.js";

describe("slices-inventory-table", () => {
  it("formatSliceDisplaySize normalizes x to ×", () => {
    expect(formatSliceDisplaySize("716x212")).toBe("716×212");
  });

  it("buildSliceInventoryRows maps download files to inventory rows", () => {
    const rows = buildSliceInventoryRows([
      {
        sliceName: "title",
        file: "title.png",
        path: "/tmp/assets/slices/title.png",
        url: "https://example.com/title.png",
        bytes: 100,
        size: "716x212",
      },
    ]);

    expect(rows).toEqual([
      {
        lanhu_name: "title",
        size: "716×212",
        description: "",
        renamed_file: "",
        disk_file: "title.png",
        path: "/tmp/assets/slices/title.png",
      },
    ]);
  });

  it("formatSliceInventoryTable renders fixed columns", () => {
    const table = formatSliceInventoryTable([
      {
        lanhu_name: "702 拷贝 3",
        size: "702×188",
        description: "",
        renamed_file: "",
        disk_file: "702_拷贝_3.png",
        path: "/data/assets/slices/702_拷贝_3.png",
      },
    ]);

    expect(table).toContain("| 蓝湖文件名 | 尺寸 | 说明 | 修改后名称 |");
    expect(table).toContain("| 702 拷贝 3 | 702×188 | | |");
  });
});
