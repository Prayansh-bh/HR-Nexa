import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionUsageService } from './subscription-usage.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { PasswordResetService } from '../../auth/services/password-reset.service';
import { AuditLoggerService } from '../../../common/audit/audit-logger.service';
import { SystemConfigService } from '../../system/services/system-config.service';
import { NotFoundException } from '@nestjs/common';

describe('SubscriptionUsageService - Reset Admin Password Spec', () => {
  let service: SubscriptionUsageService;
  let prisma: any;
  let passwordResetService: jest.Mocked<PasswordResetService>;

  const mockSubscription = {
    id: 'sub-uuid-1',
    company: 'Stark Industries',
    companyId: 'company-uuid-1',
    ownerEmail: 'tony@stark.corp',
    hrAdmin: 'pepper@stark.corp',
    plan: 'ENTERPRISE',
    status: 'Active',
  };

  const mockHrAdminUser = {
    id: 'user-uuid-hr-1',
    email: 'pepper@stark.corp',
    name: 'Pepper Potts',
    role: 'HRAdmin',
    subscriptionId: 'sub-uuid-1',
    companyId: 'company-uuid-1',
  };

  beforeEach(async () => {
    passwordResetService = {
      requestPasswordResetForUser: jest.fn().mockResolvedValue({
        success: true,
        message: 'Password reset link queued successfully.',
      }),
    } as any;

    prisma = {
      subscription: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionUsageService,
        { provide: PrismaService, useValue: prisma },
        { provide: PasswordResetService, useValue: passwordResetService },
        { provide: AuditLoggerService, useValue: {} },
        { provide: SystemConfigService, useValue: {} },
      ],
    }).compile();

    service = module.get<SubscriptionUsageService>(SubscriptionUsageService);
  });

  it('throws NotFoundException if subscription is not found', async () => {
    prisma.subscription.findUnique.mockResolvedValue(null);

    await expect(service.resetPassword('nonexistent-sub-id')).rejects.toThrow(
      NotFoundException,
    );
    expect(passwordResetService.requestPasswordResetForUser).not.toHaveBeenCalled();
  });

  it('finds authoritative HRAdmin linked to subscription and triggers password reset', async () => {
    prisma.subscription.findUnique.mockResolvedValue(mockSubscription);
    prisma.user.findFirst.mockResolvedValue(mockHrAdminUser);

    const response = await service.resetPassword('sub-uuid-1');

    expect(response).toEqual({
      success: true,
      message: 'Password reset link queued successfully.',
    });
    expect(response.message).not.toContain('pepper@stark.corp'); // No email leakage in response
    expect(passwordResetService.requestPasswordResetForUser).toHaveBeenCalledWith(
      mockHrAdminUser,
    );
  });

  it('throws NotFoundException when no HRAdmin user exists for subscription', async () => {
    prisma.subscription.findUnique.mockResolvedValue(mockSubscription);
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(service.resetPassword('sub-uuid-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(passwordResetService.requestPasswordResetForUser).not.toHaveBeenCalled();
  });
});
