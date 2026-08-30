import {
  Injectable,
  Inject,
  forwardRef,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { RazorpayService } from './razorpay.service';
import { SubscriptionProvisioningService } from '../../subscriptions/services/subscription-provisioning.service';
import { PaymentsService } from '../../billing/services/payments.service';
import { CreateCheckoutOrderDto } from '../dto/create-checkout-order.dto';
import { VerifyCheckoutPaymentDto } from '../dto/verify-checkout-payment.dto';

export interface CheckoutOrderResponse {
  orderId: string;
  amountMinor: number;
  currency: string;
  keyId: string;
  company: string;
  planName: string;
  cycle: string;
}

export interface VerificationResult {
  success: boolean;
  status: 'PROVISIONED' | 'ALREADY_PROVISIONED' | 'PROVISIONING_IN_PROGRESS';
  companyId?: string | null;
  subscriptionId?: string | null;
  redirectUrl?: string;
  message?: string;
}

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpayService: RazorpayService,
    private readonly provisioningService: SubscriptionProvisioningService,
    @Inject(forwardRef(() => PaymentsService))
    private readonly paymentsService?: PaymentsService,
  ) {}

  /**
   * 1. Create Checkout Order
   * Pre-flight checks, server-side plan & price calculation, Razorpay order generation, PaymentOrder persistence.
   */
  async createCheckoutOrder(dto: CreateCheckoutOrderDto): Promise<CheckoutOrderResponse> {
    // 1. Pre-flight check: Verify company name is not already registered
    const existingCompany = await this.prisma.company.findUnique({
      where: { name: dto.company.trim() },
    });
    if (existingCompany) {
      throw new ConflictException(`Company name "${dto.company.trim()}" is already registered.`);
    }

    // 2. Pre-flight check: Verify owner email is not already registered
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.ownerEmail.trim().toLowerCase() },
    });
    if (existingUser) {
      throw new ConflictException(`Email address "${dto.ownerEmail.trim()}" is already registered.`);
    }

    // 3. Resolve authoritative published SaaS Plan and PlanVersion from database
    const planIdentifier = dto.plan.trim();
    let plan = await (this.prisma as any).saaSPlanNew.findFirst({
      where: {
        status: { not: 'Archived' },
        OR: [
          { id: planIdentifier },
          { code: planIdentifier },
          { name: { equals: planIdentifier, mode: 'insensitive' } },
        ],
      },
    });

    if (!plan) {
      throw new BadRequestException(`SaaS Plan "${planIdentifier}" not found.`);
    }

    const version = await this.prisma.planVersion.findFirst({
      where: {
        planId: plan.id,
        status: 'Published',
      },
      orderBy: {
        version: 'desc',
      },
    });

    if (!version) {
      throw new BadRequestException(`No published version found for plan "${plan.name}".`);
    }

    // 4. Server-authoritative calculation: Convert major currency price to minor integer units (paise)
    const isAnnual = dto.cycle.toLowerCase() === 'annual' || dto.cycle.toLowerCase() === 'yearly';
    const normalizedCycle = isAnnual ? 'Annual' : 'Monthly';
    const priceInMajor = isAnnual ? version.yearlyPrice : version.monthlyPrice;

    if (priceInMajor <= 0) {
      throw new BadRequestException(
        `Plan "${plan.name}" has zero amount. Free trials must use the trial registration endpoint.`,
      );
    }

    const amountMinor = Math.round(priceInMajor * 100);

    // 5. Create Gateway Order via Razorpay
    const receipt = `rcpt_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
    const razorpayOrder = await this.razorpayService.createOrder({
      amountMinor,
      currency: 'INR',
      receipt,
      notes: {
        company: dto.company.trim(),
        plan: plan.name,
        cycle: normalizedCycle,
        ownerEmail: dto.ownerEmail.trim(),
      },
    });

    // 6. Persist durable PaymentOrder in PostgreSQL (30-minute expiry)
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await this.prisma.paymentOrder.create({
      data: {
        orderId: razorpayOrder.id,
        provider: 'RAZORPAY',
        status: 'CREATED',
        planName: plan.name,
        planVersionId: version.id,
        billingCycle: normalizedCycle,
        amountMinor,
        currency: 'INR',
        companyName: dto.company.trim(),
        ownerName: dto.ownerName.trim(),
        ownerEmail: dto.ownerEmail.trim().toLowerCase(),
        contact: dto.contact ? dto.contact.trim() : null,
        gst: dto.gst ? dto.gst.trim().toUpperCase() : null,
        address: dto.address ? dto.address.trim() : null,
        expiresAt,
      },
    });

    this.logger.log(
      `Created PaymentOrder ${razorpayOrder.id} for "${dto.company}" (${plan.name}, ₹${priceInMajor}, ${normalizedCycle})`,
    );

    return {
      orderId: razorpayOrder.id,
      amountMinor,
      currency: 'INR',
      keyId: await this.razorpayService.getKeyId(),
      company: dto.company.trim(),
      planName: plan.name,
      cycle: normalizedCycle,
    };
  }

  /**
   * 2. Verify Payment (Client Frontend Callback)
   * Receives only cryptographic tokens. Verifies HMAC, checks gateway invariants, and triggers decoupled provisioning.
   */
  async verifyPayment(dto: VerifyCheckoutPaymentDto): Promise<VerificationResult> {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = dto;

    // A. Cryptographic HMAC Signature Validation
    const isSignatureValid = await this.razorpayService.verifyPaymentSignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });

    if (!isSignatureValid) {
      this.logger.warn(`HMAC_SIGNATURE_MISMATCH for order ${razorpay_order_id}`);
      throw new BadRequestException('Invalid payment signature');
    }

    return this.executeVerificationAndProvisioning({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
      source: 'CLIENT_CALLBACK',
    });
  }

  /**
   * 3. Handle Webhook (Razorpay Server-to-Server Event)
   * Authoritative async verification using raw request body.
   */
  async handleWebhook(rawBody: Buffer | string, signature: string): Promise<{ received: boolean; status?: string }> {
    const isSignatureValid = await this.razorpayService.verifyWebhookSignature(rawBody, signature);
    if (!isSignatureValid) {
      this.logger.warn('RAZORPAY_WEBHOOK_SIGNATURE_INVALID');
      throw new ForbiddenException('Invalid webhook signature');
    }

    let payload: any;
    try {
      const rawText = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
      payload = JSON.parse(rawText);
    } catch {
      throw new BadRequestException('Invalid webhook JSON body');
    }

    const eventName = payload?.event;
    this.logger.log(`Received Razorpay webhook event: ${eventName}`);

    if (eventName === 'payment.captured' || eventName === 'order.paid') {
      const paymentEntity = payload?.payload?.payment?.entity;
      const orderEntity = payload?.payload?.order?.entity;

      const orderId = paymentEntity?.order_id || orderEntity?.id;
      const paymentId = paymentEntity?.id;

      if (!orderId || !paymentId) {
        this.logger.warn('Webhook missing orderId or paymentId in payload');
        return { received: true, status: 'SKIPPED_MISSING_DATA' };
      }

      await this.executeVerificationAndProvisioning({
        orderId,
        paymentId,
        signature,
        source: 'WEBHOOK',
      });

      return { received: true, status: 'PROCESSED' };
    }

    if (
      eventName === 'refund.processed' ||
      eventName === 'refund.failed' ||
      eventName === 'refund.created'
    ) {
      const refundEntity = payload?.payload?.refund?.entity;
      const gatewayRefundId = refundEntity?.id;
      const gatewayPaymentId = refundEntity?.payment_id;

      if (!gatewayRefundId) {
        this.logger.warn('Refund webhook missing refund ID in payload');
        return { received: true, status: 'SKIPPED_MISSING_DATA' };
      }

      if (this.paymentsService) {
        await this.paymentsService.handleRefundWebhook({
          gatewayRefundId,
          gatewayPaymentId,
          status:
            eventName === 'refund.processed'
              ? 'PROCESSED'
              : eventName === 'refund.failed'
                ? 'FAILED'
                : ('PENDING' as any),
          amountMinor: refundEntity?.amount,
          failureReason:
            refundEntity?.error_description || refundEntity?.error_code,
          notes: refundEntity?.notes,
        });
      }

      return { received: true, status: 'PROCESSED' };
    }

    return { received: true, status: 'IGNORED_EVENT' };
  }

  /**
   * 4. Core Decoupled Provisioning Execution Pipeline
   *
   * Pre-Step: Authoritative Gateway Payment Fetch (Outside DB Lock)
   * Tx1: Short Atomic Claim Transaction with PostgreSQL Row Lock (SELECT ... FOR UPDATE)
   * Execution: Tenant Provisioning via SubscriptionProvisioningService (Outside DB Lock)
   * Tx2: Short Atomic Finalization Transaction
   */
  private async executeVerificationAndProvisioning(params: {
    orderId: string;
    paymentId: string;
    signature: string;
    source: 'CLIENT_CALLBACK' | 'WEBHOOK';
  }): Promise<VerificationResult> {
    const { orderId, paymentId, signature, source } = params;

    // --- Pre-Step: Fetch Authoritative Gateway Payment Details (Outside DB Lock) ---
    // Executing the external HTTPS request outside the database transaction prevents
    // holding PostgreSQL connections or row locks during external network I/O.
    const paymentDetails = await this.razorpayService.fetchPayment(paymentId);

    // --- Step 1: Short Claim Transaction (Tx1) ---
    const claimedOrder = await this.prisma.$transaction(
      async (tx) => {
        const [order]: any[] = await tx.$queryRaw`
          SELECT *
          FROM "PaymentOrder"
          WHERE "orderId" = ${orderId}
          FOR UPDATE
        `;

        if (!order) {
          throw new NotFoundException(`Checkout order "${orderId}" not found`);
        }

        // Idempotency: If already provisioned, return immediately
        if (order.status === 'PROVISIONED') {
          return { ...order, isAlreadyProvisioned: true };
        }

        // Replay Protection: Check if paymentId is already linked to another order
        const duplicatePayment = await tx.paymentOrder.findFirst({
          where: {
            paymentId,
            NOT: { orderId },
          },
        });
        if (duplicatePayment) {
          throw new ConflictException(
            `Payment ID "${paymentId}" has already been processed for a different order.`,
          );
        }

        // Expiry Validation
        if (new Date(order.expiresAt) < new Date() && order.status === 'CREATED') {
          await tx.paymentOrder.update({
            where: { id: order.id },
            data: { status: 'EXPIRED' },
          });
          throw new BadRequestException('Checkout session has expired. Please initiate a new order.');
        }

        // Stale provisioning check (if already in PROVISIONING for < 3 minutes, wait)
        if (order.status === 'PROVISIONING' && order.provisioningStartedAt) {
          const elapsedMs = Date.now() - new Date(order.provisioningStartedAt).getTime();
          if (elapsedMs < 3 * 60 * 1000) {
            return { ...order, isProvisioningInProgress: true };
          }
          // Stale provisioning (> 3 min) -> Allow recovery
          this.logger.warn(`Recovering stale provisioning for order ${orderId}`);
        }

        // Authoritative Gateway Invariant Cross-Verification against locked order record
        if (paymentDetails) {
          if (paymentDetails.order_id && paymentDetails.order_id !== order.orderId) {
            throw new BadRequestException('Payment order ID does not match stored checkout order');
          }
          if (paymentDetails.amount && paymentDetails.amount !== order.amountMinor) {
            throw new BadRequestException('Payment amount does not match stored checkout amount');
          }
          if (
            paymentDetails.currency &&
            paymentDetails.currency.toUpperCase() !== order.currency.toUpperCase()
          ) {
            throw new BadRequestException('Payment currency mismatch');
          }
          if (
            paymentDetails.status &&
            paymentDetails.status !== 'captured' &&
            paymentDetails.status !== 'authorized'
          ) {
            throw new BadRequestException(
              `Payment is not in captured status (current: ${paymentDetails.status})`,
            );
          }
        }

        // Atomic claim transition
        const now = new Date();
        const updated = await tx.paymentOrder.update({
          where: { id: order.id },
          data: {
            status: 'PROVISIONING',
            paymentId,
            signature,
            paidAt: order.paidAt || now,
            provisioningStartedAt: now,
          },
        });

        return updated;
      },
      { maxWait: 5000, timeout: 10000 },
    );

    if (claimedOrder.isAlreadyProvisioned) {
      this.logger.log(`Order ${orderId} is already PROVISIONED. Returning idempotent success.`);
      return {
        success: true,
        status: 'ALREADY_PROVISIONED',
        companyId: claimedOrder.companyId,
        subscriptionId: claimedOrder.subscriptionId,
        redirectUrl: 'https://app.hrnexa.com/login',
        message: 'Account is already provisioned. You can log in directly.',
      };
    }

    if (claimedOrder.isProvisioningInProgress) {
      this.logger.log(`Order ${orderId} is currently being provisioned. Returning in-progress response.`);
      return {
        success: true,
        status: 'PROVISIONING_IN_PROGRESS',
        message: 'Provisioning is in progress. Please wait a moment.',
      };
    }

    // --- Step 2: Tenant Provisioning Execution (Outside DB Transaction) ---
    let provisionedSub: any;
    let provisioningError: any = null;

    try {
      this.logger.log(
        `Invoking SubscriptionProvisioningService for "${claimedOrder.companyName}" (${claimedOrder.planName}, source: ${source})`,
      );

      provisionedSub = await this.provisioningService.createSubscription({
        company: claimedOrder.companyName,
        plan: claimedOrder.planName,
        cycle: claimedOrder.billingCycle,
        amount: claimedOrder.amountMinor / 100, // Converted to major units for accounting/invoice
        ownerEmail: claimedOrder.ownerEmail,
        ownerName: claimedOrder.ownerName,
        contact: claimedOrder.contact || undefined,
        address: claimedOrder.address || undefined,
        gst: claimedOrder.gst || undefined,
        status: 'Active',
      });
    } catch (err: any) {
      provisioningError = err;
      this.logger.error(
        `Tenant provisioning execution failed for order ${orderId}: ${err.message}`,
        err.stack,
      );
    }

    // --- Step 3: Short Finalize Transaction (Tx2) ---
    if (provisioningError) {
      await this.prisma.paymentOrder.update({
        where: { id: claimedOrder.id },
        data: {
          status: 'PROVISIONING_FAILED',
          failureReason: provisioningError.message || 'Unknown provisioning error',
          retryCount: { increment: 1 },
        },
      });

      throw new BadRequestException(
        `Tenant provisioning failed: ${provisioningError.message || 'Please contact support.'}`,
      );
    }

    const finalizedOrder = await this.prisma.paymentOrder.update({
      where: { id: claimedOrder.id },
      data: {
        status: 'PROVISIONED',
        subscriptionId: provisionedSub.id,
        companyId: provisionedSub.companyId,
        provisionedAt: new Date(),
      },
    });

    // Create synchronized PaymentRecord with real verified gateway payment ID
    try {
      const createdInvoice = await this.prisma.invoice.findFirst({
        where: { subscriptionId: provisionedSub.id },
        orderBy: { createdAt: 'desc' },
      });

      await this.prisma.paymentRecord.create({
        data: {
          invoiceId: createdInvoice?.id || null,
          company: claimedOrder.companyName,
          amount: claimedOrder.amountMinor / 100,
          paymentMethod: 'Razorpay',
          transactionId: paymentId,
          gatewayPaymentId: paymentId,
          status: 'Success',
          type: 'Payment',
          refundedAmount: 0,
        },
      });
    } catch (paymentRecErr: any) {
      this.logger.warn(
        `Failed to create synchronized PaymentRecord for order ${orderId}: ${paymentRecErr.message}`,
      );
    }

    this.logger.log(
      `Successfully PROVISIONED tenant workspace for "${finalizedOrder.companyName}" (Company ID: ${finalizedOrder.companyId}, Sub ID: ${finalizedOrder.subscriptionId})`,
    );

    return {
      success: true,
      status: 'PROVISIONED',
      companyId: finalizedOrder.companyId,
      subscriptionId: finalizedOrder.subscriptionId,
      redirectUrl: 'https://app.hrnexa.com/login',
      message: 'Workspace provisioned successfully. Welcome email with login credentials has been sent.',
    };
  }

  /**
   * 5. Expired Checkout Order Reconciliation Job
   * Runs periodically to reconcile abandoned, unpaid checkout orders past their 30-minute window to 'EXPIRED'.
   * Safe, idempotent, and non-blocking. Never modifies PROVISIONING, PROVISIONED, or PROVISIONING_FAILED orders.
   */
  @Cron(process.env.CHECKOUT_EXPIRY_CRON || CronExpression.EVERY_5_MINUTES)
  async reconcileExpiredCheckoutOrders(): Promise<{ expiredCount: number }> {
    const now = new Date();
    try {
      const result = await this.prisma.paymentOrder.updateMany({
        where: {
          status: 'CREATED',
          expiresAt: { lt: now },
        },
        data: {
          status: 'EXPIRED',
        },
      });

      if (result.count > 0) {
        this.logger.log(
          `[CheckoutReconciliation] Reconciled ${result.count} stale checkout order(s) (status=CREATED, expiresAt < now) to 'EXPIRED'.`,
        );
      }
      return { expiredCount: result.count };
    } catch (err: any) {
      this.logger.error(
        `[CheckoutReconciliation] Failed to reconcile expired checkout orders: ${err.message}`,
        err.stack,
      );
      return { expiredCount: 0 };
    }
  }
}
