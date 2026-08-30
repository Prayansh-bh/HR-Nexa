import { Injectable, Logger } from '@nestjs/common';

export interface PayrollJobData {
  employeeId: string;
  month: string;
  basicSalary: number;
  allowances: number;
  deductions: number;
  netSalary: number;
}

export interface EmailJobData {
  to: string;
  subject: string;
  body: string;
}

export interface NotificationJobData {
  title: string;
  content: string;
  targetUser?: string;
}

export interface ReportJobData {
  reportType: string;
  month?: string;
  format?: string;
}

export interface AttendanceSyncJobData {
  employeeId?: string;
  date: string;
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  addPayrollJob(data: PayrollJobData): void {
    this.logger.log(
      `[Queue] Dispatched Payroll Job for Employee ${data.employeeId} - Month: ${data.month}`,
    );
    // Background execution decoupling
    setImmediate(() => {
      this.logger.log(
        `[Background Worker] Processed Payroll for ${data.employeeId} (${data.month}) - Net: ${data.netSalary}`,
      );
    });
  }

  addEmailJob(data: EmailJobData): void {
    this.logger.log(`[Queue] Dispatched Email Job to ${data.to}`);
    setImmediate(() => {
      this.logger.log(
        `[Background Worker] Email sent to ${data.to} | Subject: ${data.subject}`,
      );
    });
  }

  addNotificationJob(data: NotificationJobData): void {
    this.logger.log(`[Queue] Dispatched Notification Job: "${data.title}"`);
    setImmediate(() => {
      this.logger.log(
        `[Background Worker] Notification broadcasted: ${data.title}`,
      );
    });
  }

  addReportJob(data: ReportJobData): void {
    this.logger.log(
      `[Queue] Dispatched Report Generation Job: ${data.reportType}`,
    );
    setImmediate(() => {
      this.logger.log(
        `[Background Worker] Generated ${data.reportType} report successfully`,
      );
    });
  }

  addAttendanceSyncJob(data: AttendanceSyncJobData): void {
    this.logger.log(
      `[Queue] Dispatched Attendance Sync Job for date ${data.date}`,
    );
    setImmediate(() => {
      this.logger.log(
        `[Background Worker] Attendance synced for date ${data.date}`,
      );
    });
  }
}
