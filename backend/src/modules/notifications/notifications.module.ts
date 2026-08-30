import { Module } from '@nestjs/common';
import { NotificationsService } from './services/notifications.service';
import { NotificationsRepository } from './repositories/notifications.repository';
import { CalendarReminderService } from './services/calendar-reminder.service';
import { CalendarReminderScheduler } from './services/calendar-reminder.scheduler';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [
    NotificationsService,
    NotificationsRepository,
    CalendarReminderService,
    CalendarReminderScheduler,
  ],
  exports: [
    NotificationsService,
    NotificationsRepository,
    CalendarReminderService,
    CalendarReminderScheduler,
  ],
})
export class NotificationsModule {}

