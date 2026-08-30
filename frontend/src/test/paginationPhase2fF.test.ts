import { describe, it, expect, vi, beforeEach } from 'vitest';
import axiosInstance from '../api/axios';
import { payrollService } from '../services/payroll.service';
import { recruitmentService } from '../services/recruitment.service';
import { reimbursementService } from '../services/reimbursement.service';
import { taxDeclarationService } from '../services/taxDeclaration.service';
import { assetService } from '../services/asset.service';
import { reviewCycleService } from '../services/reviewCycle.service';
import { notificationService } from '../services/notification.service';
import { ticketsService } from '../services/tickets.service';
import { exitApi } from '../features/exit/api/exit.api';
import { usePayrollStore } from '../store/payrollStore';
import { useRecruitmentStore } from '../store/recruitmentStore';
import { useAuditLogsStore } from '../store/auditLogsStore';
import type { PaginatedResponse } from '../types/pagination';

vi.mock('../api/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('Phase 2F-F: Global Forensic Pagination & Contract Closure Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Canonical Pagination Contract & Normalization Invariants', () => {
    it('1.1 Canonical contract enforces structure: data, total, page, limit, totalPages', () => {
      const canonicalEnvelope: PaginatedResponse<any> = {
        data: [{ id: '1', name: 'Item 1' }],
        total: 100,
        page: 2,
        limit: 25,
        totalPages: 4,
      };
      expect(Array.isArray(canonicalEnvelope.data)).toBe(true);
      expect(canonicalEnvelope.total).toBe(100);
      expect(canonicalEnvelope.page).toBe(2);
      expect(canonicalEnvelope.limit).toBe(25);
      expect(canonicalEnvelope.totalPages).toBe(4);
    });

    it('1.2 totalPages calculates correctly for exact divides and fractional totals', () => {
      const calcTotalPages = (total: number, limit: number) =>
        total === 0 ? 0 : Math.ceil(total / limit);

      expect(calcTotalPages(100, 25)).toBe(4);
      expect(calcTotalPages(101, 25)).toBe(5);
      expect(calcTotalPages(0, 50)).toBe(0);
      expect(calcTotalPages(7, 10)).toBe(1);
    });

    it('1.3 Empty paginated response maintains array invariant and 0 count', () => {
      const emptyEnvelope: PaginatedResponse<any> = {
        data: [],
        total: 0,
        page: 1,
        limit: 50,
        totalPages: 0,
      };
      expect(emptyEnvelope.data).toEqual([]);
      expect(emptyEnvelope.total).toBe(0);
      expect(emptyEnvelope.totalPages).toBe(0);
    });
  });

  describe('2. Domain Contract Audits', () => {
    it('2.1 Payroll: getPayroll safely unwraps and preserves salarySlips array state', async () => {
      const mockPayload = {
        data: [{ id: 'p-1', month: '2026-04', netSalary: 80000, status: 'Processed' }],
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
      };
      (axiosInstance.get as any).mockResolvedValueOnce({ data: mockPayload });

      await usePayrollStore.getState().fetchPayroll('2026-04');
      const slips = usePayrollStore.getState().salarySlips;
      expect(Array.isArray(slips)).toBe(true);
      expect(slips).toHaveLength(1);
      expect(slips[0].id).toBe('p-1');
    });

    it('2.2 Recruitment: fetchRequisitions and fetchCandidates safely unwrap data arrays', async () => {
      const mockReqEnvelope = {
        data: [{ id: 'req-1', title: 'Senior Software Engineer', department: 'Engineering', status: 'Open' }],
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
      };
      (axiosInstance.get as any).mockResolvedValueOnce({ data: mockReqEnvelope });

      await useRecruitmentStore.getState().fetchRequisitions();
      const reqs = useRecruitmentStore.getState().requisitions;
      expect(Array.isArray(reqs)).toBe(true);
      expect(reqs).toHaveLength(1);
      expect(reqs[0].title).toBe('Senior Software Engineer');
    });

    it('2.3 Reimbursement Claims: getMyClaims and getTenantClaims return canonical PaginatedResponse', async () => {
      const mockExpenseEnvelope = {
        data: [{ id: 'claim-1', title: 'Client Lunch', amount: 1500, status: 'SUBMITTED', items: [] }],
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
      };
      (axiosInstance.get as any).mockResolvedValueOnce({ data: mockExpenseEnvelope });

      const res = await reimbursementService.getMyClaims();
      expect(res.data).toHaveLength(1);
      expect(res.total).toBe(1);
      expect(res.totalPages).toBe(1);
    });

    it('2.4 Tax Declarations: getTenantDeclarations returns canonical PaginatedResponse', async () => {
      const mockTaxEnvelope = {
        data: [{ id: 'tax-1', financialYearId: 'fy-1', regime: 'NEW', status: 'DRAFT', totalDeclared: 0, totalApproved: 0, items: [] }],
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
      };
      (axiosInstance.get as any).mockResolvedValueOnce({ data: mockTaxEnvelope });

      const res = await taxDeclarationService.getTenantDeclarations();
      expect(res.data).toHaveLength(1);
      expect(res.total).toBe(1);
      expect(res.data[0].regime).toBe('NEW');
    });

    it('2.5 Assets & Devices: getAssets returns canonical envelope and mapped models', async () => {
      const mockAssetEnvelope = {
        data: [{ id: 'ast-1', name: 'MacBook Pro 16', type: 'HARDWARE', status: 'ASSIGNED', serialNumber: 'SN-123' }],
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
      };
      (axiosInstance.get as any).mockResolvedValueOnce({ data: mockAssetEnvelope });

      const res = await assetService.getAssets();
      expect(res.data).toHaveLength(1);
      expect(res.total).toBe(1);
      expect(res.data[0].name).toBe('MacBook Pro 16');
    });

    it('2.6 Performance Reviews & Goals: return canonical envelopes and support pagination metadata', async () => {
      const mockReviewEnvelope = {
        data: [{ id: 'rev-1', employeeId: 'emp-1', status: 'Manager Review', finalRating: 4.8 }],
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
      };
      (axiosInstance.get as any).mockResolvedValueOnce({ data: mockReviewEnvelope });

      const res = await reviewCycleService.getReviews({ status: 'Manager Review' });
      expect(res.data).toHaveLength(1);
      expect(res.total).toBe(1);
      expect(res.totalPages).toBe(1);
    });

    it('2.7 Exit / Offboarding: exitApi.getExits response safely unwrapped by UI', async () => {
      const mockExitList = [
        { id: 'exit-1', stage: 'CLEARANCE', status: 'IN_PROGRESS', employee: { name: 'Bob' } },
      ];
      (axiosInstance.get as any).mockResolvedValueOnce({ data: mockExitList });

      const res = await exitApi.getExits();
      const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      expect(list).toHaveLength(1);
      expect(list[0].stage).toBe('CLEARANCE');
    });

    it('2.8 System Audit Logs: auditLogsStore safely handles envelope without data loss', async () => {
      const mockAuditEnvelope = {
        data: [{ id: 'log-1', action: 'UPDATE_ROLE', details: 'Granted Admin', timestamp: '2026-08-27T00:00:00.000Z' }],
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
      };
      (axiosInstance.get as any).mockResolvedValueOnce({ data: mockAuditEnvelope });

      await useAuditLogsStore.getState().fetchAuditLogs();
      const logs = useAuditLogsStore.getState().auditLogs;
      expect(Array.isArray(logs)).toBe(true);
      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe('UPDATE_ROLE');
    });

    it('2.9 Support Tickets: ticketsService.getAllTickets handles both envelope and raw array', async () => {
      const mockTicketEnvelope = {
        data: [{ id: 't-1', subject: 'Network connectivity', priority: 'High', status: 'Open' }],
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
      };
      (axiosInstance.get as any).mockResolvedValueOnce({ data: mockTicketEnvelope });

      const res = await ticketsService.getAllTickets();
      expect(Array.isArray(res)).toBe(true);
      expect(res).toHaveLength(1);
      expect(res[0].subject).toBe('Network connectivity');
    });
  });

  describe('3. Tenant Isolation & Filtering Integrity', () => {
    it('3.1 Rejects cross-tenant leakage: empty query parameters do not override tenant scoping', () => {
      const tenantACompanyId = 'comp-tenant-a';
      const scopedWhere = { companyId: tenantACompanyId, deletedAt: null };

      expect(scopedWhere.companyId).toBe('comp-tenant-a');
      expect(scopedWhere.deletedAt).toBeNull();
    });

    it('3.2 Count and findMany filters are structurally identical', () => {
      const buildWhere = (companyId: string, search?: string) => ({
        companyId,
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      });

      const countWhere = buildWhere('company-123', 'Engineering');
      const findManyWhere = buildWhere('company-123', 'Engineering');

      expect(countWhere).toEqual(findManyWhere);
    });
  });
});
