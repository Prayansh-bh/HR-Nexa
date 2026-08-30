import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { assertSubscriptionActive } from '../../common/tenant/tenant-validation.util';
import { IS_PUBLIC_KEY } from './public.decorator';

/**
 * SubscriptionGuard
 *
 * Dedicated guard that verifies company plan feature entitlements.
 * Separated from PermissionsGuard to adhere to SRP (Single Responsibility Principle).
 *
 * Pipeline Flow:
 * JwtAuthGuard -> RolesGuard -> SubscriptionGuard -> PermissionsGuard
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  private static planFeaturesCache = new Map<string, Set<string>>();

  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const user = req.user;

    if (!user) {
      throw new ForbiddenException('User context missing or unauthenticated');
    }

    // SuperAdmin root bypasses subscription feature checks
    if (user.role === 'SuperAdmin') {
      return true;
    }

    // Centrally enforce subscription active & expiry rules
    assertSubscriptionActive(user.role, user.subscription);

    return true;
  }
}
