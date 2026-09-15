import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { PLATFORM_CORE_PERMISSIONS, permissionToFeatureKey } from '../../scripts/seed-permissions';

/**
 * PermissionsGuard
 *
 * Infrastructure Guard that verifies fine-grained RBAC permissions attached to `req.user.permissions`
 * by `JwtStrategy`. Designed to safely coexist with `RolesGuard`.
 *
 * Authorization Pipeline Flow:
 * 1. SuperAdmin Bypass: SuperAdmin role automatically bypasses permission checks.
 * 2. Unrestricted Routes: Endpoints with no `@Permissions()` decorator return `true`.
 * 3. Role Permission Verification: Checks `req.user.permissions` (pre-computed by JwtStrategy).
 *    Supports backward-compatible alias matching between legacy and granular permission keys.
 * 4. Plan Entitlement Verification: Verifies required permissions match enabled features in company plan.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  private static permissionToFeatureMap = new Map<string, string>();
  private static planVersionFeaturesCache = new Map<string, Set<string>>();

  public static clearCache(planVersionId?: string) {
    if (planVersionId) {
      PermissionsGuard.planVersionFeaturesCache.delete(planVersionId);
    } else {
      PermissionsGuard.planVersionFeaturesCache.clear();
      PermissionsGuard.permissionToFeatureMap.clear();
    }
  }

  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Flow Step 2: Allow unrestricted access if no @Permissions() decorator is specified
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const req = context
      .switchToHttp()
      .getRequest<{ user?: { role?: string; subscription?: any; id?: string; email?: string } }>();
    const user = req.user;

    if (!user || !user.role) {
      throw new ForbiddenException('User context missing or unauthenticated');
    }

    // Flow Step 1: SuperAdmin root bypass
    if (user.role === 'SuperAdmin') {
      return true;
    }

    // Flow Step 3: Role Permission Verification (reads pre-loaded req.user.permissions)
    const userPermissions: string[] = (user as any).permissions || [];
    const hasRolePermission = requiredPermissions.every((permission) => {
      if (userPermissions.includes(permission)) return true;

      // Alias matching between legacy permission keys and new granular action keys
      if (
        permission === 'attendance:clock' ||
        permission === 'employees:attendance:clock'
      ) {
        return (
          userPermissions.includes('attendance:clock') ||
          userPermissions.includes('employees:attendance:clock')
        );
      }
      if (
        permission === 'employees:read' ||
        permission === 'employees:list:view'
      ) {
        return (
          userPermissions.includes('employees:read') ||
          userPermissions.includes('employees:list:view')
        );
      }
      if (
        permission === 'payroll:read' ||
        permission === 'payroll:process:view' ||
        permission === 'payroll:process:lock' ||
        permission === 'payroll:process:reopen'
      ) {
        return (
          userPermissions.includes(permission) ||
          userPermissions.includes('payroll:read') ||
          userPermissions.includes('payroll:process') ||
          userPermissions.includes('payroll:process:view') ||
          userPermissions.includes('payroll:process:run')
        );
      }
      if (
        permission === 'leaves:view' ||
        permission === 'leaves:requests:view'
      ) {
        return (
          userPermissions.includes('leaves:view') ||
          userPermissions.includes('leaves:requests:view') ||
          userPermissions.includes('leaves:policy:manage')
        );
      }
      if (
        permission === 'system:audit:read' ||
        permission === 'system:audit:view'
      ) {
        return (
          userPermissions.includes('system:audit:read') ||
          userPermissions.includes('system:audit:view')
        );
      }
      if (
        permission === 'support:tickets:view' ||
        permission === 'support:tickets:create' ||
        permission === 'support:tickets:message' ||
        permission === 'support:tickets:status' ||
        permission === 'support:tickets:resolve' ||
        permission === 'support:tickets:close'
      ) {
        return (
          userPermissions.includes(permission) ||
          userPermissions.includes('chatbox:access')
        );
      }
      if (permission === 'system:announcement:create') {
        return userPermissions.includes('system:announcement:create');
      }
      if (permission === 'settings:roles:view') {
        return userPermissions.includes('settings:roles:view');
      }
      if (permission === 'settings:roles:edit') {
        return userPermissions.includes('settings:roles:edit');
      }
      if (
        permission === 'settings:company:view' ||
        permission === 'settings:company:edit'
      ) {
        return userPermissions.includes(permission);
      }
      if (
        permission === 'employees:departments:manage' ||
        permission === 'departments:manage'
      ) {
        return (
          userPermissions.includes('employees:departments:manage') ||
          userPermissions.includes('departments:manage') ||
          userPermissions.includes('departments:read') ||
          userPermissions.includes('employees:list:view') ||
          userPermissions.includes('employees:read')
        );
      }
      if (permission === 'employees:designations:manage') {
        return (
          userPermissions.includes('employees:designations:manage') ||
          userPermissions.includes('departments:read') ||
          userPermissions.includes('employees:list:view') ||
          userPermissions.includes('employees:read')
        );
      }
      if (
        permission === 'employees:profile:docs:upload' ||
        permission === 'documents:write'
      ) {
        return (
          userPermissions.includes('employees:profile:docs:upload') ||
          userPermissions.includes('documents:write') ||
          userPermissions.includes('recruitment:candidates:hire') ||
          userPermissions.includes('recruitment:candidates:movestage')
        );
      }
      if (
        permission === 'employees:profile:docs:download' ||
        permission === 'documents:read'
      ) {
        return (
          userPermissions.includes('employees:profile:docs:download') ||
          userPermissions.includes('documents:read') ||
          userPermissions.includes('expenses:claims:manage') ||
          userPermissions.includes('expenses:claims:view') ||
          userPermissions.includes('expenses:manage') ||
          userPermissions.includes('expenses:view')
        );
      }
      if (permission === 'documents:verify') {
        return userPermissions.includes('documents:verify');
      }
      if (
        permission === 'expenses:claims:view' ||
        permission === 'expenses:view'
      ) {
        return (
          userPermissions.includes('expenses:claims:view') ||
          userPermissions.includes('expenses:view')
        );
      }
      if (
        permission === 'expenses:claims:submit' ||
        permission === 'expenses:submit'
      ) {
        return (
          userPermissions.includes('expenses:claims:submit') ||
          userPermissions.includes('expenses:submit')
        );
      }
      if (
        permission === 'expenses:claims:approve' ||
        permission === 'expenses:approve'
      ) {
        return (
          userPermissions.includes('expenses:claims:approve') ||
          userPermissions.includes('expenses:approve')
        );
      }
      if (
        permission === 'expenses:claims:manage' ||
        permission === 'expenses:manage'
      ) {
        return (
          userPermissions.includes('expenses:claims:manage') ||
          userPermissions.includes('expenses:manage')
        );
      }
      if (
        permission === 'expenses:claims:pay' ||
        permission === 'expenses:pay'
      ) {
        return (
          userPermissions.includes('expenses:claims:pay') ||
          userPermissions.includes('expenses:pay')
        );
      }
      return false;
    });

    if (!hasRolePermission) {
      throw new ForbiddenException(
        'Insufficient permissions to perform this action',
      );
    }

    // Flow Step 4: Verify Subscription Plan Feature Entitlement (FAIL-CLOSED)
    const requiredFeatureKeys = new Set<string>();

    for (const permission of requiredPermissions) {
      // Platform core permissions are baseline and do not require plan feature gating
      if (PLATFORM_CORE_PERMISSIONS.has(permission)) {
        continue;
      }

      let featureKey = PermissionsGuard.permissionToFeatureMap.get(permission) || permissionToFeatureKey[permission];

      if (!featureKey) {
        const permRecord = await (this.prisma as any).permission.findUnique({
          where: { key: permission },
          include: { feature: true },
        });

        if (permRecord && permRecord.feature) {
          featureKey = permRecord.feature.key;
          PermissionsGuard.permissionToFeatureMap.set(permission, featureKey);
        }
      }

      if (!featureKey) {
        // Unknown or unmapped permission key MUST FAIL CLOSED
        throw new ForbiddenException(
          `Permission "${permission}" is not mapped to any canonical feature (Fail-Closed).`,
        );
      }

      requiredFeatureKeys.add(featureKey);
    }

    if (requiredFeatureKeys.size > 0) {
      const sub = user.subscription;
      if (!sub) {
        throw new ForbiddenException('No active subscription found for tenant company.');
      }

      let planVersionId: string | null = null;

      if (sub?.company) {
        const assignment = await this.prisma.companyPlanAssignment.findUnique({
          where: { company: sub.company },
        });
        if (assignment) {
          planVersionId = assignment.planVersionId;
        }
      }

      if (!planVersionId && sub?.plan) {
        const plan = await (this.prisma as any).saaSPlanNew.findUnique({
          where: { name: sub.plan.toUpperCase() },
          include: {
            versions: {
              where: { status: 'Published' },
              orderBy: { version: 'desc' },
              take: 1,
            },
          },
        });
        if (plan && plan.versions?.[0]) {
          planVersionId = plan.versions[0].id;
        }
      }

      if (!planVersionId) {
        throw new ForbiddenException(
          'No plan version configuration found for tenant subscription.',
        );
      }

      let enabledFeatures = PermissionsGuard.planVersionFeaturesCache.get(planVersionId);

      if (!enabledFeatures) {
        const planVersion = await this.prisma.planVersion.findUnique({
          where: { id: planVersionId },
          include: {
            features: {
              where: { enabled: true },
              include: { feature: true },
            },
          },
        });

        enabledFeatures = new Set<string>();
        if (planVersion) {
          planVersion.features.forEach((pf) => {
            if (pf.feature) {
              enabledFeatures?.add(pf.feature.key);
            }
          });
        }
        PermissionsGuard.planVersionFeaturesCache.set(planVersionId, enabledFeatures);
      }

      // Load Tenant Feature Overrides (Tenant-Specific Exceptions)
      const tenantOverridesMap = new Map<string, boolean>();
      const userCompanyId = (user as any)?.companyId;
      if (userCompanyId && userCompanyId !== 'PLATFORM') {
        try {
          const overrides = await (this.prisma as any).tenantFeatureOverride.findMany({
            where: { companyId: userCompanyId },
          });
          const now = new Date();
          for (const o of overrides) {
            const isExpired = o.expiresAt && o.expiresAt <= now;
            const isRevoked = o.revokedAt && o.revokedAt <= now;
            if (!isExpired && !isRevoked) {
              tenantOverridesMap.set(o.featureKey, o.enabled);
            }
          }
        } catch (e) {
          // Graceful fallback
        }
      }

      for (const reqFeatureKey of requiredFeatureKeys) {
        // Nullish behavior: Tenant override takes precedence if present; otherwise inherits plan feature
        const isFeatureAllowed = tenantOverridesMap.has(reqFeatureKey)
          ? tenantOverridesMap.get(reqFeatureKey) === true
          : enabledFeatures.has(reqFeatureKey);

        if (!isFeatureAllowed) {
          throw new ForbiddenException(
            'This feature is not included in your subscription plan or tenant entitlements.',
          );
        }
      }
    }

    return true;
  }
}
