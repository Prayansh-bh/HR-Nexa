import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  resolveIanaTimezone,
  getBusinessDateString,
  getBusinessTimeString,
} from '../../../common/utils/date.util';

export interface ReminderProcessingResult {
  generatedCount: number;
  skippedCount: number;
}

@Injectable()
export class CalendarReminderService {
  private readonly logger = new Logger(CalendarReminderService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Dispatches an immediate notification when a new Holiday is declared by HR Admin.
   * Safe and idempotent: won't throw or duplicate if dedupKey already exists.
   */
  async sendHolidayImmediate(
    companyId: string,
    holiday: { id: string; occasion: string; date: Date | string },
  ): Promise<any> {
    if (!companyId || !holiday || !holiday.id) return null;

    try {
      const company = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: { id: true, name: true },
      });
      const companyName = company?.name || companyId;
      const dateStr =
        holiday.date instanceof Date
          ? holiday.date.toISOString().slice(0, 10)
          : String(holiday.date).slice(0, 10);

      const dedupKey = `HOLIDAY:${holiday.id}:IMMEDIATE`;

      return await this.createSystemNotificationSafe({
        title: `New Holiday Declared: ${holiday.occasion}`,
        message: `Official company holiday declared for ${holiday.occasion} on ${dateStr}. Office will remain closed.`,
        severity: 'info',
        category: 'holiday',
        targetRole: 'ALL',
        company: companyName,
        companyId,
        reason: 'Company Holiday Declared',
        recommendedAction: 'View Leave Calendar',
        linkUrl: 'leave.calendar',
        dedupKey,
      });
    } catch (err: any) {
      this.logger.error(
        `Failed to send immediate holiday notification for ${holiday.id}: ${err.message}`,
        err.stack,
      );
      return null;
    }
  }

  /**
   * Dispatches an immediate notification when a new CalendarEvent (Meeting or Event) is created.
   */
  async sendEventImmediate(
    companyId: string | null | undefined,
    event: { id: string; title: string; date: string; type: string },
  ): Promise<any> {
    if (!event || !event.id) return null;

    try {
      let companyName = 'Company';
      if (companyId) {
        const company = await this.prisma.company.findUnique({
          where: { id: companyId },
          select: { id: true, name: true },
        });
        if (company?.name) companyName = company.name;
      }

      const typeLabel =
        (event.type || '').toLowerCase() === 'meeting' ? 'Meeting' : 'Company Event';
      const dedupKey = `EVENT:${event.id}:IMMEDIATE`;

      return await this.createSystemNotificationSafe({
        title: `New ${typeLabel}: ${event.title}`,
        message: `${typeLabel} scheduled on ${event.date}: ${event.title}.`,
        severity: 'info',
        category: 'calendar',
        targetRole: 'ALL',
        company: companyName,
        companyId: companyId || undefined,
        reason: `${typeLabel} Scheduled`,
        recommendedAction: 'View Leave Calendar',
        linkUrl: 'leave.calendar',
        dedupKey,
      });
    } catch (err: any) {
      this.logger.error(
        `Failed to send immediate event notification for ${event.id}: ${err.message}`,
        err.stack,
      );
      return null;
    }
  }

  /**
   * Evaluates due T-1 and T-0 reminders for a specific tenant based on tenant local time.
   * Reminders are triggered when the tenant local clock is >= 08:00 AM.
   */
  async processDueRemindersForTenant(
    tenantId: string,
    timezoneStr?: string,
    referenceDate: Date = new Date(),
  ): Promise<ReminderProcessingResult> {
    const tz = resolveIanaTimezone(timezoneStr);
    const currentDateStr = getBusinessDateString(referenceDate, tz);
    const currentTimeStr = getBusinessTimeString(referenceDate, tz);

    const [hourStr, minuteStr] = currentTimeStr.split(':');
    const currentMinutes = parseInt(hourStr, 10) * 60 + parseInt(minuteStr, 10);
    const REMINDER_THRESHOLD_MINUTES = 8 * 60; // 08:00 AM (480 minutes)

    // Only process T-1 and T-0 morning reminders once local time reaches 08:00 AM
    if (currentMinutes < REMINDER_THRESHOLD_MINUTES) {
      return { generatedCount: 0, skippedCount: 0 };
    }

    // Tomorrow's date in tenant timezone
    const tomorrowRef = new Date(referenceDate);
    tomorrowRef.setDate(tomorrowRef.getDate() + 1);
    const tomorrowDateStr = getBusinessDateString(tomorrowRef, tz);

    let generatedCount = 0;
    let skippedCount = 0;

    const company = await this.prisma.company.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true },
    });
    const companyName = company?.name || tenantId;

    // 1. Process Holidays (T-1 for tomorrow, T-0 for today)
    const holidays = await this.prisma.holiday.findMany({
      where: {
        companyId: tenantId,
      },
    });

    for (const h of holidays) {
      const hDateStr =
        h.date instanceof Date
          ? h.date.toISOString().slice(0, 10)
          : String(h.date).slice(0, 10);

      // T-1 Reminder (Tomorrow is Holiday)
      if (hDateStr === tomorrowDateStr) {
        const dedupKey = `HOLIDAY:${h.id}:T_MINUS_1`;
        const res = await this.createSystemNotificationSafe({
          title: `Holiday Tomorrow: ${h.occasion}`,
          message: `Reminder: Tomorrow (${tomorrowDateStr}) is an official company holiday for ${h.occasion}.`,
          severity: 'info',
          category: 'holiday',
          targetRole: 'ALL',
          company: companyName,
          companyId: tenantId,
          reason: 'Upcoming Holiday Reminder (T-1)',
          recommendedAction: 'View Leave Calendar',
          linkUrl: 'leave.calendar',
          dedupKey,
        });
        if (res) generatedCount++;
        else skippedCount++;
      }

      // T-0 Reminder (Today is Holiday)
      if (hDateStr === currentDateStr) {
        const dedupKey = `HOLIDAY:${h.id}:T_MINUS_0`;
        const res = await this.createSystemNotificationSafe({
          title: `Holiday Today: ${h.occasion}`,
          message: `Reminder: Today is a company holiday for ${h.occasion}. Enjoy the day!`,
          severity: 'info',
          category: 'holiday',
          targetRole: 'ALL',
          company: companyName,
          companyId: tenantId,
          reason: 'Holiday Today Reminder (T-0)',
          recommendedAction: 'View Leave Calendar',
          linkUrl: 'leave.calendar',
          dedupKey,
        });
        if (res) generatedCount++;
        else skippedCount++;
      }
    }

    // 2. Process Calendar Events (T-1 for tomorrow, T-0 for today)
    const calendarEvents = await this.prisma.calendarEvent.findMany({
      where: {
        OR: [{ companyId: tenantId }, { companyId: null }],
        date: { in: [currentDateStr, tomorrowDateStr] },
      },
    });

    for (const e of calendarEvents) {
      const typeLabel =
        (e.type || '').toLowerCase() === 'meeting' ? 'Meeting' : 'Event';

      // T-1 Reminder (Tomorrow is Event/Meeting)
      if (e.date === tomorrowDateStr) {
        const dedupKey = `EVENT:${e.id}:T_MINUS_1`;
        const res = await this.createSystemNotificationSafe({
          title: `${typeLabel} Tomorrow: ${e.title}`,
          message: `Reminder: ${typeLabel} "${e.title}" is scheduled for tomorrow (${tomorrowDateStr}).`,
          severity: 'info',
          category: 'calendar',
          targetRole: 'ALL',
          company: companyName,
          companyId: tenantId,
          reason: `Upcoming ${typeLabel} Reminder (T-1)`,
          recommendedAction: 'View Leave Calendar',
          linkUrl: 'leave.calendar',
          dedupKey,
        });
        if (res) generatedCount++;
        else skippedCount++;
      }

      // T-0 Reminder (Today is Event/Meeting)
      if (e.date === currentDateStr) {
        const dedupKey = `EVENT:${e.id}:T_MINUS_0`;
        const res = await this.createSystemNotificationSafe({
          title: `${typeLabel} Today: ${e.title}`,
          message: `Reminder: ${typeLabel} "${e.title}" is scheduled for today.`,
          severity: 'info',
          category: 'calendar',
          targetRole: 'ALL',
          company: companyName,
          companyId: tenantId,
          reason: `${typeLabel} Today Reminder (T-0)`,
          recommendedAction: 'View Leave Calendar',
          linkUrl: 'leave.calendar',
          dedupKey,
        });
        if (res) generatedCount++;
        else skippedCount++;
      }
    }

    return { generatedCount, skippedCount };
  }

  /**
   * Processes all active tenants across the system, resolving each tenant's configured timezone.
   */
  async processAllTenants(
    referenceDate: Date = new Date(),
  ): Promise<{ totalProcessed: number; totalGenerated: number; totalSkipped: number }> {
    const companies = await this.prisma.company.findMany({
      select: { id: true, name: true },
    });

    let totalGenerated = 0;
    let totalSkipped = 0;

    for (const company of companies) {
      try {
        // Resolve tenant timezone configuration if present
        const tzConfigKey = `payroll_settings_${company.id}`;
        const config = await this.prisma.systemConfig.findUnique({
          where: { key: tzConfigKey },
        });

        let tenantTz = 'Asia/Kolkata';
        if (config && config.value) {
          try {
            const parsed = JSON.parse(config.value);
            if (parsed.timeZone) tenantTz = parsed.timeZone;
          } catch {
            tenantTz = config.value;
          }
        }

        const result = await this.processDueRemindersForTenant(
          company.id,
          tenantTz,
          referenceDate,
        );
        totalGenerated += result.generatedCount;
        totalSkipped += result.skippedCount;
      } catch (err: any) {
        this.logger.error(
          `Error processing calendar reminders for tenant ${company.id}: ${err.message}`,
          err.stack,
        );
      }
    }

    return {
      totalProcessed: companies.length,
      totalGenerated,
      totalSkipped,
    };
  }

  /**
   * Atomically creates a SystemNotification with database-enforced idempotency.
   * If a record with the same dedupKey already exists (P2002), returns null cleanly as a no-op.
   */
  private async createSystemNotificationSafe(data: {
    title: string;
    message: string;
    severity: string;
    category: string;
    targetRole: string;
    company: string;
    companyId?: string;
    reason: string;
    recommendedAction: string;
    linkUrl: string;
    dedupKey: string;
  }): Promise<any> {
    try {
      return await (this.prisma as any).systemNotification.create({
        data: {
          title: data.title,
          message: data.message,
          severity: data.severity,
          category: data.category,
          targetRole: data.targetRole,
          recipientId: null,
          company: data.company,
          reason: data.reason,
          recommendedAction: data.recommendedAction,
          linkUrl: data.linkUrl,
          dedupKey: data.dedupKey,
          read: false,
          readBy: '[]',
          timestamp: new Date(),
        },
      });
    } catch (err: any) {
      // Prisma P2002: Unique constraint failed (idempotent duplicate)
      if (err.code === 'P2002' || err.message?.includes('Unique constraint')) {
        this.logger.debug(
          `Idempotent duplicate ignored for dedupKey: ${data.dedupKey}`,
        );
        return null;
      }
      this.logger.warn(
        `Failed to create notification for dedupKey ${data.dedupKey}: ${err.message}`,
      );
      return null;
    }
  }
}
