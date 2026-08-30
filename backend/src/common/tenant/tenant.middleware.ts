/**
 * TenantMiddleware
 *
 * Single Responsibility: Early request stamping for logging/tracing only.
 *
 * NOTE: The actual authoritative tenant context is set by TenantInterceptor
 * AFTER JwtAuthGuard resolves the authenticated user from the JWT. This
 * middleware intentionally does NOT set TenantContextService to avoid
 * security issues with header-injection (a client could forge any companyId).
 *
 * This middleware runs before guards and serves only to:
 *   1. Add x-request-start header for latency measurement
 *   2. Pass-through all requests unchanged
 */
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Stamp request start time for logging
    (req as any)._requestStart = Date.now();
    next();
  }
}
