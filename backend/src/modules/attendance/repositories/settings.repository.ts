import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export const DEFAULT_ATTENDANCE_SETTING = {
  id: 'default',
  companyId: null,
  gracePeriod: 15,
  halfDayThreshold: 240,
  otMultiplier: 1.5,
  enableRegularization: true,
  selfRegularization: false,
  shiftName: 'General',
  shiftStart: '09:00',
  shiftEnd: '18:00',
  weekOffs: 'Saturday,Sunday',
  enableGeofencing: false,
  geofenceOnClockOut: false,
};

@Injectable()
export class AttendanceSettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get model(): any {
    return (this.prisma as any).attendanceSetting;
  }

  async get(companyId?: string | null) {
    if (!companyId || companyId === 'PLATFORM') {
      return { ...DEFAULT_ATTENDANCE_SETTING };
    }

    const setting = await this.model.findFirst({
      where: { companyId },
    });

    if (setting) {
      return setting;
    }

    try {
      return await this.model.create({
        data: { companyId },
      });
    } catch {
      const raceExisting = await this.model.findFirst({
        where: { companyId },
      });
      return raceExisting || { ...DEFAULT_ATTENDANCE_SETTING, companyId };
    }
  }

  async update(
    companyIdOrData: any,
    maybeData?: {
      gracePeriod?: number;
      halfDayThreshold?: number;
      otMultiplier?: number;
      enableRegularization?: boolean;
      selfRegularization?: boolean;
      shiftName?: string;
      shiftStart?: string;
      shiftEnd?: string;
      weekOffs?: string;
      enableGeofencing?: boolean;
      geofenceOnClockOut?: boolean;
    },
  ) {
    let companyId: string | null | undefined = undefined;
    let data: any = companyIdOrData;

    if (typeof companyIdOrData === 'string' || companyIdOrData === null) {
      companyId = companyIdOrData;
      data = maybeData || {};
    }

    if (!companyId || companyId === 'PLATFORM') {
      // Missing companyId must never mutate another tenant's row
      return { ...DEFAULT_ATTENDANCE_SETTING, ...data };
    }

    const existing = await this.model.findFirst({
      where: { companyId },
    });

    if (existing) {
      return this.model.update({
        where: { id: existing.id },
        data,
      });
    }

    return this.model.create({
      data: {
        companyId,
        ...data,
      },
    });
  }
}
