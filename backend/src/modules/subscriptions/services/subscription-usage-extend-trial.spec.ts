import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SubscriptionUsageService } from './subscription-usage.service';
import { getBusinessDateString } from '../../../common/utils/date.util';

describe('SubscriptionUsageService - extendTrial Hardening Specs (F-01)', () => {
  let service: SubscriptionUsageService;
  let mockPrisma: any;
  let mockSystemConfigService: any;

  beforeEach(() => {
    mockPrisma = {
      subscription: {
        findUnique: jest.fn(),
        update: jest.fn().mockImplementation((args) => ({
          id: args.where.id,
          ...args.data,
        })),
      },
      subscriptionEvent: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    mockSystemConfigService = {
      getConfiguredTrialDays: jest.fn().mockResolvedValue(14),
    };

    service = new SubscriptionUsageService(
      mockPrisma,
      { requestPasswordResetForUser: jest.fn() } as any,
      undefined,
      mockSystemConfigService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('1. Normal trial extension adds configured trialDays (14 days) to existing sub.expiry', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      id: 'SUB-1',
      company: 'Acme Corp',
      status: 'Trial',
      expiry: '2029-08-30',
      cycle: 'Trial',
    });

    const result = await service.extendTrial('SUB-1');

    expect(mockPrisma.subscription.findUnique).toHaveBeenCalledWith({
      where: { id: 'SUB-1' },
    });
    expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
      where: { id: 'SUB-1' },
      data: {
        expiry: '2029-09-13',
        status: 'Trial',
        cycle: 'Trial',
      },
    });
    expect(result.expiry).toBe('2029-09-13');
    expect(result.status).toBe('Trial');
  });

  it('2. Extension across month boundary (2029-08-25 + 14 days -> 2029-09-08)', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      id: 'SUB-2',
      company: 'Acme Corp',
      status: 'Trial',
      expiry: '2029-08-25',
      cycle: 'Trial',
    });

    const result = await service.extendTrial('SUB-2');

    expect(result.expiry).toBe('2029-09-08');
    expect(result.status).toBe('Trial');
  });

  it('3. Extension across year boundary (2029-12-25 + 14 days -> 2030-01-08)', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      id: 'SUB-3',
      company: 'Acme Corp',
      status: 'Trial',
      expiry: '2029-12-25',
      cycle: 'Trial',
    });

    const result = await service.extendTrial('SUB-3');

    expect(result.expiry).toBe('2030-01-08');
    expect(result.status).toBe('Trial');
  });

  it('4. Configurable trialDays (e.g. 21 days from SystemConfigService)', async () => {
    mockSystemConfigService.getConfiguredTrialDays.mockResolvedValue(21);
    mockPrisma.subscription.findUnique.mockResolvedValue({
      id: 'SUB-4',
      company: 'Acme Corp',
      status: 'Trial',
      expiry: '2029-08-30',
      cycle: 'Trial',
    });

    const result = await service.extendTrial('SUB-4');

    expect(result.expiry).toBe('2029-09-20');
    expect(mockSystemConfigService.getConfiguredTrialDays).toHaveBeenCalled();
  });

  it('5. Custom trialDays passed as argument overrides configured trialDays', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      id: 'SUB-5',
      company: 'Acme Corp',
      status: 'Trial',
      expiry: '2029-08-30',
      cycle: 'Trial',
    });

    const result = await service.extendTrial('SUB-5', 7);

    expect(result.expiry).toBe('2029-09-06');
  });

  it('6. Expired trial sub (expiry in the past) anchors strictly to max(sub.expiry, today)', async () => {
    const todayStr = getBusinessDateString();
    mockPrisma.subscription.findUnique.mockResolvedValue({
      id: 'SUB-EXPIRED',
      company: 'Acme Corp',
      status: 'Expired',
      expiry: '2025-01-01',
      cycle: 'Trial',
    });

    const result = await service.extendTrial('SUB-EXPIRED', 14);

    expect(result.expiry > todayStr).toBe(true);
    expect(result.status).toBe('Trial');
  });

  it('7. Throws NotFoundException if subscription ID does not exist', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(null);

    await expect(service.extendTrial('NON-EXISTENT-ID')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('8. Throws BadRequestException if subscription is Archived or Deleted', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      id: 'SUB-ARCHIVED',
      status: 'Archived',
    });

    await expect(service.extendTrial('SUB-ARCHIVED')).rejects.toThrow(
      BadRequestException,
    );
  });
});
