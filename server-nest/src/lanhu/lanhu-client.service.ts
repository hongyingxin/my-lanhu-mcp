import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { LanhuClient } from "@lanhu/core";
import { getDdsCookie, getLanhuCookie } from "../env.js";
import {
  COOKIE_REQUIRED_MESSAGE,
  resolveRequestCookie,
  resolveRequestDdsCookie,
} from "../common/request.util.js";

@Injectable()
export class LanhuClientService {
  get hasEnvCookie(): boolean {
    return Boolean(getLanhuCookie());
  }

  resolveCookie(body: unknown): string {
    const cookie = resolveRequestCookie(body, getLanhuCookie());
    if (!cookie) {
      throw new ServiceUnavailableException(COOKIE_REQUIRED_MESSAGE);
    }
    return cookie;
  }

  createClient(body: unknown): LanhuClient {
    const cookie = this.resolveCookie(body);
    const ddsCookie = resolveRequestDdsCookie(body, getDdsCookie(), cookie);
    return new LanhuClient({ cookie, ddsCookie });
  }
}
