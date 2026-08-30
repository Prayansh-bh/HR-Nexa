import { Injectable } from '@nestjs/common';
import {
  ExitAction,
  ExitApproverRole,
  ExitStage,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ExitTimelineService {
  constructor(private readonly prisma: PrismaService) {}

  async logAction(
    data: {
      exitId: string;
      action: ExitAction;
      oldStage?: ExitStage;
      newStage?: ExitStage;
      description: string;
      userId: string;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx || this.prisma;
    return client.exitTimeline.create({
      data: {
        ...data,
      },
    });
  }

  async recordApproval(
    data: {
      exitId: string;
      approverId: string;
      role: ExitApproverRole;
      action: ExitAction;
      remarks?: string;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx || this.prisma;
    return client.exitApproval.create({
      data: {
        ...data,
      },
    });
  }
}
