import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CalendarReminderService } from './calendar-reminder.service';

@Injectable()
export class CalendarReminderScheduler {
  private readonly logger = new Logger(CalendarReminderScheduler.name);

  constructor(private readonly reminderService: CalendarReminderService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleHourlyCalendarReminders() {
    try {
      this.logger.log('Executing hourly calendar and holiday reminder evaluation...');
      const result = await this.reminderService.processAllTenants();
      this.logger.log(
        `Calendar reminders finished: ${result.totalGenerated} created, ${result.totalSkipped} skipped across ${result.totalProcessed} tenants.`,
      );
    } catch (err: any) {
      this.logger.error(
        `Error executing calendar reminders scheduler: ${err.message}`,
        err.stack,
      );
    }
  }
}
