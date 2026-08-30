import { Injectable, Optional } from '@nestjs/common';
import {
  Prisma,
  SettlementPaymentStatus,
  ExitStage,
  ExitStatus,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { SeatLimitService } from '../../subscriptions/services/seat-limit.service';

@Injectable()
export class ExitSettlementService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly seatLimitService?: SeatLimitService,
  ) {}

  async generateSettlement(
    exitId: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx || this.prisma;
    const exit = await client.exit.findFirst({
      where: { id: exitId, companyId },
      include: { employee: true },
    });

    if (!exit)
      throw new Error('Exit not found or does not belong to your company');

    // Financial precision calculations using Prisma.Decimal
    const salary = exit.employee.salary || 0;
    const grossAmount = new Prisma.Decimal(salary);
    const deductions = new Prisma.Decimal(0);
    const leaveEncashment = new Prisma.Decimal(0);
    const bonus = new Prisma.Decimal(0);
    const recoveries = new Prisma.Decimal(0);

    // grossAmount + leaveEncashment + bonus - deductions - recoveries
    const netPayable = grossAmount
      .plus(leaveEncashment)
      .plus(bonus)
      .minus(deductions)
      .minus(recoveries);

    const settlement = await client.exitSettlement.upsert({
      where: { exitId },
      create: {
        exitId,
        grossAmount,
        deductions,
        leaveEncashment,
        bonus,
        recoveries,
        netPayable,
        paymentStatus: SettlementPaymentStatus.PENDING,
      },
      update: {
        grossAmount,
        deductions,
        leaveEncashment,
        bonus,
        recoveries,
        netPayable,
      },
    });

    // P8-04 Remediation: Advance Exit to COMPLETED stage & COMPLETED status
    await client.exit.update({
      where: { id: exitId },
      data: {
        stage: ExitStage.COMPLETED,
        status: ExitStatus.COMPLETED,
      },
    });

    // P8-04 Remediation: Transition Employee status to 'Inactive' (canonical termination status) and release seat
    if (exit.employeeId && exit.employee.status !== 'Inactive') {
      await client.employee.update({
        where: { id: exit.employeeId },
        data: { status: 'Inactive' },
      });

      // Synchronize subscription seat counters to release the seat
      if (exit.employee.subscriptionId && this.seatLimitService) {
        await this.seatLimitService.syncEmployeeCounts(
          exit.employee.subscriptionId,
        );
      }
    }

    return settlement;
  }
}
