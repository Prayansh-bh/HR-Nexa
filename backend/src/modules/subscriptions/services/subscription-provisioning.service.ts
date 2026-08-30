import * as crypto from 'crypto';
import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  Optional,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { PasswordService } from '../../auth/services/password.service';
import { EmailService } from '../../../email/email.service';
import { CompanyNotificationsService } from '../../../common/notifications/company-notifications.service';
import { AuditLoggerService } from '../../../common/audit/audit-logger.service';
import { Permission } from '../../auth/permissions.enum';
import { CANONICAL_ROLE_PERMISSIONS } from '../../auth/constants/canonical-permissions';
import {
  CompanyCreatedEvent,
  SubscriptionCreatedEvent,
  EmployeeCountChangedEvent,
  COMPANY_EVENTS,
} from '../../../common/events/company.events';

import { SubscriptionStatus } from '../enums/subscription-status.enum';
import { BillingCycle } from '../enums/billing-cycle.enum';
import { CreateSubscriptionDto } from '../controllers/dto/create-subscription.dto';
import {
  getBusinessDateString,
  calculateSubscriptionExpiry,
} from '../../../common/utils/date.util';

import { SystemConfigService } from '../../system/services/system-config.service';

import { OutboxPublisherService } from '../../../common/queue/outbox-publisher.service';

import { RoleProvisioningService } from '../../auth/services/role-provisioning.service';

@Injectable()
export class SubscriptionProvisioningService {
  private readonly logger = new Logger(SubscriptionProvisioningService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly emailService: EmailService,
    private readonly companyNotificationsService: CompanyNotificationsService,
    private readonly eventEmitter: EventEmitter2,
    private readonly roleProvisioningService: RoleProvisioningService,
    @Optional() private readonly auditLogger?: AuditLoggerService,
    @Optional() private readonly systemConfigService?: SystemConfigService,
    @Optional() private readonly outboxPublisher?: OutboxPublisherService,
  ) {}

  private gbToMB(gb: number): number {
    return gb * 1024;
  }

  private mbToDisplayString(mb: number): string {
    const gb = mb / 1024;
    if (Number.isInteger(gb)) {
      return `${gb} GB`;
    }
    return `${gb.toFixed(2).replace(/\.?0+$/, '')} GB`;
  }

  private formatStorage(usedMB: number, limitMB: number): string {
    return `${this.mbToDisplayString(usedMB)} / ${this.mbToDisplayString(limitMB)}`;
  }

  private async resolvePlanAndVersion(planIdentifier: string) {
    let plan = await this.prisma.saaSPlanNew.findFirst({
      where: {
        status: { not: 'Archived' },
        OR: [{ id: planIdentifier }, { code: planIdentifier }],
      },
    });

    if (!plan) {
      plan = await this.prisma.saaSPlanNew.findFirst({
        where: {
          status: { not: 'Archived' },
          name: { equals: planIdentifier, mode: 'insensitive' },
        },
      });
    }

    if (!plan) {
      throw new BadRequestException(`SaaS Plan "${planIdentifier}" not found.`);
    }

    const version = await this.prisma.planVersion.findFirst({
      where: {
        planId: plan.id,
        status: 'Published',
      },
      orderBy: {
        version: 'desc',
      },
    });

    if (!version) {
      throw new BadRequestException(
        `No published version found for plan "${plan.name}".`,
      );
    }

    if (version.employeeLimit <= 0) {
      throw new BadRequestException(
        `Plan version has invalid employeeLimit: ${version.employeeLimit}`,
      );
    }

    return { plan, version };
  }

