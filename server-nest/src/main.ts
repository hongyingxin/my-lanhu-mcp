import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { FallbackExceptionFilter, HttpExceptionFilter } from "./common/http-exception.filter.js";
import { getServerPort } from "./env.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  /** debug-vue :5173、debug-react :5174 及本机其它 dev 端口 */
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  });

  app.useGlobalFilters(new FallbackExceptionFilter(), new HttpExceptionFilter());

  const port = getServerPort();
  await app.listen(port);
  console.log(`[server-nest] listening on http://localhost:${port}`);
}

bootstrap().catch((error: unknown) => {
  console.error("[server-nest] failed to start", error);
  process.exit(1);
});
