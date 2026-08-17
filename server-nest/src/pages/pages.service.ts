import { join, resolve } from "node:path";
import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";
import {
  analyzeLocalPage,
  analyzePrototypePages,
  createLanhuFetch,
  downloadResources,
  getPrototypeDocumentInfo,
  listPages,
  listProductDocuments,
  parseLanhuUrl,
  resolveAxureOutputDir,
  resolveAxureScreenshotDir,
  resolvePrototypeDocumentUrl,
} from "@lanhu/core";
import { LanhuClientService } from "../lanhu/lanhu-client.service.js";
import {
  getBooleanField,
  getStringField,
  resolveRequestDdsCookie,
  toErrorMessage,
} from "../common/request.util.js";
import { getLanhuDataDir } from "../env.js";

@Injectable()
export class PagesService {
  constructor(@Inject(LanhuClientService) private readonly lanhu: LanhuClientService) {}

  private wrap<T>(fn: () => Promise<T>): Promise<T> {
    return fn().catch((error: unknown) => {
      throw new BadGatewayException(toErrorMessage(error));
    });
  }

  private createFetch(body: unknown) {
    const cookie = this.lanhu.resolveCookie(body);
    const ddsCookie = resolveRequestDdsCookie(body, undefined, cookie);
    return createLanhuFetch({ cookie, ddsCookie });
  }

  private resolveProjectPrototypeUrl(body: unknown): string {
    const url = getStringField(body, "url");
    if (!url) {
      throw new BadRequestException("Missing required field: url");
    }

    const parsed = parseLanhuUrl(url);
    if (parsed.kind !== "prototype") {
      throw new BadRequestException(
        "URL must be a prototype/PRD link (#/item/project/product?tid=...&pid=...)",
      );
    }
    if (!parsed.teamId) {
      throw new BadRequestException("Missing required param tid in prototype URL");
    }

    return url;
  }

  private resolveDocumentContext(body: unknown): { url: string; docId: string } {
    const url = this.resolveProjectPrototypeUrl(body);
    const parsed = parseLanhuUrl(url);
    const docId =
      getStringField(body, "docId")
      ?? getStringField(body, "doc_id")
      ?? getStringField(body, "imageId")
      ?? getStringField(body, "image_id")
      ?? parsed.docId;

    if (!docId) {
      throw new BadRequestException(
        "Missing docId/image_id. Add it to the URL, or call /api/pages/list-documents first and pass doc_id in the request body.",
      );
    }

    return {
      url: resolvePrototypeDocumentUrl(url, docId),
      docId,
    };
  }

  private documentNameFromInfo(docInfo: Record<string, unknown>): string {
    const name = docInfo["name"];
    return typeof name === "string" && name.trim() ? name.trim() : "Unknown";
  }

  private async resolveDefaultPackageDir(
    fetchImpl: ReturnType<typeof createLanhuFetch>,
    url: string,
    docId: string,
  ): Promise<string> {
    const parsed = parseLanhuUrl(url);
    const docInfo = await getPrototypeDocumentInfo(fetchImpl, parsed.projectId, docId);
    return resolveAxureOutputDir(
      getLanhuDataDir(),
      parsed.projectId,
      docId,
      this.documentNameFromInfo(docInfo),
    );
  }

  private async resolveDefaultScreenshotDir(
    fetchImpl: ReturnType<typeof createLanhuFetch>,
    url: string,
    docId: string,
  ): Promise<string> {
    const parsed = parseLanhuUrl(url);
    const docInfo = await getPrototypeDocumentInfo(fetchImpl, parsed.projectId, docId);
    return resolveAxureScreenshotDir(
      getLanhuDataDir(),
      parsed.projectId,
      docId,
      this.documentNameFromInfo(docInfo),
    );
  }

  private async resolvePackageOutputDir(
    body: unknown,
    fetchImpl: ReturnType<typeof createLanhuFetch>,
    url: string,
    docId: string,
  ): Promise<string> {
    const custom = getStringField(body, "outputDir") ?? getStringField(body, "output_dir");
    if (custom?.trim()) {
      return custom.trim();
    }
    return this.wrap(() => this.resolveDefaultPackageDir(fetchImpl, url, docId));
  }

