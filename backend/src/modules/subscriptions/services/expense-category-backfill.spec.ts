import { backfillExpenseCategories } from '../../../scripts/backfill-expense-categories';
import { DEFAULT_EXPENSE_CATEGORIES } from './subscription-provisioning.service';

describe('Expense Category Backfill Specs (Phase 14 Production Safe)', () => {
  let mockPrisma: any;
  let companiesStore: any[];
  let categoriesStore: Map<string, any>;

  beforeEach(() => {
    categoriesStore = new Map();
    companiesStore = [];

    mockPrisma = {
      company: {
        findMany: jest.fn().mockImplementation(async () => {
          return companiesStore.map((c) => {
            const companyCats: any[] = [];
            for (const [key, cat] of categoriesStore.entries()) {
              if (key.startsWith(`${c.id}::`)) {
                companyCats.push(cat);
              }
            }
            return {
              ...c,
              expenseCategories: companyCats,
            };
          });
        }),
      },
      expenseCategory: {
        upsert: jest.fn().mockImplementation(async (args) => {
          const key = `${args.where.companyId_code.companyId}::${args.where.companyId_code.code}`;
          const existing = categoriesStore.get(key);
          if (existing) {
            const updated = { ...existing, ...args.update };
            categoriesStore.set(key, updated);
            return updated;
          }
          const created = {
            id: `CAT-${args.create.code}-${Date.now()}`,
            ...args.create,
          };
          categoriesStore.set(key, created);
          return created;
        }),
      },
    };
  });

  it('1. should create all 5 canonical defaults for an empty tenant', async () => {
    companiesStore = [{ id: 'COMP-1', name: 'Company One' }];

    const summary = await backfillExpenseCategories(mockPrisma);

    expect(summary.eligibleCompanies).toBe(1);
    expect(summary.companiesBackfilled).toBe(1);
    expect(summary.companiesAlreadyComplete).toBe(0);
    expect(summary.categoriesCreated).toBe(5);
    expect(summary.categoriesSkipped).toBe(0);

    const expectedCodes = ['TRAVEL', 'MEALS', 'OFFICE_SUPPLIES', 'COMMUNICATION', 'MEDICAL'];
    for (const code of expectedCodes) {
      const cat = categoriesStore.get(`COMP-1::${code}`);
      expect(cat).toBeDefined();
      expect(cat.companyId).toBe('COMP-1');
      expect(cat.isActive).toBe(true);
      expect(cat.requireReceipt).toBe(true);
    }
  });

  it('2. should only backfill missing defaults for a partially configured tenant', async () => {
    companiesStore = [{ id: 'COMP-PARTIAL', name: 'Partial Corp' }];

    // Pre-populate TRAVEL & MEALS
    categoriesStore.set('COMP-PARTIAL::TRAVEL', {
      id: 'CAT-TRAVEL-OLD',
      companyId: 'COMP-PARTIAL',
      code: 'TRAVEL',
      name: 'Travel & Conveyance',
      maxLimit: 10000,
      requireReceipt: true,
      isTaxable: false,
      isActive: true,
    });
    categoriesStore.set('COMP-PARTIAL::MEALS', {
      id: 'CAT-MEALS-OLD',
      companyId: 'COMP-PARTIAL',
      code: 'MEALS',
      name: 'Client Meals & Entertainment',
      maxLimit: 3000,
      requireReceipt: true,
      isTaxable: true,
      isActive: true,
    });

    const summary = await backfillExpenseCategories(mockPrisma);

    expect(summary.eligibleCompanies).toBe(1);
    expect(summary.companiesBackfilled).toBe(1);
    expect(summary.categoriesCreated).toBe(3); // OFFICE_SUPPLIES, COMMUNICATION, MEDICAL
    expect(summary.categoriesSkipped).toBe(2); // TRAVEL, MEALS

    expect(categoriesStore.size).toBe(5);
  });

  it('3. should create zero additional records for a fully complete tenant', async () => {
    companiesStore = [{ id: 'COMP-COMPLETE', name: 'Complete Corp' }];

    for (const def of DEFAULT_EXPENSE_CATEGORIES) {
      categoriesStore.set(`COMP-COMPLETE::${def.code}`, {
        id: `CAT-${def.code}`,
        companyId: 'COMP-COMPLETE',
        code: def.code,
        name: def.name,
        maxLimit: def.maxLimit,
        requireReceipt: def.requireReceipt,
        isTaxable: def.isTaxable,
        isActive: true,
      });
    }

    const summary = await backfillExpenseCategories(mockPrisma);

    expect(summary.eligibleCompanies).toBe(1);
    expect(summary.companiesAlreadyComplete).toBe(1);
    expect(summary.companiesBackfilled).toBe(0);
    expect(summary.categoriesCreated).toBe(0);
    expect(summary.categoriesSkipped).toBe(5);
  });

  it('4. should preserve custom category configurations and not overwrite them', async () => {
    companiesStore = [{ id: 'COMP-CUSTOM', name: 'Custom Corp' }];

    // Pre-populate custom TRAVEL category with non-standard name, limit, and status
    categoriesStore.set('COMP-CUSTOM::TRAVEL', {
      id: 'CAT-CUSTOM-1',
      companyId: 'COMP-CUSTOM',
      code: 'TRAVEL',
      name: 'Executive Business Flights Only',
      description: 'Custom VIP Policy',
      maxLimit: 90000,
      requireReceipt: true,
      isTaxable: false,
      isActive: false, // Inactive custom status
    });

    const summary = await backfillExpenseCategories(mockPrisma);

    expect(summary.categoriesCreated).toBe(4);
    expect(summary.categoriesSkipped).toBe(1);

    const travel = categoriesStore.get('COMP-CUSTOM::TRAVEL');
    expect(travel.name).toBe('Executive Business Flights Only');
    expect(travel.description).toBe('Custom VIP Policy');
    expect(travel.maxLimit).toBe(90000);
    expect(travel.isActive).toBe(false); // Inactive status strictly preserved
  });

  it('5. should preserve distinct non-standard custom categories', async () => {
    companiesStore = [{ id: 'COMP-EXTRA', name: 'Extra Corp' }];

    // Pre-populate custom head 'RELOCATION_BONUS'
    categoriesStore.set('COMP-EXTRA::RELOCATION', {
      id: 'CAT-RELO-1',
      companyId: 'COMP-EXTRA',
      code: 'RELOCATION',
      name: 'Employee Relocation Assistance',
      maxLimit: 50000,
      requireReceipt: true,
      isTaxable: true,
      isActive: true,
    });

    const summary = await backfillExpenseCategories(mockPrisma);

    expect(summary.categoriesCreated).toBe(5);
    expect(summary.categoriesSkipped).toBe(0);

    // Total categories should now be 6 (1 custom + 5 defaults)
    expect(categoriesStore.size).toBe(6);
    expect(categoriesStore.has('COMP-EXTRA::RELOCATION')).toBe(true);
  });

  it('6. should be 100% idempotent on repeated execution', async () => {
    companiesStore = [
      { id: 'COMP-A', name: 'Company A' },
      { id: 'COMP-B', name: 'Company B' },
    ];

    // Pass 1: Fresh backfill
    const summary1 = await backfillExpenseCategories(mockPrisma);
    expect(summary1.categoriesCreated).toBe(10);
    expect(categoriesStore.size).toBe(10);

    // Pass 2: Retry backfill immediately
    const summary2 = await backfillExpenseCategories(mockPrisma);
    expect(summary2.companiesAlreadyComplete).toBe(2);
    expect(summary2.companiesBackfilled).toBe(0);
    expect(summary2.categoriesCreated).toBe(0);
    expect(summary2.categoriesSkipped).toBe(10);
    expect(categoriesStore.size).toBe(10);

    // Pass 3: 3rd retry
    const summary3 = await backfillExpenseCategories(mockPrisma);
    expect(summary3.categoriesCreated).toBe(0);
    expect(categoriesStore.size).toBe(10);
  });

  it('7. should enforce strict tenant isolation across multiple companies', async () => {
    companiesStore = [
      { id: 'TENANT-X', name: 'Tenant X' },
      { id: 'TENANT-Y', name: 'Tenant Y' },
    ];

    await backfillExpenseCategories(mockPrisma);

    for (const def of DEFAULT_EXPENSE_CATEGORIES) {
      const catX = categoriesStore.get(`TENANT-X::${def.code}`);
      const catY = categoriesStore.get(`TENANT-Y::${def.code}`);

      expect(catX.companyId).toBe('TENANT-X');
      expect(catY.companyId).toBe('TENANT-Y');
      expect(catX.companyId).not.toBe(catY.companyId);
    }
  });
});
