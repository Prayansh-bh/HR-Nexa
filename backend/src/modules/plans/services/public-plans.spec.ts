import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ThrottlerGuard } from '@nestjs/throttler';
import { PlansService } from './plans.service';
import { PlansRepository } from '../repositories/plans.repository';
import { PublicPlansController } from '../controllers/public-plans.controller';

describe('Public Plans API & Dynamic Pricing (Phase B2.1)', () => {
  let service: PlansService;
  let controller: PublicPlansController;
  let repository: any;
  let eventEmitter: any;

  const mockPublicPlansFromDb = [
    {
      id: 'plan-basic-uuid',
      name: 'BASIC',
      code: 'PLAN_BASIC',
      description: 'Starter plan for small teams',
      status: 'Published',
      isDefault: true,
      versions: [
        {
          id: 'ver-basic-v1',
          planId: 'plan-basic-uuid',
          version: 1,
          status: 'Published',
          monthlyPrice: 0,
          yearlyPrice: 0,
          currency: 'INR',
          employeeLimit: 10,
          storageLimitGB: 10,
          branchLimit: 1,
          apiCallLimit: 1000,
          changelog: 'Initial v1 release of Basic Plan',
          features: [
            {
              enabled: true,
              feature: { key: 'CORE_EMPLOYEE', name: 'Employee Directory', category: { name: 'Core HR' } },
            },
            {
              enabled: true,
              feature: { key: 'ATT_BASIC', name: 'Attendance Management', category: { name: 'Time & Attendance' } },
            },
          ],
        },
      ],
    },
    {
      id: 'plan-std-uuid',
      name: 'STANDARD',
      code: 'PLAN_STD',
      description: 'Growth plan for mid-sized organizations',
      status: 'Published',
      isDefault: false,
      versions: [
        {
          id: 'ver-std-v2',
          planId: 'plan-std-uuid',
          version: 2,
          status: 'Published',
          monthlyPrice: 5000,
          yearlyPrice: 50000,
          currency: 'INR',
          employeeLimit: 100,
          storageLimitGB: 50,
          branchLimit: 3,
          apiCallLimit: 5000,
          changelog: 'V2 pricing update',
          features: [
            {
              enabled: true,
              feature: { key: 'CORE_EMPLOYEE', name: 'Employee Directory', category: { name: 'Core HR' } },
            },
            {
              enabled: true,
              feature: { key: 'PAY_STATUTORY', name: 'Payroll & Tax Filing', category: { name: 'Payroll' } },
            },
            {
              enabled: true,
              feature: { key: 'ATT_GEO', name: 'Geo-Fencing Attendance', category: { name: 'Time & Attendance' } },
            },
          ],
        },
      ],
    },
    {
      id: 'plan-prem-uuid',
      name: 'PREMIUM',
      code: 'PLAN_PREM',
      description: 'Comprehensive enterprise plan',
      status: 'Published',
      isDefault: false,
      versions: [
        {
          id: 'ver-prem-v1',
          planId: 'plan-prem-uuid',
          version: 1,
          status: 'Published',
          monthlyPrice: 15000,
          yearlyPrice: 150000,
          currency: 'INR',
          employeeLimit: 500,
          storageLimitGB: 100,
          branchLimit: 10,
          apiCallLimit: 50000,
          changelog: 'Initial v1 release of Premium Plan',
          features: [
            {
              enabled: true,
              feature: { key: 'CORE_EMPLOYEE', name: 'Employee Directory', category: { name: 'Core HR' } },
            },
            {
              enabled: true,
              feature: { key: 'ADV_API', name: 'REST API & Webhooks Access', category: { name: 'Enterprise' } },
            },
          ],
        },
      ],
    },
  ];

  beforeEach(async () => {
    repository = {
      findPublicPlans: jest.fn().mockResolvedValue(mockPublicPlansFromDb),
      findSelectablePlans: jest.fn().mockResolvedValue([]),
      findNewPlans: jest.fn().mockResolvedValue([]),
      findFeatures: jest.fn().mockResolvedValue([]),
      getCompanySubscriptions: jest.fn().mockResolvedValue([]),
      findNewPlanByName: jest.fn().mockResolvedValue(null),
      createNewPlan: jest.fn(),
      createPlanVersion: jest.fn(),
      updatePlanVersion: jest.fn(),
      updateNewPlanStatus: jest.fn(),
      logPlanAudit: jest.fn(),
      syncPlanFeatureConfigs: jest.fn(),
      findByName: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    eventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublicPlansController],
      providers: [
        PlansService,
        { provide: PlansRepository, useValue: repository },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    service = module.get<PlansService>(PlansService);
    controller = module.get<PublicPlansController>(PublicPlansController);
  });

  describe('1. GET /api/public/plans (Controller & Service Integration)', () => {
    it('should return published plans without requiring authentication', async () => {
      const result = await controller.getPublicPlans();

      expect(result).toBeDefined();
      expect(result.plans).toBeInstanceOf(Array);
      expect(result.plans.length).toBe(3);

      const [basic, standard, premium] = result.plans;

      expect(basic.name).toBe('BASIC');
      expect(basic.code).toBe('PLAN_BASIC');
      expect(basic.monthlyPrice).toBe(0);
      expect(basic.yearlyPrice).toBe(0);
      expect(basic.monthlyAvailable).toBe(true);
      expect(basic.annualAvailable).toBe(true);
      expect(basic.limits.employeeLimit).toBe(10);

      expect(standard.name).toBe('STANDARD');
      expect(standard.code).toBe('PLAN_STD');
      expect(standard.monthlyPrice).toBe(5000);
      expect(standard.yearlyPrice).toBe(50000);
      expect(standard.isPopular).toBe(true);
      expect(standard.limits.employeeLimit).toBe(100);

      expect(premium.name).toBe('PREMIUM');
      expect(premium.code).toBe('PLAN_PREM');
      expect(premium.monthlyPrice).toBe(15000);
      expect(premium.yearlyPrice).toBe(150000);
      expect(premium.limits.employeeLimit).toBe(500);
    });

    it('should return features with category and included flags', async () => {
      const result = await service.getPublicPlans();
      const standard = result.plans.find((p: any) => p.code === 'PLAN_STD');

      expect(standard).toBeDefined();
      expect(standard.features).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            key: 'CORE_EMPLOYEE',
            name: 'Employee Directory',
            included: true,
            category: 'Core HR',
          }),
          expect.objectContaining({
            key: 'PAY_STATUTORY',
            name: 'Payroll & Tax Filing',
            included: true,
            category: 'Payroll',
          }),
        ]),
      );
    });
  });

  describe('2. Published Version & Draft Isolation Rule', () => {
    it('should filter out plans that have no published versions', async () => {
      repository.findPublicPlans.mockResolvedValue([
        {
          id: 'plan-draft-uuid',
          name: 'EXPERIMENTAL',
          code: 'PLAN_EXP',
          status: 'Published',
          versions: [], // No published version
        },
        ...mockPublicPlansFromDb,
      ]);

      service.invalidateCache();
      const result = await service.getPublicPlans();

      expect(result.plans.length).toBe(3);
      expect(result.plans.some((p: any) => p.code === 'PLAN_EXP')).toBe(false);
    });
  });

  describe('3. Cache Strategy & Realtime SuperAdmin Invalidation', () => {
    it('should serve cached public plans on subsequent calls', async () => {
      await service.getPublicPlans();
      await service.getPublicPlans();

      expect(repository.findPublicPlans).toHaveBeenCalledTimes(1);
    });

    it('should immediately re-fetch updated pricing after invalidateCache is called', async () => {
      await service.getPublicPlans();
      expect(repository.findPublicPlans).toHaveBeenCalledTimes(1);

      // SuperAdmin updates a plan price
      service.invalidateCache();

      const updatedPlans = [
        {
          ...mockPublicPlansFromDb[1],
          versions: [
            {
              ...mockPublicPlansFromDb[1].versions[0],
              monthlyPrice: 6999,
              yearlyPrice: 69990,
            },
          ],
        },
      ];
      repository.findPublicPlans.mockResolvedValue(updatedPlans);

      const refreshed = await service.getPublicPlans();
      expect(repository.findPublicPlans).toHaveBeenCalledTimes(2);
      expect(refreshed.plans[0].monthlyPrice).toBe(6999);
      expect(refreshed.plans[0].yearlyPrice).toBe(69990);
    });
  });
});