  async createSubscription(data: CreateSubscriptionDto) {
    if (
      typeof data.employeesCount === 'number' &&
      typeof data.purchasedSeats === 'number' &&
      data.employeesCount > data.purchasedSeats
    ) {
      throw new BadRequestException(
        `Initial headcount (${data.employeesCount}) cannot exceed purchased seat limit (${data.purchasedSeats}).`,
      );
    }

    let createdCompany: any;
    let createdSub: any;
    const companyRolesMap: Record<string, any> = {};
    const adminEmail =
      data.ownerEmail ||
      `admin@${data.company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
    const adminName =
      data.ownerName || data.hrAdmin || `${data.company} HR Admin`;
    const start = data.start || getBusinessDateString();

    const { plan, version } = await this.resolvePlanAndVersion(data.plan);

    const isTrial =
      data.status === SubscriptionStatus.TRIAL ||
      data.cycle === BillingCycle.TRIAL ||
      data.status?.trim().toLowerCase() === 'trial' ||
      data.cycle?.trim().toLowerCase() === 'trial';

    const cycle = isTrial
      ? BillingCycle.TRIAL
      : data.cycle === BillingCycle.ANNUAL
        ? BillingCycle.ANNUAL
        : BillingCycle.MONTHLY;

    const amount =
      cycle === BillingCycle.ANNUAL
        ? version.yearlyPrice
        : cycle === BillingCycle.TRIAL
          ? 0
          : version.monthlyPrice;

    const trialDays = this.systemConfigService
      ? await this.systemConfigService.getConfiguredTrialDays()
      : 14;

    const calculatedExpiry = calculateSubscriptionExpiry(start, cycle, trialDays);
    const expiry = data.expiry || calculatedExpiry;

    const approvalRequired = this.systemConfigService
      ? await this.systemConfigService.isCompanyApprovalRequired()
      : false;
    const initialStatus = isTrial
      ? SubscriptionStatus.TRIAL
      : data.status || (approvalRequired ? 'Pending' : SubscriptionStatus.ACTIVE);

    // FIX: Generate temporary password EXACTLY ONCE for hashing, database, and welcome email
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const tempPassword = `AdminNexa#${randomDigits}`;
    const hashedPassword = await this.passwordService.hash(tempPassword);

    try {
      await this.prisma.$transaction(
        async (tx) => {
          // 1. Create company record
          try {
            createdCompany = await tx.company.create({
              data: {
                name: data.company,
              },
            });
          } catch (companyErr: any) {
            if (companyErr.code === 'P2002') {
              throw new ConflictException(
                `Company name "${data.company}" already exists.`,
              );
            }
            throw companyErr;
          }

          // 2. Create subscription
          const storageLimitMB = this.gbToMB(version.storageLimitGB);
          const storageUsedText = this.formatStorage(0, storageLimitMB);

          const initialEmployeesCount =
            typeof data.employeesCount === 'number' && data.employeesCount > 0
              ? data.employeesCount
              : adminEmail
                ? 1
                : 0;
          const initialUsedSeats = initialEmployeesCount > 0 ? 1 : 0;

          createdSub = await tx.subscription.create({
            data: {
              company: data.company,
              companyId: createdCompany.id,
              plan: plan.name,
              cycle,
              start,
              expiry,
              amount,
              status: initialStatus,
              gst: data.gst || null,
              pan: data.pan || null,
              cin: data.cin || null,
              address: data.address || null,
              contact: data.contact || null,
              hrAdmin: data.hrAdmin || null,
              ownerName: data.ownerName || null,
              ownerEmail: data.ownerEmail || null,
              billing: data.billing || 'Active Subscription',
              storageUsed: storageUsedText,
              storageUsedMB: 0,
              storageLimitMB,
              employeesCount: initialEmployeesCount,
              purchasedSeats: version.employeeLimit,
              usedSeats: initialUsedSeats,
              logo: (data as any).logo || data.company.slice(0, 2).toUpperCase(),
            },
          });


          await tx.subscriptionEvent.create({
            data: {
              subscriptionId: createdSub.id,
              event: 'Created',
              toPlan: plan.name,
              toStatus: createdSub.status,
              performedBy: data.hrAdmin || 'SuperAdmin',
              note: `Company "${data.company}" provisioned with plan ${plan.name}`,
            },
          });

          // 3. Upsert CompanyPlanAssignment
          const todayStr = getBusinessDateString();
          await tx.companyPlanAssignment.upsert({
            where: { company: data.company },
            update: {
              planVersionId: version.id,
              assignedBy: data.hrAdmin || 'SuperAdmin',
              effectiveDate: todayStr,
              status: 'Active',
            },
            create: {
              company: data.company,
              planVersionId: version.id,
              assignedBy: data.hrAdmin || 'SuperAdmin',
              effectiveDate: todayStr,
              status: 'Active',
            },
          });

          // 4. Create invoice snapshot
          const randomSuffix = Math.floor(100 + Math.random() * 900);
          const invoiceId = `INV-NEW-${Date.now()}-${randomSuffix}`;
          await tx.invoice.create({
            data: {
              id: invoiceId,
              type: 'Invoice',
              company: data.company,
              date: start,
              amount,
              status: 'Paid',
              subscriptionId: createdSub.id,
              planName: plan.name,
              planVersion: version.version,
              seatCount: version.employeeLimit,
              storageGB: version.storageLimitGB,
              unitPrice: new Decimal(amount),
            },
          });

          // 5. Seed default Departments & Designations
          const defaultDepts = [
            { name: 'Human Resources', head: adminName },
            { name: 'Engineering', head: 'TBD' },
            { name: 'Finance', head: 'TBD' },
            { name: 'IT & Operations', head: 'TBD' },
            { name: 'Sales & Marketing', head: 'TBD' },
          ];
          for (const d of defaultDepts) {
            await tx.department.create({
              data: {
                name: d.name,
                head: d.head,
                subscriptionId: createdSub.id,
                companyId: createdCompany.id,
              },
            });
          }

          const defaultDesigs = [
            { name: 'HR Manager', band: 'M2' },
            { name: 'Software Engineer', band: 'IC3' },
            { name: 'Accountant', band: 'IC2' },
            { name: 'IT Specialist', band: 'IC2' },
            { name: 'Sales Executive', band: 'IC1' },
          ];
          for (const des of defaultDesigs) {
            await tx.designation.create({
              data: {
                name: des.name,
                band: des.band,
                subscriptionId: createdSub.id,
                companyId: createdCompany.id,
              },
            });
          }

          // 6. Seed default Roles & Permissions idempotently using RoleProvisioningService
          const defaultRolesMap = await this.roleProvisioningService.ensureDefaultRoles(
            createdCompany.id,
            tx,
          );
          Object.assign(companyRolesMap, defaultRolesMap);

          // 7. Seed default HR Admin user
          const existingUser = await tx.user.findUnique({
            where: { email: adminEmail },
          });

          let hrAdminUser: any = null;

          if (!existingUser) {
            const initials = adminName
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .substring(0, 2);

            hrAdminUser = await tx.user.create({
              data: {
                email: adminEmail,
                password: hashedPassword,
                name: adminName,
                role: 'HRAdmin',
                roleId: companyRolesMap['HRAdmin']?.id || null,
                initials,
                subscriptionId: createdSub.id,
                companyId: createdCompany.id,
              },
            });
          } else {
            hrAdminUser = await tx.user.update({
              where: { id: existingUser.id },
              data: {
                role: 'HRAdmin',
                roleId: companyRolesMap['HRAdmin']?.id || null,
                password: hashedPassword,
                subscriptionId: createdSub.id,
                companyId: createdCompany.id,
              },
            });
          }

          // Ensure corresponding linked Employee record exists for HRAdmin user
          if (hrAdminUser && tx.employee) {
            const initials = adminName
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .substring(0, 2);

            const existingEmployee = await tx.employee.findFirst({
              where: {
                userId: hrAdminUser.id,
              },
            });

            if (!existingEmployee) {
              const empId = `EMP-${crypto.randomUUID().substring(0, 8).toUpperCase()}`;
              await tx.employee.create({
                data: {
                  id: empId,
                  userId: hrAdminUser.id,
                  name: adminName,
                  email: adminEmail,
                  companyId: createdCompany.id,
                  subscriptionId: createdSub.id,
                  status: 'Active',
                  joined: new Date().toISOString().split('T')[0],
                  salary: 0,
                  avatar: initials,
                  departmentId: null,
                  designationId: null,
                  managerId: null,
                },
              });
            }
          }

          if (this.outboxPublisher) {
            await this.outboxPublisher.publishEmail(tx, {
              to: adminEmail,
              subject: `Welcome to HR NEXA — ${data.company}`,
              body: `Welcome ${adminName}! Your temp password is: ${tempPassword}`,
              companyId: createdCompany.id,
              actor: { id: existingUser?.id || 'system', role: 'HRAdmin' },
            });
          }
        },
        { maxWait: 15000, timeout: 45000 },
      );
    } catch (err: any) {
      if (
        err instanceof ConflictException ||
        err instanceof BadRequestException
      ) {
        throw err;
      }
      throw new BadRequestException(
        `Subscription onboarding transaction failed: ${err.message}`,
      );
    }

    // --- Out-of-Transaction Side Effects (Emails, Notifications, Audit Logs, Events) ---
    try {
      // Send welcome email with the exact same tempPassword generated prior to transaction
      const emailSent = await this.emailService.sendWelcomeEmail(
        adminEmail,
        adminName,
        data.company,
        tempPassword,
        true,
      );
      if (emailSent) {
        this.logger.log(
          `HR Admin welcome email successfully delivered via SMTP to ${adminEmail}`,
        );
      }
    } catch (err: any) {
      this.logger.error(`HR Admin welcome email error: ${err.message}`);
    }

    try {
      await this.companyNotificationsService.notifySuperAdmin({
        title: 'Company Created',
        message: `New tenant company "${data.company}" provisioned with plan ${plan.name}`,
        severity: 'success',
        category: 'company',
        company: data.company,
      });
    } catch (notifErr: any) {
      this.logger.error(`Company creation notification error: ${notifErr.message}`);
    }

    this.eventEmitter.emit(
      COMPANY_EVENTS.CREATED,
      new CompanyCreatedEvent(
        createdCompany.id,
        data.company,
        plan.name,
        createdSub.status,
        adminEmail,
      ),
    );
    this.eventEmitter.emit(
      COMPANY_EVENTS.SUBSCRIPTION_CREATED,
      new SubscriptionCreatedEvent(
        createdSub.id,
        createdCompany.id,
        plan.name,
        createdSub.status,
      ),
    );
    this.eventEmitter.emit(
      COMPANY_EVENTS.EMPLOYEE_COUNT_CHANGED,
      new EmployeeCountChangedEvent(
        createdCompany.id,
        'SubscriptionProvisioning',
      ),
    );


    if (this.auditLogger) {
      await this.auditLogger
        .logAction({
          companyId: createdCompany.id,
          action: 'Company Provisioned',
          newValue: {
            company: data.company,
            plan: plan.name,
            adminEmail,
          },
          details: `Provisioned new tenant company "${data.company}" with plan ${plan.name}`,
        })
        .catch(() => null);
    }

    return createdSub;
  }
}
