import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { TokenHashService } from './token-hash.service';
import { Role } from '../role.enum';

describe('SuperAdmin Email Change Security & Reliability', () => {
  let service: AuthService;
  let userRepository: any;
  let passwordService: any;
  let tokenService: any;
  let refreshTokenService: any;
  let tokenBlacklistService: any;
  let passwordResetService: any;
  let emailVerificationService: any;
  let rbacService: any;
  let prisma: any;
  let systemConfigService: any;
  let emailService: any;
  let tokenHashService: TokenHashService;
  let auditLogger: any;

  const mockSuperAdmin = {
    id: 'super-admin-uuid-1',
    email: 'admin@demo.co',
    name: 'Deepak Bhagat',
    password: 'hashed_password_123',
    role: Role.SuperAdmin,
    sessionVersion: 1,
  };

  const mockHRAdmin = {
    id: 'hr-admin-uuid-2',
    email: 'hr@tenant.com',
    name: 'HR User',
    password: 'hashed_password_456',
    role: Role.HRAdmin,
    sessionVersion: 1,
  };

  beforeEach(() => {
    tokenHashService = new TokenHashService();

    userRepository = {
      findById: jest.fn().mockImplementation(async (id: string) => {
        if (id === mockSuperAdmin.id) return { ...mockSuperAdmin };
        if (id === mockHRAdmin.id) return { ...mockHRAdmin };
        return null;
      }),
      findByEmail: jest.fn().mockImplementation(async (email: string) => {
        const norm = email.trim().toLowerCase();
        if (norm === mockSuperAdmin.email) return { ...mockSuperAdmin };
        if (norm === 'existing@other.com') {
          return { id: 'other-uuid', email: 'existing@other.com', role: 'Employee' };
        }
        return null;
      }),
    };

    passwordService = {
      compare: jest.fn().mockImplementation(async (plain: string, hashed: string) => {
        return plain === 'CorrectSuperAdminPass123!';
      }),
      hash: jest.fn().mockResolvedValue('new_hashed_password'),
    };

    tokenService = {
      sign: jest.fn(),
      verify: jest.fn(),
    };

    refreshTokenService = {
      revokeAllUserSessions: jest.fn().mockResolvedValue(undefined),
    };

    tokenBlacklistService = {
      isBlacklisted: jest.fn().mockResolvedValue(false),
    };

    passwordResetService = {};
    emailVerificationService = {};
    rbacService = {};

    prisma = {
      otpChallenge: {
        create: jest.fn().mockResolvedValue({ id: 'challenge-1' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 'challenge-1' }),
      },
      user: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: mockSuperAdmin.id }),
      },
      userSession: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      $transaction: jest.fn().mockImplementation(async (cb: any) => {
        return cb(prisma);
      }),
    };

    systemConfigService = {
      getGlobalSettings: jest.fn().mockResolvedValue({}),
    };

    emailService = {
      sendEmailChangeVerificationEmail: jest.fn().mockResolvedValue(true),
    };

    auditLogger = {
      logAction: jest.fn().mockResolvedValue(undefined),
    };

    service = new AuthService(
      userRepository,
      passwordService,
      tokenService,
      refreshTokenService,
      tokenBlacklistService,
      passwordResetService,
      emailVerificationService,
      rbacService,
      prisma,
      systemConfigService,
      emailService,
      tokenHashService,
      undefined,
      auditLogger,
    );
  });

  describe('1. Authorization & Role Enforcement', () => {
    it('should reject non-SuperAdmin callers (HRAdmin, Employee, etc.) with 403 Forbidden', async () => {
      await expect(
        service.requestSuperAdminEmailChange(mockHRAdmin, {
          currentPassword: 'CorrectSuperAdminPass123!',
          newEmail: 'new-admin@demo.co',
        }),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.verifySuperAdminEmailChange(mockHRAdmin, {
          challengeToken: 'tok_123',
          otp: '123456',
          newEmail: 'new-admin@demo.co',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject unauthenticated or null user with 403 Forbidden', async () => {
      await expect(
        service.requestSuperAdminEmailChange(null, {
          currentPassword: 'CorrectSuperAdminPass123!',
          newEmail: 'new-admin@demo.co',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('2. Request Email Change Validation & OTP Challenge', () => {
    it('should reject if current password is wrong', async () => {
      await expect(
        service.requestSuperAdminEmailChange(mockSuperAdmin, {
          currentPassword: 'WrongPassword123!',
          newEmail: 'new-owner@hrnexa.com',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if new email is identical to current email', async () => {
      await expect(
        service.requestSuperAdminEmailChange(mockSuperAdmin, {
          currentPassword: 'CorrectSuperAdminPass123!',
          newEmail: '  ADMIN@DEMO.CO  ',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if new email already belongs to another user', async () => {
      await expect(
        service.requestSuperAdminEmailChange(mockSuperAdmin, {
          currentPassword: 'CorrectSuperAdminPass123!',
          newEmail: 'existing@other.com',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should successfully create OTP challenge and send email to new address', async () => {
      const result = await service.requestSuperAdminEmailChange(mockSuperAdmin, {
        currentPassword: 'CorrectSuperAdminPass123!',
        newEmail: '  NEW-OWNER@HRNEXA.COM ',
      });

      expect(result.newEmail).toBe('new-owner@hrnexa.com');
      expect(result.challengeToken).toBeDefined();
      expect(prisma.otpChallenge.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: mockSuperAdmin.id,
            status: 'PENDING_EMAIL_CHANGE:new-owner@hrnexa.com',
            maxAttempts: 5,
          }),
        }),
      );
      expect(emailService.sendEmailChangeVerificationEmail).toHaveBeenCalledWith(
        'new-owner@hrnexa.com',
        expect.any(String),
        15,
      );
    });
  });

  describe('3. Verification, Email Binding & Atomic Update', () => {
    const rawOtp = '654321';
    const targetEmail = 'new-owner@hrnexa.com';
    const challengeToken = 'valid_challenge_token_abc';

    let validChallenge: any;

    beforeEach(() => {
      validChallenge = {
        id: 'challenge-row-1',
        challengeToken,
        userId: mockSuperAdmin.id,
        otpHash: tokenHashService.hash(targetEmail + ':' + rawOtp),
        status: `PENDING_EMAIL_CHANGE:${targetEmail}`,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10m in future
        attempts: 0,
        maxAttempts: 5,
      };
    });

    it('should reject verification if challenge belongs to a different user (Anti-IDOR)', async () => {
      prisma.otpChallenge.findUnique.mockResolvedValue({
        ...validChallenge,
        userId: 'different-user-id',
      });

      await expect(
        service.verifySuperAdminEmailChange(mockSuperAdmin, {
          challengeToken,
          otp: rawOtp,
          newEmail: targetEmail,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject if client provides a different email than the challenge target email', async () => {
      prisma.otpChallenge.findUnique.mockResolvedValue(validChallenge);

      await expect(
        service.verifySuperAdminEmailChange(mockSuperAdmin, {
          challengeToken,
          otp: rawOtp,
          newEmail: 'tampered-victim@hrnexa.com',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if challenge has expired', async () => {
      prisma.otpChallenge.findUnique.mockResolvedValue({
        ...validChallenge,
        expiresAt: new Date(Date.now() - 1000), // in past
      });

      await expect(
        service.verifySuperAdminEmailChange(mockSuperAdmin, {
          challengeToken,
          otp: rawOtp,
          newEmail: targetEmail,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should increment attempts and reject if OTP is incorrect', async () => {
      prisma.otpChallenge.findUnique.mockResolvedValue(validChallenge);

      await expect(
        service.verifySuperAdminEmailChange(mockSuperAdmin, {
          challengeToken,
          otp: '000000', // wrong
          newEmail: targetEmail,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.otpChallenge.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: validChallenge.id },
          data: expect.objectContaining({ attempts: 1 }),
        }),
      );
    });

    it('should lock challenge when max attempts are reached', async () => {
      prisma.otpChallenge.findUnique.mockResolvedValue({
        ...validChallenge,
        attempts: 4,
      });

      await expect(
        service.verifySuperAdminEmailChange(mockSuperAdmin, {
          challengeToken,
          otp: '000000',
          newEmail: targetEmail,
        }),
      ).rejects.toThrow('Verification challenge is locked due to too many failed attempts');

      expect(prisma.otpChallenge.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: validChallenge.id },
          data: expect.objectContaining({ attempts: 5, status: 'LOCKED' }),
        }),
      );
    });

    it('should reject if challenge is already LOCKED', async () => {
      prisma.otpChallenge.findUnique.mockResolvedValue({
        ...validChallenge,
        status: 'LOCKED',
      });

      await expect(
        service.verifySuperAdminEmailChange(mockSuperAdmin, {
          challengeToken,
          otp: rawOtp,
          newEmail: targetEmail,
        }),
      ).rejects.toThrow('Verification challenge is locked');
    });

    it('should successfully update email, bump sessionVersion, revoke sessions and log audit event', async () => {
      prisma.otpChallenge.findUnique.mockResolvedValue(validChallenge);
      prisma.user.findUnique.mockImplementation(async (query: any) => {
        if (query.where?.email === targetEmail) return null; // Uniqueness holds
        if (query.where?.id === mockSuperAdmin.id) return { ...mockSuperAdmin };
        return null;
      });

      const result = await service.verifySuperAdminEmailChange(mockSuperAdmin, {
        challengeToken,
        otp: rawOtp,
        newEmail: targetEmail,
      });

      expect(result.success).toBe(true);
      expect(result.newEmail).toBe(targetEmail);

      // 1. Consumed challenge
      expect(prisma.otpChallenge.update).toHaveBeenCalledWith({
        where: { id: validChallenge.id },
        data: {
          status: 'VERIFIED',
          verifiedAt: expect.any(Date),
        },
      });

      // 2. Updated user email and bumped sessionVersion
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockSuperAdmin.id },
        data: {
          email: targetEmail,
          sessionVersion: { increment: 1 },
        },
      });

      // 3. Revoked all active UserSessions
      expect(prisma.userSession.updateMany).toHaveBeenCalledWith({
        where: { userId: mockSuperAdmin.id, revokedAt: null },
        data: {
          revokedAt: expect.any(Date),
          revokedReason: 'SUPERADMIN_EMAIL_CHANGED',
        },
      });

      // 4. Recorded Audit Log
      expect(auditLogger.logAction).toHaveBeenCalledWith({
        userId: mockSuperAdmin.id,
        userName: mockSuperAdmin.name,
        companyId: 'PLATFORM',
        action: 'SUPERADMIN_EMAIL_CHANGED',
        oldValue: mockSuperAdmin.email,
        newValue: targetEmail,
        details: 'Platform SuperAdmin email address changed successfully',
      });
    });

    it('should prevent replay of an already VERIFIED challenge', async () => {
      prisma.otpChallenge.findUnique.mockResolvedValue({
        ...validChallenge,
        status: 'VERIFIED',
      });

      await expect(
        service.verifySuperAdminEmailChange(mockSuperAdmin, {
          challengeToken,
          otp: rawOtp,
          newEmail: targetEmail,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
