import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { parsePayrollMonth } from '../../../common/utils/date.util';

export type LopDivisorMode = 'CALENDAR_DAYS' | 'FIXED_26' | 'WORKING_DAYS';

export interface LopPolicyResult {
  mode: LopDivisorMode;
  divisor: number;
}

@Injectable()
export class LopPolicyService {
  private readonly logger = new Logger(LopPolicyService.name);

  constructor(private readonly prisma: PrismaService) {}

  async resolvePolicy(
    companyId: string | null | undefined,
    month: string,
    attendanceSummary?: { workingDays: number },
  ): Promise<LopPolicyResult> {
    let mode: LopDivisorMode = 'CALENDAR_DAYS';

    const normalizedCompanyId = companyId && companyId !== 'PLATFORM' ? companyId : null;
    const configKey = normalizedCompanyId
      ? `payroll_lop_divisor_mode_${normalizedCompanyId}`
      : `payroll_lop_divisor_mode`;

    const config = await this.prisma.systemConfig.findUnique({
      where: { key: configKey },
    });

    if (config && config.value) {
      const rawMode = config.value.trim().toUpperCase();
      if (rawMode === 'CALENDAR_DAYS' || rawMode === 'FIXED_26' || rawMode === 'WORKING_DAYS') {
        mode = rawMode as LopDivisorMode;
      } else {
        throw new BadRequestException(
          `Invalid LOP divisor mode configuration "${config.value}". Allowed modes: CALENDAR_DAYS, FIXED_26, WORKING_DAYS.`,
        );
      }
    }

    let divisor: number;

    if (mode === 'FIXED_26') {
      divisor = 26;
    } else if (mode === 'WORKING_DAYS') {
      const workingDays = attendanceSummary?.workingDays ?? 0;
      if (!isFinite(workingDays) || workingDays <= 0) {
        throw new BadRequestException(
          `Cannot calculate payroll using WORKING_DAYS mode when working days (${workingDays}) is invalid or non-positive.`,
        );
      }
      divisor = workingDays;
    } else {
      // CALENDAR_DAYS mode using authoritative parsePayrollMonth utility
      const parsedMonth = parsePayrollMonth(month);
      divisor = parsedMonth.daysInMonth;
    }

    if (!isFinite(divisor) || divisor <= 0) {
      throw new BadRequestException(`Calculated LOP divisor (${divisor}) is invalid or non-positive.`);
    }

    return { mode, divisor };
  }
}
