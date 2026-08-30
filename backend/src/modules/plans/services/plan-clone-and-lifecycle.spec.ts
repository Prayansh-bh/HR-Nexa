import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BadRequestException } from '@nestjs/common';
import { PlansService } from './plans.service';
import { PlansRepository } from '../repositories/plans.repository';

describe('Plan Clone, Safe Delete, Code Update & Lifecycle Remediation', () => {
  let service: PlansService;
  let repository: any;
  let eventEmitter: any;

  const mockSourcePlan = {
    id: 'source-plan-uuid',
    name: 'ENTERPRISE',
    code: 'PLAN_ENTERPRISE',
    status: 'Published',
    versions: [
      {
        id: 'source-ver-v1',
        planId: 'source-plan-uuid',
        version: 1,
        status: 'Published',
        monthlyPrice: 12000,
        yearlyPrice: 120000,
        currency: 'INR',
        setupFee: 500,
        employeeLimit: 250,
        storageLimitGB: 100,
        branchLimit: 5,
        apiCallLimit: 25000,
        changelog: 'V1 enterprise release',
        features: [
          {
            featureId: 'feat-1',
            enabled: true,
            customConfig: '{"maxExportRows":50000}',
            feature: { id: 'feat-1', key: 'CORE_EMPLOYEE', name: 'Employee Directory' },
          },
          {
            featureId: 'feat-2',
            enabled: false,
            customConfig: null,
            feature: { id: 'feat-2', key: 'ADV_API', name: 'REST API & Webhooks' },
          },
        ],
      },
    ],
  };

  beforeEach(async () => {
    repository = {
      findByName: jest.fn().mockResolvedValue(null),
      findNewPlanById: jest.fn().mockResolvedValue(null),
      findNewPlanByName: jest.fn().mockResolvedValue(null),
      findNewPlanByCode: jest.fn().mockResolvedValue(null),
      findSelectablePlans: jest.fn().mockResolvedValue([]),
      findPublicPlans: jest.fn().mockResolvedValue([]),
      findNewPlans: jest.fn().mockResolvedValue([]),
      findFeatures: jest.fn().mockResolvedValue([]),
      findCategories: jest.fn().mockResolvedValue([]),
      findAddOns: jest.fn().mockResolvedValue([]),
      getAuditLogs: jest.fn().mockResolvedValue([]),
      getCompanySubscriptions: jest.fn().mockResolvedValue([]),
      createNewPlan: jest.fn(),
      createPlanVersion: jest.fn(),
      updatePlanVersion: jest.fn(),
      updateNewPlanCodeAndStatus: jest.fn(),
      countSubscriptionsByPlan: jest.fn().mockResolvedValue(0),
      countCompanyAssignmentsByPlan: jest.fn().mockResolvedValue(0),
      hardDeleteNewPlan: jest.fn().mockResolvedValue({ id: 'deleted-plan-uuid' }),
      clonePlanTransactional: jest.fn(),
      logPlanAudit: jest.fn().mockResolvedValue({}),
      syncPlanFeatureConfigs: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      createFeature: jest.fn().mockResolvedValue({ id: 'feat-new' }),
      createFeatureCategory: jest.fn().mockResolvedValue({ id: 'cat-new' }),
      createAddOn: jest.fn().mockResolvedValue({ id: 'addon-new' }),
    };

    eventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlansService,
        { provide: PlansRepository, useValue: repository },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<PlansService>(PlansService);
  });

  describe('A. Transactional Plan Cloning', () => {
    it('should clone plan preserving monthly/yearly prices, limits, and all feature configs', async () => {
      repository.findNewPlanById.mockResolvedValue(mockSourcePlan);
      repository.findNewPlanByName.mockResolvedValue(null);
      repository.findNewPlanByCode.mockResolvedValue(null);

      const mockClonedResult = {
        id: 'cloned-plan-uuid',
        name: 'ENTERPRISE_CLONE',
        code: 'PLAN_ENTERPRISE_CLONE',
        status: 'Draft',
        versions: [
          {
            id: 'cloned-ver-v1',
            planId: 'cloned-plan-uuid',
            version: 1,
            status: 'Draft',
            monthlyPrice: 12000,
            yearlyPrice: 120000,
            employeeLimit: 250,
            storageLimitGB: 100,
            features: mockSourcePlan.versions[0].features,
          },
        ],
      };
      repository.clonePlanTransactional.mockResolvedValue(mockClonedResult);

      const result = await service.clonePlan('source-plan-uuid', 'ENTERPRISE_CLONE');

      expect(repository.clonePlanTransactional).toHaveBeenCalledWith(
        mockSourcePlan,
        'ENTERPRISE_CLONE',
        'PLAN_ENTERPRISE_CLONE',
      );
      expect(result.name).toBe('ENTERPRISE_CLONE');
      expect(result.status).toBe('Draft');
      expect(result.versions[0].monthlyPrice).toBe(12000);
      expect(result.versions[0].yearlyPrice).toBe(120000);
      expect(result.versions[0].features.length).toBe(2);
      expect(result.versions[0].features[0].enabled).toBe(true);
      expect(result.versions[0].features[1].enabled).toBe(false);
      expect(eventEmitter.emit).toHaveBeenCalled();
    });

    it('should reject cloning if target plan name or code already exists', async () => {
      repository.findNewPlanById.mockResolvedValue(mockSourcePlan);
      repository.findNewPlanByName.mockResolvedValue({ id: 'existing-id', name: 'ENTERPRISE_CLONE' });

      await expect(
        service.clonePlan('source-plan-uuid', 'ENTERPRISE_CLONE'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('B. Explicit Plan Lifecycle State Machine (Archive, Restore, Permanent Delete, Delete Draft)', () => {
    // 1. ARCHIVE PLAN
    it('archivePlan: Published -> Archived succeeds and records audit log', async () => {
      const publishedPlan = {
        id: 'pub-plan-uuid',
        name: 'PUBLISHED_TIER',
        code: 'PLAN_PUB',
        status: 'Published',
        versions: [{ id: 'v1' }],
      };
      repository.findNewPlanById.mockResolvedValue(publishedPlan);
      repository.countCompanyAssignmentsByPlan.mockResolvedValue(3);
      repository.countSubscriptionsByPlan.mockResolvedValue(3);

      const result = await service.archivePlan('pub-plan-uuid');

      expect(result.status).toBe('Archived');
      expect(repository.updateNewPlanCodeAndStatus).toHaveBeenCalledWith('pub-plan-uuid', {
        status: 'Archived',
      });
      expect(repository.logPlanAudit).toHaveBeenCalledWith(
        'PUBLISHED_TIER',
        'Archived plan',
        'Super Admin',
        expect.stringContaining('preserved 3 assignments and 3 subscriptions'),
      );
      expect(eventEmitter.emit).toHaveBeenCalled();
    });

    it('archivePlan: rejects archiving a Draft plan', async () => {
      const draftPlan = { id: 'd-1', name: 'DRAFT_P', status: 'Draft' };
      repository.findNewPlanById.mockResolvedValue(draftPlan);

      await expect(service.archivePlan('d-1')).rejects.toThrow(BadRequestException);
    });

    it('archivePlan: rejects archiving an already Archived plan', async () => {
      const archivedPlan = { id: 'a-1', name: 'ARCH_P', status: 'Archived' };
      repository.findNewPlanById.mockResolvedValue(archivedPlan);

      await expect(service.archivePlan('a-1')).rejects.toThrow(BadRequestException);
    });

    // 2. RESTORE PLAN
    it('restorePlan: Archived -> Published restores plan and updates version', async () => {
      const archivedPlan = {
        id: 'arch-plan-uuid',
        name: 'RECOVERABLE_TIER',
        code: 'PLAN_REC',
        status: 'Archived',
        versions: [{ id: 'v1', version: 1, status: 'Archived' }],
      };
      repository.findNewPlanById.mockResolvedValue(archivedPlan);

      const result = await service.restorePlan('arch-plan-uuid');

      expect(result.status).toBe('Published');
      expect(repository.updatePlanVersion).toHaveBeenCalledWith('v1', {
        status: 'Published',
        changelog: 'Restored plan version v1',
      });
      expect(repository.updateNewPlanCodeAndStatus).toHaveBeenCalledWith('arch-plan-uuid', {
        status: 'Published',
      });
      expect(repository.logPlanAudit).toHaveBeenCalledWith(
        'RECOVERABLE_TIER',
        'Restored plan',
        'Super Admin',
        expect.stringContaining('Restored plan "RECOVERABLE_TIER"'),
      );
      expect(eventEmitter.emit).toHaveBeenCalled();
    });

    it('restorePlan: rejects restoring an already Published plan', async () => {
      const publishedPlan = { id: 'p-1', name: 'PUB_P', status: 'Published' };
      repository.findNewPlanById.mockResolvedValue(publishedPlan);

      await expect(service.restorePlan('p-1')).rejects.toThrow(BadRequestException);
    });

    it('restorePlan: rejects restoring a Draft plan', async () => {
      const draftPlan = { id: 'd-1', name: 'DRAFT_P', status: 'Draft' };
      repository.findNewPlanById.mockResolvedValue(draftPlan);

      await expect(service.restorePlan('d-1')).rejects.toThrow(BadRequestException);
    });

    // 3. PERMANENT DELETE (ARCHIVED -> PURGE)
    it('permanentlyDeletePlan: succeeds for Archived plan with 0 assignments and 0 subscriptions', async () => {
      const archivedPlan = {
        id: 'arch-plan-uuid',
        name: 'SAFE_TO_DELETE',
        status: 'Archived',
        versions: [{ id: 'v1' }, { id: 'v2' }],
      };
      repository.findNewPlanById.mockResolvedValue(archivedPlan);
      repository.countCompanyAssignmentsByPlan.mockResolvedValue(0);
      repository.countSubscriptionsByPlan.mockResolvedValue(0);

      const result = await service.permanentlyDeletePlan('arch-plan-uuid');

      expect(result.action).toBe('PermanentlyDeleted');
      expect(repository.hardDeleteNewPlan).toHaveBeenCalledWith('arch-plan-uuid', 'SAFE_TO_DELETE');
    });

    it('permanentlyDeletePlan: rejects permanent deletion when plan has active company assignments', async () => {
      const archivedPlan = {
        id: 'arch-assigned-uuid',
        name: 'ACTIVE_ASSIGNED_PLAN',
        status: 'Archived',
      };
      repository.findNewPlanById.mockResolvedValue(archivedPlan);
      repository.countCompanyAssignmentsByPlan.mockResolvedValue(5);
      repository.countSubscriptionsByPlan.mockResolvedValue(0);

      await expect(service.permanentlyDeletePlan('arch-assigned-uuid')).rejects.toThrow(
        /attached to 5 company assignment\(s\)/,
      );
      expect(repository.hardDeleteNewPlan).not.toHaveBeenCalled();
    });

    it('permanentlyDeletePlan: rejects permanent deletion when plan has active subscriptions', async () => {
      const archivedPlan = {
        id: 'arch-sub-uuid',
        name: 'ACTIVE_SUB_PLAN',
        status: 'Archived',
      };
      repository.findNewPlanById.mockResolvedValue(archivedPlan);
      repository.countCompanyAssignmentsByPlan.mockResolvedValue(0);
      repository.countSubscriptionsByPlan.mockResolvedValue(8);

      await expect(service.permanentlyDeletePlan('arch-sub-uuid')).rejects.toThrow(
        /8 subscription\(s\)/,
      );
      expect(repository.hardDeleteNewPlan).not.toHaveBeenCalled();
    });

    it('permanentlyDeletePlan: rejects direct permanent delete on Published plan', async () => {
      const publishedPlan = { id: 'p-1', name: 'PUB_P', status: 'Published' };
      repository.findNewPlanById.mockResolvedValue(publishedPlan);

      await expect(service.permanentlyDeletePlan('p-1')).rejects.toThrow(BadRequestException);
    });

    // 4. DELETE DRAFT
    it('deleteDraftPlan: succeeds for Draft plan with 0 references', async () => {
      const draftPlan = {
        id: 'draft-plan-uuid',
        name: 'UNUSED_DRAFT',
        status: 'Draft',
        versions: [{ id: 'v1' }],
      };
      repository.findNewPlanById.mockResolvedValue(draftPlan);
      repository.countCompanyAssignmentsByPlan.mockResolvedValue(0);
      repository.countSubscriptionsByPlan.mockResolvedValue(0);

      const result = await service.deleteDraftPlan('draft-plan-uuid');

      expect(result.action).toBe('DraftDeleted');
      expect(repository.hardDeleteNewPlan).toHaveBeenCalledWith('draft-plan-uuid', 'UNUSED_DRAFT');
    });

    it('deleteDraftPlan: rejects when plan is not in Draft status', async () => {
      const publishedPlan = { id: 'p-1', name: 'PUB_P', status: 'Published' };
      repository.findNewPlanById.mockResolvedValue(publishedPlan);

      await expect(service.deleteDraftPlan('p-1')).rejects.toThrow(BadRequestException);
    });

    // 5. COMPATIBILITY ROUTER (deletePlan)
    it('deletePlan compatibility: routes Draft -> deleteDraftPlan', async () => {
      const draftPlan = { id: 'd-1', name: 'DRAFT_COMPAT', status: 'Draft' };
      repository.findNewPlanByName.mockResolvedValue(draftPlan);
      repository.countCompanyAssignmentsByPlan.mockResolvedValue(0);
      repository.countSubscriptionsByPlan.mockResolvedValue(0);

      const result = await service.deletePlan('DRAFT_COMPAT');
      expect(result.action).toBe('DraftDeleted');
    });

    it('deletePlan compatibility: routes Published -> archivePlan', async () => {
      const publishedPlan = { id: 'p-1', name: 'PUB_COMPAT', status: 'Published' };
      repository.findNewPlanByName.mockResolvedValue(publishedPlan);
      repository.countCompanyAssignmentsByPlan.mockResolvedValue(0);
      repository.countSubscriptionsByPlan.mockResolvedValue(0);

      const result = await service.deletePlan('PUB_COMPAT');
      expect(result.action).toBe('Archived');
    });
  });

  describe('C. Plan Code Updating & Uniqueness', () => {
    it('should successfully update plan code when unique', async () => {
      const existingPlan = {
        id: 'plan-1',
        name: 'BASIC',
        code: 'PLAN_BASIC',
        status: 'Published',
        versions: [{ id: 'v1', monthlyPrice: 1000, yearlyPrice: 10000, employeeLimit: 20 }],
      };
      repository.findNewPlanByName.mockResolvedValue(existingPlan);
      repository.findNewPlanByCode.mockResolvedValue(null);

      const result = await service.updatePlan('BASIC', {
        code: 'PLAN_BASIC_V2',
        monthlyPrice: 1500,
        features: [],
      });

      expect(repository.updateNewPlanCodeAndStatus).toHaveBeenCalledWith('plan-1', {
        code: 'PLAN_BASIC_V2',
        status: undefined,
        description: undefined,
      });
      expect(result.name).toBe('BASIC');
      expect(result.monthlyPrice).toBe(1500);
    });

    it('should reject update if code is already claimed by another plan', async () => {
      const planA = { id: 'plan-a', name: 'PLAN_A', code: 'CODE_A', versions: [{ id: 'v1' }] };
      const planB = { id: 'plan-b', name: 'PLAN_B', code: 'CODE_B', versions: [{ id: 'v1' }] };
      repository.findNewPlanByName.mockResolvedValue(planA);
      repository.findNewPlanByCode.mockResolvedValue(planB); // Another plan already has CODE_B

      await expect(
        service.updatePlan('PLAN_A', { code: 'CODE_B', features: [] }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('D. Independent Pricing Maintenance', () => {
    it('should preserve existing yearlyPrice when updating only monthlyPrice', async () => {
      const existingPlan = {
        id: 'plan-custom-annual',
        name: 'PRO',
        code: 'PLAN_PRO',
        status: 'Published',
        versions: [
          {
            id: 'v1',
            version: 1,
            monthlyPrice: 3000,
            yearlyPrice: 29990, // Custom discounted annual price
            employeeLimit: 50,
            storageLimitGB: 20,
          },
        ],
      };
      repository.findNewPlanByName.mockResolvedValue(existingPlan);

      const result = await service.updatePlan('PRO', {
        monthlyPrice: 3500, // Monthly updated, yearly omitted
        features: [],
      });

      expect(repository.updatePlanVersion).toHaveBeenCalledWith('v1', {
        monthlyPrice: 3500,
        yearlyPrice: 29990, // Preserved exact discounted price
        employeeLimit: 50,
        storageLimitGB: 20,
      });
      expect(result.monthlyPrice).toBe(3500);
      expect(result.yearlyPrice).toBe(29990);
    });
  });

  describe('E. Safe Default / System Plan Bootstrap (ensureDefaultPlansExist)', () => {
    it('TEST 1: Existing customized BASIC is preserved (never overwritten)', async () => {
      const customBasic = {
        id: 'basic-uuid',
        name: 'BASIC',
        code: 'PLAN_BASIC_CUSTOM',
        status: 'Published',
        versions: [
          {
            id: 'ver-1',
            version: 1,
            status: 'Published',
            monthlyPrice: 999,
            yearlyPrice: 9990,
            employeeLimit: 25,
            storageLimitGB: 30,
            branchLimit: 2,
            apiCallLimit: 5000,
            features: [{ featureId: 'f1', enabled: true }],
          },
        ],
      };
      const standard = { id: 'std-uuid', name: 'STANDARD', status: 'Published', versions: [{ id: 'std-v1' }] };
      const premium = { id: 'prem-uuid', name: 'PREMIUM', status: 'Published', versions: [{ id: 'prem-v1' }] };

      repository.findNewPlanByName.mockImplementation((name: string) => {
        if (name === 'BASIC') return Promise.resolve(customBasic);
        if (name === 'STANDARD') return Promise.resolve(standard);
        if (name === 'PREMIUM') return Promise.resolve(premium);
        return Promise.resolve(null);
      });

      await service.ensureDefaultPlansExist();

      // Assert that repository was never instructed to mutate existing BASIC
      expect(repository.createNewPlan).not.toHaveBeenCalled();
      expect(repository.createPlanVersion).not.toHaveBeenCalled();
      expect(repository.updateNewPlanCodeAndStatus).not.toHaveBeenCalled();
      expect(customBasic.versions[0].monthlyPrice).toBe(999);
      expect(customBasic.versions[0].yearlyPrice).toBe(9990);
      expect(customBasic.versions[0].employeeLimit).toBe(25);
    });

    it('TEST 2: Archived BASIC stays archived (never silently restored)', async () => {
      const archivedBasic = {
        id: 'basic-uuid',
        name: 'BASIC',
        code: 'PLAN_BASIC',
        status: 'Archived',
        versions: [
          {
            id: 'ver-1',
            status: 'Archived',
            monthlyPrice: 0,
            yearlyPrice: 0,
            employeeLimit: 10,
          },
        ],
      };
      const standard = { id: 'std-uuid', name: 'STANDARD', status: 'Published', versions: [{ id: 'std-v1' }] };
      const premium = { id: 'prem-uuid', name: 'PREMIUM', status: 'Published', versions: [{ id: 'prem-v1' }] };

      repository.findNewPlanByName.mockImplementation((name: string) => {
        if (name === 'BASIC') return Promise.resolve(archivedBasic);
        if (name === 'STANDARD') return Promise.resolve(standard);
        if (name === 'PREMIUM') return Promise.resolve(premium);
        return Promise.resolve(null);
      });

      await service.ensureDefaultPlansExist();

      expect(archivedBasic.status).toBe('Archived');
      expect(repository.updateNewPlanCodeAndStatus).not.toHaveBeenCalled();
      expect(repository.createNewPlan).not.toHaveBeenCalled();
    });

    it('TEST 3: Draft BASIC stays draft (never published automatically)', async () => {
      const draftBasic = {
        id: 'basic-uuid',
        name: 'BASIC',
        code: 'PLAN_BASIC',
        status: 'Draft',
        versions: [
          {
            id: 'ver-1',
            status: 'Draft',
            monthlyPrice: 0,
            yearlyPrice: 0,
            employeeLimit: 10,
          },
        ],
      };
      const standard = { id: 'std-uuid', name: 'STANDARD', status: 'Published', versions: [{ id: 'std-v1' }] };
      const premium = { id: 'prem-uuid', name: 'PREMIUM', status: 'Published', versions: [{ id: 'prem-v1' }] };

      repository.findNewPlanByName.mockImplementation((name: string) => {
        if (name === 'BASIC') return Promise.resolve(draftBasic);
        if (name === 'STANDARD') return Promise.resolve(standard);
        if (name === 'PREMIUM') return Promise.resolve(premium);
        return Promise.resolve(null);
      });

      await service.ensureDefaultPlansExist();

      expect(draftBasic.status).toBe('Draft');
      expect(repository.updateNewPlanCodeAndStatus).not.toHaveBeenCalled();
      expect(repository.createNewPlan).not.toHaveBeenCalled();
    });

    it('TEST 4: Missing BASIC is recreated with canonical defaults', async () => {
      const standard = { id: 'std-uuid', name: 'STANDARD', status: 'Published', versions: [{ id: 'std-v1' }] };
      const premium = { id: 'prem-uuid', name: 'PREMIUM', status: 'Published', versions: [{ id: 'prem-v1' }] };

      repository.findNewPlanByName.mockImplementation((name: string) => {
        if (name === 'BASIC') return Promise.resolve(null); // Truly missing
        if (name === 'STANDARD') return Promise.resolve(standard);
        if (name === 'PREMIUM') return Promise.resolve(premium);
        return Promise.resolve(null);
      });

      repository.createNewPlan.mockResolvedValue({
        id: 'new-basic-uuid',
        name: 'BASIC',
        code: 'PLAN_BASIC',
        status: 'Published',
      });

      await service.ensureDefaultPlansExist();

      expect(repository.createNewPlan).toHaveBeenCalledWith({
        name: 'BASIC',
        code: 'PLAN_BASIC',
        description: 'Starter plan for small teams',
        status: 'Published',
        isDefault: true,
      });
      expect(repository.createPlanVersion).toHaveBeenCalledWith({
        planId: 'new-basic-uuid',
        version: 1,
        status: 'Published',
        monthlyPrice: 0,
        yearlyPrice: 0,
        employeeLimit: 10,
        storageLimitGB: 10,
        branchLimit: 1,
        apiCallLimit: 1000,
        changelog: 'Standard v1 release for BASIC Plan',
      });
    });

    it('TEST 5: Existing STANDARD/PREMIUM are never reset', async () => {
      const customStandard = {
        id: 'std-uuid',
        name: 'STANDARD',
        code: 'PLAN_STD_CUSTOM',
        status: 'Published',
        versions: [
          {
            id: 'std-v1',
            version: 1,
            monthlyPrice: 7999,
            yearlyPrice: 79990,
            employeeLimit: 150,
            storageLimitGB: 80,
          },
        ],
      };
      const customPremium = {
        id: 'prem-uuid',
        name: 'PREMIUM',
        code: 'PLAN_PREM_CUSTOM',
        status: 'Published',
        versions: [
          {
            id: 'prem-v1',
            version: 1,
            monthlyPrice: 24999,
            yearlyPrice: 249990,
            employeeLimit: 1000,
            storageLimitGB: 500,
          },
        ],
      };
      const basic = { id: 'basic-uuid', name: 'BASIC', status: 'Published', versions: [{ id: 'b-v1' }] };

      repository.findNewPlanByName.mockImplementation((name: string) => {
        if (name === 'BASIC') return Promise.resolve(basic);
        if (name === 'STANDARD') return Promise.resolve(customStandard);
        if (name === 'PREMIUM') return Promise.resolve(customPremium);
        return Promise.resolve(null);
      });

      await service.ensureDefaultPlansExist();

      expect(repository.createNewPlan).not.toHaveBeenCalled();
      expect(repository.createPlanVersion).not.toHaveBeenCalled();
      expect(customStandard.versions[0].monthlyPrice).toBe(7999);
      expect(customPremium.versions[0].monthlyPrice).toBe(24999);
    });

    it('TEST 6: Missing canonical plans are independently recoverable', async () => {
      const basic = { id: 'basic-uuid', name: 'BASIC', status: 'Published', versions: [{ id: 'b-v1' }] };
      const premium = { id: 'prem-uuid', name: 'PREMIUM', status: 'Published', versions: [{ id: 'prem-v1' }] };

      repository.findNewPlanByName.mockImplementation((name: string) => {
        if (name === 'BASIC') return Promise.resolve(basic);
        if (name === 'STANDARD') return Promise.resolve(null); // STANDARD alone is missing
        if (name === 'PREMIUM') return Promise.resolve(premium);
        return Promise.resolve(null);
      });

      repository.createNewPlan.mockResolvedValue({
        id: 'new-std-uuid',
        name: 'STANDARD',
        code: 'PLAN_STD',
        status: 'Published',
      });

      await service.ensureDefaultPlansExist();

      // Only STANDARD is created
      expect(repository.createNewPlan).toHaveBeenCalledTimes(1);
      expect(repository.createNewPlan).toHaveBeenCalledWith({
        name: 'STANDARD',
        code: 'PLAN_STD',
        description: 'Growth plan for mid-sized organizations',
        status: 'Published',
        isDefault: false,
      });
      expect(repository.createPlanVersion).toHaveBeenCalledTimes(1);
    });

    it('TEST 7: Feature preservation for existing customized plans', async () => {
      const features = [
        { featureId: 'f-directory', enabled: true, customConfig: '{"view":"tree"}' },
        { featureId: 'f-payroll', enabled: true, customConfig: null },
      ];
      const plan = {
        id: 'plan-1',
        name: 'BASIC',
        status: 'Published',
        versions: [{ id: 'v1', version: 1, features }],
      };

      repository.findNewPlanByName.mockImplementation((name: string) => {
        if (name === 'BASIC') return Promise.resolve(plan);
        return Promise.resolve({ id: 'dummy', name, versions: [{ id: 'dv1' }] });
      });

      await service.ensureDefaultPlansExist();

      expect(plan.versions[0].features).toEqual(features);
      expect(repository.syncPlanFeatureConfigs).not.toHaveBeenCalled();
    });

    it('TEST 8: Cache invalidation occurs only when database state mutates', async () => {
      // 1. All plans exist -> NO cache invalidation
      const allExist = (name: string) =>
        Promise.resolve({ id: `${name}-id`, name, versions: [{ id: `${name}-v1` }] });
      repository.findNewPlanByName.mockImplementation(allExist);

      const spyInvalidate = jest.spyOn(service, 'invalidateCache');
      await service.ensureDefaultPlansExist();
      expect(spyInvalidate).not.toHaveBeenCalled();

      // 2. A plan is missing -> Mutation occurs -> Cache IS invalidated
      repository.findNewPlanByName.mockImplementation((name: string) => {
        if (name === 'BASIC') return Promise.resolve(null);
        return Promise.resolve({ id: `${name}-id`, name, versions: [{ id: `${name}-v1` }] });
      });
      repository.createNewPlan.mockResolvedValue({ id: 'new-id', name: 'BASIC' });

      await service.ensureDefaultPlansExist();
      expect(spyInvalidate).toHaveBeenCalledTimes(1);
    });
  });
});
