import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ExpenseClaimService } from './expense-claim.service';
import { ExpenseClaimRepository } from '../repositories/expense-claim.repository';
import { ExpensePolicyService } from './expense-policy.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { TenantScope } from '../../../common/tenant/tenant-scope.interface';

describe('ExpenseClaimService — Fiscal Year Lock Lifecycle Specs (P1-3)', () => {
  let service: ExpenseClaimService;
  let prisma: any;
  let repository: any;
  let policyService: any;

  const COMPANY_ID = 'COMP-ALPHA';
  const FOREIGN_COMPANY_ID = 'COMP-BETA';
  const scope: TenantScope = { companyId: COMPANY_ID, isSuperAdmin: false };

  const mockEmployeeUser = {
    id: 'usr-emp-1',
    name: 'Alice Employee',
    email: 'alice@company.com',
    role: 'Employee',
    employee: { id: 'emp-1' },
  };

  const mockAuditorUser = {
    id: 'usr-auditor-1',
    name: 'Bob Auditor',
    email: 'bob@company.com',
    role: 'HRAdmin',
    employee: { id: 'emp-auditor-99' },
  };

  const mockAccountantUser = {
    id: 'usr-acc-1',
    name: 'Charlie Accountant',
    email: 'charlie@company.com',
    role: 'Accountant',
    employee: { id: 'emp-acc-50' },
  };

  const openFiscalYear = {
    id: 'fy-2026-27',
    name: 'FY 2026-27',
    companyId: COMPANY_ID,
    status: 'ACTIVE',
    isLocked: false,
    deletedAt: null,
  };

  const lockedFiscalYear = {
    id: 'fy-2025-26',
    name: 'FY 2025-26 (Locked)',
    companyId: COMPANY_ID,
    status: 'ACTIVE',
    isLocked: true,
    deletedAt: null,
  };

  const closedFiscalYear = {
    id: 'fy-2024-25',
    name: 'FY 2024-25 (Closed)',
    companyId: COMPANY_ID,
    status: 'CLOSED',
    isLocked: false,
    deletedAt: null,
  };

  beforeEach(async () => {
    prisma = {
      fiscalYear: {
        findFirst: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    repository = {
      createClaim: jest.fn(),
      findByIdAndTenant: jest.fn(),
      updateClaimDraft: jest.fn(),
      submitClaim: jest.fn(),
      reviewClaim: jest.fn(),
      payClaim: jest.fn(),
    };

    policyService = {
      validateAndEnforceCategoryPolicy: jest.fn().mockResolvedValue([
        { categoryId: 'cat-travel', amount: 1200, taxTreatment: 'NON_TAXABLE' },
      ]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpenseClaimService,
        { provide: PrismaService, useValue: prisma },
        { provide: ExpenseClaimRepository, useValue: repository },
        { provide: ExpensePolicyService, useValue: policyService },
      ],
    }).compile();

    service = module.get<ExpenseClaimService>(ExpenseClaimService);
  });

  // ==========================================
  // 1. CREATE MY CLAIM (Draft Creation Lock)
  // ==========================================
  describe('1. createMyClaim', () => {
    const createDto = {
      fiscalYearId: 'fy-2026-27',
      title: 'Client Visit Travel',
      items: [
        {
          categoryId: 'cat-travel',
          amount: 1200,
          expenseDate: '2026-06-15',
          receiptDocumentId: 'doc-rcpt-1',
        },
      ],
    };

    it('should successfully create claim when fiscal year is active and unlocked', async () => {
      prisma.fiscalYear.findFirst.mockResolvedValue(openFiscalYear);
      repository.createClaim.mockResolvedValue({
        id: 'claim-101',
        claimNumber: 'EXP-2026-000001',
        totalAmount: 1200,
        status: 'DRAFT',
      });

      const result = await service.createMyClaim(mockEmployeeUser, scope, createDto);

      expect(prisma.fiscalYear.findFirst).toHaveBeenCalledWith({
        where: { id: 'fy-2026-27', companyId: COMPANY_ID, deletedAt: null },
      });
      expect(result.id).toBe('claim-101');
      expect(repository.createClaim).toHaveBeenCalled();
    });

    it('should throw BadRequestException when target fiscal year has isLocked: true', async () => {
      prisma.fiscalYear.findFirst.mockResolvedValue(lockedFiscalYear);

      await expect(
        service.createMyClaim(mockEmployeeUser, scope, { ...createDto, fiscalYearId: 'fy-2025-26' }),
      ).rejects.toThrow(BadRequestException);

      expect(repository.createClaim).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when target fiscal year has status: CLOSED', async () => {
      prisma.fiscalYear.findFirst.mockResolvedValue(closedFiscalYear);

      await expect(
        service.createMyClaim(mockEmployeeUser, scope, { ...createDto, fiscalYearId: 'fy-2024-25' }),
      ).rejects.toThrow(BadRequestException);

      expect(repository.createClaim).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when fiscal year belongs to another tenant', async () => {
      // Returns null because companyId does not match
      prisma.fiscalYear.findFirst.mockResolvedValue(null);

      await expect(
        service.createMyClaim(mockEmployeeUser, scope, { ...createDto, fiscalYearId: 'fy-foreign' }),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.fiscalYear.findFirst).toHaveBeenCalledWith({
        where: { id: 'fy-foreign', companyId: COMPANY_ID, deletedAt: null },
      });
      expect(repository.createClaim).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // 2. UPDATE MY CLAIM DRAFT (Draft Modification Lock)
  // ==========================================
  describe('2. updateMyClaimDraft', () => {
    const updateDto = {
      title: 'Updated Travel Expenses',
      items: [
        {
          categoryId: 'cat-travel',
          amount: 1500,
          expenseDate: '2026-06-16',
          receiptDocumentId: 'doc-rcpt-1',
        },
      ],
    };

    it('should throw BadRequestException when existing claim belongs to a locked fiscal year', async () => {
      repository.findByIdAndTenant.mockResolvedValue({
        id: 'claim-draft-1',
        companyId: COMPANY_ID,
        employeeId: 'emp-1',
        fiscalYearId: 'fy-2025-26',
        status: 'DRAFT',
      });
      prisma.fiscalYear.findFirst.mockResolvedValue(lockedFiscalYear);

      await expect(
        service.updateMyClaimDraft(mockEmployeeUser, scope, 'claim-draft-1', updateDto),
      ).rejects.toThrow(BadRequestException);

      expect(repository.findByIdAndTenant).toHaveBeenCalledWith('claim-draft-1', COMPANY_ID);
      expect(prisma.fiscalYear.findFirst).toHaveBeenCalledWith({
        where: { id: 'fy-2025-26', companyId: COMPANY_ID, deletedAt: null },
      });
      expect(repository.updateClaimDraft).not.toHaveBeenCalled();
    });

    it('should verify fiscalYearId is DB-resolved and cannot be overridden by request payload', async () => {
      repository.findByIdAndTenant.mockResolvedValue({
        id: 'claim-draft-1',
        companyId: COMPANY_ID,
        employeeId: 'emp-1',
        fiscalYearId: 'fy-2026-27',
        status: 'DRAFT',
      });
      prisma.fiscalYear.findFirst.mockResolvedValue(openFiscalYear);
      repository.updateClaimDraft.mockResolvedValue({ id: 'claim-draft-1', title: 'Updated' });

      // Even if attacker passes fiscalYearId in untyped body, service only looks up existing.fiscalYearId
      await service.updateMyClaimDraft(mockEmployeeUser, scope, 'claim-draft-1', {
        ...updateDto,
        fiscalYearId: 'fy-spoofed',
      } as any);

      expect(prisma.fiscalYear.findFirst).toHaveBeenCalledWith({
        where: { id: 'fy-2026-27', companyId: COMPANY_ID, deletedAt: null },
      });
      expect(repository.updateClaimDraft).toHaveBeenCalledWith(
        'claim-draft-1',
        COMPANY_ID,
        expect.not.objectContaining({ fiscalYearId: expect.anything() }),
      );
    });
  });

  // ==========================================
  // 3. SUBMIT MY CLAIM (Draft Submission Lock)
  // ==========================================
  describe('3. submitMyClaim', () => {
    it('should throw BadRequestException when submitting claim in a locked fiscal year', async () => {
      repository.findByIdAndTenant.mockResolvedValue({
        id: 'claim-draft-2',
        companyId: COMPANY_ID,
        employeeId: 'emp-1',
        fiscalYearId: 'fy-2025-26',
        status: 'DRAFT',
      });
      prisma.fiscalYear.findFirst.mockResolvedValue(lockedFiscalYear);

      await expect(
        service.submitMyClaim(mockEmployeeUser, scope, 'claim-draft-2'),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.fiscalYear.findFirst).toHaveBeenCalledWith({
        where: { id: 'fy-2025-26', companyId: COMPANY_ID, deletedAt: null },
      });
      expect(repository.submitClaim).not.toHaveBeenCalled();
    });

    it('should successfully submit claim when fiscal year is active and unlocked', async () => {
      repository.findByIdAndTenant.mockResolvedValue({
        id: 'claim-draft-3',
        companyId: COMPANY_ID,
        employeeId: 'emp-1',
        fiscalYearId: 'fy-2026-27',
        status: 'DRAFT',
      });
      prisma.fiscalYear.findFirst.mockResolvedValue(openFiscalYear);
      repository.submitClaim.mockResolvedValue({ id: 'claim-draft-3', status: 'SUBMITTED' });

      const result = await service.submitMyClaim(mockEmployeeUser, scope, 'claim-draft-3');

      expect(result.status).toBe('SUBMITTED');
      expect(repository.submitClaim).toHaveBeenCalledWith('claim-draft-3', COMPANY_ID);
    });
  });

  // ==========================================
  // 4. REVIEW CLAIM (Audit & Approval Lock)
  // ==========================================
  describe('4. reviewClaim', () => {
    it('should throw BadRequestException when approving a claim in a locked fiscal year', async () => {
      repository.findByIdAndTenant.mockResolvedValue({
        id: 'claim-sub-1',
        companyId: COMPANY_ID,
        employeeId: 'emp-other-user',
        fiscalYearId: 'fy-2025-26',
        status: 'SUBMITTED',
      });
      prisma.fiscalYear.findFirst.mockResolvedValue(lockedFiscalYear);

      await expect(
        service.reviewClaim('claim-sub-1', scope, mockAuditorUser, {
          decision: 'APPROVED',
          remarks: 'Valid receipts',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(repository.reviewClaim).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when rejecting a claim in a locked fiscal year', async () => {
      repository.findByIdAndTenant.mockResolvedValue({
        id: 'claim-sub-2',
        companyId: COMPANY_ID,
        employeeId: 'emp-other-user',
        fiscalYearId: 'fy-2024-25',
        status: 'SUBMITTED',
      });
      prisma.fiscalYear.findFirst.mockResolvedValue(closedFiscalYear);

      await expect(
        service.reviewClaim('claim-sub-2', scope, mockAuditorUser, {
          decision: 'REJECTED',
          remarks: 'Fiscal period expired',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(repository.reviewClaim).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // 5. PAY CLAIM (Disbursement & Payout Lock)
  // ==========================================
  describe('5. payClaim', () => {
    it('should throw BadRequestException when attempting disbursement on a locked fiscal year claim', async () => {
      repository.findByIdAndTenant.mockResolvedValue({
        id: 'claim-approved-1',
        companyId: COMPANY_ID,
        employeeId: 'emp-1',
        fiscalYearId: 'fy-2025-26',
        status: 'APPROVED',
        paymentStatus: 'UNPAID',
      });
      prisma.fiscalYear.findFirst.mockResolvedValue(lockedFiscalYear);

      await expect(
        service.payClaim('claim-approved-1', scope, mockAccountantUser, {
          paymentMethod: 'BANK_TRANSFER' as any,
          paymentReference: 'NEFT-998877',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(repository.payClaim).not.toHaveBeenCalled();
    });

    it('should successfully disburse payment when fiscal year is active and unlocked', async () => {
      repository.findByIdAndTenant.mockResolvedValue({
        id: 'claim-approved-2',
        companyId: COMPANY_ID,
        employeeId: 'emp-1',
        fiscalYearId: 'fy-2026-27',
        status: 'PAYABLE',
        paymentStatus: 'UNPAID',
      });
      prisma.fiscalYear.findFirst.mockResolvedValue(openFiscalYear);
      repository.payClaim.mockResolvedValue({
        id: 'claim-approved-2',
        status: 'PAID',
        paymentStatus: 'PAID',
      });

      const result = await service.payClaim('claim-approved-2', scope, mockAccountantUser, {
        paymentMethod: 'BANK_TRANSFER' as any,
        paymentReference: 'NEFT-112233',
      });

      expect(result.status).toBe('PAID');
      expect(repository.payClaim).toHaveBeenCalledWith(
        'claim-approved-2',
        COMPANY_ID,
        'BANK_TRANSFER',
        'NEFT-112233',
        undefined,
      );
    });
  });

  // ==========================================
  // 6. TENANT ISOLATION (Cross-Tenant Lock Integrity)
  // ==========================================
  describe('6. Tenant Isolation in Fiscal Year Locks', () => {
    it('should prevent Tenant A from referencing Tenant B fiscal year during creation', async () => {
      // Prisma query includes { companyId: 'COMP-ALPHA' }, so Tenant B's FY is not found
      prisma.fiscalYear.findFirst.mockResolvedValue(null);

      await expect(
        service.createMyClaim(mockEmployeeUser, scope, {
          fiscalYearId: 'fy-tenant-b',
          title: 'Attempted Cross-Tenant Claim',
          items: [
            {
              categoryId: 'cat-travel',
              amount: 500,
              expenseDate: '2026-06-15',
              receiptDocumentId: 'doc-rcpt-1',
            },
          ],
        }),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.fiscalYear.findFirst).toHaveBeenCalledWith({
        where: { id: 'fy-tenant-b', companyId: COMPANY_ID, deletedAt: null },
      });
    });

    it('should prevent Tenant A from accessing or bypassing lock on Tenant B claim', async () => {
      // Repository findByIdAndTenant returns null for cross-tenant claim query
      repository.findByIdAndTenant.mockResolvedValue(null);

      await expect(
        service.submitMyClaim(mockEmployeeUser, scope, 'claim-of-tenant-b'),
      ).rejects.toThrow(NotFoundException);

      expect(repository.findByIdAndTenant).toHaveBeenCalledWith('claim-of-tenant-b', COMPANY_ID);
      expect(prisma.fiscalYear.findFirst).not.toHaveBeenCalled();
    });
  });
});
