export const SLICE_SCALE_GROUPS = [
  { label: "通用", keys: ["1x", "2x", "3x"] },
  { label: "iOS", keys: ["ios_1x", "ios_2x", "ios_3x"] },
  {
    label: "Android",
    keys: [
      "android_mdpi",
      "android_hdpi",
      "android_xhdpi",
      "android_xxhdpi",
      "android_xxxhdpi",
    ],
  },
] as const;

export const SLICE_SCALE_KEYS = SLICE_SCALE_GROUPS.flatMap((group) => group.keys);

export const SLICE_FORMAT_OPTIONS = [
  { value: "png", label: "PNG" },
  { value: "webp", label: "WebP" },
  { value: "svg", label: "SVG（矢量）" },
] as const;

export interface SliceItem {
  id?: string;
  name?: string;
  localPath?: string;
  downloadUrl?: string;
  svgUrl?: string;
  format?: string;
  size?: string;
  layerPath?: string;
  scaleUrls?: Record<string, string> | null;
}

export function applyFormatToUrl(url: string, format: string) {
  if (!url || format === "svg") {
    return url;
  }
  if (format === "png" && !url.includes("/format,")) {
    return url;
  }
  if (url.includes("/format,")) {
    return url.replace(/\/format,[^/]+/, `/format,${format}`);
  }
  const ossMatch = url.match(/([?&]x-oss-process=[^&]*)/);
  if (ossMatch) {
    return url.replace(ossMatch[1]!, `${ossMatch[1]}/format,${format}`);
  }
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}x-oss-process=image/format,${format}`;
}

export function replacePathExtension(path: string, format: string) {
  if (!path || format === "svg") {
    return path;
  }
  return path.replace(/\.(png|jpe?g|webp|gif)$/i, extForFormat(format));
}

export function sanitizeFilename(name: string) {
  return (name || "slice")
    .replace(/[^\w\u4e00-\u9fa5.-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

export function extForFormat(format: string) {
  if (format === "webp") return ".webp";
  if (format === "svg") return ".svg";
  return ".png";
}

export function resolveScaleUrl(slice: SliceItem, scale: string) {
  if (slice.format === "svg") {
    return slice.svgUrl || slice.downloadUrl;
  }
  if (slice.scaleUrls?.[scale]) {
    return slice.scaleUrls[scale];
  }
  return slice.downloadUrl;
}

export function resolveSliceDownloadUrl(
  slice: SliceItem,
  options: { scale: string; format: string; source: string },
) {
  if (slice.format === "svg") {
    return slice.svgUrl || slice.downloadUrl;
  }
  if (options.format === "svg") {
    return slice.svgUrl || null;
  }

  let url = slice.downloadUrl;
  if (options.source === "scaleUrls") {
    url = resolveScaleUrl(slice, options.scale);
  }

  return applyFormatToUrl(url || "", options.format);
}

export function zipPathForSlice(
  slice: SliceItem,
  options: { scale: string; format: string; source: string },
) {
  if (options.source === "mapping" && slice.localPath) {
    let path = slice.localPath.replace(/^\.\//, "");
    if (options.format && slice.format !== "svg") {
      path = replacePathExtension(path, options.format);
    }
    return path;
  }

  const base = sanitizeFilename(slice.name || slice.id || "slice");
  const ext = extForFormat(options.format);
  if (options.source === "scaleUrls" && options.scale && options.scale !== "1x") {
    return `assets/slices/${base}@${options.scale}${ext}`;
  }
  return `assets/slices/${base}${ext}`;
}

export function mappingToSliceItems(mapping: Record<string, string> | null | undefined): SliceItem[] {
  if (!mapping || typeof mapping !== "object") {
    return [];
  }

  return Object.entries(mapping).map(([localPath, remoteUrl]) => {
    const filename = localPath.split("/").pop() || "slice";
    const isSvg = filename.endsWith(".svg") || String(remoteUrl).includes(".svg");
    return {
      id: localPath,
      name: filename.replace(/\.[^.]+$/, ""),
      localPath,
      downloadUrl: remoteUrl,
      format: isSvg ? "svg" : "png",
      size: "—",
      layerPath: localPath,
      scaleUrls: null,
    };
  });
}

function mimeForFormat(format: string) {
  if (format === "webp") return "image/webp";
  if (format === "svg") return "image/svg+xml";
  return "image/png";
}

type PreviewFn = (url: string) => Promise<{ ok?: boolean; error?: string; data?: string; contentType?: string }>;

export async function fetchImageBlob(apiPreview: PreviewFn, url: string, format: string) {
  const data = await apiPreview(url);
  if (!data.ok) {
    throw new Error(data.error || "图片下载失败");
  }
  const binary = Uint8Array.from(atob(data.data!), (char) => char.charCodeAt(0));
  const serverType = data.contentType || "";
  const preferred = format ? mimeForFormat(format) : serverType;
  const type =
    format && format !== "png" && serverType.startsWith("image/png")
      ? preferred
      : serverType || preferred;
  return new Blob([binary], { type });
}

export function triggerBlobDownload(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}

export async function downloadSliceFile(
  apiPreview: PreviewFn,
  slice: SliceItem,
  options: { scale: string; format: string; source: string },
) {
  const url = resolveSliceDownloadUrl(slice, options);
  if (!url) {
    throw new Error(`${slice.name || slice.id}: 无可用下载 URL`);
  }
  const blob = await fetchImageBlob(apiPreview, url, options.format);
  const zipPath = zipPathForSlice(slice, options);
  const filename = zipPath.split("/").pop()!;
  triggerBlobDownload(blob, filename);
  return { filename, url };
}

export async function downloadSlicesZip(
  apiPreview: PreviewFn,
  slices: SliceItem[],
  options: { scale: string; format: string; source: string; designName?: string },
  onProgress?: (p: { done: number; total: number; current: string }) => void,
) {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const folder = zip.folder("assets/slices");
  let done = 0;
  const errors: string[] = [];

  for (const slice of slices) {
    try {
      const url = resolveSliceDownloadUrl(slice, options);
      if (!url) {
        throw new Error("无可用 URL");
      }
      const blob = await fetchImageBlob(apiPreview, url, options.format);
      const zipPath = zipPathForSlice(slice, options);
      const entryName = zipPath.replace(/^assets\/slices\//, "");
      folder!.file(entryName, blob);
    } catch (error) {
      errors.push(`${slice.name || slice.id}: ${(error as Error).message}`);
    }
    done += 1;
    onProgress?.({ done, total: slices.length, current: slice.name || slice.id || "" });
  }

  if (errors.length === slices.length) {
    throw new Error(errors[0] || "全部下载失败");
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  const designName = sanitizeFilename(options.designName || "design");
  const scaleTag = options.source === "scaleUrls" ? `@${options.scale}` : "";
  const formatTag = options.format !== "png" ? `.${options.format}` : "";
  triggerBlobDownload(zipBlob, `${designName}-slices${scaleTag}${formatTag}.zip`);

  return { ok: slices.length - errors.length, failed: errors.length, errors };
}
