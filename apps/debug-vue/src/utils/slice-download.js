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
];

export const SLICE_SCALE_KEYS = SLICE_SCALE_GROUPS.flatMap((group) => group.keys);

export const SLICE_FORMAT_OPTIONS = [
  { value: "png", label: "PNG" },
  { value: "webp", label: "WebP" },
  { value: "svg", label: "SVG（矢量）" },
];

export function applyFormatToUrl(url, format) {
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
    return url.replace(ossMatch[1], `${ossMatch[1]}/format,${format}`);
  }
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}x-oss-process=image/format,${format}`;
}

export function replacePathExtension(path, format) {
  if (!path || format === "svg") {
    return path;
  }
  return path.replace(/\.(png|jpe?g|webp|gif)$/i, extForFormat(format));
}

export function sanitizeFilename(name) {
  return (name || "slice")
    .replace(/[^\w\u4e00-\u9fa5.-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

export function extForFormat(format) {
  if (format === "webp") return ".webp";
  if (format === "svg") return ".svg";
  return ".png";
}

/** B 套：getSlices 条目 */
export function resolveScaleUrl(slice, scale) {
  if (slice.format === "svg") {
    return slice.svgUrl || slice.downloadUrl;
  }
  if (slice.scaleUrls?.[scale]) {
    return slice.scaleUrls[scale];
  }
  return slice.downloadUrl;
}

export function resolveSliceDownloadUrl(slice, { scale, format, source }) {
  if (slice.format === "svg") {
    return slice.svgUrl || slice.downloadUrl;
  }
  if (format === "svg") {
    return slice.svgUrl || null;
  }

  let url = slice.downloadUrl;
  if (source === "scaleUrls") {
    url = resolveScaleUrl(slice, scale);
  }

  return applyFormatToUrl(url, format);
}

export function zipPathForSlice(slice, { scale, format, source }) {
  if (source === "mapping" && slice.localPath) {
    let path = slice.localPath.replace(/^\.\//, "");
    if (format && slice.format !== "svg") {
      path = replacePathExtension(path, format);
    }
    return path;
  }

  const base = sanitizeFilename(slice.name || slice.id || "slice");
  const ext = extForFormat(format);
  if (source === "scaleUrls" && scale && scale !== "1x") {
    return `assets/slices/${base}@${scale}${ext}`;
  }
  return `assets/slices/${base}${ext}`;
}

export function mappingToSliceItems(mapping) {
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

function mimeForFormat(format) {
  if (format === "webp") return "image/webp";
  if (format === "svg") return "image/svg+xml";
  return "image/png";
}

export async function fetchImageBlob(apiPreview, url, format) {
  const data = await apiPreview(url);
  if (!data.ok) {
    throw new Error(data.error || "图片下载失败");
  }
  const binary = Uint8Array.from(atob(data.data), (char) => char.charCodeAt(0));
  const serverType = data.contentType || "";
  const preferred = format ? mimeForFormat(format) : serverType;
  const type =
    format && format !== "png" && serverType.startsWith("image/png")
      ? preferred
      : serverType || preferred;
  return new Blob([binary], { type });
}

export function triggerBlobDownload(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}

export async function downloadSliceFile(apiPreview, slice, options) {
  const url = resolveSliceDownloadUrl(slice, options);
  if (!url) {
    throw new Error(`${slice.name || slice.id}: 无可用下载 URL`);
  }
  const blob = await fetchImageBlob(apiPreview, url, options.format);
  const zipPath = zipPathForSlice(slice, options);
  const filename = zipPath.split("/").pop();
  triggerBlobDownload(blob, filename);
  return { filename, url };
}

export async function downloadSlicesZip(apiPreview, slices, options, onProgress) {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const folder = zip.folder("assets/slices");
  let done = 0;
  const errors = [];

  for (const slice of slices) {
    try {
      const url = resolveSliceDownloadUrl(slice, options);
      if (!url) {
        throw new Error("无可用 URL");
      }
      const blob = await fetchImageBlob(apiPreview, url, options.format);
      const zipPath = zipPathForSlice(slice, options);
      const entryName = zipPath.replace(/^assets\/slices\//, "");
      folder.file(entryName, blob);
    } catch (error) {
      errors.push(`${slice.name || slice.id}: ${error.message}`);
    }
    done += 1;
    onProgress?.({ done, total: slices.length, current: slice.name || slice.id });
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
