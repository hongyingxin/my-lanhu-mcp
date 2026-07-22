import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  apiAnalyzePages,
  apiDownloadPages,
  apiListPages,
  apiListProductDocuments,
  prototypeScreenshotUrl,
} from "@/api/debug-api";
import type {
  ProductDocumentItem,
  ProductDocumentsListResult,
  PrototypeAnalyzeResult,
  PrototypeListResult,
} from "@/api/types";
import { parseLanhuUrl } from "@/api/parse-url";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setResult } from "@/store/inspectSlice";
import { prependLog } from "@/store/logsSlice";
import { persistToStorage } from "@/store/settingsSlice";
import {
  setPrototypeDocumentName,
  setPrototypeDocuments,
  setPrototypeOutputDir,
  setPrototypePages,
  setSelectedPrototypeDocId,
  setSelectedPrototypePageName,
} from "@/store/sessionSlice";
import { setPrototypeActiveTab, setPrototypeResultGroup, setLoading } from "@/store/uiSlice";
import { API_BASE } from "@/api/client";
import { selectHasCookie } from "./selectors";
import { changePrototypeUrl, showToast } from "./workspaceActions";

function isPrototypeProjectUrl(url: string): boolean {
  try {
    parseLanhuUrl(url);
    return url.includes("/product");
  } catch {
    return false;
  }
}

function pickInitialPageName(
  pages: PrototypeListResult["pages"],
  pageId: string | null | undefined,
): string | null {
  if (!pages?.length) return null;
  if (pageId) {
    const matched = pages.find((page) => page.id === pageId);
    if (matched) return matched.name;
  }
  return pages[0]?.name ?? null;
}

