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
        roleRecord = await this.prisma.role.findUnique({
          where: { id: user.roleId },
        });
      }
      if (!roleRecord && user.companyId) {
        roleRecord = await this.prisma.role.findFirst({
          where: { companyId: user.companyId, name: user.role },
        });
      }
      if (!roleRecord) {
        roleRecord = await this.prisma.role.findFirst({
          where: { name: user.role },
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
