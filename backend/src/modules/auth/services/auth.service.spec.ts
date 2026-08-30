import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UserRepository } from '../repositories/user.repository';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { RefreshTokenService } from './refresh-token.service';
import { TokenBlacklistService } from './token-blacklist.service';
import { PasswordResetService } from './password-reset.service';
import { EmailVerificationService } from './email-verification.service';
import {
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Role } from '../role.enum';
import { RbacService } from './rbac.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { SystemConfigService } from '../../system/services/system-config.service';
import { EmailService } from '../../../email/email.service';

describe('AuthService', () => {
  let service: AuthService;

  const mockUser = {
    id: 'user-1',
    email: 'admin@company.com',
    password: 'hashed_password',
    name: 'Admin User',
    role: 'HRAdmin',
    subscriptionId: 'sub-1',
    status: 'Active',
  };

  const mockSuperAdmin = {
    id: 'user-2',
    email: 'superadmin@platform.com',
    password: 'hashed_password',
    name: 'Super Admin',
    role: 'SuperAdmin',
    subscriptionId: null,
    status: 'Active',
  };

  const mockUserRepository = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    createUser: jest.fn(),
    updateUser: jest.fn().mockResolvedValue({}),
  };

  const mockPasswordService = {
    compare: jest.fn(),
    hash: jest.fn(),
    validatePasswordPolicy: jest.fn(),
  };

  const mockTokenService = {
    sign: jest.fn().mockReturnValue('mock_access_token'),
    generateAccessToken: jest.fn().mockReturnValue('mock_access_token'),
  };

  const mockRefreshTokenService = {
    generateRefreshToken: jest.fn().mockReturnValue('mock_refresh_token'),
    generateRefreshTokenPair: jest.fn().mockReturnValue({
      access_token: 'mock_access_token',
      refresh_token: 'mock_refresh_token',
    }),
    rotateRefreshToken: jest.fn(),
    revokeRefreshToken: jest.fn(),
    revokeAllUserSessions: jest.fn(),
  };

  const mockTokenBlacklistService = {
    blacklistToken: jest.fn(),
    isBlacklisted: jest.fn().mockReturnValue(false),
  };

  const mockPasswordResetService = {
    requestPasswordReset: jest.fn(),
    resetPassword: jest.fn(),
  };

  const mockEmailVerificationService = {
    generateVerificationToken: jest.fn(),
    verifyEmail: jest.fn(),
  };

  const mockPrismaService = {
    subscription: {
      findUnique: jest.fn().mockResolvedValue({ status: 'ACTIVE', tier: 'PRO', plan: 'PREMIUM' }),
    },
    user: {
      updateUser: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
    role: {
      findFirst: jest.fn().mockResolvedValue({ id: 'role-1' }),
    },
    companyPlanAssignment: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    saaSPlanNew: {
      findUnique: jest.fn().mockResolvedValue({
        versions: [{ id: 'version-1' }],
      }),
    },
    planVersion: {
      findUnique: jest.fn().mockResolvedValue({
        features: [{ feature: { key: 'ATT_BASIC' } }],
      }),
    },
    permission: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserRepository, useValue: mockUserRepository },
        { provide: PasswordService, useValue: mockPasswordService },
        { provide: TokenService, useValue: mockTokenService },
        { provide: RefreshTokenService, useValue: mockRefreshTokenService },
        { provide: TokenBlacklistService, useValue: mockTokenBlacklistService },
        { provide: PasswordResetService, useValue: mockPasswordResetService },
        {
          provide: EmailVerificationService,
          useValue: mockEmailVerificationService,
        },
        {
          provide: RbacService,
          useValue: { assignRole: jest.fn().mockResolvedValue({}) },
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: SystemConfigService,
          useValue: {
            getConfig: jest.fn().mockResolvedValue({}),
            getGlobalSettings: jest.fn().mockResolvedValue({ maintenanceMode: false, strictPasswordPolicy: false }),
            getConfiguredSessionTimeoutMins: jest.fn().mockResolvedValue(15),
          },
        },
        {
          provide: EmailService,
          useValue: { sendEmail: jest.fn().mockResolvedValue(true) },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    mockPrismaService.subscription.findUnique.mockResolvedValue({
      status: 'Active',
      plan: 'PREMIUM',
      company: 'Acme Corp',
    });
    mockPrismaService.user.update.mockResolvedValue({});
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('should authenticate user and return token pair', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      mockPasswordService.compare.mockResolvedValue(true);

      const result = await service.login({
        email: 'admin@company.com',
        password: 'password123',
      });

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
      expect((result as any).user.email).toBe(mockUser.email);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'wrong@company.com', password: 'password' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password does not match', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      mockPasswordService.compare.mockResolvedValue(false);

      await expect(
        service.login({ email: 'admin@company.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ForbiddenException if company subscription is suspended', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      mockPasswordService.compare.mockResolvedValue(true);
      mockPrismaService.subscription.findUnique.mockResolvedValue({
        status: 'Suspended',
      });

      await expect(
        service.login({ email: 'admin@company.com', password: 'password123' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if company subscription is cancelled', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      mockPasswordService.compare.mockResolvedValue(true);
      mockPrismaService.subscription.findUnique.mockResolvedValue({
        status: 'Cancelled',
      });

      await expect(
        service.login({ email: 'admin@company.com', password: 'password123' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if company subscription is deleted', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      mockPasswordService.compare.mockResolvedValue(true);
      mockPrismaService.subscription.findUnique.mockResolvedValue({
        status: 'Deleted',
      });

      await expect(
        service.login({ email: 'admin@company.com', password: 'password123' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow SuperAdmin login even if company subscription is suspended', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockSuperAdmin);
      mockPasswordService.compare.mockResolvedValue(true);
      mockPrismaService.subscription.findUnique.mockResolvedValue(null);

      const result = await service.login({
        email: 'superadmin@platform.com',
        password: 'password123',
      });

      expect(result).toHaveProperty('access_token');
      expect((result as any).user.email).toBe(mockSuperAdmin.email);
    });
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockPasswordService.hash.mockResolvedValue('hashed');
      mockUserRepository.createUser.mockResolvedValue({
        ...mockUser,
        id: 'new-user',
      });

      const dto = {
        email: 'new@company.com',
        password: 'Password123',
        name: 'New User',
        role: Role.Employee,
        initials: 'NU',
      };

      const result = await service.register(dto);
      expect(result.email).toBe(mockUser.email);
    });

    it('should throw ConflictException if email is already taken', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);

      const dto = {
        email: 'admin@company.com',
        password: 'Password123',
        name: 'Existing User',
        role: Role.Employee,
        initials: 'EU',
      };

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });
  });
});
