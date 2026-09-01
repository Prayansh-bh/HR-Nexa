import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ExpensePolicyService } from './expense-policy.service';
import { ExpenseClaimRepository } from '../repositories/expense-claim.repository';

describe('ExpensePolicyService (P0/P3 Receipt & Category Policy Verification)', () => {
  let service: ExpensePolicyService;
  let repository: jest.Mocked<ExpenseClaimRepository>;

  const companyId = 'COMPANY-ALPHA';
  const employeeId = 'emp-101';

  const mockCategoryWithReceipt = {
    id: 'cat-travel-1',
    companyId,
    name: 'Travel & Conveyance',
    code: 'TRAVEL',
    maxLimit: 5000,
    requireReceipt: true,
    isTaxable: false,
    isActive: true,
  };

  const mockCategoryNoReceipt = {
    id: 'cat-meals-2',
    companyId,
    name: 'Client Meals',
    code: 'MEALS',
    maxLimit: 1500,
    requireReceipt: false,
    isTaxable: true,
    isActive: true,
  };

  const mockInactiveCategory = {
    id: 'cat-inactive-3',
    companyId,
    name: 'Deprecated Head',
    code: 'OLD_HEAD',
    maxLimit: 1000,
    requireReceipt: true,
    isTaxable: false,
    isActive: false,
  };

  beforeEach(async () => {
    const mockRepo = {
      findCategoryByIdAndTenant: jest.fn(),
      findDocumentByIdAndTenant: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpensePolicyService,
        {
          provide: ExpenseClaimRepository,
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<ExpensePolicyService>(ExpensePolicyService);
    repository = module.get(ExpenseClaimRepository);
  });

  describe('Receipt Attachment & Invariant Policies (P3)', () => {
    it('1. should accept claim item when category requires receipt and valid own-employee EXPENSE_RECEIPT is present', async () => {
      repository.findCategoryByIdAndTenant.mockResolvedValue(mockCategoryWithReceipt as any);
      repository.findDocumentByIdAndTenant.mockResolvedValue({
        id: 'doc-receipt-123',
        companyId,
        employeeId,
        category: 'EXPENSE_RECEIPT',
        fileName: 'cab_bill.pdf',
      } as any);

      const items = [
        {
          categoryId: 'cat-travel-1',
          amount: 1200,
          receiptDocumentId: 'doc-receipt-123',
        },
      ];

      const result = await service.validateAndEnforceCategoryPolicy(companyId, items, employeeId);

      expect(result).toHaveLength(1);
      expect(result[0].categoryId).toBe('cat-travel-1');
      expect(result[0].amount).toBe(1200);
      expect(result[0].receiptDocumentId).toBe('doc-receipt-123');
      expect(result[0].taxTreatment).toBe('NON_TAXABLE');
      expect(repository.findDocumentByIdAndTenant).toHaveBeenCalledWith('doc-receipt-123', companyId);
    });

    it('2. should reject claim item when category requires receipt but receiptDocumentId is missing', async () => {
      repository.findCategoryByIdAndTenant.mockResolvedValue(mockCategoryWithReceipt as any);

      const items = [
        {
          categoryId: 'cat-travel-1',
          amount: 1200,
          receiptDocumentId: undefined,
        },
      ];

      await expect(
        service.validateAndEnforceCategoryPolicy(companyId, items, employeeId),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.validateAndEnforceCategoryPolicy(companyId, items, employeeId),
      ).rejects.toThrow(/requires a valid proof receipt document/);
    });

    it('3. should accept claim item when category does not require receipt and receiptDocumentId is missing', async () => {
      repository.findCategoryByIdAndTenant.mockResolvedValue(mockCategoryNoReceipt as any);

      const items = [
        {
          categoryId: 'cat-meals-2',
          amount: 800,
          receiptDocumentId: undefined,
        },
      ];

      const result = await service.validateAndEnforceCategoryPolicy(companyId, items, employeeId);

      expect(result).toHaveLength(1);
      expect(result[0].categoryId).toBe('cat-meals-2');
      expect(result[0].taxTreatment).toBe('TAXABLE');
      expect(repository.findDocumentByIdAndTenant).not.toHaveBeenCalled();
    });

    it('4. should reject claim item when receiptDocumentId belongs to another tenant or is not found', async () => {
      repository.findCategoryByIdAndTenant.mockResolvedValue(mockCategoryWithReceipt as any);
      repository.findDocumentByIdAndTenant.mockResolvedValue(null);

      const items = [
        {
          categoryId: 'cat-travel-1',
          amount: 1200,
          receiptDocumentId: 'foreign-tenant-doc-999',
        },
      ];

      await expect(
        service.validateAndEnforceCategoryPolicy(companyId, items, employeeId),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.validateAndEnforceCategoryPolicy(companyId, items, employeeId),
      ).rejects.toThrow(/not found or belongs to another tenant/);
    });

    it('5. should reject claim item when attached document category is not EXPENSE_RECEIPT (e.g. HR_LETTER)', async () => {
      repository.findCategoryByIdAndTenant.mockResolvedValue(mockCategoryWithReceipt as any);
      repository.findDocumentByIdAndTenant.mockResolvedValue({
        id: 'doc-hr-offer',
        companyId,
        employeeId,
        category: 'HR_LETTER',
        fileName: 'offer_letter.pdf',
      } as any);

      const items = [
        {
          categoryId: 'cat-travel-1',
          amount: 1200,
          receiptDocumentId: 'doc-hr-offer',
        },
      ];

      await expect(
        service.validateAndEnforceCategoryPolicy(companyId, items, employeeId),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.validateAndEnforceCategoryPolicy(companyId, items, employeeId),
      ).rejects.toThrow(/is not categorized as an EXPENSE_RECEIPT/);
    });

    it('6. should reject claim item when attached document belongs to another employee', async () => {
      repository.findCategoryByIdAndTenant.mockResolvedValue(mockCategoryWithReceipt as any);
      repository.findDocumentByIdAndTenant.mockResolvedValue({
        id: 'doc-receipt-other',
        companyId,
        employeeId: 'emp-other-999',
        category: 'EXPENSE_RECEIPT',
        fileName: 'other_bill.pdf',
      } as any);

      const items = [
        {
          categoryId: 'cat-travel-1',
          amount: 1200,
          receiptDocumentId: 'doc-receipt-other',
        },
      ];

      await expect(
        service.validateAndEnforceCategoryPolicy(companyId, items, employeeId),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.validateAndEnforceCategoryPolicy(companyId, items, employeeId),
      ).rejects.toThrow(/does not belong to the claiming employee/);
    });

    it('7. should reject claim item when attached EXPENSE_RECEIPT has null employeeId', async () => {
      repository.findCategoryByIdAndTenant.mockResolvedValue(mockCategoryWithReceipt as any);
      repository.findDocumentByIdAndTenant.mockResolvedValue({
        id: 'doc-receipt-unlinked',
        companyId,
        employeeId: null,
        category: 'EXPENSE_RECEIPT',
        fileName: 'unlinked_receipt.pdf',
      } as any);

      const items = [
        {
          categoryId: 'cat-travel-1',
          amount: 1200,
          receiptDocumentId: 'doc-receipt-unlinked',
        },
      ];

      await expect(
        service.validateAndEnforceCategoryPolicy(companyId, items, employeeId),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.validateAndEnforceCategoryPolicy(companyId, items, employeeId),
      ).rejects.toThrow(/does not belong to the claiming employee/);
    });
  });

  describe('Category Policy Enforcement & Limits', () => {
    it('8. should reject claim item when amount exceeds category maxLimit', async () => {
      repository.findCategoryByIdAndTenant.mockResolvedValue(mockCategoryWithReceipt as any);
      repository.findDocumentByIdAndTenant.mockResolvedValue({
        id: 'doc-1',
        companyId,
        employeeId,
        category: 'EXPENSE_RECEIPT',
      } as any);

      const items = [
        {
          categoryId: 'cat-travel-1',
          amount: 6500, // maxLimit is 5000
          receiptDocumentId: 'doc-1',
        },
      ];

      await expect(
        service.validateAndEnforceCategoryPolicy(companyId, items, employeeId),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.validateAndEnforceCategoryPolicy(companyId, items, employeeId),
      ).rejects.toThrow(/exceeds category 'Travel & Conveyance' policy limit of ₹5000/);
    });

    it('9. should reject claim item when category is inactive', async () => {
      repository.findCategoryByIdAndTenant.mockResolvedValue(mockInactiveCategory as any);

      const items = [
        {
          categoryId: 'cat-inactive-3',
          amount: 500,
          receiptDocumentId: 'doc-1',
        },
      ];

      await expect(
        service.validateAndEnforceCategoryPolicy(companyId, items, employeeId),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.validateAndEnforceCategoryPolicy(companyId, items, employeeId),
      ).rejects.toThrow(/is inactive/);
    });

    it('10. should reject claim item when category is not found in tenant', async () => {
      repository.findCategoryByIdAndTenant.mockResolvedValue(null);

      const items = [
        {
          categoryId: 'non-existent-id',
          amount: 500,
        },
      ];

      await expect(
        service.validateAndEnforceCategoryPolicy(companyId, items, employeeId),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.validateAndEnforceCategoryPolicy(companyId, items, employeeId),
      ).rejects.toThrow(/not found or inactive/);
    });
  });
});
