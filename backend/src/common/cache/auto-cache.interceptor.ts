import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { CacheService } from './cache.service';

@Injectable()
export class AutoCacheInterceptor implements NestInterceptor {
  constructor(private readonly cacheService: CacheService) {
    // Invalidate any legacy corrupted cache keys on startup
    this.cacheService.delByPattern('dashboard:*');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const method = req.method;
    const url = req.originalUrl || req.url;

    const reqWithTenant = req as Request & { companyId?: string };
    const companyId = reqWithTenant.companyId || 'DEFAULT_COMPANY';

    // Invalidate caches on state modifications
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      if (url.includes('/employees')) {
        this.cacheService.delByPattern(`employees:*`);
        this.cacheService.delByPattern(`*dashboard*`);
        this.cacheService.delByPattern(`reports:*`);
      } else if (url.includes('/leave')) {
        this.cacheService.delByPattern(`*dashboard*`);
        this.cacheService.delByPattern(`reports:*`);
      } else if (url.includes('/payroll')) {
        this.cacheService.delByPattern(`*dashboard*`);
        this.cacheService.delByPattern(`reports:*`);
      } else if (url.includes('/attendance')) {
        this.cacheService.delByPattern(`*dashboard*`);
        this.cacheService.delByPattern(`reports:*`);
      }

      return next.handle();
    }

    // Cache read endpoints with strict, non-colliding route namespaces
    if (method === 'GET') {
      let cacheKey: string | null = null;
      let ttl = 60;

      if (url.includes('/super-admin/dashboard-stats')) {
        cacheKey = `super-admin-dashboard:${companyId}`;
        ttl = 60;
      } else if (url.includes('/plans/stats/dashboard')) {
        cacheKey = `plans-dashboard:${companyId}`;
        ttl = 60;
      } else if (url.includes('/dashboard/metrics')) {
        cacheKey = `tenant-dashboard:${companyId}`;
        ttl = 60;
      } else if (url.includes('/reports/stats')) {
        cacheKey = `reports-stats:${companyId}`;
        ttl = 60;
      }

      if (cacheKey) {
        const cachedResponse = this.cacheService.get(cacheKey);
        if (cachedResponse !== null) {
          return of(cachedResponse);
        }

        return next.handle().pipe(
          tap((responseBody: unknown) => {
            if (cacheKey && responseBody !== undefined) {
              this.cacheService.set(cacheKey, responseBody, ttl);
            }
          }),
        );
      }
    }

    return next.handle();
  }
}
