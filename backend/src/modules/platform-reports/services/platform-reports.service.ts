import { Injectable, Logger, BadRequestException, Optional } from '@nestjs/common';
import { PlatformReportsRepository } from '../repositories/platform-reports.repository';
import { AuditLogsRepository } from '../../system/repositories/audit-logs.repository';
import { PrismaService } from '../../../prisma/prisma.service';
import { OutboxPublisherService } from '../../../common/queue/outbox-publisher.service';
import { ReportQueryDto } from '../dto/report-query.dto';
import { convertToCSV } from '../utils/csv-exporter.util';
import { convertToHTMLReport } from '../utils/html-pdf-exporter.util';

export interface ReportTypeDefinition {
  id: string;
  title: string;
  category: string;
  description: string;
}

export const PLATFORM_REPORT_TYPES: ReportTypeDefinition[] = [
  {
    id: 'company',
    title: 'Company Report',
    category: 'Platform',
    description:
      'Overview of all onboarded SaaS companies, plan assignments, and statuses',
  },
  {
    id: 'subscription',
    title: 'Subscription Report',
    category: 'Platform',
    description:
      'Detailed breakdown of subscription plans, MRR/ARR, and renewal dates',
  },
  {
    id: 'employee',
    title: 'Employee Report',
    category: 'Headcount',
    description: 'Platform-wide employee directory across all tenant companies',
  },
  {
    id: 'hr_admin',
    title: 'HR Admin Report',
    category: 'Access',
    description: 'List of company HR Administrators and access metrics',
  },
  {
    id: 'revenue',
    title: 'Revenue Report',
    category: 'Financial',
    description: 'SaaS platform revenue metrics, payments, and billing logs',
  },
  {
    id: 'invoice',
    title: 'Invoice Report',
    category: 'Financial',
    description: 'Full history of platform subscription invoices',
  },
  {
    id: 'payroll',
    title: 'Payroll Summary',
    category: 'Financial',
    description: 'Platform-wide payroll payouts and net salary totals',
  },
  {
    id: 'attendance',
    title: 'Attendance Summary',
    category: 'Operations',
    description: 'Cross-company check-in records and verification logs',
  },
  {
    id: 'leave',
    title: 'Leave Summary',
    category: 'Operations',
    description: 'Cross-company leave requests, approvals, and pending counts',
  },
  {
    id: 'recruitment',
    title: 'Recruitment Summary',
    category: 'Hiring',
    description: 'Platform job requisitions and candidate hiring pipeline',
  },
  {
    id: 'storage',
    title: 'Storage Usage Report',
    category: 'Infrastructure',
    description: 'Storage quota allocations and usage per company',
  },
  {
    id: 'auth',
    title: 'Login & Authentication Report',
    category: 'Security',
    description: 'User account statuses, roles, and onboarding dates',
  },
  {
    id: 'audit_log',
    title: 'Audit Log Report',
    category: 'Security',
    description: 'System-wide compliance audit trail records',
  },
  {
    id: 'security',
    title: 'Security Events Report',
    category: 'Security',
    description: 'Security alerts and system security notifications',
  },
  {
    id: 'system_health',
    title: 'System Health Report',
    category: 'Infrastructure',
    description: 'Server metrics, database status, and subsystem health',
  },
];

@Injectable()
export class PlatformReportsService {
  private readonly logger = new Logger(PlatformReportsService.name);

  constructor(
    private readonly repo: PlatformReportsRepository,
    private readonly auditLogsRepo: AuditLogsRepository,
    private readonly prisma: PrismaService,
    @Optional() private readonly outboxPublisher?: OutboxPublisherService,
  ) {}

  getReportTypes(): ReportTypeDefinition[] {
    return PLATFORM_REPORT_TYPES;
  }

  async generateReport(
    query: ReportQueryDto,
    user: { id: string; name: string; role: string },
    ip?: string,
    userAgent?: string,
  ) {
    const data = await this.fetchRawData(query);

    const page = Number(query.page || 1);
    const limit = Number(query.limit || 50);
    const totalRecords = data.length;
    const startIndex = (page - 1) * limit;
    const pagedData = data.slice(startIndex, startIndex + limit);

    // Audit log & Outbox Event inside transaction
    await this.prisma.$transaction(async (tx) => {
      await this.logReportActivity(
        'GENERATED',
        query,
        totalRecords,
        user,
        ip,
        userAgent,
      );

      if (this.outboxPublisher) {
        await this.outboxPublisher.publishReport(tx, {
          reportType: query.reportType,
          parameters: { company: query.company, search: query.search },
          companyId: 'PLATFORM',
          actor: { id: user.id, role: user.role || 'SuperAdmin' },
        });
      }
    });

    return {
      metadata: {
        reportType: query.reportType,
        generatedAt: new Date().toISOString(),
        generatedBy: `${user.name} (${user.role})`,
        appliedFilters: {
          company: query.company || 'All Companies',
          search: query.search || 'None',
          startDate: query.startDate || 'All Time',
          endDate: query.endDate || 'All Time',
        },
        totalRecords,
        page,
        limit,
        totalPages: Math.ceil(totalRecords / limit) || 1,
      },
      data: pagedData,
    };
  }

