import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLoggerService } from '../../../common/audit/audit-logger.service';
import {
  COMPANY_EVENTS,
  EMPLOYEE_COUNT_SYNC_LOCK_ID,
  EmployeeCountUpdatedEvent,
  SeatCountUpdatedEvent,
} from '../../../common/events/company.events';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';


export interface SyncMetrics {
  totalSyncs: number;
  totalRepairs: number;
  failedSyncs: number;
  totalDurationMs: number;
  lastRepairTime: string | null;
  companiesChecked: number;
  lastSuccessfulSync: string | null;
  lastRepairSucceeded: boolean;
  staleCompaniesFound: number;
}

@Injectable()
export class EmployeeCountSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(EmployeeCountSyncService.name);

  // In-memory metrics
  private readonly metrics: SyncMetrics = {
    totalSyncs: 0,
    totalRepairs: 0,
    failedSyncs: 0,
    totalDurationMs: 0,
    lastRepairTime: null,
    companiesChecked: 0,
    lastSuccessfulSync: null,
    lastRepairSucceeded: true,
    staleCompaniesFound: 0,
  };

  // NOTE: In-memory debouncing map works only within a single instance.
  // In a horizontally scaled production deployment, this should be replaced with
  // distributed queue coalescing (e.g. BullMQ, Redis streams, or Kafka).
  private readonly syncDebounceMap = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly auditLoggerService: AuditLoggerService,
  ) {}

  onApplicationBootstrap() {
    // 1. Startup self-healing runs in the background to prevent blocking bootstrap
    setImmediate(async () => {
      this.logger.log(
        '[EmployeeCountSync] Starting background startup self-healing repair...',
      );
      try {
        await this.syncAllCompanies('StartupRepair');
      } catch (err) {
        this.logger.error(
          '[EmployeeCountSync] Startup self-healing repair failed',
          err,
        );
      }
    });

    // 2. Configure Cron reconciliation dynamically from environment configuration
    const cronExpression =
      this.configService.get<string>('EMPLOYEE_COUNT_SYNC_CRON') || '0 2 * * *'; // Nightly at 2:00 AM

    this.logger.log(
      `[EmployeeCountSync] Registering reconciliation job with cron: "${cronExpression}"`,
    );

    try {
      const job = new CronJob(cronExpression, async () => {
        this.logger.log(
          '[EmployeeCountSync] Triggering scheduled reconciliation job...',
        );
        try {
          await this.syncAllCompanies('ScheduledReconciliation');
        } catch (err) {
          this.logger.error(
            '[EmployeeCountSync] Scheduled reconciliation job failed',
            err,
          );
        }
      });

      this.schedulerRegistry.addCronJob('employee-count-reconciliation', job);
      job.start();
    } catch (cronErr) {
      this.logger.error(
        `[EmployeeCountSync] Failed to register cron expression "${cronExpression}":`,
        cronErr,
      );
    }
  }

  /**
   * Acquires a session-level advisory lock using PostgreSQL's built-in distributed locking.
   * On SQLite, fallback silently and return true (single-writer model doesn't need advisory locks).
   */
  private async acquireAdvisoryLock(tx: any): Promise<boolean> {
    try {
      // Check if we are running on PostgreSQL
      const provider = (this.prisma as any)._activeProvider || 'postgresql';
      if (provider === 'sqlite') {
        return true;
      }

      const result = (await tx.$queryRawUnsafe(
        `SELECT pg_try_advisory_lock(${EMPLOYEE_COUNT_SYNC_LOCK_ID}) as pg_try_advisory_lock;`,
      )) as { pg_try_advisory_lock: boolean }[];
      return result[0]?.pg_try_advisory_lock ?? false;
    } catch (err) {
      this.logger.warn(
        `[EmployeeCountSync] Failed to acquire advisory lock: ${err.message}. Assuming local lock or SQLite.`,
      );
      return true;
    }
  }

  /**
   * Releases a session-level advisory lock.
   */
  private async releaseAdvisoryLock(tx: any): Promise<void> {
    try {
      const provider = (this.prisma as any)._activeProvider || 'postgresql';
      if (provider === 'sqlite') {
        return;
      }
      await tx.$queryRawUnsafe(
        `SELECT pg_advisory_unlock(${EMPLOYEE_COUNT_SYNC_LOCK_ID});`,
      );
    } catch (err) {
      this.logger.warn(
        `[EmployeeCountSync] Failed to release advisory lock: ${err.message}`,
      );
    }
  }

  /**
   * Debounces incoming count changes to prevent database thrashing on bulk operations.
   */
  syncCompanyDebounced(companyId: string, source: string) {
    if (this.syncDebounceMap.has(companyId)) {
      clearTimeout(this.syncDebounceMap.get(companyId));
    }
    const timeout = setTimeout(() => {
      this.syncDebounceMap.delete(companyId);
      TenantContextService.runTenant(companyId, async () => {
        await this.syncCompany(companyId, source);
      }).catch((err) => {
        this.logger.error(
          `[EmployeeCountSync] Debounced sync failed for company ${companyId}`,
          err,
        );
      });
    }, 500);
    this.syncDebounceMap.set(companyId, timeout);
  }

  /**
   * Returns the count of all employee records in the DB.
   */
  async getActualEmployeeCount(companyId: string, tx?: any): Promise<number> {
    const client = tx || this.prisma;
    return client.employee.count({
      where: {
        OR: [{ companyId }, { subscriptionId: companyId }],
      },
    });
  }

  /**
   * Returns the count of active/on-leave employees.
   */
  async getActiveEmployeeCount(companyId: string, tx?: any): Promise<number> {
    const client = tx || this.prisma;
    return client.employee.count({
      where: {
        OR: [{ companyId }, { subscriptionId: companyId }],
        status: { in: ['Active', 'ACTIVE', 'On Leave'] },
      },
    });
  }

  /**
   * Recalculates and updates the count for a company inside a transaction.
   * Emits real-time events and registers audit logs strictly AFTER commit.
   */
  async syncCompany(
    companyId: string,
    source: string,
    tx?: any,
  ): Promise<void> {
    const startTime = Date.now();
    this.metrics.totalSyncs++;

    try {
      const client = tx || this.prisma;

      let subscription = await client.subscription.findUnique({
        where: { id: companyId },
      });

      if (!subscription) {
        subscription = await client.subscription.findFirst({
          where: { companyId },
        });
      }

      if (!subscription) {
        subscription = await client.subscription.findFirst({
          where: { company: companyId },
        });
      }

      if (!subscription) {
        this.logger.warn(
          `[EmployeeCountSync] No subscription found for companyId "${companyId}". Skipping.`,
        );
        return;
      }

      const targetCompanyId = subscription.companyId || subscription.id;
      const cachedBefore = subscription.employeesCount ?? 0;
      const purchasedSeats = subscription.purchasedSeats ?? 50;

      // ── Calculate and Update Inside a Transaction (Atomic read + write) ──
      const { actualCount, activeCount, usedSeats } = await client.$transaction(
        async (innerTx) => {
          const actual = await this.getActualEmployeeCount(
            targetCompanyId,
            innerTx,
          );
          const active = await this.getActiveEmployeeCount(
            targetCompanyId,
            innerTx,
          );
          const seats = Math.min(active, purchasedSeats);

          await innerTx.subscription.update({
            where: { id: subscription.id },
            data: {
              employeesCount: actual,
              usedSeats: seats,
            },
          });

          return { actualCount: actual, activeCount: active, usedSeats: seats };
        },
      );

      const duration = Date.now() - startTime;
      this.metrics.totalDurationMs += duration;
      this.metrics.lastSuccessfulSync = new Date().toISOString();

      // Log successful sync
      this.logger.log(
        `[EmployeeCountSync] Company: "${subscription.company}" | Actual Employee Count: ${actualCount} | Cached Count Before: ${cachedBefore} | Cached Count After: ${actualCount} | Source: ${source} | Duration: ${duration}ms`,
      );

      // ── Write Audit Log and emit SSE events strictly POST-COMMIT (only if not inside a wrapping outer transaction) ──
      if (!tx) {
        if (cachedBefore !== actualCount) {
          this.metrics.totalRepairs++;
          this.metrics.lastRepairTime = new Date().toISOString();

          await this.auditLoggerService.logAction({
            userId: 'SYSTEM',
            userName: 'System (Reconciliation)',
            companyId: targetCompanyId,
            action: 'EMPLOYEE_COUNT_RECONCILIATION_REPAIR',
            oldValue: { employeesCount: cachedBefore },
            newValue: { employeesCount: actualCount },
            details: `Employee count repaired from ${cachedBefore} to ${actualCount} (Source: ${source})`,
          });
        }

        // Emit realtime synchronization events
        this.eventEmitter.emit(
          COMPANY_EVENTS.EMPLOYEE_COUNT_UPDATED,
          new EmployeeCountUpdatedEvent(
            subscription.id,
            targetCompanyId,
            actualCount,
          ),
        );
        this.eventEmitter.emit(
          COMPANY_EVENTS.SEAT_COUNT_UPDATED,
          new SeatCountUpdatedEvent(
            subscription.id,
            targetCompanyId,
            usedSeats,
            purchasedSeats,
          ),
        );
      }
    } catch (error) {
      this.metrics.failedSyncs++;
      this.logger.error(
        `[EmployeeCountSync] Synchronization failed for company "${companyId}" (Source: ${source}):`,
        error,
      );
      throw error;
    }
  }

  /**
   * Scans all companies, detects count mismatches, and runs repairs.
   * Utilizes session-level PostgreSQL advisory locks for safe multi-instance concurrency.
   */
  async syncAllCompanies(source: string): Promise<void> {
    return TenantContextService.runPlatform(async () => {
      this.logger.log(
        `[EmployeeCountSync] Initiating scan for all companies (Source: ${source})...`,
      );

      // Acquire PostgreSQL distributed lock to prevent multiple instances from running full reconciliation concurrently
      const lockAcquired = await this.prisma.$transaction(async (tx) => {
        return this.acquireAdvisoryLock(tx);
      });

      if (!lockAcquired) {
        this.logger.log(
          `[EmployeeCountSync] Advisory lock contention detected for scan (Source: ${source}). Skipping repair execution on this node.`,
        );
        return;
      }

      try {
        const subs = await this.prisma.subscription.findMany();
        this.metrics.companiesChecked = subs.length;

        let repairedCount = 0;

        for (const sub of subs) {
          const companyId = sub.companyId || sub.id;

          await TenantContextService.runTenant(companyId, async () => {
            const actualCount = await this.getActualEmployeeCount(companyId);
            const cachedCount = sub.employeesCount ?? 0;

            if (
              actualCount !== cachedCount ||
              source === 'StartupRepair' ||
              source === 'ScheduledReconciliation'
            ) {
              if (actualCount !== cachedCount) {
                repairedCount++;
                this.metrics.staleCompaniesFound++;
                this.logger.warn(
                  `[EmployeeCountRepair] Company: "${sub.company}" | Stored Count: ${cachedCount} | Actual Count: ${actualCount} | Status: Mismatch detected. Repairing...`,
                );
              }

              await this.syncCompany(companyId, `${source}_Repair`);

              if (actualCount !== cachedCount) {
                this.logger.log(
                  `[EmployeeCountRepair] Company: "${sub.company}" | Stored Count: ${cachedCount} | Actual Count: ${actualCount} | Status: Repaired Successfully`,
                );
              }
            }
          });
        }

        this.metrics.lastRepairSucceeded = true;
        this.logger.log(
          `[EmployeeCountSync] Full company scan finished. Checked: ${subs.length} | Repaired: ${repairedCount}`,
        );
      } catch (err) {
        this.metrics.lastRepairSucceeded = false;
        this.logger.error(`[EmployeeCountSync] Full company scan failed:`, err);
        throw err;
      } finally {
        // Always release distributed lock
        await this.prisma.$transaction(async (tx) => {
          await this.releaseAdvisoryLock(tx);
        });
      }
    });
  }

  /**
   * Exposes raw metrics for internal metrics endpoint.
   */
  getMetrics(): SyncMetrics {
    return { ...this.metrics };
  }
}
