import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ApiRequestLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ApiRequestLogInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      method: string;
      path: string;
      headers: Record<string, string>;
      ip: string;
    }>();
    const startTime = Date.now();
    const method = request.method;
    const path = request.path;
    const actorId = request.headers['x-user-id'] ?? null;
    const ip = request.ip ?? null;

    return next.handle().pipe(
      tap({
        next: () => {
          const statusCode = context.switchToHttp().getResponse<{ statusCode: number }>().statusCode;
          this.writeLog(method, path, statusCode, Date.now() - startTime, actorId, ip);
        },
        error: (err: { status?: number }) => {
          const statusCode = err?.status ?? 500;
          this.writeLog(method, path, statusCode, Date.now() - startTime, actorId, ip);
        },
      }),
    );
  }

  private writeLog(
    method: string,
    path: string,
    statusCode: number,
    latencyMs: number,
    actorId: string | null,
    ip: string | null,
  ): void {
    this.prisma.apiRequestLog
      .create({ data: { method, path, statusCode, latencyMs, actorId, ip } })
      .catch((err: unknown) => {
        this.logger.error(`Failed to write ApiRequestLog: ${String(err)}`);
      });
  }
}
