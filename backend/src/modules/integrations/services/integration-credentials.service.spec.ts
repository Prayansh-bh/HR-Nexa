import { Test, TestingModule } from '@nestjs/testing';
import { IntegrationCredentialsService } from './integration-credentials.service';
import { IntegrationResolverService } from './integration-resolver.service';
import { EncryptionService } from '../../../common/security/encryption.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLoggerService } from '../../../common/audit/audit-logger.service';
import { IntegrationProvider, IntegrationStatus } from '../types/integration.types';
import * as crypto from 'crypto';

describe('Integration Credentials & Resolver Services (Security Remediations)', () => {
  let credentialsService: IntegrationCredentialsService;
  let resolverService: IntegrationResolverService;
  let prismaService: any;
  let encryptionService: EncryptionService;
  let auditLoggerService: any;

  const TEST_KEY = crypto.randomBytes(32).toString('hex');
  const SECOND_KEY = crypto.randomBytes(32).toString('hex');

  const mockDbRecords: Record<string, any> = {};

  beforeEach(async () => {
    process.env.ENCRYPTION_KEY = TEST_KEY;

    // Reset in-memory mock DB
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
          // Simulate DB partial unique index constraint check (SEC-P2-02)
          const targetCompanyId = data.companyId ?? null;
          const duplicate = Object.values(mockDbRecords).find((r: any) => {
            if (r.provider !== data.provider) return false;
            return r.companyId === targetCompanyId;
          });

          if (duplicate) {
            const err = new Error('Unique constraint failed on partial index');
            (err as any).code = 'P2002';
            return Promise.reject(err);
          }

          const newRecord = {
            id: `ic_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            provider: data.provider,
            name: data.name,
            enabled: data.enabled ?? true,
            companyId: targetCompanyId,
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

    auditLoggerService = {
      logAction: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntegrationCredentialsService,
        IntegrationResolverService,
        EncryptionService,
        { provide: ConfigService, useValue: { get: (key: string) => process.env[key] } },
        { provide: PrismaService, useValue: prismaService },
        { provide: AuditLoggerService, useValue: auditLoggerService },
      ],
    }).compile();

    credentialsService = module.get<IntegrationCredentialsService>(IntegrationCredentialsService);
    resolverService = module.get<IntegrationResolverService>(IntegrationResolverService);
    encryptionService = module.get<EncryptionService>(EncryptionService);
  });

  afterEach(() => {
    delete process.env.ENCRYPTION_KEY;
  });

  // ==========================================
  // REMEDIATION 1 (SEC-P1-01): FAIL-FAST RESOLVER
  // ==========================================
  describe('SEC-P1-01: Resolver Fail-Fast Behavior', () => {
    it('1. No DB credential -> .env is used', async () => {
      process.env.RAZORPAY_KEY_ID = 'env_rzp_key';
      process.env.RAZORPAY_KEY_SECRET = 'env_rzp_secret';

      const resolved = await resolverService.resolveRazorpay(null);
      expect(resolved.source).toEqual('ENV');
      expect(resolved.keyId).toEqual('env_rzp_key');
    });

    it('2. Disabled DB credential -> .env is used', async () => {
      process.env.AWS_REGION = 'ap-south-1';
      process.env.AWS_S3_BUCKET = 'env-bucket';
      process.env.AWS_ACCESS_KEY_ID = 'env-access';
      process.env.AWS_SECRET_ACCESS_KEY = 'env-secret';

      const created = await credentialsService.createCredential({
        provider: IntegrationProvider.AWS_S3,
        name: 'Disabled S3',
        config: { region: 'ap-south-1', bucket: 'db-bucket', accessKeyId: 'db-access' },
        secrets: { secretAccessKey: 'db-secret' },
      });

      await credentialsService.setCredentialStatus(created.id, false);

      const resolved = await resolverService.resolveAwsS3(null);
      expect(resolved.source).toEqual('ENV');
      expect(resolved.bucket).toEqual('env-bucket');
    });

    it('3. Enabled valid DB credential -> DB is used', async () => {
      await credentialsService.createCredential({
        provider: IntegrationProvider.RAZORPAY,
        name: 'Active Razorpay',
        config: { keyId: 'db_rzp_key' },
        secrets: { keySecret: 'db_rzp_secret', webhookSecret: 'db_wh_secret' },
      });

      const resolved = await resolverService.resolveRazorpay(null);
      expect(resolved.source).toEqual('DB');
      expect(resolved.keyId).toEqual('db_rzp_key');
    });

    it('4. Enabled corrupted DB credential -> resolver THROWS (NO .env fallback!)', async () => {
      process.env.RAZORPAY_KEY_ID = 'env_fallback_key';

      // Insert corrupted payload directly into DB
      mockDbRecords['corrupted_rzp'] = {
        id: 'corrupted_rzp',
        provider: IntegrationProvider.RAZORPAY,
        name: 'Corrupted Razorpay',
        enabled: true,
        companyId: null,
        config: { keyId: 'db_key' },
        encryptedSecrets: 'v1:corrupted:corrupted:corrupted',
        status: IntegrationStatus.CONNECTED,
      };

      await expect(resolverService.resolveRazorpay(null)).rejects.toThrow(
        /Failed to resolve active DB Razorpay integration credential/,
      );
    });

    it('5. Enabled DB credential with wrong encryption key -> resolver THROWS (NO .env fallback!)', async () => {
      process.env.EMAIL_HOST = 'env.smtp.com';

      // Encrypt record with SECOND_KEY
      const encryptedWithOtherKey = encryptionService.encrypt(
        JSON.stringify({ password: 'smtp_password' }),
        SECOND_KEY,
      );

      mockDbRecords['wrong_key_smtp'] = {
        id: 'wrong_key_smtp',
        provider: IntegrationProvider.SMTP_EMAIL,
        name: 'SMTP Wrong Key',
        enabled: true,
        companyId: null,
        config: { host: 'db.smtp.com' },
        encryptedSecrets: encryptedWithOtherKey,
        status: IntegrationStatus.CONNECTED,
      };

      // Current process.env.ENCRYPTION_KEY is TEST_KEY, so decryption fails
      await expect(resolverService.resolveSmtp(null)).rejects.toThrow(
        /Failed to resolve active DB SMTP integration credential/,
      );
    });
  });

  // ==========================================
  // REMEDIATION 2 (SEC-P2-01): REJECT SECRET FIELDS IN CONFIG
  // ==========================================
  describe('SEC-P2-01: Reject Secret Fields in config JSON', () => {
    it('1. Secret field inside config is rejected on createCredential', async () => {
      const dto = {
        provider: IntegrationProvider.RAZORPAY,
        name: 'Malicious Config Razorpay',
        config: {
          keyId: 'rzp_test_123',
          keySecret: 'SUPER_SECRET_PLAIN_TEXT', // Secret in config!
        },
        secrets: {
          webhookSecret: 'wh_123',
        },
      };

      await expect(credentialsService.createCredential(dto)).rejects.toThrow(
        /Security violation: Secret field "keySecret" must not be passed inside public config dictionary/,
      );
    });

    it('2. Multiple secret fields inside config are rejected', async () => {
      const dto = {
        provider: IntegrationProvider.RAZORPAY,
        name: 'Multiple Secrets Config',
        config: {
          keyId: 'rzp_test_123',
          keySecret: 'SECRET_1',
          webhookSecret: 'SECRET_2',
        },
        secrets: {},
      };

      await expect(credentialsService.createCredential(dto)).rejects.toThrow(
        /Security violation: Secret field/,
      );
    });

    it('3. Non-secret fields inside config remain accepted', async () => {
      const created = await credentialsService.createCredential({
        provider: IntegrationProvider.AWS_S3,
        name: 'Clean S3',
        config: { region: 'eu-west-1', bucket: 'my-bucket', accessKeyId: 'AKIA_TEST' },
        secrets: { secretAccessKey: 'MY_AWS_SECRET' },
      });

      expect(created.config.region).toEqual('eu-west-1');
      expect(created.config.bucket).toEqual('my-bucket');
    });

    it('4. updateCredential also rejects secret fields inside config', async () => {
      const created = await credentialsService.createCredential({
        provider: IntegrationProvider.SMTP_EMAIL,
        name: 'Valid SMTP',
        config: { host: 'smtp.test.com', port: 587, secure: false, user: 'test', from: 'a@b.com', name: 'Test' },
        secrets: { password: 'pass' },
      });

      await expect(
        credentialsService.updateCredential(created.id, {
          config: { password: 'NEW_PLAINTEXT_SECRET' },
        }),
      ).rejects.toThrow(/Security violation: Secret field "password" must not be passed inside public config dictionary/);
    });

    it('5. Original DTO object is not mutated', async () => {
      const originalDto = {
        provider: IntegrationProvider.RAZORPAY,
        name: 'Mutation Test',
        config: { keyId: 'rzp_key_99' },
        secrets: { keySecret: 'rzp_sec_99', webhookSecret: 'rzp_wh_99' },
      };

      const dtoCopy = JSON.parse(JSON.stringify(originalDto));
      await credentialsService.createCredential(originalDto);

      expect(originalDto).toEqual(dtoCopy);
    });
  });

  // ==========================================
  // REMEDIATION 3 (SEC-P2-02): DATABASE-LEVEL DUPLICATE PROTECTION
  // ==========================================
  describe('SEC-P2-02: Database Uniqueness Constraints', () => {
    it('1. Duplicate platform credential rejected by DB constraint', async () => {
      await credentialsService.createCredential({
        provider: IntegrationProvider.RAZORPAY,
        name: 'Platform Razorpay 1',
        companyId: null,
        config: { keyId: 'rzp_1' },
        secrets: { keySecret: 'sec_1', webhookSecret: 'wh_1' },
      });

      await expect(
        credentialsService.createCredential({
          provider: IntegrationProvider.RAZORPAY,
          name: 'Platform Razorpay 2',
          companyId: null,
          config: { keyId: 'rzp_2' },
          secrets: { keySecret: 'sec_2', webhookSecret: 'wh_2' },
        }),
      ).rejects.toThrow(/Platform integration credential for provider "RAZORPAY" already exists/);
    });

    it('2. Duplicate tenant credential rejected for same companyId & provider', async () => {
      await credentialsService.createCredential({
        provider: IntegrationProvider.AWS_S3,
        name: 'Tenant S3 1',
        companyId: 'company_abc',
        config: { region: 'ap-south-1', bucket: 'b1', accessKeyId: 'ak1' },
        secrets: { secretAccessKey: 'sk1' },
      });

      await expect(
        credentialsService.createCredential({
          provider: IntegrationProvider.AWS_S3,
          name: 'Tenant S3 2',
          companyId: 'company_abc',
          config: { region: 'ap-south-1', bucket: 'b2', accessKeyId: 'ak2' },
          secrets: { secretAccessKey: 'sk2' },
        }),
      ).rejects.toThrow(/Integration credential for provider "AWS_S3" and company already exists/);
    });

    it('3. Different providers can coexist for platform', async () => {
      const p1 = await credentialsService.createCredential({
        provider: IntegrationProvider.RAZORPAY,
        name: 'Platform Razorpay',
        companyId: null,
        config: { keyId: 'rzp' },
        secrets: { keySecret: 'sec', webhookSecret: 'wh' },
      });

      const p2 = await credentialsService.createCredential({
        provider: IntegrationProvider.AWS_S3,
        name: 'Platform AWS S3',
        companyId: null,
        config: { region: 'ap-south-1', bucket: 'b', accessKeyId: 'ak' },
        secrets: { secretAccessKey: 'sk' },
      });

      expect(p1.id).toBeDefined();
      expect(p2.id).toBeDefined();
    });

    it('4. Different companies can have credentials for the same provider', async () => {
      const c1 = await credentialsService.createCredential({
        provider: IntegrationProvider.AWS_S3,
        name: 'Company 1 S3',
        companyId: 'company_1',
        config: { region: 'ap-south-1', bucket: 'b1', accessKeyId: 'ak1' },
        secrets: { secretAccessKey: 'sk1' },
      });

      const c2 = await credentialsService.createCredential({
        provider: IntegrationProvider.AWS_S3,
        name: 'Company 2 S3',
        companyId: 'company_2',
        config: { region: 'ap-south-1', bucket: 'b2', accessKeyId: 'ak2' },
        secrets: { secretAccessKey: 'sk2' },
      });

      expect(c1.companyId).toEqual('company_1');
      expect(c2.companyId).toEqual('company_2');
    });
  });
});
