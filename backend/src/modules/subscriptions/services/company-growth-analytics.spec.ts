import {
  calculateCompanyGrowthMonthlyTrend,
  calculateMoMCompanyGrowth,
} from '../../../../../owner/src/features/super-admin/utils/superAdminDataHelper';
import type { SaaSCompany } from '../../../../../owner/src/features/super-admin/types/superAdmin.types';

function createMockCompany(overrides: Partial<SaaSCompany> = {}): SaaSCompany {
  return {
    id: overrides.id || 'comp-1',
    companyId: overrides.companyId || 'comp-1',
    name: overrides.name || 'Test Company',
    plan: overrides.plan || 'Basic',
    employeesCount: overrides.employeesCount ?? 1,
    status: overrides.status || 'Active',
    joinedDate: overrides.joinedDate !== undefined ? overrides.joinedDate : '2026-08-22',
    expiryDate: overrides.expiryDate || '2027-08-22',
    ownerName: overrides.ownerName || 'Owner',
    ownerEmail: overrides.ownerEmail || 'owner@test.co',
    purchasedSeats: overrides.purchasedSeats ?? 10,
    usedSeats: overrides.usedSeats ?? 1,
    ...overrides,
  };
}

describe('Company Growth Analytics — Unit & Regression Test Suite', () => {
  const fixedDate = new Date(2026, 7, 26); // August 26, 2026

  describe('calculateCompanyGrowthMonthlyTrend', () => {
    it('1. Returns all 6 months with 0 when companies list is empty', () => {
      const result = calculateCompanyGrowthMonthlyTrend([], fixedDate);
      expect(result).toHaveLength(6);
      expect(result.map((r) => r.month)).toEqual(['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug (Now)']);
      expect(result.every((r) => r.count === 0)).toBe(true);
    });

    it('2. Counts company strictly in the current month (August 2026)', () => {
      const companies: SaaSCompany[] = [
        createMockCompany({
          id: '1',
          name: 'Dezoryn',
          plan: 'Basic',
          employeesCount: 1,
          status: 'Active',
          joinedDate: '2026-08-22',
        }),
      ];
      const result = calculateCompanyGrowthMonthlyTrend(companies, fixedDate);
      expect(result.find((r) => r.month === 'Aug (Now)')?.count).toBe(1);
      expect(result.filter((r) => r.month !== 'Aug (Now)').every((r) => r.count === 0)).toBe(true);
    });

    it('3. Counts company strictly in previous month (July 2026) without leaking into August', () => {
      const companies: SaaSCompany[] = [
        createMockCompany({
          id: '1',
          name: 'July Co',
          plan: 'Standard',
          employeesCount: 5,
          status: 'Active',
          joinedDate: '2026-07-15',
        }),
      ];
      const result = calculateCompanyGrowthMonthlyTrend(companies, fixedDate);
      expect(result.find((r) => r.month === 'Jul')?.count).toBe(1);
      expect(result.find((r) => r.month === 'Aug (Now)')?.count).toBe(0);
      expect(result.find((r) => r.month === 'Jun')?.count).toBe(0);
    });

    it('4. Handles multiple companies in multiple months correctly', () => {
      const companies: SaaSCompany[] = [
        createMockCompany({ id: '1', name: 'Mar Co', plan: 'Basic', employeesCount: 1, status: 'Active', joinedDate: '2026-03-10' }),
        createMockCompany({ id: '2', name: 'May Co 1', plan: 'Standard', employeesCount: 2, status: 'Active', joinedDate: '2026-05-01' }),
        createMockCompany({ id: '3', name: 'May Co 2', plan: 'Premium', employeesCount: 3, status: 'Active', joinedDate: '2026-05-28' }),
        createMockCompany({ id: '4', name: 'Aug Co 1', plan: 'Basic', employeesCount: 1, status: 'Active', joinedDate: '2026-08-22' }),
        createMockCompany({ id: '5', name: 'Aug Co 2', plan: 'Premium', employeesCount: 10, status: 'Active', joinedDate: '2026-08-24' }),
      ];
      const result = calculateCompanyGrowthMonthlyTrend(companies, fixedDate);
      const map = Object.fromEntries(result.map((r) => [r.month, r.count]));
      expect(map['Mar']).toBe(1);
      expect(map['Apr']).toBe(0);
      expect(map['May']).toBe(2);
      expect(map['Jun']).toBe(0);
      expect(map['Jul']).toBe(0);
      expect(map['Aug (Now)']).toBe(2);
    });

    it('5. Does NOT leak old historical companies (e.g. 2024) into 2026 monthly trend', () => {
      const companies: SaaSCompany[] = [
        createMockCompany({
          id: 'C1',
          name: 'Acme Corp',
          plan: 'Premium',
          employeesCount: 5,
          status: 'Active',
          joinedDate: '2024-01-15',
        }),
      ];
      const result = calculateCompanyGrowthMonthlyTrend(companies, fixedDate);
      expect(result.every((r) => r.count === 0)).toBe(true);
    });

    it('6. Correctly navigates year transitions (e.g., target in February across year boundary)', () => {
      const febDate = new Date(2026, 1, 15); // Feb 15, 2026
      const companies: SaaSCompany[] = [
        createMockCompany({ id: '1', name: 'Dec Co', plan: 'Basic', employeesCount: 1, status: 'Active', joinedDate: '2025-12-10' }),
        createMockCompany({ id: '2', name: 'Jan Co', plan: 'Basic', employeesCount: 1, status: 'Active', joinedDate: '2026-01-05' }),
        createMockCompany({ id: '3', name: 'Feb Co', plan: 'Basic', employeesCount: 1, status: 'Active', joinedDate: '2026-02-12' }),
      ];
      const result = calculateCompanyGrowthMonthlyTrend(companies, febDate);
      const map = Object.fromEntries(result.map((r) => [r.month, r.count]));
      expect(map['Sep']).toBe(0);
      expect(map['Oct']).toBe(0);
      expect(map['Nov']).toBe(0);
      expect(map['Dec']).toBe(1);
      expect(map['Jan']).toBe(1);
      expect(map['Feb (Now)']).toBe(1);
    });

    it('7. Handles missing, null, and malformed joinedDates safely without throwing or false-matching', () => {
      const companies: SaaSCompany[] = [
        createMockCompany({ id: '1', name: 'Null Date', plan: 'Basic', employeesCount: 1, status: 'Active', joinedDate: null as any }),
        createMockCompany({ id: '2', name: 'Empty Date', plan: 'Basic', employeesCount: 1, status: 'Active', joinedDate: '' }),
        createMockCompany({ id: '3', name: 'Invalid Date', plan: 'Basic', employeesCount: 1, status: 'Active', joinedDate: 'not-a-date' }),
      ];
      const result = calculateCompanyGrowthMonthlyTrend(companies, fixedDate);
      expect(result.every((r) => r.count === 0)).toBe(true);
    });
  });

  describe('calculateMoMCompanyGrowth', () => {
    it('1. Calculates valid positive percentage growth when previous month > 0', () => {
      const companies: SaaSCompany[] = [
        // 2 in July
        createMockCompany({ id: '1', name: 'J1', plan: 'Basic', employeesCount: 1, status: 'Active', joinedDate: '2026-07-01' }),
        createMockCompany({ id: '2', name: 'J2', plan: 'Basic', employeesCount: 1, status: 'Active', joinedDate: '2026-07-10' }),
        // 3 in August (+50%)
        createMockCompany({ id: '3', name: 'A1', plan: 'Basic', employeesCount: 1, status: 'Active', joinedDate: '2026-08-01' }),
        createMockCompany({ id: '4', name: 'A2', plan: 'Basic', employeesCount: 1, status: 'Active', joinedDate: '2026-08-10' }),
        createMockCompany({ id: '5', name: 'A3', plan: 'Basic', employeesCount: 1, status: 'Active', joinedDate: '2026-08-20' }),
      ];
      const res = calculateMoMCompanyGrowth(companies, fixedDate);
      expect(res).toBe('+50% growth');
    });

    it('2. Calculates valid negative percentage growth when previous month > 0', () => {
      const companies: SaaSCompany[] = [
        // 4 in July
        createMockCompany({ id: '1', name: 'J1', plan: 'Basic', employeesCount: 1, status: 'Active', joinedDate: '2026-07-01' }),
        createMockCompany({ id: '2', name: 'J2', plan: 'Basic', employeesCount: 1, status: 'Active', joinedDate: '2026-07-10' }),
        createMockCompany({ id: '3', name: 'J3', plan: 'Basic', employeesCount: 1, status: 'Active', joinedDate: '2026-07-15' }),
        createMockCompany({ id: '4', name: 'J4', plan: 'Basic', employeesCount: 1, status: 'Active', joinedDate: '2026-07-20' }),
        // 2 in August (-50%)
        createMockCompany({ id: '5', name: 'A1', plan: 'Basic', employeesCount: 1, status: 'Active', joinedDate: '2026-08-01' }),
        createMockCompany({ id: '6', name: 'A2', plan: 'Basic', employeesCount: 1, status: 'Active', joinedDate: '2026-08-10' }),
      ];
      const res = calculateMoMCompanyGrowth(companies, fixedDate);
      expect(res).toBe('-50% growth');
    });

    it('3. Avoids fake percentages and returns clear delta string when previous month is 0 and current > 0', () => {
      const companies: SaaSCompany[] = [
        // 0 in July
        // 2 in August
        createMockCompany({ id: '1', name: 'Dezoryn', plan: 'Basic', employeesCount: 1, status: 'Active', joinedDate: '2026-08-22' }),
        createMockCompany({ id: '2', name: 'Shulka', plan: 'Premium', employeesCount: 11, status: 'Active', joinedDate: '2026-08-24' }),
      ];
      const res = calculateMoMCompanyGrowth(companies, fixedDate);
      expect(res).toBe('+2 new companies');
    });

    it('4. Returns neutral zero state when both previous and current month have 0 onboardings', () => {
      const companies: SaaSCompany[] = [
        createMockCompany({ id: '1', name: 'Old Co', plan: 'Basic', employeesCount: 1, status: 'Active', joinedDate: '2026-01-10' }),
      ];
      const res = calculateMoMCompanyGrowth(companies, fixedDate);
      expect(res).toBe('0 new companies');
    });
  });
});
