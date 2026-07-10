import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private logger = new Logger('GlobalExceptionFilter');

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(error: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (error instanceof HttpException) {
      status = error.getStatus();
      const res = error.getResponse();
      message = typeof res === 'string' ? res : (res as any).message || error.message;
    } else if (error instanceof Error) {
      message = error.message;
    }

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[500] ${ctx.getRequest().method} ${ctx.getRequest().url}`,
        error instanceof Error ? error.stack : error,
      );
    }

    const body = {
      statusCode: status,
      message: Array.isArray(message) ? message : [message],
      timestamp: new Date().toISOString(),
      path: ctx.getRequest().url,
    };

    httpAdapter.reply(ctx.getResponse(), body, status);
  }
}