export function PrototypePanel() {
  const dispatch = useAppDispatch();
  const settings = useAppSelector((s) => s.settings);
  const prototypeParams = useAppSelector((s) => s.session.prototypeParams);
  const prototypeDocuments = useAppSelector((s) => s.session.prototypeDocuments);
  const selectedDocId = useAppSelector((s) => s.session.selectedPrototypeDocId);
  const pages = useAppSelector((s) => s.session.prototypePages);
  const selectedPageName = useAppSelector((s) => s.session.selectedPrototypePageName);
  const documentName = useAppSelector((s) => s.session.prototypeDocumentName);
  const outputDir = useAppSelector((s) => s.session.prototypeOutputDir);
  const loading = useAppSelector((s) => s.ui.loading);
  const hasCookie = useAppSelector(selectHasCookie);

  const url = settings.prototypeUrl.trim();

  const parsedPrototype = useMemo(() => {
    if (!url) return null;
    try {
      return parseLanhuUrl(url);
    } catch {
      return null;
    }
  }, [url]);

  const urlReady = Boolean(parsedPrototype) && url.includes("/product");
  const docId = prototypeParams?.doc_id ?? parsedPrototype?.doc_id ?? selectedDocId ?? null;
  const pageId = prototypeParams?.page_id ?? parsedPrototype?.page_id ?? null;
  const hasDocId = Boolean(docId);

  const hint = useMemo(() => {
    if (!url) return "请填写下方的原型 / PRD 地址（与设计稿 URL 独立）";
    if (!isPrototypeProjectUrl(url)) {
      return "当前 URL 不是原型项目链接，需使用 #/item/project/product?tid=...&pid=...";
    }
    if (!hasCookie && !settings.useMock) return "请先配置 Cookie";
    if (!hasDocId) {
      return "URL 未含 docId/image_id：请先点「获取项目文档列表」，再选择一份 PRD/原型。";
    }
    return null;
  }, [url, hasCookie, settings.useMock, hasDocId]);

  async function runAction(
    id: string,
    path: string,
    note: string,
    fn: () => Promise<void>,
  ) {
    dispatch(setLoading({ id, value: true }));
    const started = performance.now();
    try {
      await fn();
      dispatch(
        prependLog({
          ok: true,
          method: "POST",
          url: `${API_BASE}${path}`,
          status: 200,
          elapsedMs: Math.round(performance.now() - started),
          note,
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showToast(dispatch, message.split("\n")[0]!.slice(0, 120));
      dispatch(
        prependLog({
          ok: false,
          method: "POST",
          url: `${API_BASE}${path}`,
          status: 502,
          elapsedMs: Math.round(performance.now() - started),
          note: message.slice(0, 80),
        }),
      );
    } finally {
      dispatch(setLoading({ id, value: false }));
    }
  }

  const savePrototypeUrl = () => {
    dispatch(persistToStorage());
    showToast(dispatch, "原型 URL 已保存");
  };

  const listDocuments = () =>
    runAction("prototype-list-documents", "/api/pages/list-documents", "获取项目 PRD 列表", async () => {
      const data = (await apiListProductDocuments(url)) as ProductDocumentsListResult;
      if (!data.ok) throw new Error("获取项目文档列表失败");

      const documents = data.documents ?? [];
      dispatch(setPrototypeDocuments(documents));
      dispatch(setResult({ key: "prototypeDocuments", data }));
      dispatch(setPrototypeResultGroup("meta"));
      dispatch(setPrototypeActiveTab("prototypeDocuments"));

      if (!hasDocId && documents.length === 1 && documents[0]) {
        dispatch(setSelectedPrototypeDocId(documents[0].doc_id));
        dispatch(setPrototypeDocumentName(documents[0].name));
      }

      showToast(dispatch, `项目下共 ${documents.length} 份 PRD/原型`);
    });

  const listPages = () =>
    runAction("prototype-list", "/api/pages/list", "获取原型页面列表", async () => {
      const data = (await apiListPages(url, docId)) as PrototypeListResult;
      if (!data.ok) throw new Error("获取页面列表失败");

      const pageItems = data.pages ?? [];
      dispatch(setPrototypePages(pageItems));
      dispatch(setPrototypeDocumentName(data.document_name ?? null));
      dispatch(setSelectedPrototypePageName(pickInitialPageName(pageItems, pageId)));
      dispatch(setResult({ key: "prototypeList", data }));
      dispatch(setPrototypeResultGroup("meta"));
      dispatch(setPrototypeActiveTab("prototypeList"));
      showToast(dispatch, `已加载 ${pageItems.length} 个页面`);
    });

  const downloadPages = (forceUpdate = false) => {
    const actionId = forceUpdate ? "prototype-download-force" : "prototype-download";
    return runAction(actionId, "/api/pages/download", "下载 Axure 资源", async () => {
      const data = (await apiDownloadPages({ url, docId, forceUpdate })) as {
        ok?: boolean;
        status?: string;
        output_dir?: string;
      };
      if (!data.ok) throw new Error("下载失败");

      dispatch(setPrototypeOutputDir(data.output_dir ?? null));
      dispatch(setResult({ key: "prototypeDownload", data }));
      dispatch(setPrototypeResultGroup("meta"));
      dispatch(setPrototypeActiveTab("prototypeDownload"));
      showToast(dispatch, `下载完成：${data.status ?? "done"}`);
    });
  };

  const analyzeSelectedPage = (forceUpdate = false) => {
    if (!selectedPageName) {
      showToast(dispatch, "请先在页面列表中选择一页");
      return;
    }
    return runAction("prototype-analyze", "/api/pages/analyze", `分析页面：${selectedPageName}`, async () => {
      const data = (await apiAnalyzePages({
        url,
        docId,
        pageNames: selectedPageName,
        forceUpdate,
      })) as PrototypeAnalyzeResult;
      if (!data.ok) throw new Error("页面分析失败");

      dispatch(setPrototypeOutputDir(data.output_dir ?? null));
      if (data.document?.pages?.length) {
        dispatch(setPrototypePages(data.document.pages));
        dispatch(setPrototypeDocumentName(data.document.document_name ?? null));
      }

      const firstSuccess = data.results?.find((item) => item.success);
      if (firstSuccess) {
        const matchedPage = data.document?.pages?.find(
          (page) => page.filename.replace(/\.html$/i, "") === firstSuccess.page_name,
        );
        dispatch(setSelectedPrototypePageName(matchedPage?.name ?? firstSuccess.page_name));
      }

      const screenshots = (data.results ?? [])
        .filter((item) => item.success && item.screenshot_path)
        .map((item) => ({
          page_name: item.page_name,
          screenshot_path: item.screenshot_path!,
          screenshot_url: prototypeScreenshotUrl(item.screenshot_path!),
          from_cache: item.from_cache ?? false,
          size: item.size,
        }));

      dispatch(setResult({ key: "prototypeScreenshots", data: screenshots }));
      dispatch(setResult({ key: "prototypeAnalyze", data }));
      dispatch(setPrototypeResultGroup("output"));
      dispatch(setPrototypeActiveTab("prototypeScreenshots"));
      showToast(
        dispatch,
        `分析完成 ${data.successful ?? 0}/${data.total_requested ?? 0}`,
      );
    });
  };

  const selectDocument = (document: ProductDocumentItem) => {
    dispatch(setSelectedPrototypeDocId(document.doc_id));
    dispatch(setPrototypeDocumentName(document.name));
    dispatch(setPrototypePages([]));
    dispatch(setSelectedPrototypePageName(null));
    dispatch(setPrototypeOutputDir(null));
    showToast(dispatch, `已选文档：${document.name}`);
  };

  const selectPage = (pageName: string) => {
    dispatch(setSelectedPrototypePageName(pageName));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">原型 / PRD</CardTitle>
          <p className="text-muted-foreground text-xs">
            支持 tid+pid 项目链接（先列文档），或带 docId/image_id 的文档链接；pageId 用于预选页面。
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="block space-y-1 text-sm">
            <span className="text-muted-foreground">蓝湖原型 URL</span>
            <input
              className="border-input bg-background h-9 w-full rounded-md border px-3 font-mono text-xs"
              value={settings.prototypeUrl}
              onChange={(e) =>
                changePrototypeUrl(dispatch, e.target.value, settings.prototypeUrl)
              }
              placeholder="https://lanhuapp.com/web/#/item/project/product?tid=...&pid=..."
            />
          </label>
          <Button variant="secondary" size="sm" onClick={savePrototypeUrl}>
            保存原型 URL
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">操作</CardTitle>
          <p className="text-muted-foreground text-xs">
            Playwright 渲染：fix HTML → 浏览器提取文本/样式 → 全页截图。
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {hint ? (
            <p className="text-amber-700 dark:text-amber-300 text-sm">{hint}</p>
          ) : (
            <div className="text-muted-foreground grid gap-1 text-xs sm:grid-cols-2">
              <span>文档：{documentName ?? "—"}</span>
              <span>docId：{docId ?? "（待选文档）"}</span>
              {pageId ? <span className="sm:col-span-2">pageId：{pageId}</span> : null}
              <span className="sm:col-span-2">缓存目录：{outputDir ?? "（下载/分析后显示）"}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!urlReady || Boolean(loading["prototype-list-documents"])}
              onClick={() => listDocuments()}
            >
              {loading["prototype-list-documents"] ? "加载中…" : "0. 获取项目文档列表"}
            </Button>
            <Button
              size="sm"
              disabled={!urlReady || !hasDocId || Boolean(loading["prototype-list"])}
              onClick={() => listPages()}
            >
              {loading["prototype-list"] ? "加载中…" : "1. 获取页面列表"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!urlReady || !hasDocId || Boolean(loading["prototype-download"])}
              onClick={() => downloadPages(false)}
            >
              {loading["prototype-download"] ? "下载中…" : "2. 下载资源"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!urlReady || !hasDocId || Boolean(loading["prototype-download-force"])}
              onClick={() => downloadPages(true)}
            >
              {loading["prototype-download-force"] ? "下载中…" : "强制重新下载"}
            </Button>
            <Button
              size="sm"
              disabled={!urlReady || !hasDocId || !selectedPageName || Boolean(loading["prototype-analyze"])}
              onClick={() => analyzeSelectedPage()}
            >
              {loading["prototype-analyze"] ? "分析中…" : "3. 分析选中页面"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {prototypeDocuments.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">项目文档（{prototypeDocuments.length}）</CardTitle>
            <p className="text-muted-foreground text-xs">
              无 docId 时先选一份文档，再获取页面列表 / 下载 / 分析。
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {prototypeDocuments.map((document) => (
                <button
                  key={document.doc_id}
                  type="button"
                  onClick={() => selectDocument(document)}
                  className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                    selectedDocId === document.doc_id
                      ? "border-primary bg-primary/5"
                      : "border-input hover:bg-accent"
                  }`}
                >
                  <strong className="block truncate">{document.name}</strong>
                  <small className="text-muted-foreground font-mono block truncate text-[11px]">
                    {document.doc_id}
                  </small>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {pages.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">页面列表（{pages.length}）</CardTitle>
            <p className="text-muted-foreground text-xs">
              点击选择页面，再点「分析选中页面」。层级通过缩进展示。
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {pages.map((page) => (
                <button
                  key={`${page.id}-${page.index}`}
                  type="button"
                  onClick={() => selectPage(page.name)}
                  className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                    selectedPageName === page.name
                      ? "border-primary bg-primary/5"
                      : "border-input hover:bg-accent"
                  }`}
                  style={{ marginLeft: `${page.level * 12}px` }}
                >
                  <strong className="block truncate">
                    #{page.index} {page.name}
                  </strong>
                  <small className="text-muted-foreground block truncate">{page.path}</small>
                  <small className="text-muted-foreground font-mono block truncate text-[11px]">
                    {page.filename}
                  </small>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
