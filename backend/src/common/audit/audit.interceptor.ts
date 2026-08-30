import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { AuditLoggerService } from './audit-logger.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditLoggerService: AuditLoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const method = req.method;

    // Only auto-audit state modifying operations (POST, PUT, PATCH, DELETE)
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return next.handle();
    }

    const reqWithUser = req as Request & {
      user?: { id?: string; name?: string; email?: string; companyId?: string };
      companyId?: string;
    };

    const user = reqWithUser.user;
    const ip =
      (req.headers['x-forwarded-for'] as string) ||
      req.socket?.remoteAddress ||
      '127.0.0.1';
    const browser = (req.headers['user-agent'] as string) || 'Unknown';
    const route = req.originalUrl || req.url;

    return next.handle().pipe(
      tap((responseBody: unknown) => {
        if (this.auditLoggerService) {
          try {
            void this.auditLoggerService.logAction({
              userId: user?.id || null,
              userName: user?.name || user?.email || 'Anonymous',
              companyId: reqWithUser.companyId || user?.companyId || 'PLATFORM',
              action: `${method} ${route}`,
              oldValue: req.body as unknown,
              newValue: responseBody,
              ip,
              browser,
              details: `Executed ${method} on ${route}`,
            }).catch((err) => {
              console.error('Audit logging failed asynchronously:', err?.message || err);
            });
          } catch (error: any) {
            console.error('Audit logging interceptor failed:', error?.message || error);
          }
        }
      }),
    );
  }
}