  async exportReport(
    query: ReportQueryDto,
    user: { id: string; name: string; role: string },
    ip?: string,
    userAgent?: string,
  ) {
    const rawData = await this.fetchRawData(query);
    const data = rawData.slice(0, 1000);
    const format = (query.format || 'csv').toLowerCase();
    const reportDef = PLATFORM_REPORT_TYPES.find(
      (r) => r.id === query.reportType,
    );
    const title = reportDef ? reportDef.title : query.reportType.toUpperCase();
    const timestampStr = new Date().toISOString().slice(0, 10);
    const cleanName = title.toLowerCase().replace(/[^a-z0-9]/g, '_');

    await this.logReportActivity(
      `EXPORTED_${format.toUpperCase()}`,
      query,
      data.length,
      user,
      ip,
      userAgent,
    );

    if (format === 'csv') {
      const csvStr = convertToCSV(data);
      return {
        buffer: Buffer.from('\uFEFF' + csvStr, 'utf-8'), // UTF-8 BOM for Excel compatibility
        fileName: `${cleanName}_${timestampStr}.csv`,
        contentType: 'text/csv; charset=utf-8',
      };
    }

    if (format === 'excel' || format === 'xlsx') {
      const csvStr = convertToCSV(data);
      return {
        buffer: Buffer.from('\uFEFF' + csvStr, 'utf-8'),
        fileName: `${cleanName}_${timestampStr}.csv`,
        contentType: 'text/csv; charset=utf-8',
      };
    }

    if (format === 'pdf' || format === 'html') {
      const htmlStr = convertToHTMLReport(title, data);
      return {
        buffer: Buffer.from(htmlStr, 'utf-8'),
        fileName: `${cleanName}_${timestampStr}.html`,
        contentType: 'text/html; charset=utf-8',
      };
    }

    throw new BadRequestException(`Unsupported export format: ${format}`);
  }

  private async fetchRawData(query: ReportQueryDto): Promise<any[]> {
    switch (query.reportType) {
      case 'company':
        return this.repo.getCompanyReport(query);
      case 'subscription':
        return this.repo.getSubscriptionReport(query);
      case 'employee':
        return this.repo.getEmployeeReport(query);
      case 'hr_admin':
        return this.repo.getHrAdminReport(query);
      case 'revenue':
        return this.repo.getRevenueReport(query);
      case 'invoice':
        return this.repo.getInvoiceReport(query);
      case 'payroll':
        return this.repo.getPayrollSummary(query);
      case 'attendance':
        return this.repo.getAttendanceSummary(query);
      case 'leave':
        return this.repo.getLeaveSummary(query);
      case 'recruitment':
        return this.repo.getRecruitmentSummary();
      case 'storage':
        return this.repo.getStorageUsageReport();
      case 'auth':
        return this.repo.getAuthReport();
      case 'audit_log':
        return this.repo.getAuditLogReport();
      case 'security':
        return this.repo.getSecurityReport();
      case 'system_health':
        return this.repo.getSystemHealthReport();
      default:
        throw new BadRequestException(
          `Unknown or unsupported report type: "${query.reportType}"`,
        );
    }
  }

  private async logReportActivity(
    actionType: string,
    query: ReportQueryDto,
    recordCount: number,
    user: { id: string; name: string; role: string },
    ip?: string,
    userAgent?: string,
  ) {
    try {
      const clientIp = ip || '127.0.0.1';
      const browser = userAgent || 'Unknown Browser';
      const details = `[PLATFORM_REPORT_${actionType}] Type="${query.reportType}", Records=${recordCount}, Format="${query.format || 'json'}", User=${user.name} (${user.role}), IP=${clientIp}, Agent=${browser}`;

      await this.auditLogsRepo.create({
        userId: user.id,
        userName: user.name,
        actorId: user.id || 'system',
        actorRole: user.role || 'SuperAdmin',
        entityType: 'COMPANY_SETTINGS',
        action: 'SETTINGS_UPDATED',
        details,
        companyId: 'PLATFORM',
      });
    } catch (err: any) {
      this.logger.warn(`Failed to audit log report activity: ${err.message}`);
    }
  }
}
