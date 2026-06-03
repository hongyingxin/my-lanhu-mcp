function getExt(remoteUrl) {
  try {
    const pathname = new URL(remoteUrl).pathname;
    const filename = pathname.split("/").pop() || "";
    if (filename.includes(".")) {
      const ext = `.${filename.split(".").pop()}`;
      if ([".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"].includes(ext)) return ext;
    }
  } catch {
    // ignore invalid URL
  }
  return ".png";
}

function sanitizeName(name) {
  return name.replace(/-\d+$/, "");
}

export function localizeImageUrls(htmlCode) {
  const urlToLocalPath = new Map();
  const urlMapping = {};
  const usedNames = new Set();
  let counter = 0;

  function uniqueName(base, ext) {
    let candidate = `${base}${ext}`;
    if (!usedNames.has(candidate)) {
      usedNames.add(candidate);
      return candidate;
    }
    let index = 2;
    while (true) {
      candidate = `${base}_${index}${ext}`;
      if (!usedNames.has(candidate)) {
        usedNames.add(candidate);
        return candidate;
      }
      index += 1;
    }
  }

  function getLocalPath(remoteUrl, hintClass) {
    if (urlToLocalPath.has(remoteUrl)) return urlToLocalPath.get(remoteUrl);
    const ext = getExt(remoteUrl);
    const base = hintClass ? sanitizeName(hintClass) : `img_${(counter += 1)}`;
    const name = uniqueName(base, ext);
    const localPath = `./assets/slices/${name}`;
    urlMapping[localPath] = remoteUrl;
    urlToLocalPath.set(remoteUrl, localPath);
    return localPath;
  }

  const urlToCssClass = new Map();
  const cssBlock = htmlCode.match(/<style>([\s\S]*?)<\/style>/i);
  if (cssBlock) {
    for (const ruleMatch of cssBlock[1].matchAll(/\.([\w-]+)\s*\{([^}]*)\}/g)) {
      const className = ruleMatch[1];
      for (const urlMatch of ruleMatch[2].matchAll(/url\(['"]?(https?:\/\/[^'") ]+)['"]?/g)) {
        if (!urlToCssClass.has(urlMatch[1])) urlToCssClass.set(urlMatch[1], className);
      }
    }
  }

  let result = htmlCode.replace(/<img\b[^>]*>/g, (tag) => {
    const srcMatch = tag.match(/src=["']?(https?:\/\/[^"'>\s]+)["']?/);
    if (!srcMatch) return tag;
    const url = srcMatch[1];
    const classMatch = tag.match(/class=["']([^"']+)["']/) || tag.match(/class=([^"'>\s]+)/);
    const hint = classMatch ? classMatch[1].split(/\s+/)[0] : urlToCssClass.get(url);
    const localPath = getLocalPath(url, hint);
    return tag.replace(srcMatch[1], localPath);
  });

  result = result.replace(/url\((['"]*)(https?:\/\/[^)]+)\1\)/g, (full, quote, url) => {
    const cleanUrl = url.trim().replace(/^['"]|['"]$/g, "");
    if (!cleanUrl.startsWith("http")) return full;
    const hint = urlToCssClass.get(cleanUrl);
    const localPath = getLocalPath(cleanUrl, hint);
    return `url('${localPath}')`;
  });

  return { html: result, mapping: urlMapping };
}
