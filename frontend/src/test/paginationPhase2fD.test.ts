import { describe, it, expect, vi, beforeEach } from 'vitest';
import axiosInstance from '../api/axios';
import { payrollService } from '../services/payroll.service';
import { recruitmentService } from '../services/recruitment.service';
import { reimbursementService } from '../services/reimbursement.service';
import { taxDeclarationService } from '../services/taxDeclaration.service';
import { assetService } from '../services/asset.service';
import { useRecruitmentStore } from '../store/recruitmentStore';
import { usePayrollStore } from '../store/payrollStore';

vi.mock('../api/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('Phase 2F-D: Pagination Contract Remediation Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Payroll Domain', () => {
    it('payrollService.getPayroll returns canonical PaginatedResponse when given an envelope', async () => {
      const mockEnvelope = {
        data: [
          {
            id: 'slip-1',
            month: '2026-03',
            employeeId: 'emp-1',
            netSalary: 50000,
            status: 'PROCESSED',
            employee: { id: 'emp-1', name: 'Alice', email: 'alice@test.com' },
          },
        ],
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
      };
      (axiosInstance.get as any).mockResolvedValueOnce({ data: mockEnvelope });

      const result = await payrollService.getPayroll('2026-03');
      expect(result).toBeDefined();
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('usePayrollStore.fetchPayroll correctly sets salarySlips array from paginated response', async () => {
      const mockEnvelope = {
        data: [
          {
            id: 'slip-2',
            month: '2026-03',
            employeeId: 'emp-2',
            netSalary: 75000,
            status: 'PAID',
            employee: { id: 'emp-2', name: 'Bob', email: 'bob@test.com' },
          },
        ],
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
      };
      (axiosInstance.get as any).mockResolvedValueOnce({ data: mockEnvelope });

      await usePayrollStore.getState().fetchPayroll('2026-03');
      const salarySlips = usePayrollStore.getState().salarySlips;
      expect(Array.isArray(salarySlips)).toBe(true);
      expect(salarySlips).toHaveLength(1);
    });
  });

  describe('2. Recruitment Domain', () => {
    it('recruitmentService.getJobPostings returns canonical PaginatedResponse', async () => {
      const mockEnvelope = {
        data: [
          {
            id: 'job-1',
            title: 'Senior Engineer',
            department: 'Engineering',
            status: 'Open',
            openings: 2,
          },
        ],
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
      };
      (axiosInstance.get as any).mockResolvedValueOnce({ data: mockEnvelope });

      const result = await recruitmentService.getJobPostings();
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('useRecruitmentStore.fetchRequisitions unwraps paginated envelope into requisitions array', async () => {
      const mockEnvelope = {
        data: [
          {
            id: 'job-2',
            title: 'Product Manager',
            department: 'Product',
            status: 'Open',
            openings: 1,
          },
        ],
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
      };
      (axiosInstance.get as any).mockResolvedValueOnce({ data: mockEnvelope });

      await useRecruitmentStore.getState().fetchRequisitions();
      const reqs = useRecruitmentStore.getState().requisitions;
      expect(Array.isArray(reqs)).toBe(true);
      expect(reqs).toHaveLength(1);
      expect(reqs[0].title).toBe('Product Manager');
    });

    it('useRecruitmentStore.fetchCandidates unwraps paginated envelope into candidates array', async () => {
      const mockEnvelope = {
        data: [
          {
            id: 'cand-1',
            name: 'Charlie Brown',
            jobTitle: 'Senior Engineer',
            stage: 'INTERVIEW',
            score: 85,
            email: 'charlie@test.com',
          },
        ],
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
      };
      (axiosInstance.get as any).mockResolvedValueOnce({ data: mockEnvelope });

      await useRecruitmentStore.getState().fetchCandidates();
      const candidates = useRecruitmentStore.getState().candidates;
      expect(Array.isArray(candidates)).toBe(true);
      expect(candidates).toHaveLength(1);
      expect(candidates[0].name).toBe('Charlie Brown');
    });
  });

  describe('3. Expenses Domain', () => {
    it('reimbursementService.getMyClaims and getTenantClaims return canonical PaginatedResponse', async () => {
      const mockEnvelope = {
        data: [
          {
            id: 'claim-1',
            title: 'Travel Expenses',
            status: 'SUBMITTED',
            items: [],
          },
        ],
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
      };
      (axiosInstance.get as any).mockResolvedValueOnce({ data: mockEnvelope });

      const myClaims = await reimbursementService.getMyClaims('fy-1');
      expect(myClaims.data).toHaveLength(1);
      expect(myClaims.total).toBe(1);

      (axiosInstance.get as any).mockResolvedValueOnce({ data: mockEnvelope });
      const tenantClaims = await reimbursementService.getTenantClaims();
      expect(tenantClaims.data).toHaveLength(1);
      expect(tenantClaims.totalPages).toBe(1);
    });
  });

  describe('4. Tax Declarations Domain', () => {
    it('taxDeclarationService.getTenantDeclarations returns canonical PaginatedResponse', async () => {
      const mockEnvelope = {
        data: [
          {
            id: 'decl-1',
            status: 'SUBMITTED',
            regime: 'NEW',
            employeeId: 'emp-1',
          },
        ],
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
      };
      (axiosInstance.get as any).mockResolvedValueOnce({ data: mockEnvelope });

      const result = await taxDeclarationService.getTenantDeclarations();
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('5. Assets & Devices Domain', () => {
    it('assetService.getAssets and getDevices return canonical PaginatedResponse', async () => {
      const mockAssetsEnvelope = {
        data: [
          {
            id: 'asset-1',
            name: 'MacBook Pro 16',
            status: 'ASSIGNED',
            category: 'Laptop',
          },
        ],
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
      };
      (axiosInstance.get as any).mockResolvedValueOnce({ data: mockAssetsEnvelope });

      const assets = await assetService.getAssets();
      expect(assets.data).toHaveLength(1);
      expect(assets.total).toBe(1);

      const mockDevicesEnvelope = {
        data: [
          {
            id: 'device-1',
            deviceName: 'Biometric Node 1',
            status: 'Online',
          },
        ],
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
      };
      (axiosInstance.get as any).mockResolvedValueOnce({ data: mockDevicesEnvelope });

      const devices = await assetService.getDevices();
      expect(devices.data).toHaveLength(1);
      expect(devices.total).toBe(1);
    });
  });
});
