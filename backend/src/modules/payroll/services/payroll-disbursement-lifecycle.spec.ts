import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { PayrollRepository } from '../repositories/payroll.repository';
import { PayrollEngineService } from './payroll-engine.service';
import { AuditLoggerService } from '../../../common/audit/audit-logger.service';
import { StatutoryRulesService } from './statutory-rules.service';
import { AttendanceMatrixService } from '../../attendance/services/attendance-matrix.service';
import { TaxCalculationService } from './tax-calculation.service';
import { ExpenseClaimRepository } from '../repositories/expense-claim.repository';
import { LopPolicyService } from './lop-policy.service';
import { calculatePayrollActivity } from '../../../../../owner/src/features/super-admin/utils/superAdminDataHelper';

describe('Payroll Disbursement Lifecycle & SuperAdmin KPI (Phase 7)', () => {
  let service: PayrollService;
  let prisma: any;
  let auditLogger: any;
  let payrollRepository: any;

  const mockTenantUser = {
    id: 'user-tenant-a',
    name: 'HR Admin A',
    companyId: 'company-tenant-a',
    role: 'HRAdmin',
  };

  const mockForeignUser = {
    id: 'user-tenant-b',
    name: 'HR Admin B',
    companyId: 'company-tenant-b',
    role: 'HRAdmin',
  };

  const mockSuperAdmin = {
    id: 'user-superadmin',
    name: 'Deepak Bhagat',
    companyId: null,
    role: 'SuperAdmin',
  };

  beforeEach(async () => {
    prisma = {
      payroll: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
      },
      systemConfig: {
        findUnique: jest.fn().mockResolvedValue({ value: 'OPEN' }),
      },
      $transaction: jest.fn().mockImplementation((cb: any) => cb(prisma)),
    };

    auditLogger = {
      logAction: jest.fn().mockResolvedValue(true),
    };

    payrollRepository = {
      findMany: jest.fn(),
      findByIdAndTenant: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayrollService,
        { provide: PrismaService, useValue: prisma },
        { provide: PayrollRepository, useValue: payrollRepository },
        { provide: PayrollEngineService, useValue: {} },
        { provide: AuditLoggerService, useValue: auditLogger },
        { provide: StatutoryRulesService, useValue: {} },
        { provide: AttendanceMatrixService, useValue: {} },
        { provide: TaxCalculationService, useValue: {} },
        { provide: ExpenseClaimRepository, useValue: {} },
        { provide: LopPolicyService, useValue: {} },
      ],
    }).compile();

    service = module.get<PayrollService>(PayrollService);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 1: Authorized tenant can mark eligible payroll as PAID
  // ─────────────────────────────────────────────────────────────────────────
  it('Test 1: Authorized tenant can mark eligible LOCKED/APPROVED payroll as PAID', async () => {
    prisma.payroll.findMany.mockResolvedValue([
      { id: 'slip-1', month: 'August 2026', status: 'LOCKED', employee: { companyId: 'company-tenant-a' } },
      { id: 'slip-2', month: 'August 2026', status: 'APPROVED', employee: { companyId: 'company-tenant-a' } },
    ]);
    prisma.payroll.updateMany.mockResolvedValue({ count: 2 });

    const result = await service.markMonthAsPaid(
      { month: 'August 2026', payDate: '2026-08-31', paymentReference: 'HDFC-UTR-123' },
      mockTenantUser,
    );

    expect(result.success).toBe(true);
    expect(result.updatedCount).toBe(2);
    expect(prisma.payroll.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['slip-1', 'slip-2'] } },
      data: { status: 'PAID', payDate: '2026-08-31' },
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 2: Tenant Isolation
  // ─────────────────────────────────────────────────────────────────────────
  it('Test 2: Tenant user cannot disburse or mutate another tenant payroll', async () => {
    // When Tenant B queries for August 2026, findMany scopes strictly to company-tenant-b
    prisma.payroll.findMany.mockResolvedValue([]);

    await expect(
      service.markMonthAsPaid(
        { month: 'August 2026', companyId: 'company-tenant-a' } as any,
        mockForeignUser,
      ),
    ).rejects.toThrow(NotFoundException);

    // Verify findMany was scoped to Tenant B's own companyId
    expect(prisma.payroll.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          employee: {
            OR: [
              { companyId: 'company-tenant-b' },
              { subscriptionId: 'company-tenant-b' },
            ],
          },
        }),
      }),
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 3: Invalid status transition (DRAFT records cannot jump directly to PAID)
  // ─────────────────────────────────────────────────────────────────────────
  it('Test 3: Cannot mark DRAFT payroll as PAID without approval/lock', async () => {
    prisma.payroll.findMany.mockResolvedValue([
      { id: 'slip-1', month: 'August 2026', status: 'DRAFT', employee: { companyId: 'company-tenant-a' } },
    ]);

    await expect(
      service.markMonthAsPaid({ month: 'August 2026' }, mockTenantUser),
    ).rejects.toThrow(BadRequestException);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 4: Idempotency (Already PAID records are safely handled)
  // ─────────────────────────────────────────────────────────────────────────
  it('Test 4: Already PAID payroll records return 0 updated count without double execution', async () => {
    prisma.payroll.findMany.mockResolvedValue([
      { id: 'slip-1', month: 'August 2026', status: 'PAID', employee: { companyId: 'company-tenant-a' } },
      { id: 'slip-2', month: 'August 2026', status: 'PAID', employee: { companyId: 'company-tenant-a' } },
    ]);

    const result = await service.markMonthAsPaid({ month: 'August 2026' }, mockTenantUser);
    expect(result.success).toBe(true);
    expect(result.updatedCount).toBe(0);
    expect(prisma.payroll.updateMany).not.toHaveBeenCalled();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 5: Atomic Transaction & Audit Trail
  // ─────────────────────────────────────────────────────────────────────────
  it('Test 5: Disbursement records immutable audit trail with actor and reference', async () => {
    prisma.payroll.findMany.mockResolvedValue([
      { id: 'slip-1', month: 'August 2026', status: 'LOCKED', employee: { companyId: 'company-tenant-a' } },
    ]);
    prisma.payroll.updateMany.mockResolvedValue({ count: 1 });

    await service.markMonthAsPaid(
      { month: 'August 2026', payDate: '2026-08-31', paymentReference: 'NEFT-889922' },
      mockTenantUser,
    );

    expect(auditLogger.logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-tenant-a',
        userName: 'HR Admin A',
        action: 'PAYROLL_APPROVED',
        details: expect.stringContaining('NEFT-889922'),
      }),
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 6: SuperAdmin KPI calculation accurately counts PAID vs Pending
  // ─────────────────────────────────────────────────────────────────────────
  it('Test 6: SuperAdmin calculatePayrollActivity accurately computes Completed vs Pending', () => {
    const mockSlips = [
      { id: '1', status: 'PAID' },
      { id: '2', status: 'PAID' },
      { id: '3', status: 'LOCKED' },
      { id: '4', status: 'APPROVED' },
      { id: '5', status: 'DRAFT' },
      { id: '6', status: 'FAILED' },
    ];

    const kpi = calculatePayrollActivity(mockSlips);
    expect(kpi.completed).toBe(2);
    expect(kpi.pending).toBe(3); // LOCKED, APPROVED, DRAFT
    expect(kpi.failed).toBe(1);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 7: Demo exclusion & PLATFORM regression guard
  // ─────────────────────────────────────────────────────────────────────────
  it('Test 7: PLATFORM is never used as company filter and SuperAdmin queries exclude demo tenants', async () => {
    prisma.payroll.findMany.mockResolvedValue([
      { id: 'slip-1', month: 'August 2026', status: 'LOCKED', employee: { companyId: 'real-tenant' } },
    ]);
    prisma.payroll.updateMany.mockResolvedValue({ count: 1 });

    await service.markMonthAsPaid({ month: 'August 2026' }, mockSuperAdmin);

    // Verify SuperAdmin query excludes demo accounts
    expect(prisma.payroll.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          employee: {
            company: {
              isDemo: false,
            },
          },
        }),
      }),
    );
  });
});
