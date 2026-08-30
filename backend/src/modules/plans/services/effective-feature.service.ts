import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export interface SetTenantOverrideDto {
  enabled: boolean;
  reason?: string;
  notes?: string;
  expiresAt?: string | null;
}

export interface EffectiveFeatureInfo {
  featureKey: string;
  featureName: string;
  category: string;
  planIncluded: boolean;
  override: {
    enabled: boolean;
    reason?: string | null;
    notes?: string | null;
    grantedBy?: string | null;
    expiresAt?: Date | null;
    revokedAt?: Date | null;
  } | null;
  effectiveEnabled: boolean;
}

@Injectable()
export class EffectiveFeatureService {
  // In-memory cache for resolved effective features by companyId (TTL: 60s)
  private static cache = new Map<
    string,
    { expiresAt: number; features: Map<string, boolean> }
  >();

  // In-memory cache for detailed feature overview by companyId (TTL: 60s)
  private static overviewCache = new Map<
    string,
    { expiresAt: number; data: EffectiveFeatureInfo[] }
  >();

  constructor(private readonly prisma: PrismaService) {}

  public static clearCache(companyId?: string) {
    if (companyId) {
      EffectiveFeatureService.cache.delete(companyId);
      EffectiveFeatureService.overviewCache.delete(companyId);
    } else {
      EffectiveFeatureService.cache.clear();
      EffectiveFeatureService.overviewCache.clear();
    }
  }

  public clearCache(companyId?: string) {
    EffectiveFeatureService.clearCache(companyId);
  }

  /**
   * Resolves the effective enablement state for a single feature for a tenant.
   *
   * Business Rule:
   *   effectiveFeature =
   *     tenantOverride exists && !expired && !revoked
   *       ? tenantOverride.enabled
   *       : planFeature.enabled
   */
  async isFeatureEffective(
    companyId: string,
    featureKey: string,
    subscription?: any,
  ): Promise<boolean> {
    if (!companyId) return false;
    const effectiveFeatures = await this.getEffectiveFeatures(
      companyId,
      subscription,
    );
    return effectiveFeatures.get(featureKey) ?? false;
  }

