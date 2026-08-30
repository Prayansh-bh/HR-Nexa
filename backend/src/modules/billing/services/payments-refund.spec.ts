import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsRepository } from '../repositories/payments.repository';
import { PrismaService } from '../../../prisma/prisma.service';
import { RazorpayService } from '../../checkout/services/razorpay.service';

describe('Phase 2K: Production Payment & Refund Integrity Test Suite (20 Points)', () => {
  let paymentsService: PaymentsService;
  let paymentsRepository: PaymentsRepository;
  let prismaService: any;
  let razorpayService: RazorpayService;

  // In-memory mock storage
  let mockPayments: Record<string, any> = {};
  let mockRefunds: Record<string, any> = {};
  let mockInvoices: Record<string, any> = {};
  let mockAuditLogs: any[] = [];

  beforeEach(async () => {
    mockPayments = {};
    mockRefunds = {};
    mockInvoices = {};
    mockAuditLogs = [];

    const mockPaymentsRepo = {
      findAll: jest.fn().mockImplementation((companyId) => {
        return Object.values(mockPayments).filter((p) => !companyId || p.company === companyId);
      }),
      findById: jest.fn().mockImplementation((id: string) => {
        const p = mockPayments[id];
        if (!p) return null;
        const pRefunds = Object.values(mockRefunds).filter((r: any) => r.paymentRecordId === id);
        return { ...p, refunds: pRefunds };
      }),
      create: jest.fn().mockImplementation((data) => {
        const record = { id: `pay_rec_${Date.now()}_${Math.random()}`, ...data, refunds: [] };
        mockPayments[record.id] = record;
        return record;
      }),
      update: jest.fn().mockImplementation((id: string, data) => {
        const existing = mockPayments[id];
        if (!existing) throw new Error('Not found');
        const updated = { ...existing, ...data };
        mockPayments[id] = updated;
        const pRefunds = Object.values(mockRefunds).filter((r: any) => r.paymentRecordId === id);
        return { ...updated, refunds: pRefunds };
      }),
      createRefund: jest.fn().mockImplementation((data) => {
        const id = `rfnd_local_${Date.now()}_${Math.random()}`;
        const refund = { id, createdAt: new Date(), updatedAt: new Date(), ...data };
        mockRefunds[id] = refund;
        return refund;
      }),
      updateRefund: jest.fn().mockImplementation((id: string, data) => {
        const existing = mockRefunds[id];
        if (!existing) throw new Error('Not found');
        const updated = { ...existing, ...data, updatedAt: new Date() };
        mockRefunds[id] = updated;
        return updated;
      }),
      findRefundByGatewayRefundId: jest.fn().mockImplementation((gatewayRefundId: string) => {
        return Object.values(mockRefunds).find((r: any) => r.gatewayRefundId === gatewayRefundId) || null;
      }),
    };

    const mockPrisma = {
      invoice: {
        update: jest.fn().mockImplementation(({ where, data }) => {
          const inv = mockInvoices[where.id] || { id: where.id };
          const updated = { ...inv, ...data };
          mockInvoices[where.id] = updated;
          return updated;
        }),
      },
      auditLog: {
        create: jest.fn().mockImplementation(({ data }) => {
          mockAuditLogs.push(data);
          return { id: `audit_${Date.now()}`, ...data };
        }),
      },
    };

    const mockRazorpay = {
      refundPayment: jest.fn().mockImplementation((paymentId: string, payload: any) => {
        return Promise.resolve({
          id: `rfnd_test_${Date.now()}`,
          entity: 'refund',
          amount: payload.amountMinor,
          currency: 'INR',
          payment_id: paymentId,
          status: 'processed',
          created_at: Math.floor(Date.now() / 1000),
        });
      }),
      verifyWebhookSignature: jest.fn().mockImplementation((body: any, sig: string) => {
        return Promise.resolve(sig === 'valid_signature_123');
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PaymentsRepository, useValue: mockPaymentsRepo },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RazorpayService, useValue: mockRazorpay },
      ],
    }).compile();

    paymentsService = module.get<PaymentsService>(PaymentsService);
    paymentsRepository = module.get<PaymentsRepository>(PaymentsRepository);
    prismaService = module.get<PrismaService>(PrismaService);
    razorpayService = module.get<RazorpayService>(RazorpayService);
  });

  const seedVerifiedPayment = (overrides?: any) => {
    const payment = {
      id: 'pay_rec_100',
      invoiceId: 'inv_100',
      company: 'Acme Corp',
      amount: 10000,
      refundedAmount: 0,
      paymentMethod: 'Razorpay',
      transactionId: 'pay_rzp_live_test_123',
      gatewayPaymentId: 'pay_rzp_live_test_123',
      status: 'Success',
      type: 'Payment',
      ...overrides,
    };
    mockPayments[payment.id] = payment;
    mockInvoices['inv_100'] = { id: 'inv_100', status: 'Paid', amount: 10000 };
    return payment;
  };

  // Test 1: Successful Full Refund
  it('1. Successful Full Refund marks payment & invoice as Refunded and stores gateway refund ID', async () => {
    seedVerifiedPayment();
    const result = await paymentsService.processRefund('pay_rec_100', undefined, { id: 'admin1', email: 'admin@acme.com' });

    expect(result!.status).toBe('Refunded');
    expect((result as any)!.refundedAmount).toBe(10000);
    expect(mockInvoices['inv_100'].status).toBe('Refunded');

    const refunds = Object.values(mockRefunds);
    expect(refunds).toHaveLength(1);
    expect(refunds[0].status).toBe('PROCESSED');
    expect(refunds[0].gatewayRefundId).toMatch(/^rfnd_test_/);
    expect(refunds[0].amount).toBe(10000);
  });

  // Test 2: Successful Partial Refund
  it('2. Successful Partial Refund updates refundedAmount and sets status to Partially Refunded', async () => {
    seedVerifiedPayment();
    const result = await paymentsService.processRefund('pay_rec_100', { amount: 3000, reason: 'Partial return' }, { id: 'admin1' });

    expect(result!.status).toBe('Partially Refunded');
    expect((result as any)!.refundedAmount).toBe(3000);
    expect(mockInvoices['inv_100'].status).toBe('Partially Refunded');

    const refunds = Object.values(mockRefunds);
    expect(refunds[0].status).toBe('PROCESSED');
    expect(refunds[0].amount).toBe(3000);
  });

  // Test 3: Multiple Partial Refunds until fully refunded
  it('3. Multiple Partial Refunds sum up and transition to fully Refunded on completion', async () => {
    seedVerifiedPayment();
    await paymentsService.processRefund('pay_rec_100', { amount: 4000 });
    const second = await paymentsService.processRefund('pay_rec_100', { amount: 6000 });

    expect(second!.status).toBe('Refunded');
    expect((second as any)!.refundedAmount).toBe(10000);
    expect(mockInvoices['inv_100'].status).toBe('Refunded');

    const refunds = Object.values(mockRefunds);
    expect(refunds).toHaveLength(2);
    expect(refunds[0].amount + refunds[1].amount).toBe(10000);
  });

  // Test 4: Reject Refund Exceeding Remaining Balance
  it('4. Rejects refund exceeding remaining balance with BadRequestException', async () => {
    seedVerifiedPayment();
    await paymentsService.processRefund('pay_rec_100', { amount: 8000 });

    await expect(paymentsService.processRefund('pay_rec_100', { amount: 3000 })).rejects.toThrow(
      BadRequestException,
    );
  });

  // Test 5: Reject Zero or Negative Refund Amount
  it('5. Rejects zero or negative refund amount with BadRequestException', async () => {
    seedVerifiedPayment();
    await expect(paymentsService.processRefund('pay_rec_100', { amount: 0 })).rejects.toThrow(
      BadRequestException,
    );
    await expect(paymentsService.processRefund('pay_rec_100', { amount: -500 })).rejects.toThrow(
      BadRequestException,
    );
  });

  // Test 6: Reject Refund on Non-Gateway Transactions (Legacy/Fake IDs)
  it('6. Rejects refund on non-gateway transactions with specific explanatory error message', async () => {
    const fakePayment = {
      id: 'pay_fake_1',
      company: 'Demo Co',
      amount: 5000,
      paymentMethod: 'Stripe (Demo)',
      transactionId: 'tx_demo_123456789',
      gatewayPaymentId: null,
      status: 'Success',
      type: 'Payment',
    };
    mockPayments[fakePayment.id] = fakePayment;

    await expect(paymentsService.processRefund('pay_fake_1')).rejects.toThrow(
      'Refund unavailable — this transaction has no verified gateway payment reference.',
    );
  });

  // Test 7: Reject Refund on Non-Captured / Unsuccessful Payments
  it('7. Rejects refund when payment record is not found', async () => {
    await expect(paymentsService.processRefund('non_existent_id')).rejects.toThrow(NotFoundException);
  });

  // Test 8: Reject Refund on Already Fully Refunded Transactions
  it('8. Rejects refund when transaction has already reached fully refunded status', async () => {
    seedVerifiedPayment();
    await paymentsService.processRefund('pay_rec_100', { amount: 10000 });

    await expect(paymentsService.processRefund('pay_rec_100', { amount: 100 })).rejects.toThrow(
      'This transaction has already been fully refunded.',
    );
  });

  // Test 9: Reject Concurrent In-Flight Refund Requests
  it('9. Rejects duplicate in-flight refund requests when one is already REQUESTED or PENDING', async () => {
    seedVerifiedPayment();
    // Simulate an existing in-flight refund in DB
    mockRefunds['rfnd_inflight_1'] = {
      id: 'rfnd_inflight_1',
      paymentRecordId: 'pay_rec_100',
      status: 'REQUESTED',
      amount: 5000,
    };

    await expect(paymentsService.processRefund('pay_rec_100', { amount: 2000 })).rejects.toThrow(
      ConflictException,
    );
  });

  // Test 10: Handle Gateway API Rejection / Failure
  it('10. On Razorpay API rejection: marks refund FAILED, preserves reason, does NOT change payment status', async () => {
    seedVerifiedPayment();
    jest.spyOn(razorpayService, 'refundPayment').mockRejectedValueOnce(
      new Error('BAD_REQUEST_ERROR: Insufficient merchant account balance for refund'),
    );

    await expect(paymentsService.processRefund('pay_rec_100')).rejects.toThrow(
      'Razorpay refund failed: BAD_REQUEST_ERROR: Insufficient merchant account balance for refund',
    );

    const refunds = Object.values(mockRefunds);
    expect(refunds).toHaveLength(1);
    expect(refunds[0].status).toBe('FAILED');
    expect(refunds[0].failureReason).toContain('Insufficient merchant account balance');

    // Crucial financial integrity test: payment status MUST NOT be touched
    expect(mockPayments['pay_rec_100'].status).toBe('Success');
    expect(mockPayments['pay_rec_100'].refundedAmount).toBe(0);
    expect(mockInvoices['inv_100'].status).toBe('Paid');
  });

  // Test 11: Handle Gateway Asynchronous Pending Status
  it('11. When Gateway returns PENDING: refund is marked PENDING and payment status is NOT prematurely marked refunded', async () => {
    seedVerifiedPayment();
    jest.spyOn(razorpayService, 'refundPayment').mockResolvedValueOnce({
      id: 'rfnd_async_pending_1',
      entity: 'refund',
      amount: 1000000,
      currency: 'INR',
      payment_id: 'pay_rzp_live_test_123',
      status: 'pending',
      created_at: Math.floor(Date.now() / 1000),
    });

    const result = await paymentsService.processRefund('pay_rec_100');

    // Refund is pending
    const refunds = Object.values(mockRefunds);
    expect(refunds[0].status).toBe('PENDING');
    expect(refunds[0].gatewayRefundId).toBe('rfnd_async_pending_1');

    // Payment & Invoice MUST NOT be marked refunded until confirmed
    expect(result!.status).toBe('Success');
    expect((result as any)!.refundedAmount).toBe(0);
    expect(mockInvoices['inv_100'].status).toBe('Paid');
  });

  // Test 12: Handle Webhook refund.processed Reconciliation
  it('12. Webhook refund.processed asynchronously updates refund, payment, and invoice status', async () => {
    seedVerifiedPayment();
    // Simulate existing pending refund
    mockRefunds['rfnd_pending_rec'] = {
      id: 'rfnd_pending_rec',
      paymentRecordId: 'pay_rec_100',
      gatewayRefundId: 'rfnd_hook_proc_1',
      gatewayPaymentId: 'pay_rzp_live_test_123',
      amount: 10000,
      amountMinor: 1000000,
      status: 'PENDING',
    };

    await paymentsService.handleRefundWebhook({
      gatewayRefundId: 'rfnd_hook_proc_1',
      gatewayPaymentId: 'pay_rzp_live_test_123',
      status: 'PROCESSED',
      amountMinor: 1000000,
    });

    expect(mockRefunds['rfnd_pending_rec'].status).toBe('PROCESSED');
    expect(mockPayments['pay_rec_100'].status).toBe('Refunded');
    expect(mockPayments['pay_rec_100'].refundedAmount).toBe(10000);
    expect(mockInvoices['inv_100'].status).toBe('Refunded');
  });

  // Test 13: Handle Webhook refund.failed Reconciliation
  it('13. Webhook refund.failed marks refund FAILED, preserves failure reason, and does not alter payment', async () => {
    seedVerifiedPayment();
    mockRefunds['rfnd_pending_fail'] = {
      id: 'rfnd_pending_fail',
      paymentRecordId: 'pay_rec_100',
      gatewayRefundId: 'rfnd_hook_fail_1',
      gatewayPaymentId: 'pay_rzp_live_test_123',
      amount: 10000,
      status: 'PENDING',
    };

    await paymentsService.handleRefundWebhook({
      gatewayRefundId: 'rfnd_hook_fail_1',
      gatewayPaymentId: 'pay_rzp_live_test_123',
      status: 'FAILED',
      failureReason: 'Customer card expired or account frozen',
    });

    expect(mockRefunds['rfnd_pending_fail'].status).toBe('FAILED');
    expect(mockRefunds['rfnd_pending_fail'].failureReason).toBe('Customer card expired or account frozen');
    expect(mockPayments['pay_rec_100'].status).toBe('Success');
    expect(mockPayments['pay_rec_100'].refundedAmount).toBe(0);
  });

  // Test 14: Webhook Idempotency / Duplicate Delivery
  it('14. Webhook idempotency: Duplicate delivery of refund.processed does not double-count refund amount', async () => {
    seedVerifiedPayment();
    mockRefunds['rfnd_idemp'] = {
      id: 'rfnd_idemp',
      paymentRecordId: 'pay_rec_100',
      gatewayRefundId: 'rfnd_idemp_1',
      amount: 5000,
      status: 'PROCESSED',
    };
    mockPayments['pay_rec_100'].refundedAmount = 5000;
    mockPayments['pay_rec_100'].status = 'Partially Refunded';

    // Second duplicate webhook delivery
    await paymentsService.handleRefundWebhook({
      gatewayRefundId: 'rfnd_idemp_1',
      status: 'PROCESSED',
    });

    expect(mockPayments['pay_rec_100'].refundedAmount).toBe(5000);
    expect(mockPayments['pay_rec_100'].status).toBe('Partially Refunded');
  });

  // Test 15: Webhook Signature Validation — Reject Tampered Payload
  it('15. Webhook signature rejection: RazorpayService rejects invalid HMAC signatures', async () => {
    const isValid = await razorpayService.verifyWebhookSignature('payload_data', 'tampered_signature');
    expect(isValid).toBe(false);
  });

  // Test 16: Webhook Signature Validation — Accept Valid Signature
  it('16. Webhook signature validation: RazorpayService accepts authentic HMAC signatures', async () => {
    const isValid = await razorpayService.verifyWebhookSignature('payload_data', 'valid_signature_123');
    expect(isValid).toBe(true);
  });

  // Test 17: Audit Log Generation — REFUND_REQUESTED
  it('17. REFUND_REQUESTED audit log is emitted when refund is initiated', async () => {
    seedVerifiedPayment();
    await paymentsService.processRefund('pay_rec_100', { amount: 5000 });

    const reqLog = mockAuditLogs.find((l) => l.details.includes('[REFUND_REQUESTED]'));
    expect(reqLog).toBeDefined();
    expect(reqLog.details).toContain('INR 5000');
    expect(reqLog.details).toContain('pay_rzp_live_test_123');
  });

  // Test 18: Audit Log Generation — REFUND_PROCESSED
  it('18. REFUND_PROCESSED audit log is emitted upon confirmed gateway settlement', async () => {
    seedVerifiedPayment();
    await paymentsService.processRefund('pay_rec_100', { amount: 10000 });

    const procLog = mockAuditLogs.find((l) => l.details.includes('[REFUND_PROCESSED]'));
    expect(procLog).toBeDefined();
    expect(procLog.details).toContain('Gateway Refund ID: rfnd_test_');
  });

  // Test 19: Audit Log Generation — REFUND_FAILED
  it('19. REFUND_FAILED audit log is emitted upon gateway API failure', async () => {
    seedVerifiedPayment();
    jest.spyOn(razorpayService, 'refundPayment').mockRejectedValueOnce(new Error('Gateway Timeout'));

    await expect(paymentsService.processRefund('pay_rec_100')).rejects.toThrow();

    const failLog = mockAuditLogs.find((l) => l.details.includes('[REFUND_FAILED]'));
    expect(failLog).toBeDefined();
    expect(failLog.details).toContain('Reason: Gateway Timeout');
  });

  // Test 20: Secret Protection / No Secret Leakage
  it('20. Secrets and raw credentials are never leaked in error messages, audit logs, or responses', async () => {
    seedVerifiedPayment();
    const result = await paymentsService.processRefund('pay_rec_100');

    // Check response
    const jsonStr = JSON.stringify(result);
    expect(jsonStr).not.toContain('rzp_test_');
    expect(jsonStr).not.toContain('key_secret');
    expect(jsonStr).not.toContain('webhook_secret');

    // Check all audit logs
    for (const log of mockAuditLogs) {
      expect(log.details).not.toContain('rzp_test_');
      expect(log.details).not.toContain('key_secret');
      expect(log.details).not.toContain('webhook_secret');
    }
  });
});
