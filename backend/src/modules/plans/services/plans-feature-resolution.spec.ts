import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PlansService } from './plans.service';
import { PlansRepository } from '../repositories/plans.repository';

describe('PlansService - Feature Resolution Hierarchy & Fallback Security', () => {
  let service: PlansService;
  let repository: jest.Mocked<PlansRepository>;

  beforeEach(async () => {
    const mockRepo = {
      findSelectablePlans: jest.fn().mockResolvedValue([]),
      findNewPlanByName: jest.fn(),
      findCompanyAssignment: jest.fn(),
      findActiveCompanySubscription: jest.fn(),
      findFeatures: jest.fn().mockResolvedValue([]),
      getCompanySubscriptions: jest.fn().mockResolvedValue([]),
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

  it('should resolve features directly from CompanyPlanAssignment if present', async () => {
    const mockAssignment = {
      id: 'assign_1',
      company: 'Acme Corp',
      planVersion: {
        id: 'ver_std',
        version: 1,
        employeeLimit: 50,
        storageLimitGB: 20,
        branchLimit: 2,
        apiCallLimit: 5000,
        plan: { name: 'STANDARD' },
        features: [
          { feature: { key: 'CORE_EMPLOYEE', name: 'Core Employee' }, enabled: true },
          { feature: { key: 'ATT_GEO', name: 'Geo Attendance' }, enabled: true },
          { feature: { key: 'ADV_API', name: 'API Access' }, enabled: false },
        ],
      },
    };

    repository.findCompanyAssignment.mockResolvedValue(mockAssignment as any);

    const result = await service.resolveCompanyFeatures('Acme Corp');

    expect(result.planName).toBe('STANDARD');
    expect(result.limits.employees).toBe(50);
    expect(result.features['CORE_EMPLOYEE']).toBe(true);
    expect(result.features['ATT_GEO']).toBe(true);
    expect(result.features['ADV_API']).toBe(false);
  });

  it('should resolve features from active Subscription if CompanyPlanAssignment is missing', async () => {
    repository.findCompanyAssignment.mockResolvedValue(null);

    // Active subscription in DB for Starter plan
    repository.findActiveCompanySubscription.mockResolvedValue({
      id: 'sub_starter',
      company: 'Beta Startups',
      plan: 'STARTER',
      status: 'Active',
    } as any);

    repository.findNewPlanByName.mockResolvedValue({
      id: 'plan_starter',
      name: 'STARTER',
      versions: [
        {
          id: 'ver_starter',
          version: 1,
          employeeLimit: 10,
          storageLimitGB: 5,
          branchLimit: 1,
          apiCallLimit: 1000,
          plan: { name: 'STARTER' },
          features: [
            { feature: { key: 'CORE_EMPLOYEE', name: 'Core Employee' }, enabled: true },
            { feature: { key: 'PAY_STATUTORY', name: 'Statutory Tax' }, enabled: false },
          ],
        },
      ],
    } as any);

    const result = await service.resolveCompanyFeatures('Beta Startups');

    expect(result.planName).toBe('STARTER');
    expect(result.limits.employees).toBe(10);
    expect(result.features['CORE_EMPLOYEE']).toBe(true);
    expect(result.features['PAY_STATUTORY']).toBe(false);
  });

  it('should return safe denial / empty features for unsubscribed tenant (NEVER leak PREMIUM)', async () => {
    repository.findCompanyAssignment.mockResolvedValue(null);
    repository.findActiveCompanySubscription.mockResolvedValue(null);

    const result = await service.resolveCompanyFeatures('Unregistered Tenant');

    expect(result.planName).toBe('NONE');
    expect(result.limits.employees).toBe(0);
    expect(result.features).toEqual({});
    expect(result.features['ADV_API']).toBeUndefined();
    expect(result.features['PAY_STATUTORY']).toBeUndefined();
  });
});