  /**
   * Resolves all canonical features and their effective state for a tenant.
   */
  async getEffectiveFeatures(
    companyId: string,
    subscription?: any,
  ): Promise<Map<string, boolean>> {
    if (!companyId) return new Map();

    const now = Date.now();
    const cached = EffectiveFeatureService.cache.get(companyId);
    if (cached && cached.expiresAt > now) {
      return cached.features;
    }

    // 1. Resolve Company and Plan Version
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: { subscriptions: true },
    });

    let planVersionId: string | null = null;

    if (company?.name) {
      const assignment = await this.prisma.companyPlanAssignment.findUnique({
        where: { company: company.name },
      });
      if (assignment) {
        planVersionId = assignment.planVersionId;
      }
    }

    if (!planVersionId) {
      const sub =
        company?.subscriptions?.find(
          (s) =>
            (s.status || '').toLowerCase() === 'active' ||
            (s.status || '').toLowerCase() === 'trial',
        ) ||
        company?.subscriptions?.[0] ||
        subscription;

      if (sub?.plan) {
        const plan = await this.prisma.saaSPlanNew.findUnique({
          where: { name: sub.plan.toUpperCase() },
          include: {
            versions: {
              where: { status: 'Published' },
              orderBy: { version: 'desc' },
              take: 1,
            },
          },
        });
        if (plan?.versions?.[0]) {
          planVersionId = plan.versions[0].id;
        }
      }
    }

    // 2. Load Default Plan Features (Fail-closed: empty if no plan version)
    const planFeatures = new Map<string, boolean>();
    if (planVersionId) {
      const version = await this.prisma.planVersion.findUnique({
        where: { id: planVersionId },
        include: {
          features: {
            include: { feature: true },
          },
        },
      });

      if (version?.features) {
        for (const pf of version.features) {
          if (pf.feature) {
            planFeatures.set(pf.feature.key, pf.enabled);
          }
        }
      }
    }

    // 3. Load Tenant Overrides from Database
    const overrides = await this.prisma.tenantFeatureOverride.findMany({
      where: { companyId },
    });

    const currentDate = new Date();
    const effectiveMap = new Map<string, boolean>();

    // Load all registered features from DB to ensure complete dictionary
    const allDbFeatures = await this.prisma.feature.findMany({
      select: { key: true },
    });

    for (const feat of allDbFeatures) {
      const planDefault = planFeatures.get(feat.key) ?? false;
      const override = overrides.find((o) => o.featureKey === feat.key);

      if (override) {
        const isExpired =
          override.expiresAt && override.expiresAt <= currentDate;
        const isRevoked =
          override.revokedAt && override.revokedAt <= currentDate;

        if (!isExpired && !isRevoked) {
          effectiveMap.set(feat.key, override.enabled);
          continue;
        }
      }

      effectiveMap.set(feat.key, planDefault);
    }

    // Cache results for 60 seconds
    EffectiveFeatureService.cache.set(companyId, {
      expiresAt: now + 60000,
      features: effectiveMap,
    });

    return effectiveMap;
  }

  /**
   * Detailed breakdown for SuperAdmin Owner Console (with bounded 60s company-scoped caching)
   */
  async getDetailedFeatureOverview(
    companyId: string,
  ): Promise<EffectiveFeatureInfo[]> {
    if (!companyId) return [];

    const now = Date.now();
    const cachedOverview = EffectiveFeatureService.overviewCache.get(companyId);
    if (cachedOverview && cachedOverview.expiresAt > now) {
      return cachedOverview.data;
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: { subscriptions: true },
    });
    if (!company) {
      throw new NotFoundException(`Company with ID "${companyId}" not found.`);
    }

    // 1. Resolve Plan Features
    let planVersionId: string | null = null;
    const assignment = await this.prisma.companyPlanAssignment.findUnique({
      where: { company: company.name },
    });
    if (assignment) {
      planVersionId = assignment.planVersionId;
    }

    if (!planVersionId) {
      const sub =
        company.subscriptions?.find(
          (s) =>
            (s.status || '').toLowerCase() === 'active' ||
            (s.status || '').toLowerCase() === 'trial',
        ) || company.subscriptions?.[0];

      if (sub?.plan) {
        const plan = await this.prisma.saaSPlanNew.findUnique({
          where: { name: sub.plan.toUpperCase() },
          include: {
            versions: {
              where: { status: 'Published' },
              orderBy: { version: 'desc' },
              take: 1,
            },
          },
        });
        if (plan?.versions?.[0]) {
          planVersionId = plan.versions[0].id;
        }
      }
    }

    // Parallelize Plan Version, Overrides, and Canonical Features lookup
    const [version, overrides, dbFeatures] = await Promise.all([
      planVersionId
        ? this.prisma.planVersion.findUnique({
            where: { id: planVersionId },
            include: {
              features: {
                include: { feature: true },
              },
            },
          })
        : Promise.resolve(null),
      this.prisma.tenantFeatureOverride.findMany({
        where: { companyId },
      }),
      this.prisma.feature.findMany({
        include: { category: true },
        orderBy: { key: 'asc' },
      }),
    ]);

    const planFeaturesMap = new Map<string, boolean>();
    if (version?.features) {
      for (const pf of version.features) {
        if (pf.feature) {
          planFeaturesMap.set(pf.feature.key, pf.enabled);
        }
      }
    }

    const currentDate = new Date();

    const result: EffectiveFeatureInfo[] = dbFeatures.map((feat) => {
      const planIncluded = planFeaturesMap.get(feat.key) ?? false;
      const override = overrides.find((o) => o.featureKey === feat.key);

      let effectiveEnabled = planIncluded;
      let overrideInfo: any = null;

      if (override) {
        const isExpired =
          override.expiresAt && override.expiresAt <= currentDate;
        const isRevoked =
          override.revokedAt && override.revokedAt <= currentDate;

        overrideInfo = {
          enabled: override.enabled,
          reason: override.reason,
          notes: override.notes,
          grantedBy: override.grantedBy,
          expiresAt: override.expiresAt,
          revokedAt: override.revokedAt,
        };

        if (!isExpired && !isRevoked) {
          effectiveEnabled = override.enabled;
        }
      }

      return {
        featureKey: feat.key,
        featureName: feat.name,
        category: feat.category?.name || 'General',
        planIncluded,
        override: overrideInfo,
        effectiveEnabled,
      };
    });

    // Store in company-scoped overviewCache for 60 seconds
    EffectiveFeatureService.overviewCache.set(companyId, {
      expiresAt: now + 60000,
      data: result,
    });

    return result;
  }

  /**
   * Set or update a tenant-level feature override (SuperAdmin only)
   */
  async setTenantOverride(
    companyId: string,
    featureKey: string,
    dto: SetTenantOverrideDto,
    actor: { id?: string; email?: string; name?: string },
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId is required.');
    }
    if (!featureKey) {
      throw new BadRequestException('featureKey is required.');
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) {
      throw new NotFoundException(`Company with ID "${companyId}" not found.`);
    }

    const feature = await this.prisma.feature.findUnique({
      where: { key: featureKey },
    });
    if (!feature) {
      throw new BadRequestException(
        `Feature key "${featureKey}" is not recognized as a valid platform feature.`,
      );
    }

    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (expiresAt && isNaN(expiresAt.getTime())) {
      throw new BadRequestException('Invalid expiresAt date format.');
    }

    const grantedBy = actor?.email || actor?.name || 'SuperAdmin';

    // Upsert override and rotate user permissionVersion
    let override: any;
    if (typeof this.prisma.$transaction === 'function') {
      const [txOverride] = await this.prisma.$transaction([
        this.prisma.tenantFeatureOverride.upsert({
          where: {
            companyId_featureKey: {
              companyId,
              featureKey,
            },
          },
          create: {
            companyId,
            featureKey,
            enabled: dto.enabled,
            reason: dto.reason?.trim() || null,
            notes: dto.notes?.trim() || null,
            grantedBy,
            expiresAt,
          },
          update: {
            enabled: dto.enabled,
            reason: dto.reason?.trim() || null,
            notes: dto.notes?.trim() || null,
            grantedBy,
            expiresAt,
            revokedAt: null, // Clear revocation if re-applied
            updatedAt: new Date(),
          },
        }),
        this.prisma.user.updateMany({
          where: { companyId },
          data: { permissionVersion: { increment: 1 } },
        }),
      ]);
      override = txOverride;
    } else {
      override = await this.prisma.tenantFeatureOverride.upsert({
        where: {
          companyId_featureKey: {
            companyId,
            featureKey,
          },
        },
        create: {
          companyId,
          featureKey,
          enabled: dto.enabled,
          reason: dto.reason?.trim() || null,
          notes: dto.notes?.trim() || null,
          grantedBy,
          expiresAt,
        },
        update: {
          enabled: dto.enabled,
          reason: dto.reason?.trim() || null,
          notes: dto.notes?.trim() || null,
          grantedBy,
          expiresAt,
          revokedAt: null,
          updatedAt: new Date(),
        },
      });
      await this.prisma.user.updateMany({
        where: { companyId },
        data: { permissionVersion: { increment: 1 } },
      });
    }

    // Invalidate caches immediately
    this.clearCache(companyId);

    // Record Security Audit Log
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: actor?.id || 'system',
          userName: actor?.name || 'SuperAdmin',
          actorId: actor?.id || 'system',
          actorRole: 'SuperAdmin',
          entityType: 'COMPANY_SETTINGS',
          action: dto.enabled
            ? 'FEATURE_OVERRIDE_GRANTED'
            : 'FEATURE_OVERRIDE_REVOKED',
          details: `[TENANT_FEATURE_OVERRIDE] SuperAdmin ${grantedBy} set override on feature "${featureKey}" (${feature.name}) to ${dto.enabled ? 'ENABLED' : 'REVOKED'} for company "${company.name}" (${companyId}). Reason: ${dto.reason || 'Not specified'}. Expiry: ${expiresAt ? expiresAt.toISOString() : 'Never'}`,
          companyId,
        },
      });
    } catch (e) {
      // Audit log fallback
    }

    return override;
  }

  /**
   * Remove a tenant feature override to restore Plan inheritance (SuperAdmin only)
   */
  async removeTenantOverride(
    companyId: string,
    featureKey: string,
    actor: { id?: string; email?: string; name?: string },
  ) {
    if (!companyId) {
      throw new BadRequestException('companyId is required.');
    }
    if (!featureKey) {
      throw new BadRequestException('featureKey is required.');
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) {
      throw new NotFoundException(`Company with ID "${companyId}" not found.`);
    }

    // Atomic transaction: delete override & rotate permission version in a single round-trip
    if (typeof this.prisma.$transaction === 'function') {
      await this.prisma.$transaction([
        this.prisma.tenantFeatureOverride.deleteMany({
          where: { companyId, featureKey },
        }),
        this.prisma.user.updateMany({
          where: { companyId },
          data: { permissionVersion: { increment: 1 } },
        }),
      ]);
    } else {
      await this.prisma.tenantFeatureOverride.deleteMany({
        where: { companyId, featureKey },
      });
      await this.prisma.user.updateMany({
        where: { companyId },
        data: { permissionVersion: { increment: 1 } },
      });
    }

    // Invalidate caches immediately
    this.clearCache(companyId);

    const actorIdentifier = actor?.email || actor?.name || 'SuperAdmin';

    // Record Security Audit Log
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: actor?.id || 'system',
          userName: actor?.name || 'SuperAdmin',
          actorId: actor?.id || 'system',
          actorRole: 'SuperAdmin',
          entityType: 'COMPANY_SETTINGS',
          action: 'FEATURE_OVERRIDE_REMOVED',
          details: `[TENANT_FEATURE_OVERRIDE] SuperAdmin ${actorIdentifier} removed override on feature "${featureKey}" for company "${company.name}" (${companyId}). Inherits plan default.`,
          companyId,
        },
      });
    } catch (e) {
      // Audit log fallback
    }
  }
}
