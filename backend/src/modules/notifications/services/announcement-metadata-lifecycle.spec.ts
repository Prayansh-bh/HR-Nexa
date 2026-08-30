import { NotificationsService } from './notifications.service';
import { NotificationsRepository } from '../repositories/notifications.repository';
import { SystemService } from '../../system/services/system.service';
import { CreateAnnouncementDto } from '../../system/dto/create-announcement.dto';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

describe('Announcement Metadata Architecture — Unit & Regression Test Suite', () => {
  let notificationsService: NotificationsService;
  let notificationsRepository: NotificationsRepository;
  let systemService: SystemService;

  let mockPrisma: any;
  let mockTx: any;
  let mockOutboxPublisher: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockTx = {
      announcement: {
        create: jest.fn().mockImplementation((args) =>
          Promise.resolve({
            id: 'ann-1',
            ...args.data,
            createdAt: new Date(),
          }),
        ),
      },
      company: {
        findUnique: jest.fn().mockResolvedValue({ id: 'comp-1', name: 'Dezoryn Technologies' }),
      },
      systemNotification: {
        create: jest.fn().mockResolvedValue({ id: 'notif-1' }),
      },
    };

    mockPrisma = {
      $transaction: jest.fn().mockImplementation(async (cb) => {
        return cb(mockTx);
      }),
      announcement: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      systemNotification: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };

    mockOutboxPublisher = {
      publishNotification: jest.fn().mockResolvedValue({ id: 'event-1' }),
    };

    notificationsRepository = new NotificationsRepository(mockPrisma, mockOutboxPublisher);
    notificationsService = new NotificationsService(notificationsRepository);

    const mockAuditLogsRepository: any = {};
    systemService = new SystemService(
      mockAuditLogsRepository,
      notificationsService,
      mockPrisma,
    );
  });

  describe('1. DTO Validation Suite', () => {
    it('should validate and accept valid Maintenance announcement with ISO scheduledFor and duration', async () => {
      const payload = {
        title: 'Planned System Downtime',
        content: 'Database maintenance scheduled.',
        type: 'Maintenance',
        scheduledFor: '2026-08-30T02:00:00.000Z',
        duration: '2 Hours',
      };

      const dto = plainToInstance(CreateAnnouncementDto, payload);
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.type).toBe('Maintenance');
      expect(dto.scheduledFor).toBe('2026-08-30T02:00:00.000Z');
      expect(dto.duration).toBe('2 Hours');
    });

    it('should reject invalid non-ISO scheduledFor date string', async () => {
      const payload = {
        title: 'Planned System Downtime',
        content: 'Database maintenance scheduled.',
        type: 'Maintenance',
        scheduledFor: 'tomorrow at 2pm', // invalid ISO
      };

      const dto = plainToInstance(CreateAnnouncementDto, payload);
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const scheduledError = errors.find((e) => e.property === 'scheduledFor');
      expect(scheduledError).toBeDefined();
    });

    it('should validate and accept legacy announcement without optional metadata', async () => {
      const payload = {
        title: 'General Holiday Notice',
        content: 'Offices will be closed on Friday.',
      };

      const dto = plainToInstance(CreateAnnouncementDto, payload);
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.type).toBeUndefined();
      expect(dto.scheduledFor).toBeUndefined();
      expect(dto.duration).toBeUndefined();
    });
  });

  describe('2. Metadata Persistence & Severity Mapping in Repository', () => {
    it('should persist Maintenance announcement with type, scheduledFor Date, and duration', async () => {
      const announcementData = {
        title: 'Planned Maintenance',
        content: 'Routine upgrades.',
        author: 'SuperAdmin User',
        date: '2026-08-30',
        type: 'Maintenance',
        scheduledFor: '2026-08-30T02:00:00.000Z',
        duration: '2 Hours',
      };

      const result = await notificationsRepository.createAnnouncement(null, announcementData);

      expect(mockTx.announcement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'Planned Maintenance',
          content: 'Routine upgrades.',
          author: 'SuperAdmin User',
          type: 'Maintenance',
          scheduledFor: new Date('2026-08-30T02:00:00.000Z'),
          duration: '2 Hours',
          subscriptionId: null,
        }),
      });

      // Verify SystemNotification severity mapping for Maintenance is 'warning'
      expect(mockTx.systemNotification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: '[Maintenance] Planned Maintenance',
          severity: 'warning',
          category: 'system',
          company: 'All Employees',
        }),
      });

      // Verify Outbox publisher received structured title and content
      expect(mockOutboxPublisher.publishNotification).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({
          title: '[Maintenance] Planned Maintenance',
          targetUser: 'All Employees',
          companyId: 'PLATFORM',
        }),
      );

      expect(result.type).toBe('Maintenance');
    });

    it('should map Security announcement severity to critical', async () => {
      const announcementData = {
        title: 'Security Advisory',
        content: 'Urgent password rotation requested.',
        author: 'Security Lead',
        date: '2026-08-30',
        type: 'Security',
      };

      await notificationsRepository.createAnnouncement(null, announcementData);

      expect(mockTx.systemNotification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: '[Security] Security Advisory',
          severity: 'critical',
          category: 'system',
        }),
      });
    });

    it('should map Release and Notice category severity to info', async () => {
      const announcementData = {
        title: 'Release V2.5 Live',
        content: 'New payroll dashboard features.',
        author: 'Product Team',
        date: '2026-08-30',
        type: 'Release',
      };

      await notificationsRepository.createAnnouncement(null, announcementData);

      expect(mockTx.systemNotification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: '[Release] Release V2.5 Live',
          severity: 'info',
          category: 'system',
        }),
      });
    });
  });

  describe('3. Multi-Tenant Scoping & Tenant Isolation', () => {
    it('should return both company-specific announcements and platform broadcasts for a tenant', async () => {
      const tenantSubscriptionId = 'sub-dezoryn-123';

      mockPrisma.announcement.findMany.mockResolvedValueOnce([
        {
          id: '1',
          title: 'Global Maintenance',
          type: 'Maintenance',
          scheduledFor: new Date('2026-08-30T02:00:00Z'),
          duration: '2 Hours',
          subscriptionId: null, // Platform broadcast
        },
        {
          id: '2',
          title: 'Dezoryn Townhall',
          type: 'Notice',
          subscriptionId: tenantSubscriptionId, // Company internal
        },
      ]);

      const results = await notificationsRepository.findAnnouncements(tenantSubscriptionId);

      expect(mockPrisma.announcement.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { subscriptionId: tenantSubscriptionId },
            { subscriptionId: null },
          ],
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(results).toHaveLength(2);
      expect(results[0].type).toBe('Maintenance');
      expect(results[0].duration).toBe('2 Hours');
    });

    it('should prevent Tenant A from accessing Tenant B company-specific announcements', async () => {
      const tenantASubscriptionId = 'sub-tenant-A';

      await notificationsRepository.findAnnouncements(tenantASubscriptionId);

      const whereClause = mockPrisma.announcement.findMany.mock.calls[0][0].where;
      expect(whereClause.OR).toEqual([
        { subscriptionId: 'sub-tenant-A' },
        { subscriptionId: null },
      ]);
      // Does NOT include sub-tenant-B
      expect(JSON.stringify(whereClause)).not.toContain('sub-tenant-B');
    });
  });

  describe('4. Legacy Compatibility Suite', () => {
    it('should handle legacy announcement with null type, scheduledFor, and duration gracefully', async () => {
      const legacyRow = {
        id: 'legacy-1',
        title: 'Legacy Bulletin',
        content: 'Old notice without metadata columns.',
        date: '2025-01-01',
        author: 'Admin',
        readCount: 5,
        subscriptionId: null,
        type: 'Notice',
        scheduledFor: null,
        duration: null,
        createdAt: new Date('2025-01-01T00:00:00Z'),
      };

      mockPrisma.announcement.findMany.mockResolvedValueOnce([legacyRow]);

      const results = await notificationsRepository.findAnnouncements();
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('legacy-1');
      expect(results[0].type).toBe('Notice');
      expect(results[0].scheduledFor).toBeNull();
      expect(results[0].duration).toBeNull();
    });
  });

  describe('5. End-to-End SystemService Forwarding', () => {
    it('should forward all metadata fields from currentUser and DTO to repository', async () => {
      const currentUser = { id: 'superadmin-1', name: 'Deepak Bhagat', subscriptionId: null };
      const dto = {
        title: 'Platform Maintenance Notice',
        content: 'Upgrading core database infrastructure.',
        type: 'Maintenance',
        scheduledFor: '2026-09-01T00:00:00.000Z',
        duration: '4 Hours',
      };

      const result = await systemService.createAnnouncement(currentUser, {
        ...dto,
        author: currentUser.name,
      });

      expect(mockTx.announcement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'Platform Maintenance Notice',
          content: 'Upgrading core database infrastructure.',
          author: 'Deepak Bhagat',
          type: 'Maintenance',
          scheduledFor: new Date('2026-09-01T00:00:00.000Z'),
          duration: '4 Hours',
        }),
      });

      expect(result.id).toBe('ann-1');
    });
  });
});
