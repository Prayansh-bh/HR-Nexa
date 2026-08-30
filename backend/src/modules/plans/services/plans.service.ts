import {
  Injectable,
  OnModuleInit,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PlansRepository } from '../repositories/plans.repository';
import {
  PlanCreatedEvent,
  PlanUpdatedEvent,
  PlanDeletedEvent,
  PLAN_EVENTS,
} from '../../../common/events/plan.events';
import { clearTenantEntitlementCache } from '../../../common/tenant/tenant-validation.util';
import { PermissionsGuard } from '../../auth/permissions.guard';

@Injectable()
export class PlansService implements OnModuleInit {
  private plansCache: { data: any; expiresAt: number } | null = null;
  private selectableCache: { data: any; expiresAt: number } | null = null;
  private publicPlansCache: { data: any; expiresAt: number } | null = null;

  constructor(
    private readonly plansRepository: PlansRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit() {
    try {
      await this.ensureDefaultPlansExist();
    } catch (err: any) {
      // Non-fatal background check
    }
  }

  async ensureDefaultPlansExist() {
    const defaultPlans = [
      {
        name: 'BASIC',
        code: 'PLAN_BASIC',
        description: 'Starter plan for small teams',
        monthlyPrice: 0,
        yearlyPrice: 0,
        employeeLimit: 10,
        storageLimitGB: 10,
        branchLimit: 1,
        apiCallLimit: 1000,
        isDefault: true,
      },
      {
        name: 'STANDARD',
        code: 'PLAN_STD',
        description: 'Growth plan for mid-sized organizations',
        monthlyPrice: 5000,
        yearlyPrice: 60000,
        employeeLimit: 100,
        storageLimitGB: 50,
        branchLimit: 3,
        apiCallLimit: 5000,
        isDefault: false,
      },
      {
        name: 'PREMIUM',
        code: 'PLAN_PREM',
        description: 'Comprehensive enterprise plan',
        monthlyPrice: 15000,
        yearlyPrice: 180000,
        employeeLimit: 500,
        storageLimitGB: 100,
        branchLimit: 10,
        apiCallLimit: 50000,
        isDefault: false,
      },
    ];

    let hasMutated = false;

    for (const dp of defaultPlans) {
      let plan = await this.plansRepository.findNewPlanByName(dp.name);

      // 1. Existing Plan: NEVER overwrite SuperAdmin customized prices, limits, status, code, or features
      if (plan) {
        const versions = plan.versions || [];
        // If entity exists but has zero version records, create initial v1 preserving plan status
        if (versions.length === 0) {
          await this.plansRepository.createPlanVersion({
            planId: plan.id,
            version: 1,
            status: plan.status || 'Published',
            monthlyPrice: dp.monthlyPrice,
            yearlyPrice: dp.yearlyPrice,
            employeeLimit: dp.employeeLimit,
            storageLimitGB: dp.storageLimitGB,
            branchLimit: dp.branchLimit,
            apiCallLimit: dp.apiCallLimit,
            changelog: `Initial v1 release for ${dp.name} Plan`,
          });
          hasMutated = true;
        } else if (dp.monthlyPrice === 0 && (versions[0].yearlyPrice ?? 0) > 0) {
          await this.plansRepository.updatePlanVersion(versions[0].id, {
            monthlyPrice: 0,
            yearlyPrice: 0,
          });
          hasMutated = true;
        }
        continue;
      }

      // 2. Truly Missing Canonical Plan: Recreate with canonical defaults in Published status
      const createdPlan = await this.plansRepository.createNewPlan({
        name: dp.name,
        code: dp.code,
        description: dp.description,
        status: 'Published',
        isDefault: dp.isDefault,
      });

      await this.plansRepository.createPlanVersion({
        planId: createdPlan.id,
        version: 1,
        status: 'Published',
        monthlyPrice: dp.monthlyPrice,
        yearlyPrice: dp.yearlyPrice,
        employeeLimit: dp.employeeLimit,
        storageLimitGB: dp.storageLimitGB,
        branchLimit: dp.branchLimit,
        apiCallLimit: dp.apiCallLimit,
        changelog: `Standard v1 release for ${dp.name} Plan`,
      });

      // Synchronize legacy SaaSPlan table record if missing for backwards compatibility
      const legacy = await this.plansRepository.findByName(dp.name);
      if (!legacy) {
        await this.plansRepository.create({
          name: dp.name,
          price: dp.monthlyPrice > 0 ? `₹${dp.monthlyPrice} / mo` : '₹0 / mo',
          features: JSON.stringify([
            { name: 'Employee Directory & Profiles', enabled: true },
            { name: 'Document Management', enabled: true },
            { name: 'Basic Attendance & Leave', enabled: true },
          ]),
        });
      }

      hasMutated = true;
    }

    if (hasMutated) {
      this.invalidateCache();
    }
  }

  public invalidateCache() {
    this.plansCache = null;
    this.selectableCache = null;
    this.publicPlansCache = null;
    clearTenantEntitlementCache();
    PermissionsGuard.clearCache();
  }


  async getPublicPlans() {
    const now = Date.now();
    if (this.publicPlansCache && this.publicPlansCache.expiresAt > now) {
      return this.publicPlansCache.data;
    }

    const rawPlans = await this.plansRepository.findPublicPlans();

    const getSortWeight = (name: string, price: number) => {
      const upper = (name || '').toUpperCase();
      if (upper.includes('BASIC') || upper.includes('STARTER')) return 1;
      if (
        upper.includes('STD') ||
        upper.includes('STANDARD') ||
        upper.includes('PRO')
      )
        return 2;
      if (
        upper.includes('PREM') ||
        upper.includes('PREMIUM') ||
        upper.includes('ENTERPRISE')
      )
        return 3;
      return 10 + price;
    };

    const mapped = rawPlans
      .filter((p: any) => p.versions && p.versions.length > 0)
      .map((p: any) => {
        const latestVer = p.versions[0];
        const isPopular =
          p.name.toUpperCase().includes('STD') ||
          p.name.toUpperCase().includes('STANDARD') ||
          p.name.toUpperCase().includes('PRO') ||
          p.code === 'PLAN_STD';

        const features = (latestVer.features || []).map((pf: any) => ({
          key: pf.feature?.key || pf.featureId,
          name: pf.feature?.name || pf.featureId,
          included: pf.enabled !== false,
          category: pf.feature?.category?.name || 'General',
        }));

        const monthlyPrice = latestVer.monthlyPrice ?? 0;
        const yearlyPrice = monthlyPrice === 0 ? 0 : (latestVer.yearlyPrice ?? 0);

        return {
          id: p.id,
          code: p.code,
          name: p.name,
          description: p.description || latestVer.changelog || '',
          monthlyPrice,
          yearlyPrice,
          currency: latestVer.currency || 'INR',
          monthlyAvailable:
            latestVer.monthlyPrice !== null &&
            latestVer.monthlyPrice !== undefined,
          annualAvailable:
            latestVer.yearlyPrice !== null &&
            latestVer.yearlyPrice !== undefined,
          isDefault: Boolean(p.isDefault),
          isPopular,
          version: latestVer.version,
          limits: {
            employeeLimit: latestVer.employeeLimit ?? 50,
            storageLimitGB: latestVer.storageLimitGB ?? 10,
            branchLimit: latestVer.branchLimit ?? 1,
            apiCallLimit: latestVer.apiCallLimit ?? 1000,
          },
          features,
        };
      })
      .sort((a: any, b: any) => {
        const weightA = getSortWeight(a.name, a.monthlyPrice);
        const weightB = getSortWeight(b.name, b.monthlyPrice);
        if (weightA !== weightB) return weightA - weightB;
        return a.monthlyPrice - b.monthlyPrice;
      });

    const result = { plans: mapped };
    this.publicPlansCache = { data: result, expiresAt: now + 60000 };
    return result;
  }

  async getSelectablePlans() {
    const now = Date.now();
    if (this.selectableCache && this.selectableCache.expiresAt > now) {
      return this.selectableCache.data;
    }
    const list = await this.plansRepository.findSelectablePlans();
    const result = list.map((p: any) => ({
      id: p.id,
      name: p.name,
      code: p.code,
      employeeLimit: p.versions[0]?.employeeLimit ?? null,
    }));
    this.selectableCache = { data: result, expiresAt: now + 60000 };
    return result;
  }

  // ─── Legacy Compatibility & Real Feature Mapping ───────────────────────────
  async getPlans() {
    const now = Date.now();
    if (this.plansCache && this.plansCache.expiresAt > now) {
      return this.plansCache.data;
    }
    const newPlans = await this.plansRepository.findNewPlans();
    const systemFeatures = await this.plansRepository.findFeatures();
    const companySubs = await this.plansRepository.getCompanySubscriptions();

    if (newPlans.length > 0) {
      const mappedPlans = newPlans.map((p: any) => {
        const latestVer = p.versions[0] || {};

        const enabledFeatureKeys = new Set(
          (latestVer.features || [])
            .filter((pf: any) => pf.enabled)
            .map((pf: any) => pf.feature?.key || pf.featureId),
        );
        const enabledFeatureNames = new Set(
          (latestVer.features || [])
            .filter((pf: any) => pf.enabled)
            .map((pf: any) => (pf.feature?.name || '').toLowerCase()),
        );

        let featuresMap: { name: string; enabled: boolean }[] = [];
        if (systemFeatures.length > 0) {
          featuresMap = systemFeatures.map((f: any) => {
            const isEnabled =
              enabledFeatureKeys.has(f.key) ||
              enabledFeatureNames.has(f.name.toLowerCase());
            return { name: f.name, enabled: isEnabled };
          });
        } else {
          featuresMap = (latestVer.features || []).map((pf: any) => ({
            name: pf.feature?.name || pf.featureId,
            enabled: pf.enabled,
          }));
        }

        const realAssignedCount = companySubs.filter(
          (s) => (s.plan || '').toUpperCase() === p.name.toUpperCase(),
        ).length;

        return {
          id: p.id,
          name: p.name,
          code: p.code,
          status: p.status,
          version: p.currentVersion,
          price: latestVer.monthlyPrice
            ? `₹${latestVer.monthlyPrice.toLocaleString('en-IN')} / mo`
            : '₹0 / mo',
          monthlyPrice: latestVer.monthlyPrice || 0,
          yearlyPrice: latestVer.yearlyPrice || 0,
          employeeLimit: latestVer.employeeLimit ?? 50,
          storageLimitGB: latestVer.storageLimitGB ?? 10,
          features: featuresMap,
          assignedCompaniesCount:
            realAssignedCount || latestVer.assignments?.length || 0,
          versionsCount: p.versions.length,
          updatedAt: p.updatedAt,
        };
      });
      this.plansCache = { data: mappedPlans, expiresAt: Date.now() + 60000 };
      return mappedPlans;
    }

    // Fallback: legacy SaaSPlan table
    const list = await this.plansRepository.findAll();
    const fallbackList = list.map((p) => ({
      ...p,
      features: JSON.parse(p.features),
    }));
    this.plansCache = { data: fallbackList, expiresAt: Date.now() + 60000 };
    return fallbackList;
  }

  async updatePlan(
    name: string,
    data: {
      features: { name: string; enabled: boolean }[];
      price?: string;
      monthlyPrice?: number;
      yearlyPrice?: number;
      employeeLimit?: number;
      storageLimitGB?: number;
      code?: string;
      status?: string;
      description?: string;
    },
  ) {
    this.invalidateCache();
    const uppercaseName = name.toUpperCase();

    // 1. Update legacy SaaSPlan table
    let legacyPlan = await this.plansRepository.findByName(uppercaseName);
    const displayPrice =
      data.price ||
      (data.monthlyPrice ? `₹${data.monthlyPrice} / mo` : '₹0 / mo');

    if (!legacyPlan) {
      legacyPlan = await this.plansRepository.create({
        name: uppercaseName,
        price: displayPrice,
        features: JSON.stringify(data.features || []),
      });
    } else {
      const updatePayload: { features?: string; price?: string } = {};
      if (data.features) updatePayload.features = JSON.stringify(data.features);
      if (data.price !== undefined || data.monthlyPrice !== undefined)
        updatePayload.price = displayPrice;
      await this.plansRepository.update(legacyPlan.id, updatePayload);
    }

    // 2. Update SaaSPlanNew & PlanVersion & PlanFeatureConfigs
    let newPlan = await this.plansRepository.findNewPlanByName(uppercaseName);
    if (!newPlan) {
      newPlan = await this.plansRepository.createNewPlan({
        name: uppercaseName,
        code: data.code || `PLAN_${uppercaseName}`,
        status: data.status || 'Published',
        description: data.description,
      });
    } else {
      let codeToUpdate: string | undefined = undefined;
      if (data.code !== undefined && data.code !== null) {
        const normalizedCode = data.code.trim().toUpperCase();
        if (!normalizedCode) {
          throw new BadRequestException('Plan code cannot be empty');
        }
        const existingByCode = await this.plansRepository.findNewPlanByCode(normalizedCode);
        if (existingByCode && existingByCode.id !== newPlan.id) {
          throw new BadRequestException(
            `Plan code "${normalizedCode}" is already in use by another plan`,
          );
        }
        codeToUpdate = normalizedCode;
      }

      if (codeToUpdate || data.status || data.description !== undefined) {
        await this.plansRepository.updateNewPlanCodeAndStatus(newPlan.id, {
          code: codeToUpdate,
          status: data.status,
          description: data.description,
        });
      }
    }

    let latestVer = newPlan.versions?.[0];
    const numericMonthlyPrice =
      data.monthlyPrice ??
      (data.price
        ? parseFloat(data.price.replace(/[^0-9.]/g, '')) || 0
        : latestVer?.monthlyPrice || 0);

    // Explicit update retains provided yearlyPrice; partial update preserves existing yearlyPrice; otherwise defaults to 12x monthly. Free plans always have 0 yearlyPrice.
    const numericYearlyPrice =
      numericMonthlyPrice === 0
        ? 0
        : data.yearlyPrice !== undefined && data.yearlyPrice !== null
          ? Number(data.yearlyPrice)
          : latestVer?.yearlyPrice !== undefined && latestVer?.yearlyPrice !== null
            ? Number(latestVer.yearlyPrice)
            : numericMonthlyPrice * 12;

    const employeeLimit = data.employeeLimit ?? latestVer?.employeeLimit ?? 50;
    const storageLimitGB =
      data.storageLimitGB ?? latestVer?.storageLimitGB ?? 10;

    if (!latestVer) {
      latestVer = await this.plansRepository.createPlanVersion({
        planId: newPlan.id,
        version: 1,
        status: data.status || 'Published',
        monthlyPrice: numericMonthlyPrice,
        yearlyPrice: numericYearlyPrice,
        employeeLimit,
        storageLimitGB,
        changelog: 'Created version via Edit Plan Settings',
      });
    } else {
      await this.plansRepository.updatePlanVersion(latestVer.id, {
        monthlyPrice: numericMonthlyPrice,
        yearlyPrice: numericYearlyPrice,
        employeeLimit,
        storageLimitGB,
      });
    }

    // Sync PlanFeatureConfig records in DB
    if (data.features && Array.isArray(data.features)) {
      await this.plansRepository.syncPlanFeatureConfigs(
        latestVer.id,
        data.features,
      );
    }

    await this.plansRepository.logPlanAudit(
      uppercaseName,
      'Updated',
      'Super Admin',
      `Updated plan details: seats=${employeeLimit}, storage=${storageLimitGB}GB, price=₹${numericMonthlyPrice}/mo`,
    );

    // Invalidate local memory caches after successful DB writes
    this.invalidateCache();

    // Emit domain event for real-time SSE stream invalidation
    this.eventEmitter.emit(
      PLAN_EVENTS.UPDATED,
      new PlanUpdatedEvent(newPlan.id, uppercaseName, data),
    );

    return {
      name: uppercaseName,
      price: displayPrice,
      monthlyPrice: numericMonthlyPrice,
      yearlyPrice: numericYearlyPrice,
      employeeLimit,
      storageLimitGB,
      features: data.features,
    };
  }

  async createPlan(data: {
    name: string;
    price?: string;
    monthlyPrice?: number;
    yearlyPrice?: number;
    employeeLimit?: number;
    storageLimitGB?: number;
    code?: string;
    status?: string;
    description?: string;
    features: { name: string; enabled: boolean }[];
  }) {
    const uppercaseName = data.name.toUpperCase();
    const existing = await this.plansRepository.findByName(uppercaseName);
    if (existing)
      throw new BadRequestException(`Plan ${uppercaseName} already exists`);

    const numericMonthlyPrice =
      data.monthlyPrice ??
      (data.price ? parseFloat(data.price.replace(/[^0-9.]/g, '')) || 0 : 0);
    const numericYearlyPrice = data.yearlyPrice ?? numericMonthlyPrice * 12;
    const displayPrice = data.price || `₹${numericMonthlyPrice} / mo`;
    const employeeLimit = data.employeeLimit ?? 50;
    const storageLimitGB = data.storageLimitGB ?? 10;

    const created = await this.plansRepository.create({
      name: uppercaseName,
      price: displayPrice,
      features: JSON.stringify(data.features || []),
    });

    const newPlan = await this.plansRepository.createNewPlan({
      name: uppercaseName,
      code: data.code || `PLAN_${uppercaseName}`,
      status: data.status || 'Published',
      description: data.description,
    });

    const version = await this.plansRepository.createPlanVersion({
      planId: newPlan.id,
      version: 1,
      status: data.status || 'Published',
      monthlyPrice: numericMonthlyPrice,
      yearlyPrice: numericYearlyPrice,
      employeeLimit,
      storageLimitGB,
      changelog: 'Initial version created via Plan Builder',
    });

    if (data.features && Array.isArray(data.features)) {
      await this.plansRepository.syncPlanFeatureConfigs(
        version.id,
        data.features,
      );
    }

    await this.plansRepository.logPlanAudit(
      uppercaseName,
      'Created',
      'Super Admin',
      'Created new plan tier with customized seats & storage',
    );

    // Invalidate local memory caches after successful DB writes
    this.invalidateCache();

    // Emit domain event for real-time SSE stream invalidation
    this.eventEmitter.emit(
      PLAN_EVENTS.CREATED,
      new PlanCreatedEvent(newPlan.id, uppercaseName),
    );

    return {
      ...created,
      monthlyPrice: numericMonthlyPrice,
      yearlyPrice: numericYearlyPrice,
      employeeLimit,
      storageLimitGB,
      features: JSON.parse(created.features),
    };
  }

  private async findPlanEntity(planIdOrName: string) {
    let plan = await this.plansRepository.findNewPlanById(planIdOrName);
    if (!plan) {
      plan = await this.plansRepository.findNewPlanByName(planIdOrName.toUpperCase());
    }
    return plan;
  }

  // ─── 1. Archive Plan (Published -> Archived) ─────────────────────────────────
  async archivePlan(planIdOrName: string) {
    const plan = await this.findPlanEntity(planIdOrName);
    if (!plan) {
      throw new NotFoundException(`Plan "${planIdOrName}" not found`);
    }

    if (plan.status === 'Draft') {
      throw new BadRequestException(
        `Draft plans cannot be archived. They must be published first, or deleted as a draft.`,
      );
    }
    if (plan.status === 'Archived') {
      throw new BadRequestException(`Plan "${plan.name}" is already in Archived status.`);
    }

    const assignmentCount =
      await this.plansRepository.countCompanyAssignmentsByPlan(plan.id);
    const subscriptionCount =
      await this.plansRepository.countSubscriptionsByPlan(plan.name);

    await this.plansRepository.updateNewPlanCodeAndStatus(plan.id, {
      status: 'Archived',
    });

    await this.plansRepository.logPlanAudit(
      plan.name,
      'Archived plan',
      'Super Admin',
      `Archived plan "${plan.name}" (preserved ${assignmentCount} assignments and ${subscriptionCount} subscriptions)`,
    );

    this.invalidateCache();
    this.eventEmitter.emit(
      PLAN_EVENTS.DELETED,
      new PlanDeletedEvent(plan.name, plan.name),
    );

    return {
      success: true,
      id: plan.id,
      name: plan.name,
      status: 'Archived',
      action: 'Archived',
      assignmentCount,
      subscriptionCount,
    };
  }

  // ─── 2. Restore Plan (Archived -> Published) ─────────────────────────────────
  async restorePlan(planIdOrName: string) {
    const plan = await this.findPlanEntity(planIdOrName);
    if (!plan) {
      throw new NotFoundException(`Plan "${planIdOrName}" not found`);
    }

    if (plan.status === 'Published') {
      throw new BadRequestException(`Plan "${plan.name}" is already in Published status.`);
    }
    if (plan.status === 'Draft') {
      throw new BadRequestException(
        `Plan "${plan.name}" is in Draft status. Use Publish Plan to publish it.`,
      );
    }

    // Ensure a published version exists or activate existing version
    const versions = plan.versions || [];
    const hasPublishedVersion = versions.some((v: any) => v.status === 'Published');
    if (!hasPublishedVersion && versions.length > 0) {
      await this.plansRepository.updatePlanVersion(versions[0].id, {
        status: 'Published',
        changelog: `Restored plan version v${versions[0].version || 1}`,
      });
    } else if (versions.length === 0) {
      throw new BadRequestException(
        `Cannot restore plan "${plan.name}": No plan versions exist. Please edit or recreate the plan.`,
      );
    }

    await this.plansRepository.updateNewPlanCodeAndStatus(plan.id, {
      status: 'Published',
    });

    await this.plansRepository.logPlanAudit(
      plan.name,
      'Restored plan',
      'Super Admin',
      `Restored plan "${plan.name}" from archive back to Published status`,
    );

    this.invalidateCache();
    this.eventEmitter.emit(
      PLAN_EVENTS.UPDATED,
      new PlanUpdatedEvent(plan.id, plan.name, { status: 'Published' }),
    );

    return {
      success: true,
      id: plan.id,
      name: plan.name,
      status: 'Published',
      action: 'Restored',
    };
  }

  // ─── 3. Permanently Delete Plan (Archived -> Purged) ────────────────────────
  async permanentlyDeletePlan(planIdOrName: string) {
    const plan = await this.findPlanEntity(planIdOrName);
    if (!plan) {
      throw new NotFoundException(`Plan "${planIdOrName}" not found`);
    }

    if (plan.status === 'Published') {
      throw new BadRequestException(
        `Published plans cannot be permanently deleted directly. You must archive the plan first.`,
      );
    }
    if (plan.status === 'Draft') {
      throw new BadRequestException(
        `Draft plans should be deleted via Delete Draft. Current status: Draft.`,
      );
    }

    const assignmentCount =
      await this.plansRepository.countCompanyAssignmentsByPlan(plan.id);
    const subscriptionCount =
      await this.plansRepository.countSubscriptionsByPlan(plan.name);

    if (assignmentCount > 0 || subscriptionCount > 0) {
      throw new BadRequestException(
        `Permanent deletion blocked: Plan "${plan.name}" cannot be permanently deleted because it is attached to ${assignmentCount} company assignment(s) and ${subscriptionCount} subscription(s). Please migrate all subscribers before permanent deletion.`,
      );
    }

    await this.plansRepository.hardDeleteNewPlan(plan.id, plan.name);
    await this.plansRepository.logPlanAudit(
      plan.name,
      'Permanently deleted plan',
      'Super Admin',
      `Permanently purged archived plan "${plan.name}" from database (0 assignments, 0 subscriptions)`,
    );

    this.invalidateCache();
    this.eventEmitter.emit(
      PLAN_EVENTS.DELETED,
      new PlanDeletedEvent(plan.name, plan.name),
    );

    return {
      success: true,
      id: plan.id,
      name: plan.name,
      action: 'PermanentlyDeleted',
    };
  }

  // ─── 4. Delete Draft Plan (Draft -> Purged) ──────────────────────────────────
  async deleteDraftPlan(planIdOrName: string) {
    const plan = await this.findPlanEntity(planIdOrName);
    if (!plan) {
      throw new NotFoundException(`Plan "${planIdOrName}" not found`);
    }

    if (plan.status !== 'Draft') {
      throw new BadRequestException(
        `Only Draft plans can be deleted via Delete Draft. Current status: ${plan.status}.`,
      );
    }

    const assignmentCount =
      await this.plansRepository.countCompanyAssignmentsByPlan(plan.id);
    const subscriptionCount =
      await this.plansRepository.countSubscriptionsByPlan(plan.name);

    if (assignmentCount > 0 || subscriptionCount > 0) {
      throw new BadRequestException(
        `Draft deletion blocked: Draft plan "${plan.name}" is attached to ${assignmentCount} company assignment(s) and ${subscriptionCount} subscription(s).`,
      );
    }

    await this.plansRepository.hardDeleteNewPlan(plan.id, plan.name);
    await this.plansRepository.logPlanAudit(
      plan.name,
      'Deleted draft plan',
      'Super Admin',
      `Deleted draft plan "${plan.name}" from database (0 assignments, 0 subscriptions)`,
    );

    this.invalidateCache();
    this.eventEmitter.emit(
      PLAN_EVENTS.DELETED,
      new PlanDeletedEvent(plan.name, plan.name),
    );

    return {
      success: true,
      id: plan.id,
      name: plan.name,
      action: 'DraftDeleted',
    };
  }

  // ─── 5. Delete Plan (Backward Compatibility Router) ──────────────────────────
  async deletePlan(nameOrId: string) {
    const plan = await this.findPlanEntity(nameOrId);
    if (!plan) {
      const legacyPlan = await this.plansRepository.findByName(nameOrId.toUpperCase());
      if (legacyPlan) {
        await this.plansRepository.delete(legacyPlan.id);
        this.invalidateCache();
        this.eventEmitter.emit(
          PLAN_EVENTS.DELETED,
          new PlanDeletedEvent(legacyPlan.name, legacyPlan.name),
        );
        return { success: true, name: legacyPlan.name, action: 'Deleted' };
      }
      throw new NotFoundException(`Plan "${nameOrId}" not found`);
    }

    if (plan.status === 'Draft') {
      return this.deleteDraftPlan(plan.id);
    }
    if (plan.status === 'Published') {
      return this.archivePlan(plan.id);
    }
    if (plan.status === 'Archived') {
      const assignmentCount = await this.plansRepository.countCompanyAssignmentsByPlan(plan.id);
      const subscriptionCount = await this.plansRepository.countSubscriptionsByPlan(plan.name);
      if (assignmentCount === 0 && subscriptionCount === 0) {
        return this.permanentlyDeletePlan(plan.id);
      }
      return {
        success: true,
        name: plan.name,
        action: 'Archived',
        assignmentCount,
        subscriptionCount,
      };
    }
    throw new BadRequestException(`Unsupported plan status: ${plan.status}`);
  }

  // ─── Enriched Dashboard Statistics ─────────────────────────────────────────
  async getEnrichedDashboardStats() {
    const newPlans = await this.plansRepository.findNewPlans();
    const features = await this.plansRepository.findFeatures();
    const addOns = await this.plansRepository.findAddOns();
    const auditLogs = await this.plansRepository.getAuditLogs();
    const companySubs = await this.plansRepository.getCompanySubscriptions();

    const published = newPlans.filter((p) => p.status === 'Published');
    const drafts = newPlans.filter((p) => p.status === 'Draft');
    const archived = newPlans.filter((p) => p.status === 'Archived');

    const totalRealCompanyAssignments = companySubs.length;

    let popularPlanName = 'PREMIUM';
    let maxAssignments = -1;
    let highestRevenuePlanName = 'PREMIUM';
    let maxRevenue = -1;

    for (const p of newPlans) {
      const latestVer = p.versions[0];
      const count = companySubs.filter(
        (s) => (s.plan || '').toUpperCase() === p.name.toUpperCase(),
      ).length;

      if (count > maxAssignments) {
        maxAssignments = count;
        popularPlanName = p.name;
      }
      const rev = (latestVer?.yearlyPrice || 0) * count;
      if (rev > maxRevenue) {
        maxRevenue = rev;
        highestRevenuePlanName = p.name;
      }
    }

    return {
      totalPlans: newPlans.length || 3,
      publishedPlans: published.length || 3,
      draftPlans: drafts.length,
      archivedPlans: archived.length,
      activeCompanyAssignments: totalRealCompanyAssignments,
      mostPopularPlan: popularPlanName,
      highestRevenuePlan: highestRevenuePlanName,
      totalFeatures: features.length || 9,
      totalAddOns: addOns.length || 3,
      recentAuditLogs: auditLogs.slice(0, 10),
    };
  }

  // ─── Feature Library Management ─────────────────────────────────────────────
  async getFeatureLibrary() {
    const categories = await this.plansRepository.findCategories();
    const features = await this.plansRepository.findFeatures();
    return { categories, features };
  }

  async createFeature(data: {
    key: string;
    name: string;
    categoryId?: string;
    module?: string;
    description?: string;
    icon?: string;
  }) {
    const feature = await this.plansRepository.createFeature(data);
    await this.plansRepository.logPlanAudit(
      data.name,
      'FeatureAdded',
      'Super Admin',
      `Added feature ${data.key} to library`,
    );
    this.invalidateCache();
    return feature;
  }

  async createCategory(data: {
    name: string;
    description?: string;
    order?: number;
  }) {
    const cat = await this.plansRepository.createFeatureCategory(data);
    this.invalidateCache();
    return cat;
  }

  // ─── Plan Versioning & Real Publishing Engine ───────────────────────────────
  async publishPlanVersion(planIdOrName: string, changelog?: string) {
    let plan = await this.plansRepository.findNewPlanById(planIdOrName);
    if (!plan) {
      plan = await this.plansRepository.findNewPlanByName(planIdOrName);
    }

    if (!plan) {
      const legacyPlan = await this.plansRepository.findByName(planIdOrName);
      if (!legacyPlan)
        throw new NotFoundException(`Plan ${planIdOrName} not found`);

      plan = await this.plansRepository.createNewPlan({
        name: legacyPlan.name.toUpperCase(),
        code: `PLAN_${legacyPlan.name.toUpperCase()}`,
        status: 'Published',
      });
    }

    const latestVer = plan.versions?.[0];
    let publishedVer;

    if (plan.status === 'Draft' && latestVer) {
      publishedVer = await this.plansRepository.updatePlanVersion(
        latestVer.id,
        {
          status: 'Published',
          changelog: changelog || `Published version v${latestVer.version}`,
        },
      );
      await this.plansRepository.updateNewPlanCodeAndStatus(plan.id, {
        status: 'Published',
      });
    } else {
      const maxVer =
        plan.versions && plan.versions.length > 0
          ? Math.max(...plan.versions.map((v: any) => v.version || 0))
          : 0;
      const nextVerNumber = maxVer + 1;

      publishedVer = await this.plansRepository.createPlanVersion({
        planId: plan.id,
        version: nextVerNumber,
        status: 'Published',
        monthlyPrice: latestVer?.monthlyPrice || 0,
        yearlyPrice: latestVer?.yearlyPrice || 0,
        employeeLimit: latestVer?.employeeLimit || 50,
        storageLimitGB: latestVer?.storageLimitGB || 10,
        branchLimit: latestVer?.branchLimit || 1,
        changelog: changelog || `Published version v${nextVerNumber}`,
      });

      await this.plansRepository.updateNewPlanCodeAndStatus(plan.id, {
        status: 'Published',
      });
    }

    if (latestVer?.features && Array.isArray(latestVer.features)) {
      const featList = latestVer.features.map((pf: any) => ({
        name: pf.feature?.name || pf.featureId,
        enabled: pf.enabled,
      }));
      await this.plansRepository.syncPlanFeatureConfigs(
        publishedVer.id,
        featList,
      );
    }

    // Sync legacy table status
    const legacy = await this.plansRepository.findByName(plan.name);
    if (legacy) {
      await this.plansRepository.update(legacy.id, { price: legacy.price });
    }

    await this.plansRepository.logPlanAudit(
      plan.name,
      'VersionPublished',
      'Super Admin',
      `Published version v${publishedVer.version || 1} of plan ${plan.name}`,
    );

    // Invalidate local memory caches after successful publish
    this.invalidateCache();

    // Emit domain event for real-time SSE stream invalidation
    this.eventEmitter.emit(
      PLAN_EVENTS.UPDATED,
      new PlanUpdatedEvent(plan.id, plan.name, { status: 'Published' }),
    );

    return {
      success: true,
      planName: plan.name,
      version: publishedVer.version || 1,
      status: 'Published',
      publishedVersion: publishedVer,
    };
  }

  async clonePlan(planIdOrName: string, newName: string) {
    let plan = await this.plansRepository.findNewPlanById(planIdOrName);
    if (!plan) {
      plan = await this.plansRepository.findNewPlanByName(planIdOrName);
    }
    if (!plan) throw new NotFoundException('Source plan not found');

    const uppercaseName = newName.trim().toUpperCase();
    if (!uppercaseName) {
      throw new BadRequestException('Cloned plan name cannot be empty');
    }

    const uppercaseCode = `PLAN_${uppercaseName.replace(/[\s-]+/g, '_')}`;

    const existingByName =
      await this.plansRepository.findNewPlanByName(uppercaseName);
    if (existingByName) {
      throw new BadRequestException(
        `A plan named "${uppercaseName}" already exists`,
      );
    }

    const existingByCode =
      await this.plansRepository.findNewPlanByCode(uppercaseCode);
    if (existingByCode) {
      throw new BadRequestException(
        `A plan with code "${uppercaseCode}" already exists`,
      );
    }

    // Execute transactional deep-copy clone in repository
    const cloned = await this.plansRepository.clonePlanTransactional(
      plan,
      uppercaseName,
      uppercaseCode,
    );

    // Invalidate local memory caches after successful clone
    this.invalidateCache();

    // Emit domain event for real-time SSE stream invalidation
    this.eventEmitter.emit(
      PLAN_EVENTS.CREATED,
      new PlanCreatedEvent(cloned.id, cloned.name),
    );

    return cloned;
  }

  // ─── Runtime Feature Resolution Engine ──────────────────────────────────────
  async resolveCompanyFeatures(company: string) {
    // 1. Check direct company assignment
    const assignment =
      await this.plansRepository.findCompanyAssignment(company);
    let ver = assignment?.planVersion;

    // 2. If no direct assignment, resolve from active Subscription
    if (!ver) {
      const sub = await this.plansRepository.findActiveCompanySubscription(company);
      if (sub && sub.plan) {
        const saasPlan = await this.plansRepository.findNewPlanByName(sub.plan);
        if (saasPlan && saasPlan.versions && saasPlan.versions.length > 0) {
          ver = saasPlan.versions[0];
        }
      }
    }

    if (ver) {
      const enabledFeatures: Record<string, boolean> = {};
      (ver.features || []).forEach((pf: any) => {
        if (pf.feature?.key) enabledFeatures[pf.feature.key] = pf.enabled;
        if (pf.feature?.name) enabledFeatures[pf.feature.name] = pf.enabled;
      });

      return {
        company,
        planName: ver.plan?.name || 'CUSTOM',
        version: ver.version,
        limits: {
          employees: ver.employeeLimit,
          storageGB: ver.storageLimitGB,
          branches: ver.branchLimit,
          apiCalls: ver.apiCallLimit,
        },
        features: enabledFeatures,
      };
    }

    // 3. Safe denial / empty fallback for unassigned/unsubscribed tenants — NO privileged feature leakage!
    return {
      company,
      planName: 'NONE',
      version: 0,
      limits: { employees: 0, storageGB: 0, branches: 0, apiCalls: 0 },
      features: {},
    };
  }

  // ─── Add-ons & Audit Logs ──────────────────────────────────────────────────
  async getAddOns() {
    return this.plansRepository.findAddOns();
  }
  async createAddOn(data: any) {
    const addOn = await this.plansRepository.createAddOn(data);
    await this.plansRepository.logPlanAudit(
      data.name,
      'AddOnCreated',
      'Super Admin',
      `Created add-on ${data.name}`,
    );
    this.invalidateCache();
    return addOn;
  }
  async getAuditLogs() {
    return this.plansRepository.getAuditLogs();
  }
}
