import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { RefreshTokenService } from './refresh-token.service';
import { PasswordService } from './password.service';
import { UserRepository } from '../repositories/user.repository';
import { PrismaService } from '../../../prisma/prisma.service';
import { RbacService } from './rbac.service';
import { SystemConfigService } from '../../system/services/system-config.service';
import { EmailService } from '../../../email/email.service';
import { OutboxPublisherService } from '../../../common/queue/outbox-publisher.service';
import { TokenBlacklistService } from './token-blacklist.service';
import { PasswordResetService } from './password-reset.service';
import { EmailVerificationService } from './email-verification.service';
import { AuditLoggerService } from '../../../common/audit/audit-logger.service';
import { UnauthorizedException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

describe('Impersonation Ticket & Security Boundary Spec', () => {
  let authService: AuthService;
  let tokenService: TokenService;
  let prismaService: any;

  const mockSuperAdmin = {
    id: 'super-1',
    name: 'Platform SuperAdmin',
    email: 'admin@hrnexa.com',
    role: 'SuperAdmin',
  };

  const mockTargetCompany = {
    id: 'comp-100',
    name: 'Acme Corp',
    status: 'Active',
  };

  const mockTargetHRAdmin = {
    id: 'usr-hr-100',
    email: 'hr@acmecorp.com',
    name: 'Acme HR',
    role: 'HRAdmin',
    companyId: 'comp-100',
    subscriptionId: 'sub-100',
    permissionVersion: 1,
    sessionVersion: 1,
    status: 'ACTIVE',
    roleRelation: {
      permissions: JSON.stringify(['employees:list:view']),
    },
    subscription: {
      status: 'Active',
    },
  };

  beforeEach(async () => {
    const mockPrisma = {
      company: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === mockTargetCompany.id) return Promise.resolve(mockTargetCompany);
          return Promise.resolve(null);
        }),
      },
      user: {
        findFirst: jest.fn().mockImplementation(({ where }) => {
          if (where.companyId === mockTargetCompany.id && where.role === 'HRAdmin') {
            return Promise.resolve(mockTargetHRAdmin);
          }
          return Promise.resolve(null);
        }),
        findUnique: jest.fn().mockResolvedValue(mockTargetHRAdmin),
      },
      subscription: {
        findFirst: jest.fn().mockResolvedValue(mockTargetHRAdmin.subscription),
      },
      companyPlanAssignment: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      saaSPlanNew: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      customRole: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      permission: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        TokenService,
        JwtService,
        {
          provide: RefreshTokenService,
          useValue: {
            generateRefreshToken: jest.fn().mockResolvedValue('mock_refresh_token_123'),
            revokeUserSessions: jest.fn().mockResolvedValue({ message: 'Sessions revoked' }),
          },
        },
        {
          provide: TokenBlacklistService,
          useValue: { isBlacklisted: jest.fn().mockResolvedValue(false), blacklistToken: jest.fn() },
        },
        {
          provide: PasswordResetService,
          useValue: {},
        },
        {
          provide: EmailVerificationService,
          useValue: {},
        },
        {
          provide: PasswordService,
          useValue: {
            hashPassword: jest.fn().mockResolvedValue('hashed'),
            comparePassword: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: UserRepository,
          useValue: {
            findByEmail: jest.fn(),
            findById: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: RbacService,
          useValue: {},
        },
        {
          provide: SystemConfigService,
          useValue: {},
        },
        {
          provide: EmailService,
          useValue: { sendMail: jest.fn() },
        },
        {
          provide: OutboxPublisherService,
          useValue: { publish: jest.fn() },
        },
        {
          provide: AuditLoggerService,
          useValue: { logAction: jest.fn().mockResolvedValue(true) },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    tokenService = module.get<TokenService>(TokenService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should generate a cryptographically signed, short-lived single-use ticket for SuperAdmin', async () => {
    const res = await authService.createImpersonationTicket(mockTargetCompany.id, mockSuperAdmin);

    expect(res).toBeDefined();
    expect(res.ticket).toBeDefined();
    expect(res.ticketId).toBeDefined();
    expect(res.redirectUrl).toContain('/impersonate?ticket=');

    // Verify ticket structure
    const decoded = tokenService.verify(res.ticket);
    expect(decoded.type).toBe('IMPERSONATION_TICKET');
    expect(decoded.targetCompanyId).toBe(mockTargetCompany.id);
    expect(decoded.sub).toBe(mockSuperAdmin.id);
  });

  it('should throw NotFoundException if target company does not exist', async () => {
    await expect(
      authService.createImpersonationTicket('invalid-company-id', mockSuperAdmin),
    ).rejects.toThrow(NotFoundException);
  });

  it('should exchange a valid ticket for an isolated HRAdmin tenant session', async () => {
    const { ticket } = await authService.createImpersonationTicket(
      mockTargetCompany.id,
      mockSuperAdmin,
    );

    const exchangeRes = await authService.exchangeImpersonationTicket(ticket);

    expect(exchangeRes).toBeDefined();
    expect(exchangeRes.access_token).toBeDefined();
    expect(exchangeRes.refresh_token).toBe('mock_refresh_token_123');
    expect(exchangeRes.user.role).toBe('HRAdmin');
    expect(exchangeRes.user.companyId).toBe(mockTargetCompany.id);
    expect(exchangeRes.impersonator.name).toBe(mockSuperAdmin.name);
    expect(exchangeRes.impersonator.role).toBe('SuperAdmin');
  });

  it('should REJECT ticket replay (single-use guarantee)', async () => {
    const { ticket } = await authService.createImpersonationTicket(
      mockTargetCompany.id,
      mockSuperAdmin,
    );

    // First exchange must succeed
    const firstExchange = await authService.exchangeImpersonationTicket(ticket);
    expect(firstExchange.access_token).toBeDefined();

    // Second exchange must fail immediately
    await expect(authService.exchangeImpersonationTicket(ticket)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should REJECT invalid or tampered tickets', async () => {
    await expect(
      authService.exchangeImpersonationTicket('invalid.garbage.ticket'),
    ).rejects.toThrow(UnauthorizedException);
  });
});
