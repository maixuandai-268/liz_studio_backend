import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

@Injectable()
export class ActivityLogInterceptor implements NestInterceptor {
  private logger = new Logger('ActivityLog');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const { method, url } = req;
    const userId = req.user?.id || req.user?.sub || 'anonymous';
    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: () =>
          this.logger.log(`[${userId}] ${method} ${url} ${Date.now() - now}ms`),
        error: (err: any) =>
          this.logger.error(`[${userId}] ${method} ${url} — ${err.message}`),
      }),
    );
  }
}
