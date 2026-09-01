import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CheckoutService } from './checkout.service';
import { RazorpayService } from './razorpay.service';
import { SubscriptionProvisioningService } from '../../subscriptions/services/subscription-provisioning.service';
import { PaymentsService } from '../../billing/services/payments.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('CheckoutService (Phase B1)', () => {
  let service: CheckoutService;
  let prisma: any;
  let razorpayService: any;
  let provisioningService: any;

  const mockPlan = {
    id: 'plan-std-uuid',
    name: 'STANDARD',
    code: 'PLAN_STD',
    status: 'Published',
  };

  const mockPlanVersion = {
    id: 'ver-std-v1',
    planId: 'plan-std-uuid',
    version: 1,
    status: 'Published',
    monthlyPrice: 5000,
    yearlyPrice: 60000,
    employeeLimit: 100,
    storageLimitGB: 50,
  };

  beforeEach(async () => {
    prisma = {
      company: {
        findUnique: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      saaSPlanNew: {
        findFirst: jest.fn().mockResolvedValue(mockPlan),
      },
      planVersion: {
        findFirst: jest.fn().mockResolvedValue(mockPlanVersion),
      },
      paymentOrder: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    razorpayService = {
      getKeyId: jest.fn().mockReturnValue('rzp_test_key_123'),
      createOrder: jest.fn().mockResolvedValue({
        id: 'order_rzp_123',
        amount: 500000,
        currency: 'INR',
        status: 'created',
      }),
      fetchPayment: jest.fn().mockImplementation(async (paymentId: string) => {
        if (paymentId === 'pay_wh_123') {
          return {
            id: paymentId,
            order_id: 'order_wh_456',
            amount: 500000,
            currency: 'INR',
            status: 'captured',
          };
        }
        if (paymentId === 'pay_failing') {
          return {
            id: paymentId,
            order_id: 'order_failing',
            amount: 500000,
            currency: 'INR',
            status: 'captured',
          };
        }
        return {
          id: paymentId,
          order_id: 'order_123',
          amount: 500000,
          currency: 'INR',
          status: 'captured',
        };
      }),
      verifyPaymentSignature: jest.fn().mockReturnValue(true),
      verifyWebhookSignature: jest.fn().mockReturnValue(true),
    };

    provisioningService = {
      createSubscription: jest.fn().mockResolvedValue({
        id: 'sub-uuid-123',
        companyId: 'company-uuid-123',
        status: 'Active',
        plan: 'STANDARD',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckoutService,
        { provide: PrismaService, useValue: prisma },
        { provide: RazorpayService, useValue: razorpayService },
        { provide: SubscriptionProvisioningService, useValue: provisioningService },
        {
          provide: PaymentsService,
          useValue: {
            createPaymentRecord: jest.fn().mockResolvedValue({}),
            processPayment: jest.fn().mockResolvedValue({}),
          },
        },
      ],
    }).compile();

    service = module.get<CheckoutService>(CheckoutService);
  });

  describe('1. Pricing & Order Creation', () => {
    it('should calculate price server-side in integer minor units (paise) and ignore client tampering', async () => {
      prisma.company.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.createCheckoutOrder({
        company: 'Stark Industries',
        plan: 'STANDARD',
        cycle: 'Monthly',
        ownerName: 'Tony Stark',
        ownerEmail: 'tony@stark.com',
      });

      expect(result.amountMinor).toBe(500000); // ₹5,000 * 100
      expect(result.currency).toBe('INR');
      expect(result.orderId).toBe('order_rzp_123');
      expect(razorpayService.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({ amountMinor: 500000, currency: 'INR' }),
      );
      expect(prisma.paymentOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orderId: 'order_rzp_123',
            amountMinor: 500000,
            planName: 'STANDARD',
            billingCycle: 'Monthly',
            status: 'CREATED',
          }),
        }),
      );
    });

    it('should calculate annual pricing correctly in minor units', async () => {
      prisma.company.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.createCheckoutOrder({
        company: 'Wayne Enterprises',
        plan: 'STANDARD',
        cycle: 'Annual',
        ownerName: 'Bruce Wayne',
        ownerEmail: 'bruce@wayne.com',
      });

      expect(result.amountMinor).toBe(6000000); // ₹60,000 * 100
      expect(result.cycle).toBe('Annual');
    });

    it('should reject invalid or non-existent plan identifier', async () => {
      prisma.company.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.saaSPlanNew.findFirst.mockResolvedValue(null);

      await expect(
        service.createCheckoutOrder({
          company: 'Oscorp',
          plan: 'NON_EXISTENT_PLAN',
          cycle: 'Monthly',
          ownerName: 'Norman Osborn',
          ownerEmail: 'norman@oscorp.com',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject plan if no published version is available', async () => {
      prisma.company.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.planVersion.findFirst.mockResolvedValue(null);

      await expect(
        service.createCheckoutOrder({
          company: 'Pym Tech',
          plan: 'STANDARD',
          cycle: 'Monthly',
          ownerName: 'Hank Pym',
          ownerEmail: 'hank@pym.com',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject company name collision before checkout order creation', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'comp-1', name: 'Existing Corp' });

      await expect(
        service.createCheckoutOrder({
          company: 'Existing Corp',
          plan: 'STANDARD',
          cycle: 'Monthly',
          ownerName: 'John Doe',
          ownerEmail: 'john@newcorp.com',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject owner email collision before checkout order creation', async () => {
      prisma.company.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'existing@corp.com' });

      await expect(
        service.createCheckoutOrder({
          company: 'Fresh Corp',
          plan: 'STANDARD',
          cycle: 'Monthly',
          ownerName: 'John Doe',
          ownerEmail: 'existing@corp.com',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('2. Payment Signature & Invariant Validation', () => {
    it('should reject invalid HMAC payment signatures', async () => {
      razorpayService.verifyPaymentSignature.mockReturnValue(false);

      await expect(
        service.verifyPayment({
          razorpay_order_id: 'order_123',
          razorpay_payment_id: 'pay_123',
          razorpay_signature: 'invalid_forged_sig',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject webhook with invalid signature', async () => {
      razorpayService.verifyWebhookSignature.mockReturnValue(false);

      await expect(
        service.handleWebhook(Buffer.from('{"event":"payment.captured"}'), 'bad_sig'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject payment if paymentId belongs to another order (replay protection)', async () => {
      const mockOrder = {
        id: 'order-row-1',
        orderId: 'order_A',
        status: 'CREATED',
        amountMinor: 500000,
        currency: 'INR',
        expiresAt: new Date(Date.now() + 100000),
      };

      prisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          $queryRaw: jest.fn().mockResolvedValue([mockOrder]),
          paymentOrder: {
            findFirst: jest.fn().mockResolvedValue({ id: 'order-row-99', orderId: 'order_B', paymentId: 'pay_replayed' }),
          },
        };
        return cb(tx);
      });

      await expect(
        service.verifyPayment({
          razorpay_order_id: 'order_A',
          razorpay_payment_id: 'pay_replayed',
          razorpay_signature: 'valid_sig',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject expired checkout sessions', async () => {
      const expiredOrder = {
        id: 'order-row-1',
        orderId: 'order_expired',
        status: 'CREATED',
        amountMinor: 500000,
        currency: 'INR',
        expiresAt: new Date(Date.now() - 60000), // Expired 1 min ago
      };

      prisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          $queryRaw: jest.fn().mockResolvedValue([expiredOrder]),
          paymentOrder: {
            findFirst: jest.fn().mockResolvedValue(null),
            update: jest.fn().mockResolvedValue({}),
          },
        };
        return cb(tx);
      });

      await expect(
        service.verifyPayment({
          razorpay_order_id: 'order_expired',
          razorpay_payment_id: 'pay_123',
          razorpay_signature: 'valid_sig',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('3. Decoupled Provisioning & Idempotency', () => {
    it('should successfully provision tenant workspace and transition to PROVISIONED', async () => {
      const pendingOrder = {
        id: 'order-row-1',
        orderId: 'order_123',
        status: 'CREATED',
        companyName: 'Acme Global',
        planName: 'STANDARD',
        billingCycle: 'Monthly',
        amountMinor: 500000,
        currency: 'INR',
        ownerName: 'Alice',
        ownerEmail: 'alice@acme.com',
        expiresAt: new Date(Date.now() + 100000),
      };

      prisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          $queryRaw: jest.fn().mockResolvedValue([pendingOrder]),
          paymentOrder: {
            findFirst: jest.fn().mockResolvedValue(null),
            update: jest.fn().mockResolvedValue({
              ...pendingOrder,
              status: 'PROVISIONING',
            }),
          },
        };
        return cb(tx);
      });

      prisma.paymentOrder.update.mockResolvedValue({
        ...pendingOrder,
        status: 'PROVISIONED',
        companyId: 'company-uuid-123',
        subscriptionId: 'sub-uuid-123',
      });

      const result = await service.verifyPayment({
        razorpay_order_id: 'order_123',
        razorpay_payment_id: 'pay_123',
        razorpay_signature: 'valid_sig',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('PROVISIONED');
      expect(result.companyId).toBe('company-uuid-123');
      expect(result.subscriptionId).toBe('sub-uuid-123');
      expect(provisioningService.createSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          company: 'Acme Global',
          plan: 'STANDARD',
          cycle: 'Monthly',
          amount: 5000, // Converted to major units
          ownerEmail: 'alice@acme.com',
          ownerName: 'Alice',
          status: 'Active',
        }),
      );
    });

    it('should be safely idempotent if order is already PROVISIONED', async () => {
      const alreadyProvisionedOrder = {
        id: 'order-row-1',
        orderId: 'order_already_done',
        status: 'PROVISIONED',
        companyId: 'comp-existing',
        subscriptionId: 'sub-existing',
        expiresAt: new Date(Date.now() + 100000),
      };

      prisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          $queryRaw: jest.fn().mockResolvedValue([alreadyProvisionedOrder]),
          paymentOrder: {
            findFirst: jest.fn().mockResolvedValue(null),
          },
        };
        return cb(tx);
      });

      const result = await service.verifyPayment({
        razorpay_order_id: 'order_already_done',
        razorpay_payment_id: 'pay_123',
        razorpay_signature: 'valid_sig',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('ALREADY_PROVISIONED');
      expect(provisioningService.createSubscription).not.toHaveBeenCalled();
    });

    it('should mark PROVISIONING_FAILED and allow recovery if createSubscription fails', async () => {
      const pendingOrder = {
        id: 'order-row-1',
        orderId: 'order_failing',
        status: 'CREATED',
        companyName: 'Failed Corp',
        planName: 'STANDARD',
        billingCycle: 'Monthly',
        amountMinor: 500000,
        currency: 'INR',
        ownerName: 'Bob',
        ownerEmail: 'bob@failed.com',
        expiresAt: new Date(Date.now() + 100000),
      };

      prisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          $queryRaw: jest.fn().mockResolvedValue([pendingOrder]),
          paymentOrder: {
            findFirst: jest.fn().mockResolvedValue(null),
            update: jest.fn().mockResolvedValue({
              ...pendingOrder,
              status: 'PROVISIONING',
            }),
          },
        };
        return cb(tx);
      });

      provisioningService.createSubscription.mockRejectedValue(
        new Error('Database timeout during employee role seeding'),
      );

      prisma.paymentOrder.update.mockResolvedValue({});

      await expect(
        service.verifyPayment({
          razorpay_order_id: 'order_failing',
          razorpay_payment_id: 'pay_failing',
          razorpay_signature: 'valid_sig',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.paymentOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-row-1' },
          data: expect.objectContaining({
            status: 'PROVISIONING_FAILED',
            failureReason: 'Database timeout during employee role seeding',
          }),
        }),
      );
    });

    it('should handle authoritative Razorpay webhook for payment.captured', async () => {
      const webhookPayload = JSON.stringify({
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_wh_123',
              order_id: 'order_wh_456',
              amount: 500000,
              currency: 'INR',
              status: 'captured',
            },
          },
        },
      });

      const pendingOrder = {
        id: 'order-wh-row',
        orderId: 'order_wh_456',
        status: 'CREATED',
        companyName: 'Webhook Corp',
        planName: 'STANDARD',
        billingCycle: 'Monthly',
        amountMinor: 500000,
        currency: 'INR',
        ownerName: 'Charlie',
        ownerEmail: 'charlie@webhook.com',
        expiresAt: new Date(Date.now() + 100000),
      };

      prisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          $queryRaw: jest.fn().mockResolvedValue([pendingOrder]),
          paymentOrder: {
            findFirst: jest.fn().mockResolvedValue(null),
            update: jest.fn().mockResolvedValue({
              ...pendingOrder,
              status: 'PROVISIONING',
            }),
          },
        };
        return cb(tx);
      });

      prisma.paymentOrder.update.mockResolvedValue({
        status: 'PROVISIONED',
        companyId: 'company-wh-123',
        subscriptionId: 'sub-wh-123',
      });

      const response = await service.handleWebhook(webhookPayload, 'valid_wh_sig');

      expect(response.received).toBe(true);
      expect(response.status).toBe('PROCESSED');
      expect(provisioningService.createSubscription).toHaveBeenCalled();
    });

    it('should fail fast on external Razorpay payment fetch failure without acquiring DB lock', async () => {
      razorpayService.fetchPayment.mockRejectedValueOnce(
        new BadRequestException('Razorpay API network failure'),
      );

      await expect(
        service.verifyPayment({
          razorpay_order_id: 'order_123',
          razorpay_payment_id: 'pay_fail_net',
          razorpay_signature: 'sig_123',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('4. Expired Checkout Orders Reconciliation (Cron Job)', () => {
    it('should reconcile stale CREATED orders with expiresAt < now to EXPIRED', async () => {
      prisma.paymentOrder.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.reconcileExpiredCheckoutOrders();

      expect(result.expiredCount).toBe(3);
      expect(prisma.paymentOrder.updateMany).toHaveBeenCalledWith({
        where: {
          status: 'CREATED',
          expiresAt: { lt: expect.any(Date) },
        },
        data: {
          status: 'EXPIRED',
        },
      });
    });

    it('should return 0 when no stale CREATED orders exist', async () => {
      prisma.paymentOrder.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.reconcileExpiredCheckoutOrders();

      expect(result.expiredCount).toBe(0);
    });

    it('should catch errors gracefully and return 0 count', async () => {
      prisma.paymentOrder.updateMany.mockRejectedValue(new Error('Database connectivity error'));

      const result = await service.reconcileExpiredCheckoutOrders();

      expect(result.expiredCount).toBe(0);
    });
  });
});
