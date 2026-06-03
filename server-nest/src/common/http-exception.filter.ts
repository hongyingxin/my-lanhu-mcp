import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { Response } from "express";

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    let message: string;
    if (typeof exceptionResponse === "string") {
      message = exceptionResponse;
    } else if (
      typeof exceptionResponse === "object" &&
      exceptionResponse !== null &&
      "message" in exceptionResponse
    ) {
      const raw = (exceptionResponse as { message: string | string[] }).message;
      message = Array.isArray(raw) ? raw.join("; ") : raw;
    } else {
      message = exception.message;
    }

    response.status(status).json({ ok: false, error: message });
  }
}

@Catch()
export class FallbackExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const message = error instanceof Error ? error.message : String(error);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ ok: false, error: message });
  }
}
