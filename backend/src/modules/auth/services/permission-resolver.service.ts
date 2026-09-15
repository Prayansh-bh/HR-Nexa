import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { getEffectivePermissions } from '../../../common/tenant/tenant-validation.util';

@Injectable()
export class PermissionResolver {
  constructor(private prisma: PrismaService) {}

  /**
   * Centralized permission resolution pipeline for a user.
   * Resolves roleRelation -> fallback Role lookup -> subscription feature filtering.
   */
  async resolve(user: any): Promise<string[]> {
    if (!user) return [];

    if (user.role === 'SuperAdmin') {
      let superAdminRole = user.roleRelation;
      if (!superAdminRole) {
        superAdminRole = await this.prisma.role.findFirst({
          where: { name: 'SuperAdmin' },
        });
      }
      return JSON.parse(superAdminRole?.permissions || '[]');
    }

    let roleRecord = user.roleRelation;

    // Fallback Phase: If roleRelation is null or not pre-loaded, resolve from Role table by name & companyId
    if (!roleRecord) {
      if (user.roleId) {
        const candidate = await this.prisma.role.findUnique({
          where: { id: user.roleId },
        });
        // Tenant boundary check: candidate role must be tenant-neutral (companyId: null) or match user's companyId
        if (candidate && (!candidate.companyId || candidate.companyId === user.companyId)) {
          roleRecord = candidate;
        }
      }
      if (!roleRecord && user.companyId) {
        roleRecord = await this.prisma.role.findFirst({
          where: { companyId: user.companyId, name: user.role },
        });
      }
      if (!roleRecord) {
        // Invariant: Unscoped cross-tenant role resolution is forbidden.
        // Fallback only to global, tenant-neutral system roles (companyId = null, isSystem = true)
        roleRecord = await this.prisma.role.findFirst({
          where: { name: user.role, isSystem: true, companyId: null },
        });
      }
    }

    const rolePermissions = JSON.parse(roleRecord?.permissions || '[]');

    return getEffectivePermissions(
      this.prisma,
      user.role,
      rolePermissions,
      user.subscription,
      user.companyId,
    );
  }
}