  private async resolveScreenshotOutputDir(
    body: unknown,
    fetchImpl: ReturnType<typeof createLanhuFetch>,
    url: string,
    docId: string,
    packageDir: string,
  ): Promise<string> {
    const custom =
      getStringField(body, "screenshotOutputDir") ?? getStringField(body, "screenshot_output_dir");
    if (custom?.trim()) {
      return custom.trim();
    }

    const customPackage = getStringField(body, "outputDir") ?? getStringField(body, "output_dir");
    if (customPackage?.trim()) {
      return join(customPackage.trim(), "screenshots");
    }

    return this.wrap(() => this.resolveDefaultScreenshotDir(fetchImpl, url, docId));
  }

  async listDocuments(body: unknown) {
    const url = this.resolveProjectPrototypeUrl(body);
    const parsed = parseLanhuUrl(url);
    const fetchImpl = this.createFetch(body);
    const result = await this.wrap(() =>
      listProductDocuments(fetchImpl, parsed.teamId!, parsed.projectId),
    );
    return { ok: true, ...result };
  }

  async list(body: unknown) {
    const { url } = this.resolveDocumentContext(body);
    const fetchImpl = this.createFetch(body);
    const result = await this.wrap(() => listPages(fetchImpl, url));
    return { ok: true, ...result };
  }

  async download(body: unknown) {
    const { url, docId } = this.resolveDocumentContext(body);
    const fetchImpl = this.createFetch(body);
    const outputDir = await this.resolvePackageOutputDir(body, fetchImpl, url, docId);
    const forceUpdate = getBooleanField(body, "forceUpdate") ?? getBooleanField(body, "force_update") ?? false;
    const result = await this.wrap(() => downloadResources(fetchImpl, url, outputDir, forceUpdate));
    return { ok: true, ...result };
  }

  async analyze(body: unknown) {
    const { url, docId } = this.resolveDocumentContext(body);
    const fetchImpl = this.createFetch(body);
    const outputDir = await this.resolvePackageOutputDir(body, fetchImpl, url, docId);
    const screenshotOutputDir = await this.resolveScreenshotOutputDir(
      body,
      fetchImpl,
      url,
      docId,
      outputDir,
    );
    const pageNames = getStringField(body, "pageName")
      ?? getStringField(body, "page_name")
      ?? getStringField(body, "pageNames")
      ?? getStringField(body, "page_names");
    if (!pageNames) {
      throw new BadRequestException("Missing required field: page_names (select a page to analyze)");
    }
    const forceUpdate = getBooleanField(body, "forceUpdate") ?? getBooleanField(body, "force_update") ?? false;

    const result = await this.wrap(() =>
      analyzePrototypePages(fetchImpl, url, outputDir, pageNames, {
        forceDownload: forceUpdate,
        screenshotOutputDir,
      }),
    );

    return {
      ok: true,
      output_dir: outputDir,
      screenshot_output_dir: result.screenshot_output_dir,
      total_requested: result.results.length,
      successful: result.results.filter((item) => item.success).length,
      failed: result.results.filter((item) => !item.success).length,
      document: result.document,
      download: result.download,
      results: result.results,
    };
  }

  resolveScreenshotFile(absPath: string): string {
    const dataRoot = resolve(getLanhuDataDir());
    const normalized = resolve(absPath);
    if (!normalized.startsWith(dataRoot)) {
      throw new ForbiddenException("Screenshot path is outside LANHU_DATA_DIR");
    }
    return normalized;
  }

  async analyzeLocal(body: unknown) {
    const pageName = getStringField(body, "pageName") ?? getStringField(body, "page_name");
    const outputDir = getStringField(body, "outputDir") ?? getStringField(body, "output_dir");
    if (!pageName) {
      throw new BadRequestException("Missing required field: pageName");
    }
    if (!outputDir) {
      throw new BadRequestException("Missing required field: outputDir");
    }

    const result = await this.wrap(() => analyzeLocalPage(outputDir, pageName));
    return { ok: true, result };
  }
}
