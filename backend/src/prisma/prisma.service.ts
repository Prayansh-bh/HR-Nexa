import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { createTenantPrismaExtension } from './prisma-tenant.extension';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private _extendedClient: any = null;
  private totalQueries = 0;
  private slowQueriesCount = 0;
  private queryDurations: number[] = [];
  private maxDuration = 0;

  constructor(private readonly tenantContextService: TenantContextService) {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'warn' },
      ],
    });
  }

  async onModuleInit() {
    const slowQueryThreshold = parseInt(
      process.env.DATABASE_SLOW_QUERY_MS || '200',
      10,
    );

    (this as any).$on('query', (e: any) => {
      this.totalQueries++;
      const duration = e.duration;
      if (duration > this.maxDuration) {
        this.maxDuration = duration;
      }
      if (this.queryDurations.length >= 100) {
        this.queryDurations.shift();
      }
      this.queryDurations.push(duration);

      if (duration >= slowQueryThreshold) {
        this.slowQueriesCount++;
        const cleanQuery = (e.query || '').replace(/\s+/g, ' ').trim();
        this.logger.warn(
          `[SLOW QUERY] ${duration}ms >= ${slowQueryThreshold}ms | Query: "${cleanQuery.slice(
            0,
            250,
          )}"`,
        );
      }
    });

    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        attempts++;
        await this.$connect();
        this.logger.log('Successfully connected to Neon PostgreSQL database.');
        break;
      } catch (err: any) {
        this.logger.warn(
          `Prisma $connect attempt ${attempts}/${maxAttempts} failed: ${err.message}`,
        );
        if (attempts >= maxAttempts) {
          this.logger.error(
            'Max database connection attempts reached. App will continue initialization.',
          );
        } else {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    }

    this._extendedClient = this.$extends(
      createTenantPrismaExtension(this.tenantContextService),
    );
  }

  public getQueryTelemetry() {
    const sorted = [...this.queryDurations].sort((a, b) => a - b);
    const count = sorted.length;
    const avg =
      count > 0 ? Math.round(sorted.reduce((a, b) => a + b, 0) / count) : 0;
    const p95 =
      count > 0 ? sorted[Math.floor(count * 0.95)] || sorted[count - 1] : 0;
    const p99 =
      count > 0 ? sorted[Math.floor(count * 0.99)] || sorted[count - 1] : 0;

    return {
      totalQueries: this.totalQueries,
      slowQueries: this.slowQueriesCount,
      avgDurationMs: avg,
      maxDurationMs: this.maxDuration,
      p95EstimateMs: p95,
      p99EstimateMs: p99,
    };
  }

  get extended() {
    return this._extendedClient || this;
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
