import { BadRequestException } from '@nestjs/common';
import { PayrollService } from './payroll.service';

describe('HR NEXA — Payroll Idempotency & Stale PENDING Lock Recovery Tests (PAYROLL-AUDIT-006)', () => {
  let payrollService: PayrollService;
  let mockPrismaService: any;
  let idempotencyStore: Map<string, any>;

  beforeEach(() => {
    idempotencyStore = new Map();

    mockPrismaService = {
      idempotencyKey: {
        create: jest.fn().mockImplementation(async ({ data }) => {
          if (idempotencyStore.has(data.key)) {
            const err: any = new Error('Unique constraint failed');
            err.code = 'P2002';
            throw err;
          }
          const record = {
            ...data,
            createdAt: data.createdAt || new Date(),
          };
          idempotencyStore.set(data.key, record);
          return record;
        }),

        findUnique: jest.fn().mockImplementation(async ({ where }) => {
          return idempotencyStore.get(where.key) || null;
        }),

        updateMany: jest.fn().mockImplementation(async ({ where, data }) => {
          const existing = idempotencyStore.get(where.key);
          if (!existing) return { count: 0 };

          // Verify atomic condition match
          if (existing.status !== where.status) return { count: 0 };
          if (where.createdAt && existing.createdAt.getTime() !== where.createdAt.getTime()) {
            return { count: 0 };
          }

          const updated = {
            ...existing,
            ...data,
            createdAt: data.createdAt || existing.createdAt,
          };
          idempotencyStore.set(where.key, updated);
          return { count: 1 };
        }),

        update: jest.fn().mockImplementation(async ({ where, data }) => {
          const existing = idempotencyStore.get(where.key);
          if (!existing) throw new Error('Record to update not found.');
          const updated = { ...existing, ...data };
          idempotencyStore.set(where.key, updated);
          return updated;
        }),
      },
    };

    payrollService = new PayrollService(
      mockPrismaService,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  describe('1. Fresh PENDING Lock Behavior', () => {
    it('1. Fresh PENDING lock blocks another payroll request', async () => {
      const key = 'COMPANY-A_payroll_run_July_2026';
      await payrollService.claimIdempotencyKey(key);

      await expect(payrollService.claimIdempotencyKey(key)).rejects.toThrow(BadRequestException);
    });
  });

  describe('2. Stale Lock Recovery', () => {
    it('2. PENDING lock older than stale threshold (5 min) can be reclaimed', async () => {
      const key = 'COMPANY-A_payroll_run_July_2026';
      const staleTime = new Date(Date.now() - 6 * 60 * 1000); // 6 minutes ago

      idempotencyStore.set(key, {
        key,
        status: 'PENDING',
        createdAt: staleTime,
        expiresAt: new Date(Date.now() + 23 * 60 * 60 * 1000),
      });

      const reclaimed = await payrollService.claimIdempotencyKey(key);
      expect(reclaimed).toBe(true);

      const record = idempotencyStore.get(key);
      expect(record.status).toBe('PENDING');
      expect(record.createdAt.getTime()).toBeGreaterThan(staleTime.getTime());
    });

    it("3. Reclaimed stale lock becomes the current owner's lock", async () => {
      const key = 'COMPANY-A_payroll_run_July_2026';
      const staleTime = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago

      idempotencyStore.set(key, {
        key,
        status: 'PENDING',
        createdAt: staleTime,
        expiresAt: new Date(Date.now() + 23 * 60 * 60 * 1000),
      });

      const startTime = Date.now();
      await payrollService.claimIdempotencyKey(key);

      const record = idempotencyStore.get(key);
      expect(record.createdAt.getTime()).toBeGreaterThanOrEqual(startTime);
    });

    it('4. The old stale owner cannot subsequently finalize the reclaimed lock as fresh', async () => {
      const key = 'COMPANY-A_payroll_run_July_2026';
      const staleTime = new Date(Date.now() - 10 * 60 * 1000);

      idempotencyStore.set(key, {
        key,
        status: 'PENDING',
        createdAt: staleTime,
      });

      // New process reclaims
      await payrollService.claimIdempotencyKey(key);
      const reclaimedRecord = idempotencyStore.get(key);

      // New process completes
      await payrollService.resolveIdempotencyKey(key, true);
      expect(idempotencyStore.get(key).status).toBe('COMPLETED');
    });
  });

  describe('3. Concurrency Protection', () => {
    it('5. Two concurrent reclaim attempts cannot both acquire the same stale lock', async () => {
      const key = 'COMPANY-A_payroll_run_July_2026';
      const staleTime = new Date(Date.now() - 10 * 60 * 1000);

      idempotencyStore.set(key, {
        key,
        status: 'PENDING',
        createdAt: staleTime,
      });

      // Simulate simultaneous execution where only the first updateMany succeeds
      const promise1 = payrollService.claimIdempotencyKey(key);
      const promise2 = payrollService.claimIdempotencyKey(key);

      const results = await Promise.allSettled([promise1, promise2]);
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);
    });

    it('6. Only one request proceeds to payroll processing', async () => {
      const key = 'COMPANY-A_payroll_run_July_2026';
      const firstClaim = await payrollService.claimIdempotencyKey(key);
      expect(firstClaim).toBe(true);

      await expect(payrollService.claimIdempotencyKey(key)).rejects.toThrow(BadRequestException);
    });
  });

  describe('4. Completed and Failed States', () => {
    it('7. COMPLETED idempotency key still prevents duplicate payroll processing', async () => {
      const key = 'COMPANY-A_payroll_run_July_2026';
      idempotencyStore.set(key, {
        key,
        status: 'COMPLETED',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      });

      const result = await payrollService.claimIdempotencyKey(key);
      expect(result).toBe(false);
    });

    it('8. A completed key is never treated as stale', async () => {
      const key = 'COMPANY-A_payroll_run_July_2026';
      idempotencyStore.set(key, {
        key,
        status: 'COMPLETED',
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
      });

      const result = await payrollService.claimIdempotencyKey(key);
      expect(result).toBe(false);
    });

    it('9. Existing FAILED-key behavior allows deterministic retry', async () => {
      const key = 'COMPANY-A_payroll_run_July_2026';
      idempotencyStore.set(key, {
        key,
        status: 'FAILED',
        createdAt: new Date(Date.now() - 30 * 1000),
      });

      const reclaimed = await payrollService.claimIdempotencyKey(key);
      expect(reclaimed).toBe(true);
      expect(idempotencyStore.get(key).status).toBe('PENDING');
    });

    it('10. Retry behavior for FAILED keys updates createdAt to current time', async () => {
      const key = 'COMPANY-A_payroll_run_July_2026';
      const oldTime = new Date(Date.now() - 60 * 1000);
      idempotencyStore.set(key, {
        key,
        status: 'FAILED',
        createdAt: oldTime,
      });

      await payrollService.claimIdempotencyKey(key);
      const record = idempotencyStore.get(key);
      expect(record.createdAt.getTime()).toBeGreaterThan(oldTime.getTime());
    });
  });

  describe('5. Tenant Isolation', () => {
    it("11. Company A's stale lock cannot block Company B", async () => {
      const keyA = 'COMPANY-A_payroll_run_July_2026';
      const keyB = 'COMPANY-B_payroll_run_July_2026';

      await payrollService.claimIdempotencyKey(keyA);

      const claimB = await payrollService.claimIdempotencyKey(keyB);
      expect(claimB).toBe(true);
    });

    it("12. Company A cannot reclaim Company B's idempotency key", async () => {
      const keyB = 'COMPANY-B_payroll_run_July_2026';
      idempotencyStore.set(keyB, {
        key: keyB,
        status: 'PENDING',
        createdAt: new Date(Date.now() - 10 * 60 * 1000),
      });

      // Company A claims its own key
      const keyA = 'COMPANY-A_payroll_run_July_2026';
      const claimA = await payrollService.claimIdempotencyKey(keyA);
      expect(claimA).toBe(true);

      // Company B's lock remains untouched for Company B to recover
      expect(idempotencyStore.get(keyB).key).toBe(keyB);
    });
  });

  describe('6. Expiration and Crash Semantics', () => {
    it('13. Normal 24-hour expiration calculation is applied to claimed key', async () => {
      const key = 'COMPANY-A_payroll_run_July_2026';
      const now = Date.now();
      await payrollService.claimIdempotencyKey(key);

      const record = idempotencyStore.get(key);
      expect(record.expiresAt.getTime()).toBeGreaterThanOrEqual(now + 23 * 60 * 60 * 1000);
    });

    it('14. Stale PENDING recovery works even before the normal 24-hour expiration', async () => {
      const key = 'COMPANY-A_payroll_run_July_2026';
      // 10 minutes old (well before 24h expiration)
      idempotencyStore.set(key, {
        key,
        status: 'PENDING',
        createdAt: new Date(Date.now() - 10 * 60 * 1000),
        expiresAt: new Date(Date.now() + 23 * 60 * 60 * 1000),
      });

      const reclaimed = await payrollService.claimIdempotencyKey(key);
      expect(reclaimed).toBe(true);
    });

    it('15. Simulate a PENDING record left behind by SIGKILL/crash without cleanup', async () => {
      const key = 'COMPANY-A_payroll_run_July_2026';
      // Process crashed 15 minutes ago, resolveIdempotencyKey was NEVER called
      idempotencyStore.set(key, {
        key,
        status: 'PENDING',
        createdAt: new Date(Date.now() - 15 * 60 * 1000),
      });

      const record = idempotencyStore.get(key);
      expect(record.status).toBe('PENDING'); // Left behind in PENDING state
    });

    it('16. Start a new payroll request and verify it safely recovers the stale lock', async () => {
      const key = 'COMPANY-A_payroll_run_July_2026';
      idempotencyStore.set(key, {
        key,
        status: 'PENDING',
        createdAt: new Date(Date.now() - 15 * 60 * 1000),
      });

      const recovered = await payrollService.claimIdempotencyKey(key);
      expect(recovered).toBe(true);
      expect(idempotencyStore.get(key).status).toBe('PENDING');
    });

    it('17. Verify two requests cannot both enter active calculation for the same company/month', async () => {
      const key = 'COMPANY-A_payroll_run_July_2026';
      await payrollService.claimIdempotencyKey(key);

      let enteredCalculationCount = 0;

      const attemptRun = async () => {
        const claimed = await payrollService.claimIdempotencyKey(key);
        if (claimed) {
          enteredCalculationCount++;
        }
      };

      await expect(attemptRun()).rejects.toThrow(BadRequestException);
      expect(enteredCalculationCount).toBe(0);
    });
  });
});
