import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  DEFAULT_COMPANY_ROLES,
  CANONICAL_ROLE_PERMISSIONS,
} from '../constants/canonical-permissions';

@Injectable()
export class RoleProvisioningService {
  private readonly logger = new Logger(RoleProvisioningService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Idempotently provisions all missing tenant-scoped default roles with canonical permissions
   * and reconciles missing canonical permissions for existing tenant default system roles.
   *
   * Invariant guarantees:
   * 1. Preserves existing default roles without altering IDs, names, or custom administrator permissions.
   * 2. Reconciles canonical permissions additively for existing system default roles (isSystem = true)
   *    without deleting custom permissions or creating duplicates.
   * 3. Preserves all existing custom roles for the company without mutation.
   * 4. Never creates, modifies, or mutates global system roles (companyId = null).
   * 5. Safe against concurrent execution via database unique constraint `@@unique([name, companyId])`.
   * 6. Participates in external Prisma transactions when `tx` is supplied.
   *
   * @param companyId Target tenant company ID
   * @param tx Optional active Prisma transaction client
   * @returns Record map of roleName -> Role record
   */
  async ensureDefaultRoles(
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Record<string, any>> {
    if (!companyId || companyId === 'PLATFORM' || companyId === 'DEFAULT_COMPANY') {
      return {};
    }

    const client = tx || this.prisma;
    const rolesMap: Record<string, any> = {};

    // 1. Fetch all existing roles explicitly scoped to this company
    const existingRoles = await client.role.findMany({
      where: { companyId },
      orderBy: { createdAt: 'asc' },
    });

    const existingRoleMap = new Map<string, any>();
    for (const r of existingRoles) {
      existingRoleMap.set(r.name, r);
      rolesMap[r.name] = r;
    }

    // 2. Provision missing canonical default roles or reconcile permissions for existing system default roles
    for (const roleName of DEFAULT_COMPANY_ROLES) {
      const existing = existingRoleMap.get(roleName);
      if (existing) {
        // Invariant: Only reconcile default roles that are system roles (isSystem === true)
        if (existing.isSystem) {
          const canonicalPerms = CANONICAL_ROLE_PERMISSIONS[roleName] || [];
          let existingPerms: string[] = [];
          try {
            if (typeof existing.permissions === 'string') {
              const parsed = JSON.parse(existing.permissions);
              if (Array.isArray(parsed)) {
                existingPerms = parsed;
              }
            } else if (Array.isArray(existing.permissions)) {
              existingPerms = existing.permissions;
            }
          } catch {
            this.logger.warn(
              `[RoleProvisioning] Malformed permissions JSON for role "${existing.id}" in company "${companyId}". Recovering with canonical baseline.`,
            );
            existingPerms = [];
          }

          const existingPermSet = new Set(existingPerms);
          const missingPerms = canonicalPerms.filter((p) => !existingPermSet.has(p));

          if (missingPerms.length > 0) {
            const mergedPerms = Array.from(new Set([...existingPerms, ...canonicalPerms]));
            try {
              const updatedRole = await client.role.update({
                where: { id: existing.id },
                data: {
                  permissions: JSON.stringify(mergedPerms),
                },
              });
              rolesMap[roleName] = updatedRole;
              existingRoleMap.set(roleName, updatedRole);
              this.logger.log(
                `[RoleProvisioning] Reconciled ${missingPerms.length} canonical permissions for system role "${roleName}" (ID: ${existing.id}) for company "${companyId}"`,
              );
            } catch (err: any) {
              this.logger.error(
                `[RoleProvisioning] Failed to update canonical permissions for system role "${roleName}" (ID: ${existing.id}): ${err?.message}`,
                err?.stack,
              );
              throw err;
            }
          }
        }
        continue;
      }

      const canonicalPerms = CANONICAL_ROLE_PERMISSIONS[roleName] || [];

      try {
        const createdRole = await client.role.upsert({
          where: {
            name_companyId: {
              name: roleName,
              companyId,
            },
          },
          update: {}, // Invariant: Concurrent race condition preserves existing row without overwriting
          create: {
            name: roleName,
            description: `${roleName} default system role`,
            isSystem: true,
            permissions: JSON.stringify(canonicalPerms),
            companyId,
          },
        });
        rolesMap[roleName] = createdRole;
        this.logger.log(
          `[RoleProvisioning] Provisioned default role "${roleName}" (ID: ${createdRole.id}) for company "${companyId}"`,
        );
      } catch (err: any) {
        // Fallback for concurrent execution if upsert encounters conflict
        const fetched = await client.role.findFirst({
          where: { name: roleName, companyId },
        });
        if (fetched) {
          rolesMap[roleName] = fetched;
        } else {
          this.logger.error(
            `[RoleProvisioning] Failed to provision default role "${roleName}" for company "${companyId}": ${err?.message}`,
            err?.stack,
          );
          throw err;
        }
      }
    }

    return rolesMap;
  }
}
