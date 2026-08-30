import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { createPaginatedResponse } from '../../../common/dto/paginated-response.dto';

@Injectable()
export class PaymentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId?: string | null, options?: { page?: number; limit?: number }) {
    const where: any = {};
    if (companyId) {
      where.company = companyId;
    }

    const include = {
      refunds: {
        orderBy: { createdAt: 'desc' as const },
      },
    };

    if (options?.page || options?.limit) {
      const page = options.page && options.page > 0 ? options.page : 1;
      const limit = options.limit && options.limit > 0 ? Math.min(options.limit, 100) : 50;
      const [total, data] = await Promise.all([
        this.prisma.paymentRecord.count({ where }),
        this.prisma.paymentRecord.findMany({
          where,
          include,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
      ]);
      return createPaginatedResponse(data, total, page, limit);
    }

    return this.prisma.paymentRecord.findMany({
      where,
      include,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    return this.prisma.paymentRecord.findUnique({
      where: { id },
      include: {
        refunds: {
          orderBy: { createdAt: 'desc' as const },
        },
      },
    });
  }

  async findByInvoiceId(invoiceId: string) {
    return this.prisma.paymentRecord.findMany({
      where: { invoiceId },
      include: {
        refunds: {
          orderBy: { createdAt: 'desc' as const },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: {
    invoiceId?: string;
    company: string;
    amount: number;
    paymentMethod: string;
    transactionId: string;
    gatewayPaymentId?: string;
    status: string;
    type: string;
    refundedAmount?: number;
  }) {
    return this.prisma.paymentRecord.create({
      data,
      include: {
        refunds: true,
      },
    });
  }

  async update(id: string, data: {
    status?: string;
    refundedAmount?: number;
    gatewayPaymentId?: string;
  }) {
    return this.prisma.paymentRecord.update({
      where: { id },
      data,
      include: {
        refunds: true,
      },
    });
  }

  async createRefund(data: {
    paymentRecordId: string;
    gateway?: string;
    gatewayPaymentId: string;
    gatewayRefundId?: string;
    amount: number;
    amountMinor: number;
    currency?: string;
    status: string;
    reason?: string;
    receipt?: string;
    requestedBy?: string;
    processedAt?: Date;
    failureReason?: string;
  }) {
    return this.prisma.paymentRefund.create({
      data: {
        ...data,
        gateway: data.gateway || 'RAZORPAY',
        currency: data.currency || 'INR',
      },
    });
  }

  async updateRefund(id: string, data: {
    gatewayRefundId?: string;
    status?: string;
    processedAt?: Date;
    failureReason?: string;
  }) {
    return this.prisma.paymentRefund.update({
      where: { id },
      data,
    });
  }

  async findRefundByGatewayRefundId(gatewayRefundId: string) {
    return this.prisma.paymentRefund.findUnique({
      where: { gatewayRefundId },
      include: { paymentRecord: true },
    });
  }
}
