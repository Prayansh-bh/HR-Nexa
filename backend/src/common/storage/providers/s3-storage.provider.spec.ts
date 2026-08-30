import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { S3StorageProvider } from './s3-storage.provider';
import { IntegrationResolverService } from '../../../modules/integrations/services/integration-resolver.service';
import { IntegrationCredentialsService } from '../../../modules/integrations/services/integration-credentials.service';
import { EncryptionService } from '../../security/encryption.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLoggerService } from '../../audit/audit-logger.service';
import { IntegrationProvider, IntegrationStatus } from '../../../modules/integrations/types/integration.types';
import * as crypto from 'crypto';

describe('S3StorageProvider Integration Resolver Migration (Phase 3B)', () => {
  let provider: S3StorageProvider;
  let resolverService: IntegrationResolverService;
  let credentialsService: IntegrationCredentialsService;
  let encryptionService: EncryptionService;
  let prismaService: any;

  const TEST_KEY = crypto.randomBytes(32).toString('hex');
  const SECOND_KEY = crypto.randomBytes(32).toString('hex');
  const mockDbRecords: Record<string, any> = {};

  beforeEach(async () => {
    process.env.ENCRYPTION_KEY = TEST_KEY;
    process.env.AWS_REGION = 'ap-south-1';
    process.env.AWS_S3_BUCKET = 'env-test-bucket';
    process.env.AWS_ACCESS_KEY_ID = 'AKIA_ENV_KEY';
    process.env.AWS_SECRET_ACCESS_KEY = 'ENV_SECRET_KEY';

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
        S3StorageProvider,
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

    provider = module.get<S3StorageProvider>(S3StorageProvider);
    resolverService = module.get<IntegrationResolverService>(IntegrationResolverService);
    credentialsService = module.get<IntegrationCredentialsService>(IntegrationCredentialsService);
    encryptionService = module.get<EncryptionService>(EncryptionService);
  });

  afterEach(() => {
    delete process.env.ENCRYPTION_KEY;
  });

  // Test 1
  it('1. S3 provider uses IntegrationResolverService', async () => {
    const resolveSpy = jest.spyOn(resolverService, 'resolveAwsS3');
    const resolved = await (provider as any).resolveCredentials(null);

    expect(resolveSpy).toHaveBeenCalledWith(null);
    expect(resolved.bucketName).toEqual('env-test-bucket');
  });

  // Test 2
  it('2. Enabled DB AWS credential is used', async () => {
    await credentialsService.createCredential({
      provider: IntegrationProvider.AWS_S3,
      name: 'Active S3 DB',
      config: { region: 'us-east-1', bucket: 'db-s3-bucket', accessKeyId: 'AKIA_DB_KEY' },
      secrets: { secretAccessKey: 'DB_SECRET_KEY' },
    });

    const resolved = await (provider as any).resolveCredentials(null);
    expect(resolved.region).toEqual('us-east-1');
    expect(resolved.bucketName).toEqual('db-s3-bucket');
    expect(resolved.accessKeyId).toEqual('AKIA_DB_KEY');
    expect(resolved.secretAccessKey).toEqual('DB_SECRET_KEY');
  });

  // Test 3
  it('3. No DB credential uses .env', async () => {
    const resolved = await (provider as any).resolveCredentials(null);
    expect(resolved.region).toEqual('ap-south-1');
    expect(resolved.bucketName).toEqual('env-test-bucket');
    expect(resolved.accessKeyId).toEqual('AKIA_ENV_KEY');
    expect(resolved.secretAccessKey).toEqual('ENV_SECRET_KEY');
  });

  // Test 4
  it('4. Disabled DB credential uses .env', async () => {
    const created = await credentialsService.createCredential({
      provider: IntegrationProvider.AWS_S3,
      name: 'Disabled S3 DB',
      config: { region: 'us-west-2', bucket: 'disabled-bucket', accessKeyId: 'AKIA_DISABLED' },
      secrets: { secretAccessKey: 'DISABLED_SECRET' },
    });

    await credentialsService.setCredentialStatus(created.id, false);

    const resolved = await (provider as any).resolveCredentials(null);
    expect(resolved.bucketName).toEqual('env-test-bucket');
    expect(resolved.accessKeyId).toEqual('AKIA_ENV_KEY');
  });

  // Test 5
  it('5. Corrupted active DB credential fails fast', async () => {
    mockDbRecords['corrupted_s3'] = {
      id: 'corrupted_s3',
      provider: IntegrationProvider.AWS_S3,
      name: 'Corrupted S3',
      enabled: true,
      companyId: null,
      config: { region: 'ap-south-1', bucket: 'b', accessKeyId: 'ak' },
      encryptedSecrets: 'v1:corrupted:corrupted:corrupted',
      status: IntegrationStatus.CONNECTED,
    };

    await expect((provider as any).resolveCredentials(null)).rejects.toThrow(
      /Failed to resolve active DB AWS S3 integration credential/,
    );
  });

  // Test 6
  it('6. Wrong encryption key fails fast', async () => {
    const encryptedWithOtherKey = encryptionService.encrypt(
      JSON.stringify({ secretAccessKey: 'secret' }),
      SECOND_KEY,
    );

    mockDbRecords['wrong_key_s3'] = {
      id: 'wrong_key_s3',
      provider: IntegrationProvider.AWS_S3,
      name: 'Wrong Key S3',
      enabled: true,
      companyId: null,
      config: { region: 'ap-south-1', bucket: 'b', accessKeyId: 'ak' },
      encryptedSecrets: encryptedWithOtherKey,
      status: IntegrationStatus.CONNECTED,
    };

    await expect((provider as any).resolveCredentials(null)).rejects.toThrow(
      /Failed to resolve active DB AWS S3 integration credential/,
    );
  });

  // Test 7
  it('7. Missing required DB AWS field fails fast', async () => {
    const encryptedSecrets = encryptionService.encrypt(JSON.stringify({})); // Missing secretAccessKey

    mockDbRecords['missing_fields_s3'] = {
      id: 'missing_fields_s3',
      provider: IntegrationProvider.AWS_S3,
      name: 'Incomplete S3 DB',
      enabled: true,
      companyId: null,
      config: { region: 'ap-south-1', bucket: 'b' }, // Missing accessKeyId
      encryptedSecrets,
      status: IntegrationStatus.CONNECTED,
    };

    await expect((provider as any).resolveCredentials(null)).rejects.toThrow(
      /Failed to resolve active DB AWS S3 integration credential/,
    );
  });

  // Test 8
  it('8. SecretAccessKey is never logged', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();

    const secretValue = 'TOP_CONFIDENTIAL_AWS_SECRET_KEY_777';

    await credentialsService.createCredential({
      provider: IntegrationProvider.AWS_S3,
      name: 'Logged S3 Test',
      config: { region: 'ap-south-1', bucket: 'b-log-test', accessKeyId: 'AKIA_LOG' },
      secrets: { secretAccessKey: secretValue },
    });

    await (provider as any).resolveCredentials(null);

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

  // Test 9
  it('9. S3Client receives the resolved credentials', async () => {
    await credentialsService.createCredential({
      provider: IntegrationProvider.AWS_S3,
      name: 'S3Client Creds Test',
      config: { region: 'eu-central-1', bucket: 'eu-bucket', accessKeyId: 'AKIA_EU' },
      secrets: { secretAccessKey: 'EU_SECRET' },
    });

    const ctx = await (provider as any).getS3Context(null);
    expect(ctx.region).toEqual('eu-central-1');
    expect(ctx.bucketName).toEqual('eu-bucket');
    expect(ctx.client).toBeDefined();
  });

  // Test 10
  it('10. Bucket uses resolved bucket configuration', async () => {
    await credentialsService.createCredential({
      provider: IntegrationProvider.AWS_S3,
      name: 'Bucket Conf Test',
      config: { region: 'ap-south-1', bucket: 'custom-resolved-bucket', accessKeyId: 'AKIA_CUST' },
      secrets: { secretAccessKey: 'CUST_SEC' },
    });

    const ctx = await (provider as any).getS3Context(null);
    expect(ctx.bucketName).toEqual('custom-resolved-bucket');
  });

  // Test 11
  it('11. Region uses resolved region configuration', async () => {
    await credentialsService.createCredential({
      provider: IntegrationProvider.AWS_S3,
      name: 'Region Conf Test',
      config: { region: 'sa-east-1', bucket: 'sa-bucket', accessKeyId: 'AKIA_SA' },
      secrets: { secretAccessKey: 'SA_SEC' },
    });

    const ctx = await (provider as any).getS3Context(null);
    expect(ctx.region).toEqual('sa-east-1');
  });

  // Test 12
  it('12. Existing upload behavior remains unchanged', async () => {
    const file = {
      buffer: Buffer.from('test contents'),
      originalname: 'document.pdf',
      mimetype: 'application/pdf',
      size: 13,
    };

    const mockSend = jest.fn().mockResolvedValue({ ETag: '"12345"' });
    jest.spyOn(provider as any, 'getS3Context').mockResolvedValue({
      client: { send: mockSend },
      bucketName: 'mock-bucket',
      region: 'ap-south-1',
    });

    const result = await provider.upload(file, { category: 'documents', companyId: 'comp_100' });
    expect(result.key).toContain('tenants/comp_100/documents/');
    expect(result.mimeType).toEqual('application/pdf');
    expect(result.etag).toEqual('12345');
  });

  // Test 13
  it('13. Existing download behavior remains unchanged', async () => {
    const mockStream = Buffer.from('downloaded stream');
    const mockSend = jest.fn().mockResolvedValue({ Body: mockStream });

    jest.spyOn(provider as any, 'getS3Context').mockResolvedValue({
      client: { send: mockSend },
      bucketName: 'mock-bucket',
      region: 'ap-south-1',
    });

    const stream = await provider.download('tenants/comp_100/documents/doc.pdf');
    expect(stream).toEqual(mockStream);
  });

  // Test 14
  it('14. Existing delete behavior remains unchanged', async () => {
    const mockSend = jest.fn().mockResolvedValue({});

    jest.spyOn(provider as any, 'getS3Context').mockResolvedValue({
      client: { send: mockSend },
      bucketName: 'mock-bucket',
      region: 'ap-south-1',
    });

    const success = await provider.delete('tenants/comp_100/documents/doc.pdf');
    expect(success).toBe(true);
  });

  // Test 15
  it('15. Existing healthCheck behavior remains unchanged', async () => {
    const mockSend = jest.fn().mockImplementation((command: any) => {
      if (command.constructor.name === 'HeadBucketCommand') return Promise.resolve({});
      if (command.constructor.name === 'GetBucketLocationCommand')
        return Promise.resolve({ LocationConstraint: 'ap-south-1' });
      return Promise.resolve({});
    });

    jest.spyOn(provider as any, 'getS3Context').mockResolvedValue({
      client: { send: mockSend },
      bucketName: 'health-check-bucket',
      region: 'ap-south-1',
    });

    const isHealthy = await provider.healthCheck();
    expect(isHealthy).toBe(true);
  });
});
