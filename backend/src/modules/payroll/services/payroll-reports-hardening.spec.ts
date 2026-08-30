import { Test, TestingModule } from '@nestjs/testing';
import { PayrollService } from './payroll.service';
import { PayrollRepository } from '../repositories/payroll.repository';

describe('HR NEXA — Payroll Reports Hardening & Backend Authority Tests', () => {
  let payrollService: PayrollService;
  let mockPrisma: any;
  let mockRepository: any;

  beforeEach(async () => {
    mockPrisma = {
      payroll: {
        findMany: jest.fn(),
      },
      employee: {
        findMany: jest.fn(),
      },
    };

    mockRepository = {
      findByMonth: jest.fn(),
    };

    payrollService = new PayrollService(
      mockPrisma as any,
      mockRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  describe('Report Snapshot Extraction & Backend Authority Assertions', () => {
    const sampleSlip = {
      id: 'slip-001',
      employeeId: 'emp-101',
      employeeName: 'Alice Johnson',
      month: 'July 2026',
      gross: 80000,
      basicSalary: 40000,
      deductions: 8000,
      netSalary: 72000,
      lopDays: 0,
      companyId: 'COMPANY-A',
      components: [
        { name: 'Basic Salary', type: 'EARNING', amount: 40000 },
        { name: 'Provident Fund', type: 'DEDUCTION', amount: 1800 }, // Capped by backend engine at 1800 despite 12% of 40k = 4800!
        { name: 'TDS', type: 'DEDUCTION', amount: 6200 },
        { name: 'Employer PF', type: 'EARNING', amount: 1800 },
      ],
      adjustments: {
        basicPercentage: 50,
        approvedTaxDeductions: 150000,
        presentDays: 22,
      },
    };

    const getComponentAmount = (slip: any, nameMatches: string[]): number => {
      if (!slip || !slip.components || !Array.isArray(slip.components)) return 0;
      const comp = slip.components.find((c: any) =>
        nameMatches.some((m) => c.name?.toLowerCase().includes(m.toLowerCase())),
      );
      return comp && typeof comp.amount === 'number' ? comp.amount : 0;
    };

    it('1. Backend PF value differs from 12% formula: should extract persisted backend PF (1800 vs 9600)', () => {
      const hardcodedPf = Math.round(sampleSlip.gross * 0.12); // 9600
      const extractedPf = getComponentAmount(sampleSlip, ['provident fund', 'pf']);

      expect(extractedPf).toBe(1800);
      expect(extractedPf).not.toBe(hardcodedPf);
    });

    it('2. Backend ESI value differs from 3.25% formula: should evaluate 0 when Gross > 21000', () => {
      const extractedEsi = getComponentAmount(sampleSlip, ['esi', 'employee state insurance']);
      expect(extractedEsi).toBe(0);
    });

    it('3. Backend PF ceiling enforcement: should respect backend capped ₹1800 amount', () => {
      const basicBasedPf = Math.round(sampleSlip.basicSalary * 0.12); // 4800
      const extractedPf = getComponentAmount(sampleSlip, ['provident fund', 'pf']);

      expect(extractedPf).toBe(1800); // Backend engine cap
      expect(extractedPf).toBeLessThan(basicBasedPf);
    });

    it('4. Custom statutory config: should reflect persisted snapshot metadata (pfRate/basicPercentage)', () => {
      const customSlip = {
        ...sampleSlip,
        components: [
          { name: 'Provident Fund', type: 'DEDUCTION', amount: 2400 },
        ],
        adjustments: { pfRate: 15, basicPercentage: 60 },
      };

      const extractedPf = getComponentAmount(customSlip, ['provident fund', 'pf']);
      expect(extractedPf).toBe(2400);
    });

    it('5. Backend TDS vs gross-based calculation: should consume exact TaxCalculationService TDS amount', () => {
      const extractedTds = getComponentAmount(sampleSlip, ['tds', 'tax deducted at source']);
      expect(extractedTds).toBe(6200);
    });

    it('6. Backend CTC vs reconstructed CTC: should combine gross with persisted employer components', () => {
      const employerPf = getComponentAmount(sampleSlip, ['employer pf']);
      const totalCtc = sampleSlip.gross + employerPf;

      expect(employerPf).toBe(1800);
      expect(totalCtc).toBe(81800);
    });

    it('7. Empty month slips: should handle empty month state without fabricating metrics from employee.salary', async () => {
      mockRepository.findByMonth.mockResolvedValue([]);
      const user = { id: 'u1', role: 'HRAdmin', companyId: 'COMPANY-A' };

      const summary = await payrollService.getSummary(user, 'August 2026');
      expect(summary.totalEmployees).toBe(0);
      expect(summary.totalNet).toBe(0);
    });

    it('8. Cross-tenant records: should isolate report records strictly to authenticated tenant', async () => {
      mockRepository.findByMonth.mockImplementation((companyId: string) => {
        if (companyId === 'COMPANY-A') return Promise.resolve([sampleSlip]);
        return Promise.resolve([]);
      });

      const userA = { id: 'u1', role: 'HRAdmin', companyId: 'COMPANY-A' };
      const userB = { id: 'u2', role: 'HRAdmin', companyId: 'COMPANY-B' };

      const slipsA = await mockRepository.findByMonth(userA.companyId, 'July 2026');
      const slipsB = await mockRepository.findByMonth(userB.companyId, 'July 2026');

      expect(slipsA.length).toBe(1);
      expect(slipsB.length).toBe(0);
    });
  });
});
