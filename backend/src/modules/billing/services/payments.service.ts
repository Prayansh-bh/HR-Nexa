import {
  Injectable,
  Inject,
  forwardRef,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PaymentsRepository } from '../repositories/payments.repository';
import { PrismaService } from '../../../prisma/prisma.service';
import { RazorpayService } from '../../checkout/services/razorpay.service';
import { ProcessRefundDto } from '../dto/process-refund.dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly paymentsRepository: PaymentsRepository,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => RazorpayService))
    private readonly razorpayService: RazorpayService,
  ) {}

  async getPayments(companyId?: string | null, options?: { page?: number; limit?: number }) {
    return this.paymentsRepository.findAll(companyId, options);
  }

  async processPayment(data: {
    invoiceId?: string;
    company: string;
    amount: number;
    paymentMethod: string;
    transactionId?: string;
    gatewayPaymentId?: string;
  }) {
    const transactionId =
      data.transactionId ||
      data.gatewayPaymentId ||
      `tx_demo_${Math.floor(100000000 + Math.random() * 900000000)}`;

    const gatewayPaymentId =
      data.gatewayPaymentId ||
      (transactionId.startsWith('pay_') ? transactionId : undefined);

    // Create the payment record
    const payment = await this.paymentsRepository.create({
      invoiceId: data.invoiceId || undefined,
      company: data.company,
      amount: data.amount,
      paymentMethod: data.paymentMethod || 'Razorpay',
      transactionId,
      gatewayPaymentId,
      status: 'Success',
      type: 'Payment',
      refundedAmount: 0,
    });

    // If an invoice is associated, update its status to Paid
    if (data.invoiceId) {
      await this.prisma.invoice.update({
        where: { id: data.invoiceId },
        data: { status: 'Paid' },
      });
    }

    // Add audit log entry
    await this.prisma.auditLog.create({
      data: {
        userName: 'System (Billing Gateway)',
        actorId: 'system',
        actorRole: 'SuperAdmin',
        entityType: 'COMPANY_SETTINGS',
        action: 'SETTINGS_UPDATED',
        details: `[PAYMENT_PROCESSED] Successfully recorded payment of INR ${data.amount} for ${data.company}. Transaction ID: ${transactionId}`,
        companyId: 'PLATFORM',
      },
    });

    return payment;
  }

  /**
   * Production-grade Razorpay refund lifecycle
   * Validates gateway payment reference, verifies remaining refundable balance,
   * invokes Razorpay REST API, and applies state machine transitions.
   * NEVER marks transaction as Refunded without confirmed gateway processing.
   */
  async processRefund(
    paymentId: string,
    dto?: ProcessRefundDto,
    user?: { id?: string; email?: string; name?: string; role?: string },
  ) {
    const payment = await this.paymentsRepository.findById(paymentId);
    if (!payment) {
      throw new NotFoundException(`Payment record "${paymentId}" not found`);
    }

    // 1. Validate real gateway payment reference
    const gatewayPaymentId =
      payment.gatewayPaymentId ||
      (payment.transactionId?.startsWith('pay_') ? payment.transactionId : null);

    if (!gatewayPaymentId) {
      throw new BadRequestException(
        'Refund unavailable — this transaction has no verified gateway payment reference.',
      );
    }

    // 2. Prevent duplicate concurrent in-flight refunds
    const inFlightRefund = (payment.refunds || []).find(
      (r: any) => r.status === 'REQUESTED' || r.status === 'PENDING',
    );
    if (inFlightRefund) {
      throw new ConflictException(
        'A refund request for this payment is already in progress. Please wait for gateway settlement.',
      );
    }

    // 3. Calculate remaining refundable balance
    const successfullyRefunded = (payment.refunds || [])
      .filter((r: any) => r.status === 'PROCESSED')
      .reduce((sum: number, r: any) => sum + r.amount, 0);

    const remainingRefundable = Math.max(0, payment.amount - successfullyRefunded);
    if (remainingRefundable <= 0) {
      throw new BadRequestException('This transaction has already been fully refunded.');
    }

    // 4. Validate refund amount
    const requestedAmount =
      dto?.amount !== undefined && dto?.amount !== null
        ? Number(dto.amount)
        : remainingRefundable;

    if (isNaN(requestedAmount) || requestedAmount <= 0) {
      throw new BadRequestException('Refund amount must be greater than 0.');
    }

    if (requestedAmount > remainingRefundable) {
      throw new BadRequestException(
        `Refund amount (INR ${requestedAmount}) exceeds remaining refundable balance (INR ${remainingRefundable}).`,
      );
    }

    const amountMinor = Math.round(requestedAmount * 100);
    const receipt = `rfnd_rcpt_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;

    // 5. Create durable PaymentRefund record with status 'REQUESTED'
    const refundRecord = await this.paymentsRepository.createRefund({
      paymentRecordId: payment.id,
      gateway: 'RAZORPAY',
      gatewayPaymentId,
      amount: requestedAmount,
      amountMinor,
      currency: 'INR',
      status: 'REQUESTED',
      reason: dto?.reason || 'SuperAdmin initiated refund',
      receipt,
      requestedBy: user?.email || user?.id || 'SuperAdmin',
    });

    // 6. Audit log REFUND_REQUESTED
    await this.prisma.auditLog.create({
      data: {
        userName: user?.name || 'Super Admin',
        actorId: user?.id || 'system',
        actorRole: 'SuperAdmin',
        entityType: 'COMPANY_SETTINGS',
        action: 'SETTINGS_UPDATED',
        details: `[REFUND_REQUESTED] Initiated refund of INR ${requestedAmount} for ${payment.company}. Gateway Tx: ${gatewayPaymentId}. Refund Record: ${refundRecord.id}`,
        companyId: 'PLATFORM',
      },
    });

    // 7. Invoke Razorpay REST API
    let gatewayRefundResponse: any;
    try {
      this.logger.log(
        `Invoking Razorpay refund API for payment "${gatewayPaymentId}" (Amount: INR ${requestedAmount})`,
      );
      gatewayRefundResponse = await this.razorpayService.refundPayment(gatewayPaymentId, {
        amountMinor,
        receipt,
        notes: {
          paymentRecordId: payment.id,
          refundRecordId: refundRecord.id,
          company: payment.company,
          reason: dto?.reason || 'SuperAdmin initiated refund',
        },
      });
    } catch (err: any) {
      // Gateway rejected the refund!
      this.logger.error(`Razorpay refund rejected: ${err.message}`, err.stack);

      await this.paymentsRepository.updateRefund(refundRecord.id, {
        status: 'FAILED',
        failureReason: err.message || 'Razorpay refund API rejected the request',
      });

      await this.prisma.auditLog.create({
        data: {
          userName: user?.name || 'Super Admin',
          actorId: user?.id || 'system',
          actorRole: 'SuperAdmin',
          entityType: 'COMPANY_SETTINGS',
          action: 'SETTINGS_UPDATED',
          details: `[REFUND_FAILED] Failed to process refund of INR ${requestedAmount} for ${payment.company}. Gateway Tx: ${gatewayPaymentId}. Reason: ${err.message}`,
          companyId: 'PLATFORM',
        },
      });

      throw new BadRequestException(`Razorpay refund failed: ${err.message}`);
    }

    // 8. Process Gateway Response
    const gatewayRefundId = gatewayRefundResponse?.id;
    const isProcessed = gatewayRefundResponse?.status === 'processed';
    const nextStatus = isProcessed ? 'PROCESSED' : 'PENDING';
    const processedAt = isProcessed ? new Date() : undefined;

    await this.paymentsRepository.updateRefund(refundRecord.id, {
      gatewayRefundId,
      status: nextStatus,
      processedAt,
    });

    // 9. Update Financial Ledger & Aggregates only when confirmed PROCESSED
    if (isProcessed) {
      const newTotalRefunded = successfullyRefunded + requestedAmount;
      const isFullyRefunded = newTotalRefunded >= payment.amount;

      await this.paymentsRepository.update(payment.id, {
        refundedAmount: newTotalRefunded,
        status: isFullyRefunded ? 'Refunded' : 'Partially Refunded',
      });

      if (payment.invoiceId) {
        await this.prisma.invoice.update({
          where: { id: payment.invoiceId },
          data: {
            status: isFullyRefunded ? 'Refunded' : 'Partially Refunded',
          },
        });
      }

      await this.prisma.auditLog.create({
        data: {
          userName: user?.name || 'Super Admin',
          actorId: user?.id || 'system',
          actorRole: 'SuperAdmin',
          entityType: 'COMPANY_SETTINGS',
          action: 'SETTINGS_UPDATED',
          details: `[REFUND_PROCESSED] Confirmed refund of INR ${requestedAmount} for ${payment.company}. Gateway Refund ID: ${gatewayRefundId}. Original Tx: ${gatewayPaymentId}`,
          companyId: 'PLATFORM',
        },
      });
    }

    return this.paymentsRepository.findById(paymentId);
  }

  /**
   * Idempotent webhook handler for asynchronous Razorpay refund settlement
   */
  async handleRefundWebhook(params: {
    gatewayRefundId: string;
    gatewayPaymentId?: string;
    status: 'PROCESSED' | 'FAILED';
    amountMinor?: number;
    failureReason?: string;
    notes?: Record<string, any>;
  }) {
    const { gatewayRefundId, status, failureReason } = params;
    const refund = await this.paymentsRepository.findRefundByGatewayRefundId(gatewayRefundId);

    if (!refund) {
      this.logger.warn(`No local PaymentRefund found matching gateway refund ID "${gatewayRefundId}".`);
      return;
    }

    // Idempotency: skip if already settled in target state
    if (refund.status === status) {
      this.logger.log(`Refund "${gatewayRefundId}" is already ${status}. Skipping idempotent webhook.`);
      return;
    }

    if (status === 'PROCESSED' && refund.status !== 'PROCESSED') {
      await this.paymentsRepository.updateRefund(refund.id, {
        status: 'PROCESSED',
        processedAt: new Date(),
      });

      const payment = await this.paymentsRepository.findById(refund.paymentRecordId);
      if (payment) {
        const allSuccessfulRefunds = (payment.refunds || [])
          .filter((r: any) => r.status === 'PROCESSED' || r.id === refund.id)
          .reduce((sum: number, r: any) => sum + r.amount, 0);

        const isFullyRefunded = allSuccessfulRefunds >= payment.amount;

        await this.paymentsRepository.update(payment.id, {
          refundedAmount: allSuccessfulRefunds,
          status: isFullyRefunded ? 'Refunded' : 'Partially Refunded',
        });

        if (payment.invoiceId) {
          await this.prisma.invoice.update({
            where: { id: payment.invoiceId },
            data: {
              status: isFullyRefunded ? 'Refunded' : 'Partially Refunded',
            },
          });
        }
      }

      await this.prisma.auditLog.create({
        data: {
          userName: 'System (Razorpay Webhook)',
          actorId: 'webhook',
          actorRole: 'System',
          entityType: 'COMPANY_SETTINGS',
          action: 'SETTINGS_UPDATED',
          details: `[WEBHOOK_REFUND_PROCESSED] Asynchronously settled refund "${gatewayRefundId}" for payment "${refund.gatewayPaymentId}".`,
          companyId: 'PLATFORM',
        },
      });
    } else if (status === 'FAILED') {
      await this.paymentsRepository.updateRefund(refund.id, {
        status: 'FAILED',
        failureReason: failureReason || 'Gateway notified refund failure via webhook',
      });

      await this.prisma.auditLog.create({
        data: {
          userName: 'System (Razorpay Webhook)',
          actorId: 'webhook',
          actorRole: 'System',
          entityType: 'COMPANY_SETTINGS',
          action: 'SETTINGS_UPDATED',
          details: `[WEBHOOK_REFUND_FAILED] Razorpay notified refund "${gatewayRefundId}" failed: ${failureReason}`,
          companyId: 'PLATFORM',
        },
      });
    }
  }
}
