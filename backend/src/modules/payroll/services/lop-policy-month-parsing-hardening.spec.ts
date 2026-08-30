import { BadRequestException } from '@nestjs/common';
import { parsePayrollMonth } from '../../../common/utils/date.util';
import { LopPolicyService } from './lop-policy.service';

describe('HR NEXA — LopPolicyService Month Parsing Hardening Tests (PAYROLL-AUDIT-005)', () => {
  let lopPolicyService: LopPolicyService;
  let mockPrismaService: any;

  beforeEach(() => {
    mockPrismaService = {
      systemConfig: {
        findUnique: jest.fn().mockResolvedValue(null), // Defaults to CALENDAR_DAYS mode
      },
    };
    lopPolicyService = new LopPolicyService(mockPrismaService);
  });

  describe('1. Valid Month Formats', () => {
    it('should parse ISO format "2026-09" correctly', async () => {
      const parsed = parsePayrollMonth('2026-09');
      expect(parsed.year).toBe(2026);
      expect(parsed.monthNum).toBe(9);
      expect(parsed.monthIndex).toBe(8);
      expect(parsed.daysInMonth).toBe(30);

      const policy = await lopPolicyService.resolvePolicy(null, '2026-09');
      expect(policy.mode).toBe('CALENDAR_DAYS');
      expect(policy.divisor).toBe(30);
    });

    it('should parse full month format "September 2026" correctly', async () => {
      const parsed = parsePayrollMonth('September 2026');
      expect(parsed.year).toBe(2026);
      expect(parsed.monthNum).toBe(9);
      expect(parsed.daysInMonth).toBe(30);

      const policy = await lopPolicyService.resolvePolicy(null, 'September 2026');
      expect(policy.divisor).toBe(30);
    });

    it('should parse abbreviated month formats "Sept 2026" and "Sep 2026" correctly', async () => {
      const parsedSept = parsePayrollMonth('Sept 2026');
      expect(parsedSept.monthNum).toBe(9);
      expect(parsedSept.daysInMonth).toBe(30);

      const parsedSep = parsePayrollMonth('sep 2026');
      expect(parsedSep.monthNum).toBe(9);
      expect(parsedSep.daysInMonth).toBe(30);

      const policy = await lopPolicyService.resolvePolicy(null, 'Sept 2026');
      expect(policy.divisor).toBe(30);
    });

    it('should parse canonical format "July 2026" and leap year February "2024-02"', async () => {
      const parsedJul = parsePayrollMonth('July 2026');
      expect(parsedJul.daysInMonth).toBe(31);

      const parsedFebLeap = parsePayrollMonth('2024-02');
      expect(parsedFebLeap.daysInMonth).toBe(29);

      const parsedFebNonLeap = parsePayrollMonth('2025-02');
      expect(parsedFebNonLeap.daysInMonth).toBe(28);
    });
  });

  describe('2. Invalid Month Formats', () => {
    it('should reject invalid month number "2026-13"', () => {
      expect(() => parsePayrollMonth('2026-13')).toThrow(BadRequestException);
    });

    it('should reject invalid month number "2026-00"', () => {
      expect(() => parsePayrollMonth('2026-00')).toThrow(BadRequestException);
    });

    it('should reject out-of-range year "1899-05" and "2101-05"', () => {
      expect(() => parsePayrollMonth('1899-05')).toThrow(BadRequestException);
      expect(() => parsePayrollMonth('2101-05')).toThrow(BadRequestException);
    });

    it('should reject empty string and whitespace input', () => {
      expect(() => parsePayrollMonth('')).toThrow(BadRequestException);
      expect(() => parsePayrollMonth('   ')).toThrow(BadRequestException);
    });

    it('should reject random malformed strings', () => {
      expect(() => parsePayrollMonth('invalid-month')).toThrow(BadRequestException);
      expect(() => parsePayrollMonth('2026/09')).toThrow(BadRequestException);
      expect(() => parsePayrollMonth('FooBar 2026')).toThrow(BadRequestException);
    });
  });

  describe('3. Consistency Verification', () => {
    it('should resolve identical daysInMonth divisor between LopPolicyService and parsePayrollMonth', async () => {
      const testInputs = [
        '2026-01',
        'January 2026',
        '2026-02',
        'February 2026',
        '2024-02',
        '2026-04',
        'April 2026',
        '2026-07',
        'July 2026',
        '2026-09',
        'Sept 2026',
        '2026-12',
        'December 2026',
      ];

      for (const input of testInputs) {
        const parsed = parsePayrollMonth(input);
        const policy = await lopPolicyService.resolvePolicy(null, input);

        expect(policy.divisor).toBe(parsed.daysInMonth);
      }
    });
  });
});
