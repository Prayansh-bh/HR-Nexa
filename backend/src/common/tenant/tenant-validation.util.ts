import { ForbiddenException } from '@nestjs/common';
import { getBusinessDateString } from '../utils/date.util';

export interface SubscriptionStatusCheck {
  status?: string | null;
  plan?: string | null;
  company?: string | null;
  expiry?: string | null;
}

export function assertSubscriptionActive(
  role: string | null | undefined,
  subscription: SubscriptionStatusCheck | null | undefined,
): void {
  if (role === 'SuperAdmin') {
    return;
  }

  if (!subscription) {
    throw new ForbiddenException('Company account is inactive.');
  }

  const status = (subscription.status || '').trim();
  const normStatus = status.toUpperCase();

  if (
    status === 'Pending' ||
    normStatus === 'PENDING_APPROVAL' ||
    status === 'Pending Approval'
  ) {
    throw new ForbiddenException({
      statusCode: 403,
      code: 'COMPANY_PENDING_APPROVAL',
      message:
        'Your company registration is awaiting SuperAdmin approval. You will be able to access HR NEXA once your company is approved.',
    });
  }

  if (normStatus === 'REJECTED') {
    throw new ForbiddenException({
      statusCode: 403,
      code: 'COMPANY_REJECTED',
      message: 'Your company registration was rejected. Please contact support.',
    });
  }

  const todayStr = getBusinessDateString();
  const isPastExpiry =
    subscription.expiry &&
    subscription.expiry.trim().length >= 10 &&
    subscription.expiry.trim().slice(0, 10) < todayStr;

  if (normStatus === 'EXPIRED' || isPastExpiry) {
    throw new ForbiddenException({
      statusCode: 403,
      code: 'SUBSCRIPTION_EXPIRED',
      message:
        'Your subscription has expired. Please renew your subscription to continue.',
    });
  }

  if (
    normStatus === 'SUSPENDED' ||
    normStatus === 'CANCELLED' ||
    normStatus === 'DELETED' ||
    normStatus === 'ARCHIVED'
  ) {
    throw new ForbiddenException('Company account is inactive.');
  }
}

// Memory caching for permission mappings and plan version configurations
const permissionToFeatureMap = new Map<string, string>();
const planVersionFeaturesCache = new Map<string, Set<string>>();

import { Permission } from '../../modules/auth/permissions.enum';
import { permissionToFeatureKey, PLATFORM_CORE_PERMISSIONS } from '../../scripts/seed-permissions';

export function clearTenantEntitlementCache(planVersionId?: string) {
  if (planVersionId) {
    planVersionFeaturesCache.delete(planVersionId);
  } else {
    planVersionFeaturesCache.clear();
    permissionToFeatureMap.clear();
  }
}

const validPermissionKeys = new Set<string>([
  ...Object.values(Permission),
  ...Object.keys(permissionToFeatureKey),
]);

