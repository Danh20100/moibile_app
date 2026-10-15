import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

import { ErrorResponseDto } from '../dto/api-response.dto';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (
      /^\/api\/v1\/finance\/checkouts\/demo\/pay(?:\/|\?|$)/i.test(
        request.originalUrl || request.url,
      )
    ) {
      const parser = exception as {
        type?: string;
        status?: number;
        getStatus?: () => number;
      } | null;
      const status =
        typeof parser?.getStatus === 'function'
          ? parser.getStatus()
          : isPayloadTooLarge(exception)
            ? HttpStatus.PAYLOAD_TOO_LARGE
            : parser?.type === 'entity.parse.failed' ||
                (exception instanceof URIError && parser?.status === 400)
              ? HttpStatus.BAD_REQUEST
              : HttpStatus.INTERNAL_SERVER_ERROR;
      const messages: Record<number, string> = {
        400: 'Bad request',
        403: 'Forbidden',
        404: 'Not found',
        409: 'Conflict',
        413: 'Payload too large',
        503: 'Service unavailable',
        500: 'Internal server error',
      };
      const safeStatus = messages[status] ? status : HttpStatus.INTERNAL_SERVER_ERROR;
      response.set({
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy':
          "default-src 'none'; script-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      });
      response.status(safeStatus).json({
        statusCode: safeStatus,
        timestamp: new Date().toISOString(),
        path: '/api/v1/finance/checkouts/demo/pay/[redacted]',
        message: messages[safeStatus],
      });
      return;
    }

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>;
        message = (resObj.message as string) || exception.message;
        errors = resObj.error || (Array.isArray(resObj.message) ? resObj.message : undefined);
      }
    } else if (isPayloadTooLarge(exception)) {
      status = HttpStatus.PAYLOAD_TOO_LARGE;
      message = 'Payload too large';
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled error: ${exception.message}`, exception.stack);
      message = exception.message;
    } else {
      this.logger.error('Unhandled non-error exception', exception);
    }

    const errorPayload: ErrorResponseDto = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
      ...(errors ? { errors } : {}),
    };

    response.status(status).json(errorPayload);
  }
}

function isPayloadTooLarge(exception: unknown): boolean {
  if (typeof exception !== 'object' || exception === null) return false;
  const value = exception as { status?: number; type?: string; statusCode?: number };
  return value.status === 413 || value.statusCode === 413 || value.type === 'entity.too.large';
}
