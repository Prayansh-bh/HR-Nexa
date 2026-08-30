import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export type StatutoryRules = {
  pfRate: number;
  ptAmount: number;
  tdsRate: number;
  basicPercentage: number;
  hraPercentage: number;
};

@Injectable()
export class StatutoryRulesService {
  private readonly logger = new Logger(StatutoryRulesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getStatutoryRules(): Promise<StatutoryRules> {
    try {
      const [pfConfig, ptConfig, tdsConfig, basicConfig, hraConfig] =
        await Promise.all([
          this.prisma.systemConfig.findUnique({
            where: { key: 'payroll_statutory_pf_rate' },
          }),
          this.prisma.systemConfig.findUnique({
            where: { key: 'payroll_statutory_pt_amount' },
          }),
          this.prisma.systemConfig.findUnique({
            where: { key: 'payroll_statutory_tds_rate' },
          }),
          this.prisma.systemConfig.findUnique({
            where: { key: 'payroll_basic_percentage' },
          }),
          this.prisma.systemConfig.findUnique({
            where: { key: 'payroll_hra_percentage' },
          }),
        ]);

      let pfRate = 12.0; // Bootstrap default
      let ptAmount = 250.0; // Bootstrap default
      let tdsRate = 10.0; // Bootstrap default
      let basicPercentage = 50.0; // Bootstrap default
      let hraPercentage = 20.0; // Bootstrap default

      if (pfConfig) {
        pfRate = parseFloat(pfConfig.value);
      } else {
        this.logger.warn(
          `SystemConfig key 'payroll_statutory_pf_rate' not found. Falling back to bootstrap default: ${pfRate}% of Basic`,
        );
      }

      if (ptConfig) {
        ptAmount = parseFloat(ptConfig.value);
      } else {
        this.logger.warn(
          `SystemConfig key 'payroll_statutory_pt_amount' not found. Falling back to bootstrap default: ₹${ptAmount}`,
        );
      }

      if (tdsConfig) {
        tdsRate = parseFloat(tdsConfig.value);
      } else {
        this.logger.warn(
          `SystemConfig key 'payroll_statutory_tds_rate' not found. Falling back to bootstrap default: ${tdsRate}% of Basic`,
        );
      }

      if (basicConfig) {
        basicPercentage = parseFloat(basicConfig.value);
      } else {
        this.logger.warn(
          `SystemConfig key 'payroll_basic_percentage' not found. Falling back to bootstrap default: ${basicPercentage}% of Gross`,
        );
      }

      if (hraConfig) {
        hraPercentage = parseFloat(hraConfig.value);
      } else {
        this.logger.warn(
          `SystemConfig key 'payroll_hra_percentage' not found. Falling back to bootstrap default: ${hraPercentage}% of Gross`,
        );
      }

      return { pfRate, ptAmount, tdsRate, basicPercentage, hraPercentage };
    } catch (error) {
      this.logger.error(
        `Failed to retrieve statutory configurations: ${error.message}. Using bootstrap defaults.`,
      );
      return {
        pfRate: 12.0,
        ptAmount: 250.0,
        tdsRate: 10.0,
        basicPercentage: 50.0,
        hraPercentage: 20.0,
      };
    }
  }
}
