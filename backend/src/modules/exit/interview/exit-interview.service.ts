import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ExitInterviewService {
  constructor(private readonly prisma: PrismaService) {}

  async submitInterview(
    exitId: string,
    data: any,
    interviewerId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx || this.prisma;
    return client.exitInterview.upsert({
      where: { exitId },
      create: {
        exitId,
        interviewerId,
        ...data,
      },
      update: {
        interviewerId,
        ...data,
      },
    });
  }
}
