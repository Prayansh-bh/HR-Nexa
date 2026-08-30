import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PlansService } from './plans.service';
import { PlansRepository } from '../repositories/plans.repository';

describe('PlansService - Annual Pricing Preservation Tests', () => {
  let service: PlansService;
  let repository: jest.Mocked<PlansRepository>;

  beforeEach(async () => {
    const mockRepo = {
      findSelectablePlans: jest.fn().mockResolvedValue([]),
      findNewPlanByName: jest.fn(),
      createNewPlan: jest.fn(),
      createPlanVersion: jest.fn(),
      updatePlanVersion: jest.fn(),
      updateNewPlanStatus: jest.fn(),
      findByName: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findFeatures: jest.fn().mockResolvedValue([]),
      getCompanySubscriptions: jest.fn().mockResolvedValue([]),
      findCompanyAssignment: jest.fn(),
      findActiveCompanySubscription: jest.fn(),
      syncPlanFeatureConfigs: jest.fn().mockResolvedValue(undefined),
      logPlanAudit: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlansService,
        { provide: PlansRepository, useValue: mockRepo },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<PlansService>(PlansService);
    repository = module.get(PlansRepository);
  });

  it('should PRESERVE existing yearlyPrice when updatePlan is called without yearlyPrice', async () => {
    const existingPlan = {
      id: 'plan_pro',
      name: 'PROFESSIONAL',
      code: 'PLAN_PRO',
      status: 'Published',
      versions: [
        {
          id: 'ver_1',
          version: 1,
          monthlyPrice: 4999,
          yearlyPrice: 49990, // Custom discounted annual price (10 months instead of 12)
          employeeLimit: 100,
          storageLimitGB: 50,
        },
      ],
    };

    repository.findByName.mockResolvedValue({ id: 'leg_1', name: 'PROFESSIONAL', price: '₹4999/mo', features: '[]' } as any);
    repository.findNewPlanByName.mockResolvedValue(existingPlan as any);

    // Admin updates monthly price only to ₹5499 without providing yearlyPrice
    const result = await service.updatePlan('PROFESSIONAL', {
      monthlyPrice: 5499,
      features: [],
    });

    expect(repository.updatePlanVersion).toHaveBeenCalledWith('ver_1', {
      monthlyPrice: 5499,
      yearlyPrice: 49990, // Crucial: preserved existing custom yearlyPrice!
      employeeLimit: 100,
      storageLimitGB: 50,
    });

    expect(result.yearlyPrice).toBe(49990);
    expect(result.monthlyPrice).toBe(5499);
  });

  it('should UPDATE yearlyPrice when updatePlan explicitly provides a new yearlyPrice', async () => {
    const existingPlan = {
      id: 'plan_pro',
      name: 'PROFESSIONAL',
      code: 'PLAN_PRO',
      status: 'Published',
      versions: [
        {
          id: 'ver_1',
          version: 1,
          monthlyPrice: 4999,
          yearlyPrice: 49990,
          employeeLimit: 100,
          storageLimitGB: 50,
        },
      ],
    };

    repository.findByName.mockResolvedValue({ id: 'leg_1', name: 'PROFESSIONAL', price: '₹4999/mo', features: '[]' } as any);
    repository.findNewPlanByName.mockResolvedValue(existingPlan as any);

    // Admin explicitly updates both monthly and yearly price
    const result = await service.updatePlan('PROFESSIONAL', {
      monthlyPrice: 5499,
      yearlyPrice: 52990,
      features: [],
    });

    expect(repository.updatePlanVersion).toHaveBeenCalledWith('ver_1', {
      monthlyPrice: 5499,
      yearlyPrice: 52990,
      employeeLimit: 100,
      storageLimitGB: 50,
    });

    expect(result.yearlyPrice).toBe(52990);
  });

  it('should default yearlyPrice to 12 * monthlyPrice when creating a new plan without explicit yearlyPrice', async () => {
    repository.findByName.mockResolvedValue(null);
    repository.create.mockResolvedValue({ id: 'leg_new', name: 'CUSTOM_TIER', features: '[]' } as any);
    repository.createNewPlan.mockResolvedValue({ id: 'new_plan_id', name: 'CUSTOM_TIER' } as any);
    repository.createPlanVersion.mockResolvedValue({ id: 'ver_new', version: 1 } as any);

    const result = await service.createPlan({
      name: 'CUSTOM_TIER',
      monthlyPrice: 2000,
      features: [],
    });

    expect(repository.createPlanVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        monthlyPrice: 2000,
        yearlyPrice: 24000, // 2000 * 12
      }),
    );

    expect(result.yearlyPrice).toBe(24000);
  });
});
