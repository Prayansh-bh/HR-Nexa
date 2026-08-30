import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { LeaveModule } from './modules/leave/leave.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SystemModule } from './modules/system/system.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { RecruitmentModule } from './modules/recruitment/recruitment.module';
import { PerformanceModule } from './modules/performance/performance.module';
import { AssetsModule } from './modules/assets/assets.module';
import { SeedFromEmployeesService } from './modules/departments/services/seed-from-employees.service';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { BillingModule } from './modules/billing/billing.module';
import { PlansModule } from './modules/plans/plans.module';
import { UsersModule } from './modules/users/users.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { ExitModule } from './modules/exit/exit.module';
import { PlatformReportsModule } from './modules/platform-reports/platform-reports.module';
import { CompanySyncListener } from './common/listeners/company-sync.listener';
import { RolesUsersListener } from './common/listeners/roles-users.listener';
import { SettingsModule } from './modules/settings/settings.module';
import { CheckoutModule } from './modules/checkout/checkout.module';
import { MaintenanceGuard } from './modules/auth/guards/maintenance.guard';
import { DprModule } from './modules/dpr/dpr.module';
import { TrialRequestsModule } from './modules/trial-requests/trial-requests.module';

import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import { Request } from 'express';

import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { validateEnv } from './common/config/env.validation';

import { NestModule, MiddlewareConsumer } from '@nestjs/common';
import { TenantModule } from './common/tenant/tenant.module';
import { TenantMiddleware } from './common/tenant/tenant.middleware';
import { TenantInterceptor } from './common/tenant/tenant.interceptor';
import { TenantGuard } from './common/tenant/tenant.guard';
import { AuditModule } from './common/audit/audit.module';
import { AuditInterceptor } from './common/audit/audit.interceptor';
import { CacheModule } from './common/cache/cache.module';
import { AutoCacheInterceptor } from './common/cache/auto-cache.interceptor';

import { QueueModule } from './common/queue/queue.module';
import { StorageModule } from './common/storage/storage.module';
import { EmailModule } from './email/email.module';

@Module({
  imports: [
    ConfigModule.forRoot({ validate: validateEnv, isGlobal: true }),
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      global: true,
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'default',
          ttl: 60000,
          limit: 100,
        },
      ],
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        genReqId: (req) => {
          const existingId =
            req.headers['x-request-id'] || req.headers['x-correlation-id'];
          if (existingId) return existingId;
          return randomUUID();
        },
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.body.password',
            'req.body.pass',
            'req.body.access_token',
            'req.body.token',
            '*.password',
            '*.access_token',
          ],
          censor: '[REDACTED]',
        },
        customProps: (req: Request) => {
          const reqWithUser = req as Request & {
            id?: string;
            user?: { id?: string; companyId?: string };
          };
          const user = reqWithUser.user;
          return {
            requestId: reqWithUser.id || null,
            userId: user?.id || null,
            companyId: user?.companyId || 'DEFAULT_COMPANY',
          };
        },
        autoLogging: true,
      },
    }),
    PrismaModule,
    TenantModule,
    AuthModule,
    AuditModule,
    CacheModule,
    QueueModule,
    StorageModule,
    EmailModule,
    EmployeesModule,
    DepartmentsModule,
    AttendanceModule,
    LeaveModule,
    PayrollModule,
    DocumentsModule,
    ReportsModule,
    PlatformReportsModule,
    SystemModule,
    DashboardModule,
    RecruitmentModule,
    PerformanceModule,
    AssetsModule,
    SubscriptionsModule,
    BillingModule,
    PlansModule,
    UsersModule,
    TicketsModule,
    ExitModule,
    SettingsModule,
    CheckoutModule,
    DprModule,
    TrialRequestsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    SeedFromEmployeesService,
    CompanySyncListener,
    RolesUsersListener,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: MaintenanceGuard,
    },
    {
      provide: APP_GUARD,
      useClass: TenantGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AutoCacheInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
