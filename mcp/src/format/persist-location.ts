export interface PersistLocationEntry {
  /** 可选标签，如画板名、文档名 */
  label?: string;
  /** 落盘目录绝对路径 */
  dir: string;
  /** 补充说明，如 `screenshots/` */
  note?: string;
}

/** 在 MCP content 文本中输出落盘路径（Agent 可读；不依赖 structuredContent） */
export function formatPersistLocationBlock(
  persist: boolean,
  entries: PersistLocationEntry[],
): string {
  if (!persist) {
    return "";
  }

  const valid = entries.filter((item) => item.dir.trim());
  if (valid.length === 0) {
    return "";
  }

  const lines = ["", "--- 落盘路径 ---"];
  if (valid.length === 1 && !valid[0]!.label) {
    const only = valid[0]!;
    lines.push(only.note ? `${only.dir} (${only.note})` : only.dir);
    return lines.join("\n");
  }

  for (const item of valid) {
    const prefix = item.label ? `${item.label}：` : "";
    const suffix = item.note ? ` (${item.note})` : "";
    lines.push(`${prefix}${item.dir}${suffix}`);
  }
  return lines.join("\n");
}

/** analyze 模式：按画板名列出落盘目录 */
export function formatAnalyzePersistEntries(
  slices: Array<{ design: { name: string } }>,
  artifactPaths: Array<{ outputDir: string } | undefined>,
): PersistLocationEntry[] {
  const entries: PersistLocationEntry[] = [];
  for (let i = 0; i < slices.length; i++) {
    const dir = artifactPaths[i]?.outputDir?.trim();
    if (!dir) {
      continue;
    }
    entries.push({ label: slices[i]!.design.name, dir });
  }
  return entries;
}

/** 原型 analyze：包根目录 + 截图子目录 */
export function formatPrototypePersistEntries(
  outputDir: string,
  screenshotOutputDir?: string,
): PersistLocationEntry[] {
  const entries: PersistLocationEntry[] = [{ dir: outputDir, note: "Axure 包根目录" }];
  if (screenshotOutputDir?.trim() && screenshotOutputDir !== outputDir) {
    entries.push({ dir: screenshotOutputDir, note: "screenshots" });
  }
  return entries;
}
