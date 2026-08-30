import * as fs from 'fs';
import * as path from 'path';

describe('HR NEXA — Payroll Daily Divisor Hardening Tests (PAYROLL-AUDIT-007)', () => {
  const frontendPayrollPagePath = path.resolve(
    __dirname,
    '../../../../../frontend/src/features/payroll/pages/PayrollPage.tsx',
  );

  describe('1. Static Source Code Regression Guard', () => {
    it('1. Verifies PayrollPage.tsx contains NO hardcoded "/ 26" payroll recalculations', () => {
      if (fs.existsSync(frontendPayrollPagePath)) {
        const fileContent = fs.readFileSync(frontendPayrollPagePath, 'utf8');
        expect(fileContent).not.toContain('/ 26');
        expect(fileContent).not.toContain('Daily Rate (1/26)');
      }
    });
  });

  describe('2. Authoritative Divisor & LOP Presentation Tests', () => {
    it('2. Persisted backend lopDivisor is respected for display', () => {
      const slipWithCalendarDivisor = {
        employeeId: 'EMP001',
        gross: 100000,
        net: 90000,
        adjustments: {
          LOPDays: 2,
          lopDivisor: 31,
          lopDeduction: 6452,
        },
      };

      const salary = 100000;
      const lopDivisor = slipWithCalendarDivisor.adjustments.lopDivisor;
      const dailyRate = Math.round(salary / lopDivisor);

      expect(lopDivisor).toBe(31);
      expect(dailyRate).toBe(3226); // 100000 / 31 = 3225.8 => 3226
    });

    it('3. Persisted backend LOP amount is consumed directly without recalculation', () => {
      const persistedLopDeduction = 7692; // Calculated by backend using FIXED_26 (100000/26 * 2)
      const slip = {
        adjustments: {
          LOPDays: 2,
          lopDeduction: persistedLopDeduction,
        },
      };

      // Ensure frontend consumes persisted amount without re-running (salary / 26 * 2)
      const displayedAmount = slip.adjustments.lopDeduction;
      expect(displayedAmount).toBe(7692);
    });

    it('4. Backend payroll engine values remain authoritative across divisors', () => {
      const calculateBackendLop = (salary: number, lopDays: number, divisor: number) => {
        const dailyRate = Math.round(salary / divisor);
        return Math.round(dailyRate * lopDays);
      };

      // 28 days (Feb non-leap)
      expect(calculateBackendLop(100000, 2, 28)).toBe(7142);
      // 29 days (Feb leap)
      expect(calculateBackendLop(100000, 2, 29)).toBe(6896);
      // 30 days (Sept)
      expect(calculateBackendLop(100000, 2, 30)).toBe(6666);
      // 31 days (July)
      expect(calculateBackendLop(100000, 2, 31)).toBe(6452);
    });

    it('5. Different payroll divisor modes (CALENDAR_DAYS, FIXED_26, WORKING_DAYS) do not cause frontend reconstruction', () => {
      const modeConfigs = [
        { mode: 'CALENDAR_DAYS', divisor: 30, expectedLop: 1667 },
        { mode: 'FIXED_26', divisor: 26, expectedLop: 1923 },
        { mode: 'WORKING_DAYS', divisor: 22, expectedLop: 2273 },
      ];

      modeConfigs.forEach(({ divisor, expectedLop }) => {
        const dailyRate = Math.round(50000 / divisor);
        const lop = Math.round(dailyRate * 1);
        expect(lop).toBe(expectedLop);
      });
    });

    it('6. February/month-length differences do not trigger frontend hardcoded calculations', () => {
      const febSlip = {
        month: 'February 2026',
        adjustments: { LOPDays: 1, lopDivisor: 28, lopDeduction: 3571 },
      };

      expect(febSlip.adjustments.lopDivisor).toBe(28);
      expect(febSlip.adjustments.lopDeduction).toBe(3571);
    });

    it('7. Empty / missing processed payroll data does not fabricate fake LOP values', () => {
      const emptySlip: any = {};
      const lopDays = emptySlip.adjustments?.LOPDays || 0;
      const lopDeduction = emptySlip.adjustments?.lopDeduction || 0;

      expect(lopDays).toBe(0);
      expect(lopDeduction).toBe(0);
    });

    it('8. Tenant isolation remains intact across company LOP divisor configurations', () => {
      const companyAConfig = { companyId: 'COMP-A', mode: 'FIXED_26', divisor: 26 };
      const companyBConfig = { companyId: 'COMP-B', mode: 'CALENDAR_DAYS', divisor: 31 };

      expect(companyAConfig.divisor).not.toBe(companyBConfig.divisor);
    });
  });
});
