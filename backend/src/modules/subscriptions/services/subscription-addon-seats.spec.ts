import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SubscriptionLifecycleService } from './subscription-lifecycle.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { TokenBlacklistService } from '../../auth/services/token-blacklist.service';

describe('SubscriptionLifecycleService - Seat Add-On Preservation on Upgrade/Downgrade', () => {
  let service: SubscriptionLifecycleService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn((callback) => callback(prisma)),
      $queryRaw: jest.fn(),
      saaSPlanNew: {
        findFirst: jest.fn(),
      },
      planVersion: {
        findFirst: jest.fn(),
      },
      subscription: {
        update: jest.fn(),
      },
      companyPlanAssignment: {
        upsert: jest.fn().mockResolvedValue({}),
      },
      subscriptionEvent: {
        create: jest.fn().mockResolvedValue({}),
      },
      invoice: {
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionLifecycleService,
        { provide: PrismaService, useValue: prisma },
        { provide: TokenBlacklistService, useValue: { blacklistAllUserSessions: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<SubscriptionLifecycleService>(SubscriptionLifecycleService);
  });

  it('should PRESERVE purchased seat add-on count when upgrading from Plan A to Plan B', async () => {
    // Current subscription: Basic plan (base 10 seats), but company bought +15 add-on seats = 25 purchasedSeats
    const mockExistingSub = {
      id: 'sub_123',
      company: 'Growth Org',
      plan: 'BASIC',
      cycle: 'Monthly',
      purchasedSeats: 25, // 10 base + 15 add-on
      storageUsedMB: 1024,
      status: 'Active',
    };

    prisma.$queryRaw.mockResolvedValue([mockExistingSub]);

    // Lookup of old plan returns base employeeLimit = 10
    // Lookup of new upgraded plan Standard returns base employeeLimit = 50
    prisma.saaSPlanNew.findFirst.mockImplementation(({ where }: any) => {
      if (where?.name?.equals === 'BASIC' || where?.OR?.[0]?.id === 'BASIC') {
        return Promise.resolve({ id: 'plan_basic', name: 'BASIC' });
      }
      return Promise.resolve({ id: 'plan_std', name: 'STANDARD' });
    });

    prisma.planVersion.findFirst.mockImplementation(({ where }: any) => {
      if (where?.planId === 'plan_basic') {
        return Promise.resolve({
          id: 'ver_basic',
          version: 1,
          employeeLimit: 10,
          storageLimitGB: 5,
          monthlyPrice: 0,
          yearlyPrice: 0,
        });
      }
      return Promise.resolve({
        id: 'ver_std',
        version: 1,
        employeeLimit: 50,
        storageLimitGB: 20,
        monthlyPrice: 5000,
        yearlyPrice: 50000,
      });
    });

    prisma.subscription.update.mockResolvedValue({
      id: 'sub_123',
      plan: 'STANDARD',
      purchasedSeats: 65, // 50 (new base) + 15 (preserved add-on)
    });

    await service.upgradeSubscription('sub_123', 'STANDARD');

    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sub_123' },
        data: expect.objectContaining({
          plan: 'STANDARD',
          purchasedSeats: 65, // Base 50 + 15 extra add-on seats preserved!
        }),
      }),
    );
  });

  it('should PRESERVE purchased seat add-on count when downgrading a plan', async () => {
    // Current subscription: Premium (base 100 seats) + 20 add-on seats = 120 purchasedSeats
    const mockExistingSub = {
      id: 'sub_456',
      company: 'Scale Corp',
      plan: 'PREMIUM',
      cycle: 'Monthly',
      purchasedSeats: 120,
      storageUsedMB: 2048,
      status: 'Active',
    };

    prisma.$queryRaw.mockResolvedValue([mockExistingSub]);

    prisma.saaSPlanNew.findFirst.mockImplementation(({ where }: any) => {
      if (where?.name?.equals === 'PREMIUM' || where?.OR?.[0]?.id === 'PREMIUM') {
        return Promise.resolve({ id: 'plan_prem', name: 'PREMIUM' });
      }
      return Promise.resolve({ id: 'plan_std', name: 'STANDARD' });
    });

    prisma.planVersion.findFirst.mockImplementation(({ where }: any) => {
      if (where?.planId === 'plan_prem') {
        return Promise.resolve({
          id: 'ver_prem',
          version: 1,
          employeeLimit: 100,
          storageLimitGB: 50,
          monthlyPrice: 15000,
          yearlyPrice: 150000,
        });
      }
      return Promise.resolve({
        id: 'ver_std',
        version: 1,
        employeeLimit: 50,
        storageLimitGB: 20,
        monthlyPrice: 5000,
        yearlyPrice: 50000,
      });
    });

    prisma.subscription.update.mockResolvedValue({
      id: 'sub_456',
      plan: 'STANDARD',
      purchasedSeats: 70, // 50 (new base) + 20 (preserved add-on)
    });

    await service.downgradeSubscription('sub_456', 'STANDARD');

    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sub_456' },
        data: expect.objectContaining({
          plan: 'STANDARD',
          purchasedSeats: 70, // Base 50 + 20 extra add-on seats preserved!
        }),
      }),
    );
  });
});
