import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { TenantScope } from '../../../common/tenant/tenant-scope.interface';

@Injectable()
export class EventsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(scope: TenantScope) {
    const where = scope.isPlatformBypass
      ? {}
      : { OR: [{ companyId: scope.companyId }, { companyId: null }] };

    return this.prisma.calendarEvent.findMany({
      where,
      orderBy: { date: 'asc' },
    });
  }

  async create(data: { title: string; date: string; type: string; companyId?: string }) {
    return this.prisma.calendarEvent.create({
      data,
    });
  }

  async deleteOne(id: string, scope: TenantScope) {
    const event = await this.prisma.calendarEvent.findUnique({ where: { id } });
    if (!event) return null;

    if (!scope.isPlatformBypass) {
      if (event.companyId !== scope.companyId) {
        return null;
      }
    }
    return this.prisma.calendarEvent.delete({ where: { id } });
  }
}
