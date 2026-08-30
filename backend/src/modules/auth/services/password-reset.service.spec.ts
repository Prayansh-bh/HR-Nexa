import { Test, TestingModule } from '@nestjs/testing';
import { PasswordResetService } from './password-reset.service';
import { UserRepository } from '../repositories/user.repository';
import { PasswordService } from './password.service';
import { EmailService } from '../../../email/email.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { TokenHashService } from './token-hash.service';
import { SystemConfigService } from '../../system/services/system-config.service';
import { OutboxPublisherService } from '../../../common/queue/outbox-publisher.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('PasswordResetService Security & Architecture Spec', () => {
  let service: PasswordResetService;
  let userRepository: jest.Mocked<UserRepository>;
  let passwordService: jest.Mocked<PasswordService>;
  let emailService: jest.Mocked<EmailService>;
  let prisma: any;
  let tokenHashService: jest.Mocked<TokenHashService>;
  let systemConfigService: jest.Mocked<SystemConfigService>;
  let outboxPublisher: jest.Mocked<OutboxPublisherService>;

  const mockUser = {
    id: 'user-uuid-1',
    email: 'admin@acme.corp',
    name: 'Jane Doe',
    role: 'HRAdmin',
    companyId: 'company-uuid-1',
    password: '$2b$10$hashedoldpassword',
    sessionVersion: 1,
  };

  beforeEach(async () => {
    userRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
    } as any;

    passwordService = {
      hash: jest.fn().mockResolvedValue('$2b$10$newhashedpassword'),
      validatePasswordPolicy: jest.fn(),
    } as any;

    emailService = {
      sendEmail: jest.fn().mockResolvedValue(true),
      sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
    } as any;

    tokenHashService = {
      hash: jest.fn().mockImplementation((token: string) => `hashed_${token}`),
    } as any;

    systemConfigService = {
      getGlobalSettings: jest.fn().mockResolvedValue({ strictPasswordPolicy: false }),
    } as any;

    outboxPublisher = {
      publishEmail: jest.fn().mockResolvedValue({ id: 'outbox-uuid-1' }),
    } as any;

    prisma = {
      $transaction: jest.fn().mockImplementation(async (callback: any) => {
        return callback({
          passwordResetToken: {
            create: jest.fn().mockResolvedValue({ id: 'token-record-1' }),
            update: jest.fn().mockResolvedValue({ id: 'token-record-1' }),
          },
          user: {
            update: jest.fn().mockResolvedValue({ id: 'user-uuid-1' }),
          },
          userSession: {
            updateMany: jest.fn().mockResolvedValue({ count: 2 }),
          },
        });
      }),
      passwordResetToken: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordResetService,
        { provide: UserRepository, useValue: userRepository },
        { provide: PasswordService, useValue: passwordService },
        { provide: EmailService, useValue: emailService },
        { provide: PrismaService, useValue: prisma },
        { provide: TokenHashService, useValue: tokenHashService },
        { provide: SystemConfigService, useValue: systemConfigService },
        { provide: OutboxPublisherService, useValue: outboxPublisher },
      ],
    }).compile();

    service = module.get<PasswordResetService>(PasswordResetService);
  });

  describe('requestPasswordReset (Public Flow)', () => {
    it('returns generic success response for unknown email without throwing 404', async () => {
      userRepository.findByEmail.mockResolvedValue(null);

      const response = await service.requestPasswordReset('nonexistent@random.org');

      expect(response).toEqual({
        message: 'If an account with that email exists, a password reset link has been sent.',
      });
      expect(response).not.toHaveProperty('resetToken');
      expect(outboxPublisher.publishEmail).not.toHaveBeenCalled();
    });

    it('returns generic success response for known email and does NOT return plaintext resetToken', async () => {
      userRepository.findByEmail.mockResolvedValue(mockUser as any);

      const response = await service.requestPasswordReset('admin@acme.corp');

      expect(response).toEqual({
        message: 'If an account with that email exists, a password reset link has been sent.',
      });
      expect(response).not.toHaveProperty('resetToken');
      expect(outboxPublisher.publishEmail).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          to: 'admin@acme.corp',
          subject: 'Reset Your Password - HR NEXA',
          companyId: 'company-uuid-1',
          body: expect.stringContaining('Password Reset Request'),
        }),
      );
    });

    it('contains branded HTML template and link with resetToken in Outbox payload for Tenant users', async () => {
      userRepository.findByEmail.mockResolvedValue(mockUser as any);

      await service.requestPasswordReset('admin@acme.corp');

      expect(outboxPublisher.publishEmail).toHaveBeenCalledTimes(1);
      const callArgs = outboxPublisher.publishEmail.mock.calls[0][1];
      expect(callArgs.body).toContain('<!DOCTYPE html>');
      expect(callArgs.body).toContain('Reset Password');
      expect(callArgs.body).toContain('/reset-password?resetToken=');
      expect(callArgs.body).toContain('15 minutes');
    });

    it('routes SuperAdmin reset link to Owner portal', async () => {
      const superAdminUser = {
        ...mockUser,
        role: 'SuperAdmin',
        companyId: null,
      };
      userRepository.findByEmail.mockResolvedValue(superAdminUser as any);

      await service.requestPasswordReset('superadmin@hrnexa.com');

      expect(outboxPublisher.publishEmail).toHaveBeenCalledTimes(1);
      const callArgs = outboxPublisher.publishEmail.mock.calls[0][1];
      expect(callArgs.body).toContain('/login?resetToken=');
    });
  });

  describe('requestPasswordResetForUser (Internal / SuperAdmin Delegation)', () => {
    it('accepts a verified User entity directly without second email lookup', async () => {
      const response = await service.requestPasswordResetForUser(mockUser as any);

      expect(response).toEqual({
        success: true,
        message: 'Password reset link queued successfully.',
      });
      expect(userRepository.findByEmail).not.toHaveBeenCalled();
      expect(outboxPublisher.publishEmail).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          to: 'admin@acme.corp',
          companyId: 'company-uuid-1',
        }),
      );
    });

    it('accepts a userId string and queries findById', async () => {
      userRepository.findById.mockResolvedValue(mockUser as any);

      const response = await service.requestPasswordResetForUser('user-uuid-1');

      expect(response).toEqual({
        success: true,
        message: 'Password reset link queued successfully.',
      });
      expect(userRepository.findById).toHaveBeenCalledWith('user-uuid-1');
    });

    it('throws NotFoundException if userId does not exist', async () => {
      userRepository.findById.mockResolvedValue(null);

      await expect(service.requestPasswordResetForUser('invalid-user-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('resetPassword (Token Consumption & Session Invalidation)', () => {
    it('successfully resets password and revokes all active sessions', async () => {
      const validTokenRecord = {
        id: 'token-rec-1',
        tokenHash: 'hashed_valid_token',
        userId: 'user-uuid-1',
        usedAt: null,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        user: mockUser,
      };

      prisma.passwordResetToken.findUnique.mockResolvedValue(validTokenRecord);

      const result = await service.resetPassword('valid_token', 'NewSecurePass@2026!');

      expect(result).toEqual({ message: 'Password reset successfully' });
      expect(passwordService.validatePasswordPolicy).toHaveBeenCalledWith(
        'NewSecurePass@2026!',
        false,
      );
      expect(passwordService.hash).toHaveBeenCalledWith('NewSecurePass@2026!');
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('rejects expired password reset token with BadRequestException', async () => {
      const expiredTokenRecord = {
        id: 'token-rec-2',
        tokenHash: 'hashed_expired_token',
        userId: 'user-uuid-1',
        usedAt: null,
        expiresAt: new Date(Date.now() - 5 * 60 * 1000), // Expired 5 mins ago
        user: mockUser,
      };

      prisma.passwordResetToken.findUnique.mockResolvedValue(expiredTokenRecord);

      await expect(
        service.resetPassword('expired_token', 'NewPass123!'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects already used password reset token with BadRequestException', async () => {
      const usedTokenRecord = {
        id: 'token-rec-3',
        tokenHash: 'hashed_used_token',
        userId: 'user-uuid-1',
        usedAt: new Date(Date.now() - 2 * 60 * 1000), // Used 2 mins ago
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        user: mockUser,
      };

      prisma.passwordResetToken.findUnique.mockResolvedValue(usedTokenRecord);

      await expect(
        service.resetPassword('used_token', 'NewPass123!'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
