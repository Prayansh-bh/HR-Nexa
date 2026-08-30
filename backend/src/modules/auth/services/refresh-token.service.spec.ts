import { Test, TestingModule } from '@nestjs/testing';
import { RefreshTokenService } from './refresh-token.service';
import { UserRepository } from '../repositories/user.repository';
import { TokenService } from './token.service';
import { TokenHashService } from './token-hash.service';
import { UserAgentParserService } from './user-agent.parser';
import { PrismaService } from '../../../prisma/prisma.service';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';

describe('RefreshTokenService', () => {
  let service: RefreshTokenService;

  const mockUser = {
    id: 'user-1',
    email: 'admin@company.com',
    role: 'HRAdmin',
    subscriptionId: 'sub-1',
    permissionVersion: 1,
    subscription: {
      status: 'Active',
    },
  };

  const mockSuperAdmin = {
    id: 'user-2',
    email: 'superadmin@platform.com',
    role: 'SuperAdmin',
    subscriptionId: null,
    permissionVersion: 1,
    subscription: null,
  };

  const mockUserRepository = {
    findById: jest.fn(),
  };

  const mockTokenService = {
    sign: jest.fn().mockReturnValue('mock_jwt_token'),
  };

  const mockTokenHashService = {
    hash: jest.fn().mockImplementation((t: string) => `hashed_${t}`),
  };

  const mockUserAgentParserService = {
    parse: jest.fn().mockReturnValue({ browser: 'Chrome', os: 'Windows', deviceType: 'Desktop' }),
  };

  const mockPrismaService = {
    $transaction: jest.fn().mockImplementation(async (cb: any) => cb(mockPrismaService)),
    companyPlanAssignment: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    saaSPlanNew: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    userSession: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 'sess-1', familyId: 'fam-1', refreshCount: 0 }),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    user: {
      update: jest.fn().mockResolvedValue({}),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshTokenService,
        { provide: UserRepository, useValue: mockUserRepository },
        { provide: TokenService, useValue: mockTokenService },
        { provide: TokenHashService, useValue: mockTokenHashService },
        { provide: UserAgentParserService, useValue: mockUserAgentParserService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<RefreshTokenService>(RefreshTokenService);
  });

  it('should generate a refresh token and store a session', async () => {
    const token = await service.generateRefreshToken('user-1');
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
  });

  describe('rotateRefreshToken', () => {
    it('should successfully rotate tokens for an active subscription', async () => {
      const oldToken = 'old_token_123';
      mockPrismaService.userSession.findUnique.mockResolvedValue({
        id: 'sess-1',
        familyId: 'fam-1',
        userId: 'user-1',
        refreshCount: 1,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 100000),
      });
      mockUserRepository.findById.mockResolvedValue(mockUser);

      const result = await service.rotateRefreshToken(oldToken);
      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
      expect(result.access_token).toBe('mock_jwt_token');
    });

    it('should block rotation and throw ForbiddenException if tenant is suspended', async () => {
      const oldToken = 'old_token_123';
      mockPrismaService.userSession.findUnique.mockResolvedValue({
        id: 'sess-1',
        familyId: 'fam-1',
        userId: 'user-1',
        refreshCount: 1,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 100000),
      });
      const suspendedUser = {
        ...mockUser,
        subscription: { status: 'Suspended' },
      };
      mockUserRepository.findById.mockResolvedValue(suspendedUser);

      await expect(service.rotateRefreshToken(oldToken)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw UnauthorizedException if old refresh token is invalid', async () => {
      mockPrismaService.userSession.findUnique.mockResolvedValue(null);
      await expect(service.rotateRefreshToken('invalid_token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
