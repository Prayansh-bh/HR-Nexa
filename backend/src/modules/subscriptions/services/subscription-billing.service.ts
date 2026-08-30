import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLoggerService } from '../../../common/audit/audit-logger.service';
import { InvoiceStatus } from '../enums/invoice-status.enum';

@Injectable()
export class SubscriptionBillingService {
  private readonly logger = new Logger(SubscriptionBillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly auditLogger?: AuditLoggerService,
  ) {}

  async getAllInvoices() {
    return this.prisma.invoice.findMany({
      where: {
        subscription: {
          companyRelation: {
            isDemo: false,
          },
        },
      },
      orderBy: { date: 'desc' },
    });
  }

  async markInvoicePaid(invoiceId: string) {
    const inv = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });
    if (!inv) {
      throw new NotFoundException(`Invoice with ID "${invoiceId}" not found`);
    }

    const updated = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: InvoiceStatus.PAID },
    });

    if (this.auditLogger) {
      await this.auditLogger
        .logAction({
          companyId: inv.company,
          action: 'Invoice Marked Paid',
          oldValue: { status: inv.status },
          newValue: { status: InvoiceStatus.PAID },
          details: `Invoice ${invoiceId} marked as Paid`,
        })
        .catch(() => null);
    }

    return updated;
  }
}
