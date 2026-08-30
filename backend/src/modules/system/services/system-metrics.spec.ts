import { Test, TestingModule } from '@nestjs/testing';
import { SystemService } from './system.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogsRepository } from '../repositories/audit-logs.repository';
import { NotificationsService } from '../../notifications/services/notifications.service';

describe('SystemService — System Metrics Contract (F-01)', () => {
  let service: SystemService;

  const mockPrisma = {
    $queryRaw: jest.fn().mockResolvedValue([{ size: 52428800 }]),
    user: { count: jest.fn().mockResolvedValue(10) },
    employee: { count: jest.fn().mockResolvedValue(5) },
    auditLog: { count: jest.fn().mockResolvedValue(20) },
    message: { count: jest.fn().mockResolvedValue(2) },
    outboxEvent: { count: jest.fn().mockResolvedValue(0) },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SystemService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditLogsRepository, useValue: {} },
        { provide: NotificationsService, useValue: {} },
      ],
    }).compile();

    service = module.get<SystemService>(SystemService);
  });

  it('should return valid telemetry with both numeric and formatted fields', async () => {
    const metrics = await service.getSystemMetrics();

    expect(metrics).toBeDefined();
    expect(typeof metrics.cpuUsageNumeric).toBe('number');
    expect(typeof metrics.memoryUsedGb).toBe('number');
    expect(typeof metrics.memoryTotalGb).toBe('number');
    expect(typeof metrics.uptimeSeconds).toBe('number');
    expect(typeof metrics.storageUsedGb).toBe('number');
    expect(typeof metrics.storageTotalGb).toBe('number');
    expect(metrics.apiStatus).toBe('Operational');
    expect(metrics.timestamp).toBeDefined();
  });
});
