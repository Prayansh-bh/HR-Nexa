import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class EmployeeDepartmentSyncService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Update the head name of any departments that match the old employee name.
   */
  async syncDepartmentHeadName(
    oldName: string,
    newName: string,
  ): Promise<void> {
    if (!oldName || !newName || oldName === newName) {
      return;
    }

    await this.prisma.department.updateMany({
      where: { head: oldName },
      data: { head: newName },
    });
  }
}
