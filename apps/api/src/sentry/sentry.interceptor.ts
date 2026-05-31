import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import * as Sentry from "@sentry/nestjs";
import { Observable, catchError, throwError } from "rxjs";

@Injectable()
export class SentryInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      catchError((error: unknown) => {
        Sentry.captureException(error);
        return throwError(() => error);
      }),
    );
  }
}
