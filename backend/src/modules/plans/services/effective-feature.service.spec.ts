import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EffectiveFeatureService } from './effective-feature.service';

describe('EffectiveFeatureService — Truth Table & Entitlement Specifications', () => {
  let service: EffectiveFeatureService;
  let prismaMock: any;

  beforeEach(() => {
    EffectiveFeatureService.clearCache();

    prismaMock = {
      company: {
        findUnique: jest.fn(),
      },
      companyPlanAssignment: {
        findUnique: jest.fn(),
      },
      saaSPlanNew: {
        findUnique: jest.fn(),
      },
      planVersion: {
        findUnique: jest.fn(),
      },
      tenantFeatureOverride: {
        findMany: jest.fn(),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
      feature: {
        findMany: jest.fn().mockResolvedValue([
          { key: 'MODULE_HELPDESK', name: 'Helpdesk & Support Tickets' },
          { key: 'MODULE_ASSETS', name: 'Company Asset Management' },
          { key: 'CORE_HR', name: 'Core Employee & Org Directory' },
        ]),
        findUnique: jest.fn(),
      },
      user: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };

    service = new EffectiveFeatureService(prismaMock);
  });

  describe('Truth Table 1: Plan ON + Override NONE -> ON', () => {
    it('should return true when feature is in plan and no tenant override exists', async () => {
      prismaMock.company.findUnique.mockResolvedValue({
        id: 'comp-1',
        name: 'Alpha Corp',
        subscriptions: [{ plan: 'STANDARD', status: 'Active' }],
      });
      prismaMock.companyPlanAssignment.findUnique.mockResolvedValue({
        planVersionId: 'version-std',
      });
      prismaMock.planVersion.findUnique.mockResolvedValue({
        id: 'version-std',
        features: [{ enabled: true, feature: { key: 'MODULE_HELPDESK' } }],
      });
      prismaMock.tenantFeatureOverride.findMany.mockResolvedValue([]);

      const isEffective = await service.isFeatureEffective('comp-1', 'MODULE_HELPDESK');
      expect(isEffective).toBe(true);
    });
  });

  describe('Truth Table 2: Plan ON + Override ON -> ON', () => {
    it('should return true when feature is in plan and override is explicitly true', async () => {
      prismaMock.company.findUnique.mockResolvedValue({
        id: 'comp-1',
        name: 'Alpha Corp',
      });
      prismaMock.companyPlanAssignment.findUnique.mockResolvedValue({
        planVersionId: 'version-std',
      });
      prismaMock.planVersion.findUnique.mockResolvedValue({
        id: 'version-std',
        features: [{ enabled: true, feature: { key: 'MODULE_HELPDESK' } }],
      });
      prismaMock.tenantFeatureOverride.findMany.mockResolvedValue([
        { featureKey: 'MODULE_HELPDESK', enabled: true },
      ]);

      const isEffective = await service.isFeatureEffective('comp-1', 'MODULE_HELPDESK');
      expect(isEffective).toBe(true);
    });
  });

  describe('Truth Table 3: Plan ON + Override OFF -> OFF (Explicit Tenant Revocation)', () => {
    it('should return false when feature is in plan but tenant override explicitly disables it', async () => {
      prismaMock.company.findUnique.mockResolvedValue({
        id: 'comp-1',
        name: 'Alpha Corp',
      });
      prismaMock.companyPlanAssignment.findUnique.mockResolvedValue({
        planVersionId: 'version-std',
      });
      prismaMock.planVersion.findUnique.mockResolvedValue({
        id: 'version-std',
        features: [{ enabled: true, feature: { key: 'MODULE_HELPDESK' } }],
      });
      prismaMock.tenantFeatureOverride.findMany.mockResolvedValue([
        { featureKey: 'MODULE_HELPDESK', enabled: false },
      ]);

      const isEffective = await service.isFeatureEffective('comp-1', 'MODULE_HELPDESK');
      expect(isEffective).toBe(false);
    });
  });

  describe('Truth Table 4: Plan OFF + Override NONE -> OFF', () => {
    it('should return false when feature is disabled in plan and no override exists', async () => {
      prismaMock.company.findUnique.mockResolvedValue({
        id: 'comp-dezoryn',
        name: 'Dezoryn Technologies',
      });
      prismaMock.companyPlanAssignment.findUnique.mockResolvedValue({
        planVersionId: 'version-basic',
      });
      prismaMock.planVersion.findUnique.mockResolvedValue({
        id: 'version-basic',
        features: [{ enabled: false, feature: { key: 'MODULE_HELPDESK' } }],
      });
      prismaMock.tenantFeatureOverride.findMany.mockResolvedValue([]);

      const isEffective = await service.isFeatureEffective('comp-dezoryn', 'MODULE_HELPDESK');
      expect(isEffective).toBe(false);
    });
  });

  describe('Truth Table 5: Plan OFF + Override ON -> ON (Negotiated Exception)', () => {
    it('should return true when feature is disabled in plan but tenant override explicitly enables it', async () => {
      prismaMock.company.findUnique.mockResolvedValue({
        id: 'comp-dezoryn',
        name: 'Dezoryn Technologies',
      });
      prismaMock.companyPlanAssignment.findUnique.mockResolvedValue({
        planVersionId: 'version-basic',
      });
      prismaMock.planVersion.findUnique.mockResolvedValue({
        id: 'version-basic',
        features: [{ enabled: false, feature: { key: 'MODULE_HELPDESK' } }],
      });
      prismaMock.tenantFeatureOverride.findMany.mockResolvedValue([
        { featureKey: 'MODULE_HELPDESK', enabled: true },
      ]);

      const isEffective = await service.isFeatureEffective('comp-dezoryn', 'MODULE_HELPDESK');
      expect(isEffective).toBe(true);
    });
  });

  describe('Truth Table 6: Plan OFF + Override OFF -> OFF', () => {
    it('should return false when both plan and override are off', async () => {
      prismaMock.company.findUnique.mockResolvedValue({
        id: 'comp-dezoryn',
        name: 'Dezoryn Technologies',
      });
      prismaMock.companyPlanAssignment.findUnique.mockResolvedValue({
        planVersionId: 'version-basic',
      });
      prismaMock.planVersion.findUnique.mockResolvedValue({
        id: 'version-basic',
        features: [{ enabled: false, feature: { key: 'MODULE_HELPDESK' } }],
      });
      prismaMock.tenantFeatureOverride.findMany.mockResolvedValue([
        { featureKey: 'MODULE_HELPDESK', enabled: false },
      ]);

      const isEffective = await service.isFeatureEffective('comp-dezoryn', 'MODULE_HELPDESK');
      expect(isEffective).toBe(false);
    });
  });

  describe('Override Expiration and Revocation Fallback', () => {
    it('should automatically fall back to plan default when override has expired', async () => {
      const pastDate = new Date(Date.now() - 100000);
      prismaMock.company.findUnique.mockResolvedValue({
        id: 'comp-1',
        name: 'Beta Corp',
      });
      prismaMock.companyPlanAssignment.findUnique.mockResolvedValue({
        planVersionId: 'version-basic',
      });
      prismaMock.planVersion.findUnique.mockResolvedValue({
        id: 'version-basic',
        features: [{ enabled: false, feature: { key: 'MODULE_HELPDESK' } }],
      });
      prismaMock.tenantFeatureOverride.findMany.mockResolvedValue([
        { featureKey: 'MODULE_HELPDESK', enabled: true, expiresAt: pastDate },
      ]);

      const isEffective = await service.isFeatureEffective('comp-1', 'MODULE_HELPDESK');
      expect(isEffective).toBe(false); // Falls back to basic plan (false)
    });

    it('should automatically fall back to plan default when override has been revoked', async () => {
      const pastDate = new Date(Date.now() - 50000);
      prismaMock.company.findUnique.mockResolvedValue({
        id: 'comp-1',
        name: 'Beta Corp',
      });
      prismaMock.companyPlanAssignment.findUnique.mockResolvedValue({
        planVersionId: 'version-basic',
      });
      prismaMock.planVersion.findUnique.mockResolvedValue({
        id: 'version-basic',
        features: [{ enabled: false, feature: { key: 'MODULE_HELPDESK' } }],
      });
      prismaMock.tenantFeatureOverride.findMany.mockResolvedValue([
        { featureKey: 'MODULE_HELPDESK', enabled: true, revokedAt: pastDate },
      ]);

      const isEffective = await service.isFeatureEffective('comp-1', 'MODULE_HELPDESK');
      expect(isEffective).toBe(false); // Falls back to basic plan (false)
    });
  });

  describe('Cross-Tenant Isolation', () => {
    it('should ensure Company A override does not leak into Company B', async () => {
      // Company A has override ON
      prismaMock.company.findUnique.mockImplementation(({ where }: any) => {
        if (where.id === 'comp-A') return Promise.resolve({ id: 'comp-A', name: 'Company A' });
        if (where.id === 'comp-B') return Promise.resolve({ id: 'comp-B', name: 'Company B' });
        return Promise.resolve(null);
      });

      prismaMock.companyPlanAssignment.findUnique.mockResolvedValue({
        planVersionId: 'version-basic',
      });
      prismaMock.planVersion.findUnique.mockResolvedValue({
        id: 'version-basic',
        features: [{ enabled: false, feature: { key: 'MODULE_HELPDESK' } }],
      });

      prismaMock.tenantFeatureOverride.findMany.mockImplementation(({ where }: any) => {
        if (where.companyId === 'comp-A') {
          return Promise.resolve([{ featureKey: 'MODULE_HELPDESK', enabled: true }]);
        }
        return Promise.resolve([]); // Company B has no overrides
      });

      const effectiveA = await service.isFeatureEffective('comp-A', 'MODULE_HELPDESK');
      const effectiveB = await service.isFeatureEffective('comp-B', 'MODULE_HELPDESK');

      expect(effectiveA).toBe(true);
      expect(effectiveB).toBe(false);
    });
  });

  describe('Security & Validation: setTenantOverride', () => {
    it('should reject invalid feature keys with BadRequestException', async () => {
      prismaMock.company.findUnique.mockResolvedValue({ id: 'comp-1', name: 'Alpha' });
      prismaMock.feature.findUnique.mockResolvedValue(null); // Unknown feature key

      await expect(
        service.setTenantOverride(
          'comp-1',
          'NON_EXISTENT_FEATURE_KEY',
          { enabled: true },
          { email: 'superadmin@hrnexa.com' },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should rotate user permissionVersion and record audit log on override grant', async () => {
      prismaMock.company.findUnique.mockResolvedValue({ id: 'comp-1', name: 'Alpha' });
      prismaMock.feature.findUnique.mockResolvedValue({
        key: 'MODULE_HELPDESK',
        name: 'Helpdesk & Support Tickets',
      });
      prismaMock.tenantFeatureOverride.upsert.mockResolvedValue({
        id: 'override-1',
        companyId: 'comp-1',
        featureKey: 'MODULE_HELPDESK',
        enabled: true,
      });

      const res = await service.setTenantOverride(
        'comp-1',
        'MODULE_HELPDESK',
        { enabled: true, reason: 'Commercial Pilot Add-on' },
        { email: 'superadmin@hrnexa.com' },
      );

      expect(res.enabled).toBe(true);
      expect(prismaMock.user.updateMany).toHaveBeenCalledWith({
        where: { companyId: 'comp-1' },
        data: { permissionVersion: { increment: 1 } },
      });
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'FEATURE_OVERRIDE_GRANTED',
            companyId: 'comp-1',
          }),
        }),
      );
    });
  });

  describe('Reset to Plan: removeTenantOverride', () => {
    it('should remove override, rotate permissionVersion and restore plan inheritance', async () => {
      prismaMock.company.findUnique.mockResolvedValue({ id: 'comp-1', name: 'Alpha' });

      await service.removeTenantOverride('comp-1', 'MODULE_HELPDESK', {
        email: 'superadmin@hrnexa.com',
      });

      expect(prismaMock.tenantFeatureOverride.deleteMany).toHaveBeenCalledWith({
        where: { companyId: 'comp-1', featureKey: 'MODULE_HELPDESK' },
      });
      expect(prismaMock.user.updateMany).toHaveBeenCalledWith({
        where: { companyId: 'comp-1' },
        data: { permissionVersion: { increment: 1 } },
      });
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'FEATURE_OVERRIDE_REMOVED',
            companyId: 'comp-1',
          }),
        }),
      );
    });
  });
});
