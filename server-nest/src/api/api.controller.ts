import { BadRequestException, Body, Controller, Get, Inject, Post } from "@nestjs/common";
import { parseLanhuUrl } from "@lanhu/core";
import { getStringField, toErrorMessage } from "../common/request.util.js";
import { LanhuClientService } from "../lanhu/lanhu-client.service.js";

@Controller("api")
export class ApiController {
  constructor(@Inject(LanhuClientService) private readonly lanhu: LanhuClientService) {}

  @Get("health")
  health() {
    return { ok: true, hasEnvCookie: this.lanhu.hasEnvCookie };
  }

  @Post("parse-url")
  parseUrl(@Body() body: unknown) {
    const url = getStringField(body, "url");
    if (!url) {
      throw new BadRequestException("Missing required field: url");
    }

    try {
      const params = parseLanhuUrl(url);
      return { ok: true, params };
    } catch (error) {
      throw new BadRequestException(toErrorMessage(error));
    }
  }
}
