import { Test, TestingModule } from '@nestjs/testing';
import { IntegrationsController } from './integrations.controller';
import { IntegrationCredentialsService } from '../services/integration-credentials.service';
import { EncryptionService } from '../../../common/security/encryption.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLoggerService } from '../../../common/audit/audit-logger.service';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { IntegrationProvider, IntegrationStatus } from '../types/integration.types';
import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Role } from '../../auth/role.enum';
import * as crypto from 'crypto';

describe('IntegrationsController Security & Scope Isolation (Phase 4)', () => {
  let controller: IntegrationsController;
  let credentialsService: IntegrationCredentialsService;
  let prismaService: any;
  let encryptionService: EncryptionService;

  const TEST_KEY = crypto.randomBytes(32).toString('hex');
  const mockDbRecords: Record<string, any> = {};

  beforeEach(async () => {
    process.env.ENCRYPTION_KEY = TEST_KEY;

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
        delete: jest.fn().mockImplementation(({ where }) => {
          const existing = mockDbRecords[where.id];
          if (!existing) return Promise.reject(new Error('Not found'));
          delete mockDbRecords[where.id];
          return Promise.resolve(existing);
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [IntegrationsController],
      providers: [
        IntegrationCredentialsService,
        EncryptionService,
        TenantContextService,
        { provide: PrismaService, useValue: prismaService },
        { provide: AuditLoggerService, useValue: { logAction: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();

    controller = module.get<IntegrationsController>(IntegrationsController);
    credentialsService = module.get<IntegrationCredentialsService>(IntegrationCredentialsService);
    encryptionService = module.get<EncryptionService>(EncryptionService);
  });

  afterEach(() => {
    delete process.env.ENCRYPTION_KEY;
  });

  // Mock Request Generators
  const createReq = (role: string, companyId?: string | null, userId = 'user_123') => ({
    user: {
      id: userId,
      role,
      companyId: role === Role.SuperAdmin ? 'PLATFORM' : companyId || null,
    },
  });

  describe('1. Authentication & Scope Authorization Guards', () => {
    it('should throw UnauthorizedException if request is unauthenticated', async () => {
      expect(() => (controller as any).getAuthorizedCompanyId({ user: null })).toThrow(
        UnauthorizedException,
      );
    });

    it('should throw ForbiddenException if non-SuperAdmin user attempts access', async () => {
      const req = createReq(Role.CompanyOwner, 'company_A');
      expect(() => (controller as any).getAuthorizedCompanyId(req)).toThrow(
        ForbiddenException,
      );
    });

    it('should resolve companyId = null for SuperAdmin (Platform Scope)', async () => {
      const req = createReq(Role.SuperAdmin);
      const companyId = (controller as any).getAuthorizedCompanyId(req);
      expect(companyId).toBeNull();
    });
  });

  describe('2. Platform Integration Credential Operations', () => {
    it('SuperAdmin can list platform credentials', async () => {
      await credentialsService.createCredential({
        provider: IntegrationProvider.AWS_S3,
        name: 'Platform S3 A',
        companyId: null,
        config: { region: 'ap-south-1', bucket: 'b-a', accessKeyId: 'ak-a' },
        secrets: { secretAccessKey: 'sk-a' },
      });

      await credentialsService.createCredential({
        provider: IntegrationProvider.RAZORPAY,
        name: 'Platform Razorpay',
        companyId: null,
        config: { keyId: 'rzp_test' },
        secrets: { keySecret: 'sec_test', webhookSecret: 'wh_test' },
      });

      const reqSuperAdmin = createReq(Role.SuperAdmin);
      const list = await controller.listCredentials(reqSuperAdmin);

      expect(list.length).toEqual(2);
      expect(list[0].name).toEqual('Platform S3 A');
    });

    it('Tenant non-SuperAdmin user cannot list, get, or update credentials (403 Forbidden)', async () => {
      const created = await credentialsService.createCredential({
        provider: IntegrationProvider.AWS_S3,
        name: 'Platform S3',
        companyId: null,
        config: { region: 'ap-south-1', bucket: 'b-b', accessKeyId: 'ak-b' },
        secrets: { secretAccessKey: 'sk-b' },
      });

      const reqTenant = createReq(Role.CompanyOwner, 'company_A');
      await expect(controller.listCredentials(reqTenant)).rejects.toThrow(ForbiddenException);
      await expect(controller.getCredential(created.id, reqTenant)).rejects.toThrow(ForbiddenException);
      await expect(controller.updateCredential(created.id, { name: 'Hacked' }, reqTenant)).rejects.toThrow(ForbiddenException);
      await expect(controller.deleteCredential(created.id, reqTenant)).rejects.toThrow(ForbiddenException);
    });

    it('SuperAdmin can create, read, and delete platform credentials', async () => {
      const reqSuperAdmin = createReq(Role.SuperAdmin);

      const result = await controller.createCredential(
        {
          provider: IntegrationProvider.AWS_S3,
          name: 'Platform S3 Admin',
          config: { region: 'ap-south-1', bucket: 'b-a', accessKeyId: 'ak-a' },
          secrets: { secretAccessKey: 'sk-a' },
        },
        reqSuperAdmin,
      );

      expect(result.companyId).toBeNull();
      expect(result.name).toEqual('Platform S3 Admin');

      const fetched = await controller.getCredential(result.id, reqSuperAdmin);
      expect(fetched.id).toEqual(result.id);

      const deleted = await controller.deleteCredential(result.id, reqSuperAdmin);
      expect(deleted.success).toBe(true);
    });

    it('SuperAdmin can access platform credential', async () => {
      const platformS3 = await credentialsService.createCredential({
        provider: IntegrationProvider.AWS_S3,
        name: 'Platform S3',
        companyId: null,
        config: { region: 'ap-south-1', bucket: 'plat-b', accessKeyId: 'ak-plat' },
        secrets: { secretAccessKey: 'sk-plat' },
      });

      const reqSuperAdmin = createReq(Role.SuperAdmin);
      const res = await controller.getCredential(platformS3.id, reqSuperAdmin);

      expect(res.id).toEqual(platformS3.id);
      expect(res.companyId).toBeNull();
    });
  });

  describe('3. Secret Protection & API Response Safety', () => {
    it('Responses NEVER contain plaintext secrets or encryptedSecrets', async () => {
      const reqSuperAdmin = createReq(Role.SuperAdmin);
      const secretPass = 'MY_SUPER_CONFIDENTIAL_SMTP_PASSWORD';

      const res = await controller.createCredential(
        {
          provider: IntegrationProvider.SMTP_EMAIL,
          name: 'Platform SMTP',
          config: { host: 'smtp.plat.com', port: 587, secure: false, user: 'u', from: 'a@b.com', name: 'P' },
          secrets: { password: secretPass },
        },
        reqSuperAdmin,
      );

      expect(res.maskedSecrets.password).toEqual('••••••••');
      expect((res as any).password).toBeUndefined();
      expect((res as any).encryptedSecrets).toBeUndefined();

      const getRes = await controller.getCredential(res.id, reqSuperAdmin);
      expect(getRes.maskedSecrets.password).toEqual('••••••••');
      expect((getRes as any).password).toBeUndefined();
      expect((getRes as any).encryptedSecrets).toBeUndefined();
    });
  });

  describe('4. Provider Validation & Security Rules', () => {
    it('Unsupported provider (e.g. GOOGLE) is rejected with 400 Bad Request', async () => {
      const reqSuperAdmin = createReq(Role.SuperAdmin);

      await expect(
        controller.createCredential(
          {
            provider: 'GOOGLE' as any,
            name: 'Google OAuth',
            config: { clientId: 'c1' },
            secrets: { clientSecret: 'cs1' },
          },
          reqSuperAdmin,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('Secret field inside config dictionary is rejected with 400 Bad Request', async () => {
      const reqSuperAdmin = createReq(Role.SuperAdmin);

      await expect(
        controller.createCredential(
          {
            provider: IntegrationProvider.RAZORPAY,
            name: 'Secret in Config Razorpay',
            config: {
              keyId: 'rzp_123',
              keySecret: 'PLAIN_TEXT_SECRET_IN_CONFIG',
            },
            secrets: { webhookSecret: 'wh_123' },
          },
          reqSuperAdmin,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
