import { Injectable } from '@nestjs/common';
import { ChecklistStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ExitChecklistService {
  constructor(private readonly prisma: PrismaService) {}

  async generateFromTemplates(
    exitId: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx || this.prisma;

    const templates = await client.exitChecklistTemplate.findMany({
      where: { companyId },
      orderBy: { displayOrder: 'asc' },
    });

    if (templates.length === 0) {
      await this.seedDefaults(companyId, client);
      return this.generateFromTemplates(exitId, companyId, client);
    }

    const itemsToCreate = templates.map((t) => ({
      exitId,
      task: t.task,
      department: t.department,
      status: ChecklistStatus.PENDING,
    }));

    await client.exitChecklistItem.createMany({ data: itemsToCreate });
  }

  async completeItem(
    itemId: string,
    userId: string,
    remarks?: string,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx || this.prisma;
    return client.exitChecklistItem.update({
      where: { id: itemId },
      data: {
        status: ChecklistStatus.COMPLETED,
        completedById: userId,
        completedAt: new Date(),
        remarks,
      },
    });
  }

  private async seedDefaults(companyId: string, tx?: Prisma.TransactionClient) {
    const client = tx || this.prisma;
    await client.exitChecklistTemplate.createMany({
      data: [
        {
          companyId,
          department: 'IT',
          task: 'Return Laptop',
          mandatory: true,
          displayOrder: 1,
        },
        {
          companyId,
          department: 'IT',
          task: 'Revoke Email Access',
          mandatory: true,
          displayOrder: 2,
        },
        {
          companyId,
          department: 'ADMIN',
          task: 'Return ID Card',
          mandatory: true,
          displayOrder: 3,
        },
        {
          companyId,
          department: 'FINANCE',
          task: 'Clear Pending Dues',
          mandatory: true,
          displayOrder: 4,
        },
        {
          companyId,
          department: 'MANAGER',
          task: 'Knowledge Transfer',
          mandatory: true,
          displayOrder: 5,
        },
      ],
    });
  }
}
