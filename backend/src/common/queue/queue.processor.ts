import { Injectable, Logger } from '@nestjs/common';
import { QueueService } from './queue.service';

@Injectable()
export class QueueProcessor {
  private readonly logger = new Logger(QueueProcessor.name);

  constructor(private readonly queueService: QueueService) {}

  processPayrollQueue(
    payload: Parameters<QueueService['addPayrollJob']>[0],
  ): void {
    this.logger.log(`Processing Payroll Queue task for ${payload.employeeId}`);
    this.queueService.addPayrollJob(payload);
  }

  processEmailQueue(payload: Parameters<QueueService['addEmailJob']>[0]): void {
    this.logger.log(`Processing Email Queue task for ${payload.to}`);
    this.queueService.addEmailJob(payload);
  }

  processNotificationQueue(
    payload: Parameters<QueueService['addNotificationJob']>[0],
  ): void {
    this.logger.log(`Processing Notification Queue task for ${payload.title}`);
    this.queueService.addNotificationJob(payload);
  }

  processReportQueue(
    payload: Parameters<QueueService['addReportJob']>[0],
  ): void {
    this.logger.log(`Processing Report Queue task for ${payload.reportType}`);
    this.queueService.addReportJob(payload);
  }

  processAttendanceSyncQueue(
    payload: Parameters<QueueService['addAttendanceSyncJob']>[0],
  ): void {
    this.logger.log(
      `Processing Attendance Sync Queue task for ${payload.date}`,
    );
    this.queueService.addAttendanceSyncJob(payload);
  }
}
