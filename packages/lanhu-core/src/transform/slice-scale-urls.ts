/** 构建切图各倍率/平台的 scaleUrls */

export type SliceImageFormat = "png" | "webp";

export function applyFormatToScaleUrl(url: string, format: SliceImageFormat): string {
  if (!url) {
    return url;
  }
  if (format === "png" && !url.includes("/format,")) {
    return url;
  }
  if (url.includes("/format,")) {
    return url.replace(/\/format,[^/]+/, `/format,${format}`);
  }
  const ossMatch = url.match(/([?&]x-oss-process=[^&]*)/);
  const ossParam = ossMatch?.[1];
  if (ossParam) {
    return url.replace(ossParam, `${ossParam}/format,${format}`);
  }
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}x-oss-process=image/format,${format}`;
}

function jsRound(value: number): number {
  return Math.floor(value + 0.5);
}

export function buildScaleUrls(
  imageUrl: string,
  logicalW: number,
  logicalH: number,
  sliceScale: number,
): Record<string, string> {
  if (!imageUrl || !logicalW || !logicalH) {
    return {};
  }

  const lw = Math.max(1, Math.round(logicalW));
  const lh = Math.max(1, Math.round(logicalH));
  const storedW = lw * sliceScale;
  const storedH = lh * sliceScale;

  const makeUrl = (w: number, h: number): string => {
    const width = Math.max(1, w);
    const height = Math.max(1, h);
    if (width === storedW && height === storedH) {
      return imageUrl;
    }
    return `${imageUrl}?x-oss-process=image/resize,w_${width},h_${height}/format,png`;
  };

  const iosBase = storedW / 4;

  return {
    "1x": makeUrl(lw * 1, lh * 1),
    "2x": makeUrl(lw * 2, lh * 2),
    "3x": makeUrl(lw * 3, lh * 3),
    ios_1x: makeUrl(Math.max(1, jsRound(iosBase * 1)), Math.max(1, jsRound((storedH / 4) * 1))),
    ios_2x: makeUrl(Math.max(1, jsRound(iosBase * 2)), Math.max(1, jsRound((storedH / 4) * 2))),
    ios_3x: makeUrl(Math.max(1, jsRound(iosBase * 3)), Math.max(1, jsRound((storedH / 4) * 3))),
    android_mdpi: makeUrl(Math.max(1, jsRound((storedW / 4) * 1)), Math.max(1, jsRound((storedH / 4) * 1))),
    android_hdpi: makeUrl(Math.max(1, jsRound((storedW / 4) * 1.5)), Math.max(1, jsRound((storedH / 4) * 1.5))),
    android_xhdpi: makeUrl(Math.max(1, jsRound((storedW / 4) * 2)), Math.max(1, jsRound((storedH / 4) * 2))),
    android_xxhdpi: makeUrl(Math.max(1, jsRound((storedW / 4) * 3)), Math.max(1, jsRound((storedH / 4) * 3))),
    android_xxxhdpi: makeUrl(storedW, storedH),
  };
}

export function buildPsScaleUrls(
  imageUrl: string,
  baseW: number,
  baseH: number,
): Record<string, string> {
  if (!imageUrl || !baseW || !baseH) {
    return {};
  }

  const bw = Math.max(1, Math.round(baseW));
  const bh = Math.max(1, Math.round(baseH));

  const makeUrl = (w: number, h: number): string => {
    const width = Math.max(1, w);
    const height = Math.max(1, h);
    return `${imageUrl}?x-oss-process=image/resize,w_${width},h_${height}/format,png`;
  };

  const oneXW = bw / 2;
  const oneXH = bh / 2;

  return {
    "1x": makeUrl(jsRound(oneXW), jsRound(oneXH)),
    "2x": makeUrl(bw, bh),
    "3x": makeUrl(jsRound(oneXW * 3), jsRound(oneXH * 3)),
    ios_1x: makeUrl(jsRound(oneXW), jsRound(oneXH)),
    ios_2x: makeUrl(bw, bh),
    ios_3x: makeUrl(jsRound(oneXW * 3), jsRound(oneXH * 3)),
    android_mdpi: makeUrl(jsRound(oneXW), jsRound(oneXH)),
    android_hdpi: makeUrl(jsRound(oneXW * 1.5), jsRound(oneXH * 1.5)),
    android_xhdpi: makeUrl(bw, bh),
    android_xxhdpi: makeUrl(jsRound(oneXW * 3), jsRound(oneXH * 3)),
    android_xxxhdpi: makeUrl(jsRound(oneXW * 4), jsRound(oneXH * 4)),
  };
}
