import { createReadStream, existsSync } from "node:fs";
import { extname } from "node:path";

import { Body, Controller, Get, Inject, Post, Query, Res } from "@nestjs/common";
import type { Response } from "express";

import { PagesService } from "./pages.service.js";

const SCREENSHOT_MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

@Controller("api/pages")
export class PagesController {
  constructor(@Inject(PagesService) private readonly pages: PagesService) {}

  @Get("screenshot")
  screenshot(@Query("path") path: string | undefined, @Res() response: Response) {
    if (!path?.trim()) {
      response.status(400).json({ ok: false, message: "Missing query param: path" });
      return;
    }

    try {
      const filePath = this.pages.resolveScreenshotFile(path.trim());
      if (!existsSync(filePath)) {
        response.status(404).json({ ok: false, message: "Screenshot not found" });
        return;
      }

      const mimeType = SCREENSHOT_MIME_TYPES[extname(filePath).toLowerCase()] ?? "application/octet-stream";
      response.setHeader("Content-Type", mimeType);
      createReadStream(filePath).pipe(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = message.includes("outside") ? 403 : 500;
      response.status(status).json({ ok: false, message });
    }
  }

  @Post("list-documents")
  listDocuments(@Body() body: unknown) {
    return this.pages.listDocuments(body);
  }

  @Post("list")
  list(@Body() body: unknown) {
    return this.pages.list(body);
  }

  @Post("download")
  download(@Body() body: unknown) {
    return this.pages.download(body);
  }

  @Post("analyze")
  analyze(@Body() body: unknown) {
    return this.pages.analyze(body);
  }

  @Post("analyze-local")
  analyzeLocal(@Body() body: unknown) {
    return this.pages.analyzeLocal(body);
  }
}
