import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import { IntegrationResolverService } from '../modules/integrations/services/integration-resolver.service';
import { IntegrationCredentialsService } from '../modules/integrations/services/integration-credentials.service';
import { EncryptionService } from '../common/security/encryption.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLoggerService } from '../common/audit/audit-logger.service';
import { IntegrationProvider, IntegrationStatus } from '../modules/integrations/types/integration.types';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';

jest.mock('nodemailer');

describe('EmailService Integration Resolver Migration (Phase 3C)', () => {
  let emailService: EmailService;
  let resolverService: IntegrationResolverService;
  let credentialsService: IntegrationCredentialsService;
  let encryptionService: EncryptionService;
  let prismaService: any;
  let mockSendMail: jest.Mock;

  const TEST_KEY = crypto.randomBytes(32).toString('hex');
  const SECOND_KEY = crypto.randomBytes(32).toString('hex');
  const mockDbRecords: Record<string, any> = {};

  beforeEach(async () => {
    process.env.ENCRYPTION_KEY = TEST_KEY;
    process.env.EMAIL_HOST = 'smtp.env-test.com';
    process.env.EMAIL_PORT = '587';
    process.env.EMAIL_SECURE = 'false';
    process.env.EMAIL_USER = 'env_user@test.com';
    process.env.EMAIL_PASS = 'ENV_SECRET_PASSWORD';
    process.env.EMAIL_FROM = 'noreply@env-test.com';
    process.env.EMAIL_NAME = 'HR Nexa ENV Support';

    for (const key of Object.keys(mockDbRecords)) {
      delete mockDbRecords[key];
    }

    mockSendMail = jest.fn().mockResolvedValue({ messageId: 'msg_12345' });
    (nodemailer.createTransport as jest.Mock).mockReturnValue({
      sendMail: mockSendMail,
      verify: jest.fn().mockImplementation((cb) => cb(null)),
    });

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
        EmailService,
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

    emailService = module.get<EmailService>(EmailService);
    resolverService = module.get<IntegrationResolverService>(IntegrationResolverService);
    credentialsService = module.get<IntegrationCredentialsService>(IntegrationCredentialsService);
    encryptionService = module.get<EncryptionService>(EncryptionService);
  });

  afterEach(() => {
    delete process.env.ENCRYPTION_KEY;
    jest.clearAllMocks();
  });

  // Test 1
  it('1. EmailService uses IntegrationResolverService', async () => {
    const resolveSpy = jest.spyOn(resolverService, 'resolveSmtp');
    await emailService.sendEmail({
      to: 'user@test.com',
      subject: 'Test Subject',
      html: '<p>Test</p>',
    });

    expect(resolveSpy).toHaveBeenCalledWith(null);
  });

  // Test 2
  it('2. Active DB SMTP credential is used', async () => {
    await credentialsService.createCredential({
      provider: IntegrationProvider.SMTP_EMAIL,
      name: 'DB SMTP Credential',
      config: { host: 'smtp.db-custom.com', port: 465, secure: true, user: 'db_user@test.com', from: 'noreply@db.com', name: 'DB Support' },
      secrets: { password: 'DB_SECRET_PASSWORD' },
    });

    await emailService.sendEmail({
      to: 'recipient@test.com',
      subject: 'DB Test',
      html: '<p>DB Test</p>',
    });

    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.db-custom.com',
        port: 465,
        secure: true,
        auth: { user: 'db_user@test.com', pass: 'DB_SECRET_PASSWORD' },
      }),
    );
  });

  // Test 3
  it('3. No DB credential falls back to .env', async () => {
    await emailService.sendEmail({
      to: 'recipient@test.com',
      subject: 'ENV Test',
      html: '<p>ENV Test</p>',
    });

    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.env-test.com',
        port: 587,
        secure: false,
        auth: { user: 'env_user@test.com', pass: 'ENV_SECRET_PASSWORD' },
      }),
    );
  });

  // Test 4
  it('4. Disabled DB credential falls back to .env', async () => {
    const created = await credentialsService.createCredential({
      provider: IntegrationProvider.SMTP_EMAIL,
      name: 'Disabled SMTP DB',
      config: { host: 'smtp.disabled.com', port: 587, secure: false, user: 'disabled_user', from: 'a@b.com', name: 'Disabled' },
      secrets: { password: 'disabled_pass' },
    });

    await credentialsService.setCredentialStatus(created.id, false);

    await emailService.sendEmail({
      to: 'user@test.com',
      subject: 'Disabled Test',
      html: '<p>Test</p>',
    });

    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.env-test.com',
      }),
    );
  });

  // Test 5
  it('5. Corrupted active DB credential fails fast', async () => {
    mockDbRecords['corrupted_smtp'] = {
      id: 'corrupted_smtp',
      provider: IntegrationProvider.SMTP_EMAIL,
      name: 'Corrupted SMTP',
      enabled: true,
      companyId: null,
      config: { host: 'smtp.corrupted.com' },
      encryptedSecrets: 'v1:corrupted:corrupted:corrupted',
      status: IntegrationStatus.CONNECTED,
    };

    await expect(
      emailService.sendEmail({
        to: 'user@test.com',
        subject: 'Corrupted Test',
        html: '<p>Test</p>',
      }),
    ).rejects.toThrow(/Failed to resolve active DB SMTP integration credential/);
  });

  // Test 6
  it('6. Wrong encryption key fails fast', async () => {
    const encryptedWithOtherKey = encryptionService.encrypt(
      JSON.stringify({ password: 'secret_password' }),
      SECOND_KEY,
    );

    mockDbRecords['wrong_key_smtp'] = {
      id: 'wrong_key_smtp',
      provider: IntegrationProvider.SMTP_EMAIL,
      name: 'Wrong Key SMTP',
      enabled: true,
      companyId: null,
      config: { host: 'smtp.wrongkey.com' },
      encryptedSecrets: encryptedWithOtherKey,
      status: IntegrationStatus.CONNECTED,
    };

    await expect(
      emailService.sendEmail({
        to: 'user@test.com',
        subject: 'Wrong Key Test',
        html: '<p>Test</p>',
      }),
    ).rejects.toThrow(/Failed to resolve active DB SMTP integration credential/);
  });

  // Test 7
  it('7. Missing required SMTP DB field fails fast', async () => {
    const encryptedSecrets = encryptionService.encrypt(JSON.stringify({ password: 'pass' }));

    mockDbRecords['missing_host_smtp'] = {
      id: 'missing_host_smtp',
      provider: IntegrationProvider.SMTP_EMAIL,
      name: 'Missing Host SMTP',
      enabled: true,
      companyId: null,
      config: {}, // Missing host
      encryptedSecrets,
      status: IntegrationStatus.CONNECTED,
    };

    await expect(
      emailService.sendEmail({
        to: 'user@test.com',
        subject: 'Missing Host Test',
        html: '<p>Test</p>',
      }),
    ).rejects.toThrow(/Failed to resolve active DB SMTP integration credential/);
  });

  // Test 8
  it('8. SMTP password is never logged', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();

    const secretPassword = 'TOP_CONFIDENTIAL_SMTP_PASSWORD_888';

    await credentialsService.createCredential({
      provider: IntegrationProvider.SMTP_EMAIL,
      name: 'Secret Log Test',
      config: { host: 'smtp.logtest.com', port: 587, secure: false, user: 'log_user@test.com', from: 'log@test.com', name: 'Log Test' },
      secrets: { password: secretPassword },
    });

    await emailService.sendEmail({
      to: 'user@test.com',
      subject: 'Secret Log Test',
      html: '<p>Test</p>',
    });

    const allLogs = [
      ...consoleSpy.mock.calls.flatMap((c) => c),
      ...warnSpy.mock.calls.flatMap((c) => c),
      ...errorSpy.mock.calls.flatMap((c) => c),
    ].join(' ');

    expect(allLogs).not.toContain(secretPassword);
    expect(allLogs).not.toContain(TEST_KEY);

    consoleSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  // Test 9
  it('9. Resolved host is used', async () => {
    await credentialsService.createCredential({
      provider: IntegrationProvider.SMTP_EMAIL,
      name: 'Custom Host Test',
      config: { host: 'smtp.unique-custom-host.org', port: 587, secure: false, user: 'u', from: 'a@b.com', name: 'A' },
      secrets: { password: 'p' },
    });

    await emailService.sendEmail({ to: 'u@b.com', subject: 'S', html: '<p>H</p>' });
    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'smtp.unique-custom-host.org' }),
    );
  });

  // Test 10
  it('10. Resolved port is used', async () => {
    await credentialsService.createCredential({
      provider: IntegrationProvider.SMTP_EMAIL,
      name: 'Custom Port Test',
      config: { host: 'smtp.test.com', port: 2525, secure: false, user: 'u', from: 'a@b.com', name: 'A' },
      secrets: { password: 'p' },
    });

    await emailService.sendEmail({ to: 'u@b.com', subject: 'S', html: '<p>H</p>' });
    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ port: 2525 }),
    );
  });

  // Test 11
  it('11. Resolved secure/TLS setting is used', async () => {
    await credentialsService.createCredential({
      provider: IntegrationProvider.SMTP_EMAIL,
      name: 'Custom Secure Test',
      config: { host: 'smtp.test.com', port: 465, secure: true, user: 'u', from: 'a@b.com', name: 'A' },
      secrets: { password: 'p' },
    });

    await emailService.sendEmail({ to: 'u@b.com', subject: 'S', html: '<p>H</p>' });
    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ secure: true }),
    );
  });

  // Test 12
  it('12. Resolved SMTP username is used', async () => {
    await credentialsService.createCredential({
      provider: IntegrationProvider.SMTP_EMAIL,
      name: 'Custom User Test',
      config: { host: 'smtp.test.com', port: 587, secure: false, user: 'resolved_username_spec', from: 'a@b.com', name: 'A' },
      secrets: { password: 'p' },
    });

    await emailService.sendEmail({ to: 'u@b.com', subject: 'S', html: '<p>H</p>' });
    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ auth: { user: 'resolved_username_spec', pass: 'p' } }),
    );
  });

  // Test 13
  it('13. Resolved SMTP password is used by transport but never exposed', async () => {
    await credentialsService.createCredential({
      provider: IntegrationProvider.SMTP_EMAIL,
      name: 'Custom Pass Test',
      config: { host: 'smtp.test.com', port: 587, secure: false, user: 'u', from: 'a@b.com', name: 'A' },
      secrets: { password: 'resolved_password_spec' },
    });

    const result = await emailService.sendEmail({ to: 'u@b.com', subject: 'S', html: '<p>H</p>' });
    expect(result).toBe(true);
    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ auth: { user: 'u', pass: 'resolved_password_spec' } }),
    );
  });

  // Test 14
  it('14. Resolved from address is used', async () => {
    await credentialsService.createCredential({
      provider: IntegrationProvider.SMTP_EMAIL,
      name: 'Custom From Test',
      config: { host: 'smtp.test.com', port: 587, secure: false, user: 'u', from: 'custom_from@domain.com', name: 'Custom Name' },
      secrets: { password: 'p' },
    });

    await emailService.sendEmail({ to: 'u@b.com', subject: 'S', html: '<p>H</p>' });
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: '"Custom Name" <custom_from@domain.com>' }),
    );
  });

  // Test 15
  it('15. Resolved display name is preserved', async () => {
    await credentialsService.createCredential({
      provider: IntegrationProvider.SMTP_EMAIL,
      name: 'Custom Display Name Test',
      config: { host: 'smtp.test.com', port: 587, secure: false, user: 'u', from: 'support@hrnexa.com', name: 'HR Nexa Enterprise' },
      secrets: { password: 'p' },
    });

    await emailService.sendEmail({ to: 'u@b.com', subject: 'S', html: '<p>H</p>' });
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: '"HR Nexa Enterprise" <support@hrnexa.com>' }),
    );
  });

  // Test 16
  it('16. Existing sendMail behavior remains unchanged', async () => {
    const success = await emailService.sendEmail({
      to: 'recipient@test.com',
      toName: 'John Doe',
      subject: 'Welcome Subject',
      html: '<h1>Welcome</h1>',
      text: 'Welcome Text',
    });

    expect(success).toBe(true);
    expect(mockSendMail).toHaveBeenCalledWith({
      from: '"HR Nexa ENV Support" <noreply@env-test.com>',
      to: '"John Doe" <recipient@test.com>',
      subject: 'Welcome Subject',
      html: '<h1>Welcome</h1>',
      text: 'Welcome Text',
      attachments: undefined,
      messageId: undefined,
    });
  });

  // Test 17
  it('17. Existing HTML/text behavior remains unchanged', async () => {
    await emailService.sendEmail({
      to: 'test@domain.com',
      subject: 'HTML & Text Test',
      html: '<p>HTML Content</p>',
      text: 'Plain Text Content',
    });

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        html: '<p>HTML Content</p>',
        text: 'Plain Text Content',
      }),
    );
  });

  // Test 18
  it('18. Existing attachment behavior remains unchanged', async () => {
    const attachment = {
      filename: 'payslip.pdf',
      content: Buffer.from('PDF_BYTES'),
      contentType: 'application/pdf',
    };

    await emailService.sendPayrollEmail(
      'emp@domain.com',
      'Jane Doe',
      'August 2026',
      attachment,
    );

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [attachment],
      }),
    );
  });

  // Test 19
  it('19. Existing error handling remains unchanged', async () => {
    mockSendMail.mockRejectedValue(new Error('SMTP Connection Refused'));

    const success = await emailService.sendEmail({
      to: 'fail@domain.com',
      subject: 'Failing Email',
      html: '<p>Fail</p>',
    });

    expect(success).toBe(false);
  });

  // Test 20
  it('20. Correct companyId is passed to resolveSmtp() when available', async () => {
    const resolveSpy = jest.spyOn(resolverService, 'resolveSmtp');

    await emailService.sendEmail({
      to: 'tenant@domain.com',
      subject: 'Tenant Email',
      html: '<p>Tenant</p>',
      companyId: 'company_uuid_999',
    });

    expect(resolveSpy).toHaveBeenCalledWith('company_uuid_999');
  });
});
