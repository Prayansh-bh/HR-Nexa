import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { SupportTicket, Prisma } from '@prisma/client';
import {
  PaginatedResponse,
  createPaginatedResponse,
} from '../../../common/dto/paginated-response.dto';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(id: string | null | undefined): boolean {
  return typeof id === 'string' && UUID_REGEX.test(id.trim());
}

@Injectable()
export class TicketsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    companyId?: string | null,
    options?: { page?: number; limit?: number; isDemo?: boolean },
  ): Promise<PaginatedResponse<SupportTicket> | SupportTicket[]> {
    const where: any = { deletedAt: null };
    if (options?.isDemo !== undefined) {
      where.companyRelation = { isDemo: options.isDemo };
    }
    if (companyId) {
      if (isValidUuid(companyId)) {
        const companyRecord = await this.prisma.company.findUnique({ where: { id: companyId } });
        const companyName = companyRecord?.name;
        where.AND = [
          { deletedAt: null },
          {
            OR: [
              { companyId },
              { company: companyId },
              ...(companyName ? [{ company: companyName }] : []),
            ],
          },
        ];
        delete where.company;
      } else {
        where.OR = [{ companyId }, { company: companyId }];
        delete where.company;
      }
    }

    if (options?.page || options?.limit) {
      const page = options.page && options.page > 0 ? options.page : 1;
      const limit = options.limit && options.limit > 0 ? Math.min(options.limit, 100) : 50;
      const [total, data] = await Promise.all([
        this.prisma.supportTicket.count({ where }),
        this.prisma.supportTicket.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
      ]);
      return createPaginatedResponse(data, total, page, limit);
    }

    return this.prisma.supportTicket.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async countStats(options?: {
    isDemo?: boolean;
  }): Promise<{ openTickets: number; criticalTickets: number }> {
    const baseWhere: Prisma.SupportTicketWhereInput = {
      deletedAt: null,
      status: { notIn: ['Resolved', 'Closed'] },
    };
    if (options?.isDemo !== undefined) {
      baseWhere.companyRelation = { isDemo: options.isDemo };
    }

    const [openTickets, criticalTickets] = await Promise.all([
      this.prisma.supportTicket.count({
        where: baseWhere,
      }),
      this.prisma.supportTicket.count({
        where: {
          ...baseWhere,
          priority: { equals: 'High', mode: 'insensitive' },
        },
      }),
    ]);

    return { openTickets, criticalTickets };
  }

  async findById(id: string, companyId?: string | null): Promise<SupportTicket | null> {
    const where: any = { id, deletedAt: null };
    if (companyId) {
      if (isValidUuid(companyId)) {
        const companyRecord = await this.prisma.company.findUnique({ where: { id: companyId } });
        const companyName = companyRecord?.name;
        where.AND = [
          { id, deletedAt: null },
          {
            OR: [
              { companyId },
              { company: companyId },
              ...(companyName ? [{ company: companyName }] : []),
            ],
          },
        ];
        delete where.id;
      } else {
        where.AND = [
          { id, deletedAt: null },
          { OR: [{ companyId }, { company: companyId }] },
        ];
        delete where.id;
      }
    }
    return this.prisma.supportTicket.findFirst({ where });
  }

  async create(data: Prisma.SupportTicketCreateInput): Promise<SupportTicket> {
    let companyName = data.company;
    let companyIdVal: string | null = null;

    if (data.company && isValidUuid(data.company)) {
      companyIdVal = data.company;
      const companyRecord = await this.prisma.company.findUnique({ where: { id: data.company } });
      if (companyRecord?.name) {
        companyName = companyRecord.name;
      }
    }

    const createData: any = {
      ...data,
      company: companyName || 'Tenant Company',
      companyId: companyIdVal,
    };

    return this.prisma.supportTicket.create({
      data: createData,
    });
  }

  async update(
    id: string,
    data: Prisma.SupportTicketUpdateInput,
  ): Promise<SupportTicket> {
    return this.prisma.supportTicket.update({ where: { id }, data });
  }

  async softDelete(id: string, deletedBy: string): Promise<SupportTicket> {
    return this.prisma.supportTicket.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy,
      },
    });
  }

  async findMessagesByTicketId(ticketId: string): Promise<any[]> {
    return this.prisma.ticketMessage.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createMessage(
    ticketId: string,
    sender: string,
    message: string,
  ): Promise<any> {
    return this.prisma.ticketMessage.create({
      data: {
        ticketId,
        sender,
        message,
      },
    });
  }
}
