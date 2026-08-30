import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class PlansRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Legacy compatibility methods ─────────────────────────────────────────
  async findAll() {
    return this.prisma.saaSPlan.findMany({ orderBy: { name: 'asc' } });
  }

  async findByName(name: string) {
    return this.prisma.saaSPlan.findUnique({
      where: { name: name.toUpperCase() },
    });
  }

  async create(data: { name: string; price: string; features: string }) {
    return this.prisma.saaSPlan.create({ data });
  }

  async update(
    id: string,
    data: { name?: string; price?: string; features?: string },
  ) {
    return this.prisma.saaSPlan.update({ where: { id }, data });
  }

  async delete(id: string) {
    return this.prisma.saaSPlan.delete({ where: { id } });
  }

  // ─── Production Normalized SaaS Plan Methods ──────────────────────────────
  async findNewPlans() {
    return (this.prisma as any).saaSPlanNew.findMany({
      include: {
        versions: {
          orderBy: { version: 'desc' },
          include: {
            features: { include: { feature: { include: { category: true } } } },
            assignments: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findSelectablePlans() {
    return (this.prisma as any).saaSPlanNew.findMany({
      where: {
        status: 'Published',
        versions: {
          some: {
            status: 'Published',
          },
        },
      },
      select: {
        id: true,
        name: true,
        code: true,
        versions: {
          where: {
            status: 'Published',
          },
          orderBy: {
            version: 'desc',
          },
          take: 1,
          select: {
            employeeLimit: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findPublicPlans() {
    return (this.prisma as any).saaSPlanNew.findMany({
      where: {
        status: 'Published',
        versions: {
          some: {
            status: 'Published',
          },
        },
      },
      include: {
        versions: {
          where: {
            status: 'Published',
          },
          orderBy: {
            version: 'desc',
          },
          take: 1,
          include: {
            features: {
              where: {
                enabled: true,
              },
              include: {
                feature: {
                  include: {
                    category: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findNewPlanById(id: string) {
    return (this.prisma as any).saaSPlanNew.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          include: {
            features: { include: { feature: { include: { category: true } } } },
            assignments: true,
          },
        },
      },
    });
  }

  async findNewPlanByName(name: string) {
    return (this.prisma as any).saaSPlanNew.findUnique({
      where: { name: name.toUpperCase() },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          include: {
            features: { include: { feature: { include: { category: true } } } },
            assignments: true,
          },
        },
      },
    });
  }

  async createNewPlan(data: {
    name: string;
    code: string;
    description?: string;
    isDefault?: boolean;
    status?: string;
  }) {
    return (this.prisma as any).saaSPlanNew.create({
      data: { ...data, name: data.name.toUpperCase() },
    });
  }

  async createPlanVersion(data: any) {
    return (this.prisma as any).planVersion.create({ data });
  }

  async updatePlanVersion(id: string, data: any) {
    return (this.prisma as any).planVersion.update({ where: { id }, data });
  }

  async findNewPlanByCode(code: string) {
    return (this.prisma as any).saaSPlanNew.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          include: {
            features: { include: { feature: { include: { category: true } } } },
            assignments: true,
          },
        },
      },
    });
  }

  async updateNewPlanCodeAndStatus(
    id: string,
    data: { code?: string; status?: string; description?: string },
  ) {
    const updateData: any = {};
    if (data.code) updateData.code = data.code.toUpperCase();
    if (data.status) updateData.status = data.status;
    if (data.description !== undefined) updateData.description = data.description;
    return (this.prisma as any).saaSPlanNew.update({
      where: { id },
      data: updateData,
    });
  }

  async countSubscriptionsByPlan(planName: string): Promise<number> {
    return this.prisma.subscription.count({
      where: {
        plan: { equals: planName, mode: 'insensitive' },
      },
    });
  }

  async countCompanyAssignmentsByPlan(planId: string): Promise<number> {
    return (this.prisma as any).companyPlanAssignment.count({
      where: {
        planVersion: {
          planId,
        },
      },
    });
  }

  async hardDeleteNewPlan(id: string, legacyName?: string) {
    return this.prisma.$transaction(async (tx: any) => {
      // 1. Delete all PlanFeatureConfig records belonging to this plan's versions
      const versions = await tx.planVersion.findMany({
        where: { planId: id },
        select: { id: true },
      });
      const versionIds = versions.map((v: any) => v.id);
      if (versionIds.length > 0) {
        await tx.planFeatureConfig.deleteMany({
          where: { planVersionId: { in: versionIds } },
        });
      }
      // 2. Delete versions
      await tx.planVersion.deleteMany({
        where: { planId: id },
      });
      // 3. Delete SaaSPlanNew
      const deleted = await tx.saaSPlanNew.delete({
        where: { id },
      });
      // 4. Delete legacy SaaSPlan if exists
      if (legacyName) {
        await tx.saaSPlan.deleteMany({
          where: { name: legacyName.toUpperCase() },
        });
      }
      return deleted;
    });
  }

  async clonePlanTransactional(
    sourcePlan: any,
    newName: string,
    newCode: string,
  ) {
    return this.prisma.$transaction(async (tx: any) => {
      const uppercaseName = newName.toUpperCase();
      const uppercaseCode = newCode.toUpperCase();

      // 1. Create cloned SaaSPlanNew in Draft
      const clonedPlan = await tx.saaSPlanNew.create({
        data: {
          name: uppercaseName,
          code: uppercaseCode,
          description: `Cloned from ${sourcePlan.name}`,
          status: 'Draft',
          isDefault: false,
          currentVersion: 1,
        },
      });

      // 2. Create PlanVersion v1 in Draft
      const latestVer = sourcePlan.versions?.[0] || {};
      const newVersion = await tx.planVersion.create({
        data: {
          planId: clonedPlan.id,
          version: 1,
          status: 'Draft',
          monthlyPrice: latestVer.monthlyPrice ?? 0,
          yearlyPrice: latestVer.yearlyPrice ?? 0,
          currency: latestVer.currency || 'INR',
          setupFee: latestVer.setupFee || 0,
          employeeLimit: latestVer.employeeLimit ?? 50,
          storageLimitGB: latestVer.storageLimitGB ?? 10,
          branchLimit: latestVer.branchLimit ?? 1,
          apiCallLimit: latestVer.apiCallLimit ?? 1000,
          changelog: `Cloned from ${sourcePlan.name} v${latestVer.version || 1}`,
        },
      });

      // 3. Deep-copy ALL PlanFeatureConfig records from source version
      const sourceFeatures = latestVer.features || [];
      if (sourceFeatures.length > 0) {
        for (const fc of sourceFeatures) {
          const featureId = fc.featureId || fc.feature?.id;
          if (featureId) {
            await tx.planFeatureConfig.create({
              data: {
                planVersionId: newVersion.id,
                featureId,
                enabled: fc.enabled ?? true,
                customConfig: fc.customConfig ?? null,
              },
            });
          }
        }
      }

      // 4. Log audit entry
      await tx.planAuditLog.create({
        data: {
          planName: uppercaseName,
          action: 'Cloned',
          performedBy: 'Super Admin',
          details: `Cloned from ${sourcePlan.name} with ${sourceFeatures.length} feature configurations`,
        },
      });

      return {
        ...clonedPlan,
        versions: [
          {
            ...newVersion,
            features: sourceFeatures,
          },
        ],
      };
    });
  }

  // ─── Feature Repository Methods ───────────────────────────────────────────
  async findCategories() {
    return (this.prisma as any).featureCategory.findMany({
      include: {
        features: { include: { dependencies: true, requiredBy: true } },
      },
      orderBy: { order: 'asc' },
    });
  }

  async findFeatures() {
    return (this.prisma as any).feature.findMany({
      include: {
        category: true,
        dependencies: { include: { requiredFeature: true } },
        requiredBy: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async createFeature(data: any) {
    return (this.prisma as any).feature.create({ data });
  }

  async updateFeature(id: string, data: any) {
    return (this.prisma as any).feature.update({ where: { id }, data });
  }

  async createFeatureCategory(data: any) {
    return (this.prisma as any).featureCategory.create({ data });
  }

  async addFeatureDependency(featureId: string, requiredFeatureId: string) {
    return (this.prisma as any).featureDependency.create({
      data: { featureId, requiredFeatureId },
    });
  }

  async removeFeatureDependency(featureId: string, requiredFeatureId: string) {
    return (this.prisma as any).featureDependency.delete({
      where: { featureId_requiredFeatureId: { featureId, requiredFeatureId } },
    });
  }

  // ─── Add-ons & Company Assignments ───────────────────────────────────────
  async findAddOns() {
    return (this.prisma as any).addOn.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async createAddOn(data: any) {
    return (this.prisma as any).addOn.create({ data });
  }

  async findCompanyAssignment(company: string) {
    return (this.prisma as any).companyPlanAssignment.findUnique({
      where: { company },
      include: {
        planVersion: {
          include: {
            plan: true,
            features: { include: { feature: true } },
          },
        },
      },
    });
  }

  async assignCompanyPlan(
    company: string,
    planVersionId: string,
    assignedBy?: string,
  ) {
    const today = new Date().toISOString().slice(0, 10);
    return (this.prisma as any).companyPlanAssignment.upsert({
      where: { company },
      update: {
        planVersionId,
        assignedBy,
        effectiveDate: today,
        status: 'Active',
      },
      create: {
        company,
        planVersionId,
        assignedBy,
        effectiveDate: today,
        status: 'Active',
      },
    });
  }

  // ─── Audit Log Methods ───────────────────────────────────────────────────
  async logPlanAudit(
    planName: string,
    action: string,
    performedBy?: string,
    details?: string,
  ) {
    return (this.prisma as any).planAuditLog.create({
      data: { planName, action, performedBy, details },
    });
  }

  async getAuditLogs() {
    return (this.prisma as any).planAuditLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: 100,
    });
  }

  async syncPlanFeatureConfigs(
    planVersionId: string,
    featuresList: { name: string; enabled: boolean }[],
  ) {
    const allFeatures = await (this.prisma as any).feature.findMany();

    for (const f of featuresList) {
      let featObj = allFeatures.find(
        (sysF: any) =>
          sysF.key === (f as any).key ||
          sysF.key === f.name ||
          sysF.name.toLowerCase() === f.name.toLowerCase(),
      );


      if (!featObj) {
        const key = f.name.toUpperCase().replace(/[^A-Z0-9]/g, '_');
        try {
          featObj = await (this.prisma as any).feature.create({
            data: { key, name: f.name, module: 'CORE', status: 'Active' },
          });
        } catch (e) {
          featObj = await (this.prisma as any).feature.findUnique({
            where: { key },
          });
        }
      }

      if (featObj) {
        await (this.prisma as any).planFeatureConfig.upsert({
          where: {
            planVersionId_featureId: {
              planVersionId,
              featureId: featObj.id,
            },
          },
          update: { enabled: f.enabled },
          create: {
            planVersionId,
            featureId: featObj.id,
            enabled: f.enabled,
          },
        });
      }
    }
  }

  async getCompanySubscriptions() {
    return this.prisma.subscription.findMany({
      where: {
        companyRelation: {
          isDemo: false,
        },
      },
      select: { id: true, company: true, plan: true, status: true },
    });
  }

  async findActiveCompanySubscription(company: string) {
    return this.prisma.subscription.findFirst({
      where: {
        company: { equals: company, mode: 'insensitive' },
        status: { in: ['Active', 'Paid', 'Trial'] },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