export async function getEffectivePermissions(
  prisma: any,
  role: string | null | undefined,
  rolePermissions: string[],
  subscription: any | null | undefined,
  companyId?: string | null,
): Promise<string[]> {
  if (role === 'SuperAdmin') {
    return rolePermissions;
  }

  const subStatus = (subscription?.status || '').trim().toLowerCase();
  if (
    !subscription ||
    subStatus === 'suspended' ||
    subStatus === 'cancelled' ||
    subStatus === 'deleted' ||
    subStatus === 'archived'
  ) {
    return [];
  }

  // 1. Resolve company's plan version ID
  let planVersionId: string | null = null;

  if (subscription?.company) {
    const assignment = await prisma.companyPlanAssignment.findUnique({
      where: { company: subscription.company },
    });
    if (assignment) {
      planVersionId = assignment.planVersionId;
    }
  }

  if (!planVersionId && subscription?.plan) {
    const planName = subscription.plan || 'PREMIUM';
    const plan = await prisma.saaSPlanNew.findUnique({
      where: { name: planName.toUpperCase() },
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

  // 2. Load enabled plan features with caching
  let enabledFeatures = planVersionId ? planVersionFeaturesCache.get(planVersionId) : null;
  if (!enabledFeatures && planVersionId) {
    const planVersion = await prisma.planVersion.findUnique({
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
      planVersion.features.forEach((pf: any) => {
        if (pf.feature) {
          enabledFeatures?.add(pf.feature.key);
        }
      });
    }
    planVersionFeaturesCache.set(planVersionId, enabledFeatures);
  }

  // 3. Load Tenant Feature Overrides (Tenant-Specific Exceptions)
  const targetCompanyId = companyId || subscription?.companyId;
  const tenantOverridesMap = new Map<string, boolean>();

  if (targetCompanyId && targetCompanyId !== 'PLATFORM') {
    try {
      const overrides = await prisma.tenantFeatureOverride.findMany({
        where: { companyId: targetCompanyId },
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
      // Graceful fallback if table not yet queried
    }
  }

  // 4. Load all Permission metadata mappings with caching (bulk query unmapped ones)
  const unmappedPermissions = rolePermissions.filter(p => !permissionToFeatureMap.has(p));
  if (unmappedPermissions.length > 0) {
    const dbPermissions = await prisma.permission.findMany({
      where: { key: { in: unmappedPermissions } },
      include: { feature: true },
    });
    dbPermissions.forEach((p: any) => {
      if (p.feature) {
        permissionToFeatureMap.set(p.key, p.feature.key);
      }
    });
  }

  // 5. Filter permissions strictly based on effective tenant features:
  //    effectiveFeature = tenantOverride?.enabled ?? planFeature.enabled (FAIL-CLOSED)
  return rolePermissions.filter((perm) => {
    // Baseline platform core capabilities are available to all active tenants
    if (PLATFORM_CORE_PERMISSIONS.has(perm)) {
      return true;
    }

    // Fail closed if permission key is completely unknown/unmapped in system registry
    if (!validPermissionKeys.has(perm) && !permissionToFeatureMap.has(perm)) {
      console.warn(`[getEffectivePermissions] Unknown or unmapped permission key rejected (fail-closed): "${perm}"`);
      return false;
    }

    const requiredFeatureKey = permissionToFeatureMap.get(perm) || permissionToFeatureKey[perm];
    if (!requiredFeatureKey) {
      // Unmapped permission with no feature association MUST FAIL CLOSED
      return false;
    }

    // Evaluate: tenant override takes precedence if present; otherwise inherits plan feature
    if (tenantOverridesMap.has(requiredFeatureKey)) {
      return tenantOverridesMap.get(requiredFeatureKey) === true;
    }

    return enabledFeatures?.has(requiredFeatureKey) ?? false;
  });
}

/**
 * Role Delegation Boundary Evaluator
 *
 * Evaluates whether `caller` possesses sufficient authority to assign / delegate `targetRole`
 * to an employee or user within a tenant.
 *
 * Enforcement Rules:
 * 1. SuperAdmin: Unrestricted platform bypass (can delegate any role).
 * 2. Cross-Tenant Boundary: Non-SuperAdmin cannot delegate cross-tenant roles or platform SuperAdmin.
 * 3. Administrative Delegation: Users with `settings:roles:edit`, `CompanyOwner`, or `HRAdmin`
 *    possess full authority to assign any tenant-scoped role.
 * 4. Operational Creator Delegation: Users with `employees:list:create` / `employees:create`
 *    without administrative role-management authority can only delegate:
 *    - Base operational staff roles: 'Employee', 'Viewer', 'HR Staff', 'Recruiter'.
 *    - Custom tenant roles whose permissions are a strict subset of the caller's permissions
 *      and contain ZERO administrative, security, or financial control permissions:
 *      (e.g., no `settings:roles:*`, `settings:company:edit`, `system:audit:*`, `payroll:process:*`, `employees:salary:approve`).
 * 5. Other Users: Cannot delegate any role (returns false).
 */
export function canUserDelegateRole(caller: any, targetRole: any): boolean {
  if (!caller || !targetRole) return false;

  const isSuperAdmin = caller.role === 'SuperAdmin';

  // 1. Platform SuperAdmin boundary
  if (targetRole.name === 'SuperAdmin' || (targetRole.companyId === null && !targetRole.isSystem)) {
    return isSuperAdmin;
  }

  // 2. Cross-tenant isolation boundary
  if (!isSuperAdmin) {
    const callerCompanyId = caller.companyId || caller.subscriptionId;
    if (
      targetRole.companyId !== null &&
      callerCompanyId &&
      targetRole.companyId !== callerCompanyId
    ) {
      return false;
    }
  }

  // 3. Administrative delegation (SuperAdmin, CompanyOwner, HRAdmin, or settings:roles:edit)
  const callerPerms: string[] = caller.permissions || [];
  const hasAdminDelegation =
    isSuperAdmin ||
    caller.role === 'CompanyOwner' ||
    caller.role === 'HRAdmin' ||
    callerPerms.includes('settings:roles:edit') ||
    callerPerms.includes(Permission.SETTINGS_ROLES_EDIT);

  if (hasAdminDelegation) {
    return true;
  }

  // 4. Operational Employee Creator delegation (e.g. Recruiter, HR Staff with employee creation rights)
  const hasEmployeeCreate =
    callerPerms.includes('employees:list:create') ||
    callerPerms.includes('employees:create') ||
    callerPerms.includes('employees:profile:create') ||
    callerPerms.includes(Permission.EMPLOYEES_LIST_CREATE) ||
    callerPerms.includes(Permission.EMPLOYEES_CREATE);

  if (!hasEmployeeCreate) {
    return false;
  }

  // Safe standard system operational roles that operational creators are entitled to assign
  const SAFE_OPERATIONAL_ROLES = new Set(['Employee', 'Viewer', 'HR Staff', 'Recruiter']);
  if (targetRole.isSystem && SAFE_OPERATIONAL_ROLES.has(targetRole.name)) {
    return true;
  }

  // If it's a privileged system role (HRAdmin, Accountant, Manager), operational creators cannot assign it
  if (targetRole.isSystem) {
    return false;
  }

  // For custom roles: parse permissions and verify strict subset and absence of administrative/financial capabilities
  let targetPerms: string[] = [];
  try {
    targetPerms = typeof targetRole.permissions === 'string'
      ? JSON.parse(targetRole.permissions)
      : Array.isArray(targetRole.permissions)
      ? targetRole.permissions
      : [];
  } catch {
    return false;
  }

  const RESTRICTED_DELEGATION_PERMISSIONS = new Set<string>([
    'settings:roles:view',
    'settings:roles:edit',
    'settings:company:view',
    'settings:company:edit',
    'settings:security:view',
    'settings:security:manage',
    'system:audit:view',
    'system:audit:read',
    'payroll:process:run',
    'payroll:process:lock',
    'payroll:process:reopen',
    'payroll:process:generate',
    'employees:salary:approve',
    'employees:salary:edit',
    'employees:salary:delete',
    'employees:list:delete',
    'attendance:devices:manage',
    'attendance:devices:sync',
    'attendance:geo:config',
  ]);

  // A custom role cannot contain any restricted permission when assigned by an operational creator
  const hasRestrictedPerm = targetPerms.some((p) => RESTRICTED_DELEGATION_PERMISSIONS.has(p));
  if (hasRestrictedPerm) {
    return false;
  }

  // And all permissions in the custom role must be a subset of the caller's effective permissions
  const exceedsCaller = targetPerms.some((p) => !callerPerms.includes(p));
  if (exceedsCaller) {
    return false;
  }

  return true;
}


