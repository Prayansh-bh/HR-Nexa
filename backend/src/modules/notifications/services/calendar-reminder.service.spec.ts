import { Test, TestingModule } from '@nestjs/testing';
import { CalendarReminderService } from './calendar-reminder.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('CalendarReminderService (Phase 1 Audit & Verification)', () => {
  let service: CalendarReminderService;
  let prisma: any;

  const mockCompanyA = { id: 'comp-aaa', name: 'Acme Corp' };
  const mockCompanyB = { id: 'comp-bbb', name: 'Beta Tech' };

  beforeEach(async () => {
    prisma = {
      company: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === mockCompanyA.id) return Promise.resolve(mockCompanyA);
          if (where.id === mockCompanyB.id) return Promise.resolve(mockCompanyB);
          return Promise.resolve(null);
        }),
        findMany: jest.fn().mockResolvedValue([mockCompanyA, mockCompanyB]),
      },
      systemConfig: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      holiday: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      calendarEvent: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      systemNotification: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'notif-1', ...data })),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarReminderService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CalendarReminderService>(CalendarReminderService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Immediate Notifications on Creation', () => {
    it('1.1 should generate an immediate notification on Holiday creation with dedupKey', async () => {
      const holiday = {
        id: 'hol-101',
        occasion: 'Raksha Bandhan',
        date: new Date('2026-08-28T00:00:00.000Z'),
      };

      const result = await service.sendHolidayImmediate(mockCompanyA.id, holiday);

      expect(result).toBeDefined();
      expect(prisma.systemNotification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'New Holiday Declared: Raksha Bandhan',
          category: 'holiday',
          severity: 'info',
          targetRole: 'ALL',
          company: 'Acme Corp',
          linkUrl: 'leave.calendar',
          dedupKey: 'HOLIDAY:hol-101:IMMEDIATE',
        }),
      });
    });

    it('1.2 should generate an immediate notification on CalendarEvent creation with dedupKey', async () => {
      const event = {
        id: 'evt-201',
        title: 'Q3 All Hands Meeting',
        date: '2026-08-28',
        type: 'meeting',
      };

      const result = await service.sendEventImmediate(mockCompanyA.id, event);

      expect(result).toBeDefined();
      expect(prisma.systemNotification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'New Meeting: Q3 All Hands Meeting',
          category: 'calendar',
          severity: 'info',
          targetRole: 'ALL',
          company: 'Acme Corp',
          linkUrl: 'leave.calendar',
          dedupKey: 'EVENT:evt-201:IMMEDIATE',
        }),
      });
    });
  });

  describe('2. Scheduled T-1 and T-0 Reminders', () => {
    it('2.1 should generate T-1 reminder on the day before the holiday at or after 08:00 local time', async () => {
      // Holiday is on Aug 28, 2026
      prisma.holiday.findMany.mockResolvedValue([
        {
          id: 'hol-101',
          companyId: mockCompanyA.id,
          date: new Date('2026-08-28T00:00:00.000Z'),
          occasion: 'Raksha Bandhan',
        },
      ]);

      // Reference date: Aug 27, 2026 08:30 AM IST (T-1)
      const refDate = new Date('2026-08-27T03:00:00.000Z'); // 03:00 UTC = 08:30 IST

      const result = await service.processDueRemindersForTenant(mockCompanyA.id, 'Asia/Kolkata', refDate);

      expect(result.generatedCount).toBe(1);
      expect(prisma.systemNotification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'Holiday Tomorrow: Raksha Bandhan',
          category: 'holiday',
          dedupKey: 'HOLIDAY:hol-101:T_MINUS_1',
          linkUrl: 'leave.calendar',
        }),
      });
    });

    it('2.2 should generate T-0 reminder on the day of the holiday at or after 08:00 local time', async () => {
      prisma.holiday.findMany.mockResolvedValue([
        {
          id: 'hol-101',
          companyId: mockCompanyA.id,
          date: new Date('2026-08-28T00:00:00.000Z'),
          occasion: 'Raksha Bandhan',
        },
      ]);

      // Reference date: Aug 28, 2026 08:15 AM IST (T-0)
      const refDate = new Date('2026-08-28T02:45:00.000Z'); // 02:45 UTC = 08:15 IST

      const result = await service.processDueRemindersForTenant(mockCompanyA.id, 'Asia/Kolkata', refDate);

      expect(result.generatedCount).toBe(1);
      expect(prisma.systemNotification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'Holiday Today: Raksha Bandhan',
          category: 'holiday',
          dedupKey: 'HOLIDAY:hol-101:T_MINUS_0',
          linkUrl: 'leave.calendar',
        }),
      });
    });

    it('2.3 should generate T-1 and T-0 reminders for calendar events', async () => {
      // Event on Aug 28, 2026
      prisma.calendarEvent.findMany.mockResolvedValue([
        {
          id: 'evt-301',
          title: 'Product Sync',
          date: '2026-08-28',
          type: 'meeting',
          companyId: mockCompanyA.id,
        },
      ]);

      // Reference date: Aug 27, 2026 09:00 AM IST (T-1)
      const refDateT1 = new Date('2026-08-27T03:30:00.000Z');
      const resT1 = await service.processDueRemindersForTenant(mockCompanyA.id, 'Asia/Kolkata', refDateT1);

      expect(resT1.generatedCount).toBe(1);
      expect(prisma.systemNotification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'Meeting Tomorrow: Product Sync',
          dedupKey: 'EVENT:evt-301:T_MINUS_1',
        }),
      });
    });
  });

  describe('3. Deduplication & Idempotency', () => {
    it('3.1 should safely ignore duplicate creations when Prisma returns P2002 unique constraint error', async () => {
      const p2002Error: any = new Error('Unique constraint failed on the fields: (`dedupKey`)');
      p2002Error.code = 'P2002';
      prisma.systemNotification.create.mockRejectedValueOnce(p2002Error);

      const holiday = {
        id: 'hol-101',
        occasion: 'Independence Day',
        date: '2026-08-15',
      };

      const result = await service.sendHolidayImmediate(mockCompanyA.id, holiday);

      expect(result).toBeNull(); // Graceful no-op, did not throw
    });

    it('3.2 should skip already processed reminders in consecutive scheduler runs', async () => {
      prisma.holiday.findMany.mockResolvedValue([
        {
          id: 'hol-101',
          companyId: mockCompanyA.id,
          date: new Date('2026-08-28T00:00:00.000Z'),
          occasion: 'Raksha Bandhan',
        },
      ]);

      const refDate = new Date('2026-08-27T03:00:00.000Z'); // 08:30 IST

      // Run 1: First time
      const res1 = await service.processDueRemindersForTenant(mockCompanyA.id, 'Asia/Kolkata', refDate);
      expect(res1.generatedCount).toBe(1);

      // Run 2: Second run throws P2002 duplicate
      const p2002Error: any = new Error('Unique constraint failed');
      p2002Error.code = 'P2002';
      prisma.systemNotification.create.mockRejectedValueOnce(p2002Error);

      const res2 = await service.processDueRemindersForTenant(mockCompanyA.id, 'Asia/Kolkata', refDate);
      expect(res2.generatedCount).toBe(0);
      expect(res2.skippedCount).toBe(1);
    });
  });

  describe('4. Timezone & Stale Reminder Protection', () => {
    it('4.1 should NOT trigger reminders before 08:00 AM in tenant local timezone', async () => {
      prisma.holiday.findMany.mockResolvedValue([
        {
          id: 'hol-101',
          companyId: mockCompanyA.id,
          date: new Date('2026-08-28T00:00:00.000Z'),
          occasion: 'Raksha Bandhan',
        },
      ]);

      // Reference date: Aug 27, 2026 06:30 AM IST (Before 08:00 AM)
      const refDateEarly = new Date('2026-08-27T01:00:00.000Z'); // 01:00 UTC = 06:30 IST

      const result = await service.processDueRemindersForTenant(mockCompanyA.id, 'Asia/Kolkata', refDateEarly);

      expect(result.generatedCount).toBe(0);
      expect(prisma.systemNotification.create).not.toHaveBeenCalled();
    });

    it('4.2 should evaluate reminders according to tenant specific timezone (PST vs IST)', async () => {
      prisma.holiday.findMany.mockResolvedValue([
        {
          id: 'hol-101',
          companyId: mockCompanyB.id,
          date: new Date('2026-08-28T00:00:00.000Z'),
          occasion: 'Tech Day',
        },
      ]);

      // 14:00 UTC on Aug 27 is 07:00 AM PST (America/Los_Angeles) -> Before 08:00 AM PST
      const refDate7amPst = new Date('2026-08-27T14:00:00.000Z');
      const resPstEarly = await service.processDueRemindersForTenant(mockCompanyB.id, 'America/Los_Angeles', refDate7amPst);
      expect(resPstEarly.generatedCount).toBe(0);

      // 16:00 UTC on Aug 27 is 09:00 AM PST (America/Los_Angeles) -> After 08:00 AM PST
      const refDate9amPst = new Date('2026-08-27T16:00:00.000Z');
      const resPstOnTime = await service.processDueRemindersForTenant(mockCompanyB.id, 'America/Los_Angeles', refDate9amPst);
      expect(resPstOnTime.generatedCount).toBe(1);
    });

    it('4.3 should not generate a stale T-1 reminder when local date is already on or past the event date', async () => {
      // Event date is Aug 28, 2026
      prisma.calendarEvent.findMany.mockResolvedValue([
        {
          id: 'evt-401',
          title: 'Past Event',
          date: '2026-08-28',
          type: 'event',
          companyId: mockCompanyA.id,
        },
      ]);

      // Current local date is Aug 29, 2026 (Day after event)
      const refDatePast = new Date('2026-08-29T04:00:00.000Z'); // 09:30 AM IST on Aug 29

      const result = await service.processDueRemindersForTenant(mockCompanyA.id, 'Asia/Kolkata', refDatePast);

      // Should not generate any T-1 or T-0 because event date is in the past
      expect(result.generatedCount).toBe(0);
      expect(prisma.systemNotification.create).not.toHaveBeenCalled();
    });
  });

  describe('5. Strict Tenant Isolation', () => {
    it('5.1 should never generate notifications for Tenant B from Tenant A holidays', async () => {
      prisma.holiday.findMany.mockImplementation(({ where }) => {
        if (where.companyId === mockCompanyA.id) {
          return Promise.resolve([
            {
              id: 'hol-A',
              companyId: mockCompanyA.id,
              date: new Date('2026-08-28T00:00:00.000Z'),
              occasion: 'Acme Founders Day',
            },
          ]);
        }
        return Promise.resolve([]);
      });

      const refDate = new Date('2026-08-27T04:00:00.000Z');

      // Process Tenant B
      const resB = await service.processDueRemindersForTenant(mockCompanyB.id, 'Asia/Kolkata', refDate);
      expect(resB.generatedCount).toBe(0);

      // Process Tenant A
      const resA = await service.processDueRemindersForTenant(mockCompanyA.id, 'Asia/Kolkata', refDate);
      expect(resA.generatedCount).toBe(1);
      expect(prisma.systemNotification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          company: 'Acme Corp',
        }),
      });
    });
  });
});
