import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RazorpayService } from './razorpay.service';
import { IntegrationResolverService } from '../../integrations/services/integration-resolver.service';
import { IntegrationCredentialsService } from '../../integrations/services/integration-credentials.service';
import { EncryptionService } from '../../../common/security/encryption.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLoggerService } from '../../../common/audit/audit-logger.service';
import { IntegrationProvider, IntegrationStatus } from '../../integrations/types/integration.types';
import * as crypto from 'crypto';

describe('RazorpayService Integration Resolver Migration (Phase 3A)', () => {
  let razorpayService: RazorpayService;
  let resolverService: IntegrationResolverService;
  let credentialsService: IntegrationCredentialsService;
  let prismaService: any;
  let encryptionService: EncryptionService;

  const TEST_KEY = crypto.randomBytes(32).toString('hex');
  const SECOND_KEY = crypto.randomBytes(32).toString('hex');

  const mockDbRecords: Record<string, any> = {};

  beforeEach(async () => {
    process.env.ENCRYPTION_KEY = TEST_KEY;
    process.env.NODE_ENV = 'test';
    process.env.RAZORPAY_KEY_ID = 'rzp_env_key_id_123';
    process.env.RAZORPAY_KEY_SECRET = 'env_secret_key_123';
    process.env.RAZORPAY_WEBHOOK_SECRET = 'env_webhook_secret_123';

    for (const key of Object.keys(mockDbRecords)) {
      delete mockDbRecords[key];
    }

    prismaService = {
      integrationCredential: {
        findFirst: jest.fn().mockImplementation(({ where }) => {
          const record = Object.values(mockDbRecords).find((r: any) => {
            if (where.provider && r.provider !== where.provider) return false;
            if (where.companyId !== undefined && r.companyId !== where.companyId) return false;
            if (where.enabled !== undefined && r.enabled !== where.enabled) return false;
            return true;
          });
          return Promise.resolve(record || null);
        }),
        findUnique: jest.fn().mockImplementation(({ where }) => {
          return Promise.resolve(mockDbRecords[where.id] || null);
        }),
        findMany: jest.fn().mockImplementation(({ where }) => {
          const list = Object.values(mockDbRecords).filter((r: any) => {
            if (where.companyId !== undefined && r.companyId !== where.companyId) return false;
            return true;
          });
          return Promise.resolve(list);
        }),
        create: jest.fn().mockImplementation(({ data }) => {
          const newRecord = {
            id: `ic_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            provider: data.provider,
            name: data.name,
            enabled: data.enabled ?? true,
            companyId: data.companyId ?? null,
            config: data.config,
            encryptedSecrets: data.encryptedSecrets,
            status: data.status ?? IntegrationStatus.UNTESTED,
            lastTestedAt: null,
            lastError: null,
            createdById: data.createdById ?? null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          mockDbRecords[newRecord.id] = newRecord;
          return Promise.resolve(newRecord);
        }),
        update: jest.fn().mockImplementation(({ where, data }) => {
          const existing = mockDbRecords[where.id];
          if (!existing) return Promise.reject(new Error('Not found'));
          const updated = {
            ...existing,
            ...data,
            updatedAt: new Date(),
          };
          mockDbRecords[where.id] = updated;
          return Promise.resolve(updated);
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RazorpayService,
        IntegrationResolverService,
        IntegrationCredentialsService,
        EncryptionService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => process.env[key],
          },
        },
        { provide: PrismaService, useValue: prismaService },
        { provide: AuditLoggerService, useValue: { logAction: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();

    razorpayService = module.get<RazorpayService>(RazorpayService);
    resolverService = module.get<IntegrationResolverService>(IntegrationResolverService);
    credentialsService = module.get<IntegrationCredentialsService>(IntegrationCredentialsService);
    encryptionService = module.get<EncryptionService>(EncryptionService);
  });

  afterEach(() => {
    delete process.env.ENCRYPTION_KEY;
  });

  // Test 1
  it('1. RazorpayService uses IntegrationResolverService credentials', async () => {
    const resolveSpy = jest.spyOn(resolverService, 'resolveRazorpay');
    const keyId = await razorpayService.getKeyId();

    expect(resolveSpy).toHaveBeenCalledWith(null);
    expect(keyId).toEqual('rzp_env_key_id_123');
  });

  // Test 2
  it('2. DB Razorpay credential is used when enabled', async () => {
    await credentialsService.createCredential({
      provider: IntegrationProvider.RAZORPAY,
      name: 'Active DB Razorpay',
      config: { keyId: 'rzp_db_key_id_999' },
      secrets: { keySecret: 'db_secret_key_999', webhookSecret: 'db_wh_secret_999' },
    });

    const keyId = await razorpayService.getKeyId();
    expect(keyId).toEqual('rzp_db_key_id_999');
  });

  // Test 3
  it('3. .env Razorpay credential is used when no enabled DB credential exists', async () => {
    const keyId = await razorpayService.getKeyId();
    expect(keyId).toEqual('rzp_env_key_id_123');
  });

  // Test 4
  it('4. Disabled DB credential results in .env fallback', async () => {
    const created = await credentialsService.createCredential({
      provider: IntegrationProvider.RAZORPAY,
      name: 'Disabled DB Razorpay',
      config: { keyId: 'rzp_disabled_db_key' },
      secrets: { keySecret: 'disabled_secret', webhookSecret: 'disabled_wh' },
    });

    await credentialsService.setCredentialStatus(created.id, false);

    const keyId = await razorpayService.getKeyId();
    expect(keyId).toEqual('rzp_env_key_id_123');
  });

  // Test 5
  it('5. Corrupted active DB credential causes failure (fail fast)', async () => {
    mockDbRecords['corrupted_id'] = {
      id: 'corrupted_id',
      provider: IntegrationProvider.RAZORPAY,
      name: 'Corrupted Razorpay',
      enabled: true,
      companyId: null,
      config: { keyId: 'rzp_corrupted_key' },
      encryptedSecrets: 'v1:corrupted:corrupted:corrupted',
      status: IntegrationStatus.CONNECTED,
    };

    await expect(razorpayService.getKeyId()).rejects.toThrow(
      /Failed to resolve active DB Razorpay integration credential/,
    );
  });

  // Test 6
  it('6. Wrong encryption key causes failure (fail fast)', async () => {
    const encryptedWithOtherKey = encryptionService.encrypt(
      JSON.stringify({ keySecret: 'sec', webhookSecret: 'wh' }),
      SECOND_KEY,
    );

    mockDbRecords['wrong_key_id'] = {
      id: 'wrong_key_id',
      provider: IntegrationProvider.RAZORPAY,
      name: 'Wrong Key Razorpay',
      enabled: true,
      companyId: null,
      config: { keyId: 'rzp_wrong_key' },
      encryptedSecrets: encryptedWithOtherKey,
      status: IntegrationStatus.CONNECTED,
    };

    await expect(razorpayService.getKeyId()).rejects.toThrow(
      /Failed to resolve active DB Razorpay integration credential/,
    );
  });

  // Test 7
  it('7. Razorpay key secret is never logged', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();

    const secretValue = 'ULTRA_CONFIDENTIAL_RAZORPAY_SECRET_999';

    await credentialsService.createCredential({
      provider: IntegrationProvider.RAZORPAY,
      name: 'Logged Secret Test',
      config: { keyId: 'rzp_log_test' },
      secrets: { keySecret: secretValue, webhookSecret: 'wh_secret' },
    });

    await razorpayService.getKeyId();

    const allLogs = [
      ...consoleSpy.mock.calls.flatMap((c) => c),
      ...warnSpy.mock.calls.flatMap((c) => c),
      ...errorSpy.mock.calls.flatMap((c) => c),
    ].join(' ');

    expect(allLogs).not.toContain(secretValue);
    expect(allLogs).not.toContain(TEST_KEY);

    consoleSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  // Test 8
  it('8. Webhook secret is resolved through IntegrationResolverService', async () => {
    await credentialsService.createCredential({
      provider: IntegrationProvider.RAZORPAY,
      name: 'DB Razorpay Webhook',
      config: { keyId: 'rzp_db_key' },
      secrets: { keySecret: 'db_secret', webhookSecret: 'custom_db_webhook_secret' },
    });

    const rawBody = '{"event":"payment.captured"}';

    // Calculate valid HMAC signature using DB webhookSecret
    const expectedSig = crypto
      .createHmac('sha256', 'custom_db_webhook_secret')
      .update(rawBody)
      .digest('hex');

    const isValid = await razorpayService.verifyWebhookSignature(rawBody, expectedSig);
    expect(isValid).toBe(true);

    // Invalid signature should fail
    const isInvalid = await razorpayService.verifyWebhookSignature(rawBody, 'invalid_sig_hex');
    expect(isInvalid).toBe(false);
  });

  // Test 9
  it('9. Existing Razorpay order creation behavior remains unchanged', async () => {
    const order = await razorpayService.createOrder({
      amountMinor: 500000,
      currency: 'INR',
      receipt: 'receipt_123',
    });

    expect(order.id).toBeDefined();
    expect(order.amount).toEqual(500000);
    expect(order.currency).toEqual('INR');
    expect(order.status).toEqual('created');
  });

  // Test 10
  it('10. Existing payment signature verification behavior remains unchanged', async () => {
    const orderId = 'order_test_123';
    const paymentId = 'pay_test_456';
    const payload = `${orderId}|${paymentId}`;

    const validSig = crypto
      .createHmac('sha256', 'env_secret_key_123')
      .update(payload)
      .digest('hex');

    const isValid = await razorpayService.verifyPaymentSignature({
      orderId,
      paymentId,
      signature: validSig,
    });

    expect(isValid).toBe(true);
  });

  // Test 11
  it('11. Existing webhook verification behavior remains unchanged', async () => {
    const rawBody = '{"event":"order.paid"}';
    const validSig = crypto
      .createHmac('sha256', 'env_webhook_secret_123')
      .update(rawBody)
      .digest('hex');

    const isValid = await razorpayService.verifyWebhookSignature(rawBody, validSig);
    expect(isValid).toBe(true);
  });
});
