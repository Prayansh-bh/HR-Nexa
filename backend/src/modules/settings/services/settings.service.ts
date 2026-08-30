import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Optional,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CalendarReminderService } from '../../notifications/services/calendar-reminder.service';
import { createPaginatedResponse } from '../../../common/dto/paginated-response.dto';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly reminderService?: CalendarReminderService,
  ) {}

  async getCompany(companyId: string) {
    if (!companyId || companyId === 'PLATFORM') {
      throw new BadRequestException(
        'Tenant context (companyId) is required to access company settings. Please select or impersonate a tenant first.',
      );
    }

    let settings = await this.prisma.companySettings.findUnique({
      where: { companyId },
    });
    if (!settings) {
      settings = await this.prisma.companySettings.create({
        data: { companyId, legalName: '', email: '', phone: '', address: '' },
      });
    }
    return settings;
  }

  async updateCompany(companyId: string, id: string, version: number, data: any) {
    if (!companyId || companyId === 'PLATFORM') {
      throw new BadRequestException(
        'Tenant context (companyId) is required to update company settings. Please select or impersonate a tenant first.',
      );
    }

    const existing = await this.prisma.companySettings.findUnique({ where: { id } });
    if (!existing || existing.companyId !== companyId) {
      throw new NotFoundException(`Company settings with ID "${id}" not found`);
    }

    try {
      return await this.prisma.companySettings.update({
        where: {
          id_version: { id, version },
        },
        data: {
          legalName: data.legalName,
          email: data.email,
          phone: data.phone,
          address: data.address,
          version: { increment: 1 },
        },
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new ConflictException('Optimistic lock collision: The settings record was modified by another administrator.');
      }
      throw error;
    }
  }

  async getTiming(companyId: string) {
    if (!companyId || companyId === 'PLATFORM') {
      throw new BadRequestException(
        'Tenant context (companyId) is required to access office timing settings. Please select or impersonate a tenant first.',
      );
    }

    let timing = await this.prisma.officeTiming.findUnique({
      where: { companyId },
    });
    if (!timing) {
      timing = await this.prisma.officeTiming.create({
        data: { companyId, startTime: '09:00', endTime: '18:00', breakDuration: 60, lateThreshold: 15, weekOffs: ['Saturday', 'Sunday'] },
      });
    }
    return timing;
  }

  async updateTiming(companyId: string, id: string, version: number, data: any) {
    if (!companyId || companyId === 'PLATFORM') {
      throw new BadRequestException(
        'Tenant context (companyId) is required to update office timing settings. Please select or impersonate a tenant first.',
      );
    }

    const existing = await this.prisma.officeTiming.findUnique({ where: { id } });
    if (!existing || existing.companyId !== companyId) {
      throw new NotFoundException(`Office timing record with ID "${id}" not found`);
    }

    try {
      return await this.prisma.officeTiming.update({
        where: {
          id_version: { id, version },
        },
        data: {
          startTime: data.startTime,
          endTime: data.endTime,
          breakDuration: Number(data.breakDuration),
          lateThreshold: Number(data.lateThreshold),
          weekOffs: data.weekOffs,
          version: { increment: 1 },
        },
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new ConflictException('Optimistic lock collision: The office timing record was modified by another administrator.');
      }
      throw error;
    }
  }

  async getHolidays(companyId: string, options?: { page?: number; limit?: number }) {
    if (!companyId || companyId === 'PLATFORM') {
      throw new BadRequestException(
        'Tenant context (companyId) is required to access company holidays. Please select or impersonate a tenant first.',
      );
    }

    const where = { companyId };
    if (options?.page || options?.limit) {
      const page = options.page && options.page > 0 ? options.page : 1;
      const limit = options.limit && options.limit > 0 ? Math.min(options.limit, 100) : 50;
      const [total, data] = await Promise.all([
        this.prisma.holiday.count({ where }),
        this.prisma.holiday.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { date: 'asc' },
        }),
      ]);
      return createPaginatedResponse(data, total, page, limit);
    }

    return this.prisma.holiday.findMany({
      where,
      orderBy: { date: 'asc' },
    });
  }

  async addHoliday(companyId: string, data: any) {
    if (!companyId || companyId === 'PLATFORM') {
      throw new BadRequestException(
        'Tenant context (companyId) is required to add company holidays. Please select or impersonate a tenant first.',
      );
    }

    // Normalize date to midnight UTC
    const dateObj = new Date(data.date);
    dateObj.setUTCHours(0, 0, 0, 0);

    const holiday = await this.prisma.holiday.create({
      data: {
        companyId,
        date: dateObj,
        occasion: data.occasion,
        type: data.type,
      },
    });

    if (this.reminderService) {
      this.reminderService
        .sendHolidayImmediate(companyId, holiday)
        .catch((err) => {
          this.logger.warn(`Failed to dispatch immediate holiday notification: ${err.message}`);
        });
    }

    return holiday;
  }

  async deleteHoliday(companyId: string, id: string) {
    if (!companyId || companyId === 'PLATFORM') {
      throw new BadRequestException(
        'Tenant context (companyId) is required to delete company holidays. Please select or impersonate a tenant first.',
      );
    }

    const holiday = await this.prisma.holiday.findUnique({ where: { id } });
    if (!holiday || holiday.companyId !== companyId) {
      throw new NotFoundException(`Holiday record with ID "${id}" not found`);
    }
    return this.prisma.holiday.delete({ where: { id } });
  }
}
