import {
  SubscriptionProvisioningService,
  DEFAULT_EXPENSE_CATEGORIES,
} from './subscription-provisioning.service';
import { CreateSubscriptionDto } from '../controllers/dto/create-subscription.dto';
import { BillingCycle } from '../enums/billing-cycle.enum';

describe('Expense Category Tenant Provisioning Specs (P1-1A)', () => {
  let service: SubscriptionProvisioningService;
  let mockPrisma: any;
  let mockPasswordService: any;
  let mockEmailService: any;
  let mockNotificationsService: any;
  let mockEventEmitter: any;
  let mockRoleProvisioningService: any;
  let mockOutboxPublisher: any;

  const mockPlan = {
    id: 'PLAN-PRO',
    name: 'PROFESSIONAL',
    code: 'PLAN_PRO',
    status: 'Published',
  };

  const mockVersion = {
    id: 'VER-1',
    planId: 'PLAN-PRO',
    version: 1,
    status: 'Published',
    employeeLimit: 50,
    storageLimitGB: 20,
    monthlyPrice: 25000,
    yearlyPrice: 250000,
  };

  let upsertedCategories: Map<string, any>;

  beforeEach(() => {
    upsertedCategories = new Map();

    const createTx = (companyId: string) => ({
      company: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: companyId, name: 'Acme Corp' }),
        upsert: jest.fn().mockResolvedValue({ id: companyId, name: 'Acme Corp' }),
      },
      subscription: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation((args) => ({
          id: `SUB-${companyId}`,
          companyId,
          ...args.data,
        })),
      },
      subscriptionEvent: {
        create: jest.fn().mockResolvedValue({ id: `EVT-${companyId}` }),
      },
      companyPlanAssignment: {
        upsert: jest.fn().mockResolvedValue({ id: `ASSIGN-${companyId}` }),
      },
      invoice: {
        create: jest.fn().mockResolvedValue({ id: `INV-${companyId}` }),
      },
      department: {
        create: jest.fn().mockResolvedValue({ id: `DEP-${companyId}` }),
      },
      designation: {
        create: jest.fn().mockResolvedValue({ id: `DES-${companyId}` }),
      },
      expenseCategory: {
        upsert: jest.fn().mockImplementation((args) => {
          const key = `${args.where.companyId_code.companyId}::${args.where.companyId_code.code}`;
          const existing = upsertedCategories.get(key);
          if (existing) {
            // Apply update payload (which is empty in idempotent seed)
            const updated = { ...existing, ...args.update };
            upsertedCategories.set(key, updated);
            return updated;
          }
          const created = { id: `CAT-${args.create.code}`, ...args.create };
          upsertedCategories.set(key, created);
          return created;
        }),
        findMany: jest.fn().mockImplementation((args) => {
          const list: any[] = [];
          for (const [key, val] of upsertedCategories.entries()) {
            if (key.startsWith(`${args.where.companyId}::`)) {
              list.push(val);
            }
          }
          return list;
        }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: `USR-${companyId}` }),
      },
      employee: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: `EMP-${companyId}` }),
      },
    });

    mockPrisma = {
      saaSPlanNew: {
        findFirst: jest.fn().mockResolvedValue(mockPlan),
      },
      planVersion: {
        findFirst: jest.fn().mockResolvedValue(mockVersion),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => {
        return callback(createTx('COMP-TENANT-ALPHA'));
      }),
    };

    mockPasswordService = {
      hash: jest.fn().mockResolvedValue('hashed_pw_123'),
    };
    mockEmailService = {
      sendWelcomeEmail: jest.fn().mockResolvedValue(true),
    };
    mockNotificationsService = {
      notifySuperAdmin: jest.fn().mockResolvedValue(true),
    };
    mockEventEmitter = {
      emit: jest.fn(),
    };
    mockRoleProvisioningService = {
      ensureDefaultRoles: jest.fn().mockResolvedValue({
        HRAdmin: { id: 'ROLE-HRAdmin' },
      }),
    };
    mockOutboxPublisher = {
      publishEmail: jest.fn().mockResolvedValue(true),
    };

    service = new SubscriptionProvisioningService(
      mockPrisma,
      mockPasswordService,
      mockEmailService,
      mockNotificationsService,
      mockEventEmitter,
      mockRoleProvisioningService,
      undefined,
      undefined,
      mockOutboxPublisher,
    );
  });

  it('1. should seed all 5 default expense categories for a newly provisioned tenant', async () => {
    const dto: CreateSubscriptionDto = {
      company: 'Acme Corp',
      hrAdmin: 'Alice Walker',
      ownerEmail: 'alice@acme.com',
      plan: 'PROFESSIONAL',
      cycle: BillingCycle.MONTHLY,
    };

    await service.createSubscription(dto);

    // Verify all 5 default categories were seeded
    expect(upsertedCategories.size).toBe(5);

    const expectedCodes = ['TRAVEL', 'MEALS', 'OFFICE_SUPPLIES', 'COMMUNICATION', 'MEDICAL'];
    for (const code of expectedCodes) {
      const cat = upsertedCategories.get(`COMP-TENANT-ALPHA::${code}`);
      expect(cat).toBeDefined();
      expect(cat.companyId).toBe('COMP-TENANT-ALPHA');
      expect(cat.isActive).toBe(true);
      expect(cat.requireReceipt).toBe(true);
    }

    // Verify specific limits & tax treatments match standard baseline
    const travel = upsertedCategories.get('COMP-TENANT-ALPHA::TRAVEL');
    expect(travel.name).toBe('Travel & Conveyance');
    expect(travel.maxLimit).toBe(10000);
    expect(travel.isTaxable).toBe(false);

    const meals = upsertedCategories.get('COMP-TENANT-ALPHA::MEALS');
    expect(meals.name).toBe('Client Meals & Entertainment');
    expect(meals.maxLimit).toBe(3000);
    expect(meals.isTaxable).toBe(true);
  });

  it('2. should be idempotent on provisioning retry without duplicating categories', async () => {
    const dto: CreateSubscriptionDto = {
      company: 'Acme Corp',
      hrAdmin: 'Alice Walker',
      ownerEmail: 'alice@acme.com',
      plan: 'PROFESSIONAL',
      cycle: BillingCycle.MONTHLY,
    };

    // First provisioning pass
    await service.createSubscription(dto);
    expect(upsertedCategories.size).toBe(5);

    // Second provisioning pass (retry)
    await service.createSubscription(dto);
    expect(upsertedCategories.size).toBe(5);
  });

  it('3. should preserve existing custom category configurations on tenant re-provisioning', async () => {
    // Pre-populate an existing category with custom admin policy limits
    upsertedCategories.set('COMP-TENANT-ALPHA::TRAVEL', {
      id: 'CUSTOM-CAT-1',
      companyId: 'COMP-TENANT-ALPHA',
      code: 'TRAVEL',
      name: 'Executive Travel & First Class Flights',
      description: 'Custom executive travel head',
      maxLimit: 75000,
      requireReceipt: true,
      isTaxable: false,
      isActive: true,
    });

    const dto: CreateSubscriptionDto = {
      company: 'Acme Corp',
      hrAdmin: 'Alice Walker',
      ownerEmail: 'alice@acme.com',
      plan: 'PROFESSIONAL',
      cycle: BillingCycle.MONTHLY,
    };

    await service.createSubscription(dto);

    // Custom limit of 75000 must NOT be overwritten by default 10000
    const travel = upsertedCategories.get('COMP-TENANT-ALPHA::TRAVEL');
    expect(travel.maxLimit).toBe(75000);
    expect(travel.name).toBe('Executive Travel & First Class Flights');
  });

  it('4. should strictly isolate categories between distinct tenants', async () => {
    // Provision Tenant A
    mockPrisma.$transaction.mockImplementationOnce(async (callback: any) => {
      const tx = {
        company: {
          findFirst: jest.fn().mockResolvedValue(null),
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: 'COMP-A', name: 'Company A' }),
          upsert: jest.fn().mockResolvedValue({ id: 'COMP-A', name: 'Company A' }),
        },
        subscription: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'SUB-A' }) },
        subscriptionEvent: { create: jest.fn().mockResolvedValue({ id: 'EVT-A' }) },
        companyPlanAssignment: { upsert: jest.fn().mockResolvedValue({ id: 'ASSIGN-A' }) },
        invoice: { create: jest.fn().mockResolvedValue({ id: 'INV-A' }) },
        department: { create: jest.fn().mockResolvedValue({ id: 'DEP-A' }) },
        designation: { create: jest.fn().mockResolvedValue({ id: 'DES-A' }) },
        expenseCategory: {
          upsert: jest.fn().mockImplementation((args) => {
            const key = `${args.where.companyId_code.companyId}::${args.where.companyId_code.code}`;
            const created = { id: `CAT-${args.create.code}`, ...args.create };
            upsertedCategories.set(key, created);
            return created;
          }),
        },
        user: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'USR-A' }) },
        employee: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'EMP-A' }) },
      };
      return callback(tx);
    });

    await service.createSubscription({
      company: 'Company A',
      hrAdmin: 'Admin A',
      ownerEmail: 'admin@comp-a.com',
      plan: 'PROFESSIONAL',
      cycle: BillingCycle.MONTHLY,
    });

    // Provision Tenant B
    mockPrisma.$transaction.mockImplementationOnce(async (callback: any) => {
      const tx = {
        company: {
          findFirst: jest.fn().mockResolvedValue(null),
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: 'COMP-B', name: 'Company B' }),
          upsert: jest.fn().mockResolvedValue({ id: 'COMP-B', name: 'Company B' }),
        },
        subscription: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'SUB-B' }) },
        subscriptionEvent: { create: jest.fn().mockResolvedValue({ id: 'EVT-B' }) },
        companyPlanAssignment: { upsert: jest.fn().mockResolvedValue({ id: 'ASSIGN-B' }) },
        invoice: { create: jest.fn().mockResolvedValue({ id: 'INV-B' }) },
        department: { create: jest.fn().mockResolvedValue({ id: 'DEP-B' }) },
        designation: { create: jest.fn().mockResolvedValue({ id: 'DES-B' }) },
        expenseCategory: {
          upsert: jest.fn().mockImplementation((args) => {
            const key = `${args.where.companyId_code.companyId}::${args.where.companyId_code.code}`;
            const created = { id: `CAT-${args.create.code}`, ...args.create };
            upsertedCategories.set(key, created);
            return created;
          }),
        },
        user: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'USR-B' }) },
        employee: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'EMP-B' }) },
      };
      return callback(tx);
    });

    await service.createSubscription({
      company: 'Company B',
      hrAdmin: 'Admin B',
      ownerEmail: 'admin@comp-b.com',
      plan: 'PROFESSIONAL',
      cycle: BillingCycle.MONTHLY,
    });

    // Verify 10 categories exist (5 for Comp A, 5 for Comp B)
    expect(upsertedCategories.size).toBe(10);

    const travelA = upsertedCategories.get('COMP-A::TRAVEL');
    const travelB = upsertedCategories.get('COMP-B::TRAVEL');

    expect(travelA.companyId).toBe('COMP-A');
    expect(travelB.companyId).toBe('COMP-B');
    expect(travelA.companyId).not.toBe(travelB.companyId);
  });
});
