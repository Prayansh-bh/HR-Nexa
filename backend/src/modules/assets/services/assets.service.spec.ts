import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { AssetsService, UserContext } from './assets.service';
import { AssetsRepository } from '../repositories/assets.repository';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLoggerService } from '../../../common/audit/audit-logger.service';

describe('AssetsService (Phase 2 Asset Lifecycle & Concurrency)', () => {
  let service: AssetsService;
  let prisma: any;
  let repository: any;
  let auditLogger: any;

  const mockUser: UserContext = {
    id: 'user-admin-1',
    name: 'HR Admin',
    email: 'admin@acmecorp.com',
  };

  const TENANT_A = 'company-tenant-a';
  const TENANT_B = 'company-tenant-b';

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(async (cb) => cb(prisma)),
      companyAsset: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      assetHistory: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      employee: {
        findUnique: jest.fn(),
      },
      systemNotification: {
        create: jest.fn().mockResolvedValue({ id: 'notif-1' }),
      },
    };

    repository = {
      getAssets: jest.fn(),
      getDevices: jest.fn(),
      getAssetById: jest.fn(),
      findAssetByTag: jest.fn(),
      getEmployeeAssets: jest.fn(),
      createAsset: jest.fn(),
      updateAsset: jest.fn(),
      deleteAsset: jest.fn(),
      createHistory: jest.fn(),
      getHistory: jest.fn(),
      countHistory: jest.fn(),
      mapAsset: jest.fn((raw) => ({
        ...raw,
        category: raw.type || 'General Asset',
        assignedToUser: raw.assignedTo
          ? {
              id: raw.assignedTo.id,
              name: raw.assignedTo.name,
              email: raw.assignedTo.email,
            }
          : null,
      })),
      mapDevice: jest.fn((raw) => ({
        ...raw,
        deviceName: raw.name,
        ipAddress: raw.ip,
        location: raw.location || null,
      })),
    };

    auditLogger = {
      logAction: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssetsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AssetsRepository, useValue: repository },
        { provide: AuditLoggerService, useValue: auditLogger },
      ],
    }).compile();

    service = module.get<AssetsService>(AssetsService);
  });

  describe('1. Asset Creation', () => {
    it('should create an asset with status Available and write a CREATED history record', async () => {
      repository.findAssetByTag.mockResolvedValue(null);
      prisma.companyAsset.create.mockResolvedValue({
        id: 'asset-1',
        companyId: TENANT_A,
        name: 'MacBook Pro 16',
        type: 'Laptop',
        assetTag: 'AST-001',
        status: 'Available',
        condition: 'New',
        assignedTo: null,
      });

      const result = await service.createAsset(
        TENANT_A,
        {
          name: 'MacBook Pro 16',
          type: 'Laptop',
          assetTag: 'AST-001',
          purchaseCost: 2499.99,
          condition: 'New',
        },
        mockUser,
      );

      expect(prisma.companyAsset.create).toHaveBeenCalled();
      expect(prisma.assetHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          assetId: 'asset-1',
          companyId: TENANT_A,
          action: 'CREATED',
          condition: 'New',
        }),
      });
      expect(auditLogger.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ASSET_CREATED',
          companyId: TENANT_A,
        }),
      );
      expect(result.status).toBe('Available');
    });

    it('should reject duplicate assetTag within the same tenant with ConflictException', async () => {
      repository.findAssetByTag.mockResolvedValue({
        id: 'asset-existing',
        companyId: TENANT_A,
        assetTag: 'AST-001',
      });

      await expect(
        service.createAsset(
          TENANT_A,
          {
            name: 'MacBook Pro 16',
            type: 'Laptop',
            assetTag: 'AST-001',
          },
          mockUser,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('2. Tenant Isolation', () => {
    it('should reject assigning an asset if target employee belongs to another tenant', async () => {
      prisma.companyAsset.findUnique.mockResolvedValue({
        id: 'asset-1',
        companyId: TENANT_A,
        status: 'Available',
      });

      // Employee belongs to TENANT_B
      prisma.employee.findUnique.mockResolvedValue({
        id: 'emp-b',
        companyId: TENANT_B,
        name: 'Alien User',
        status: 'Active',
      });

      await expect(
        service.assignAsset(
          TENANT_A,
          'asset-1',
          { employeeId: 'emp-b' },
          mockUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject fetching asset history if asset belongs to another tenant', async () => {
      repository.getAssetById.mockResolvedValue(null);

      await expect(
        service.getAssetHistory(TENANT_A, 'asset-of-tenant-b'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('3. Concurrency-Safe Asset Assignment', () => {
    it('should successfully assign an Available asset to an active employee', async () => {
      prisma.companyAsset.findUnique
        .mockResolvedValueOnce({
          id: 'asset-1',
          companyId: TENANT_A,
          name: 'Dell XPS 15',
          type: 'Laptop',
          status: 'Available',
          condition: 'New',
        })
        .mockResolvedValueOnce({
          id: 'asset-1',
          companyId: TENANT_A,
          name: 'Dell XPS 15',
          type: 'Laptop',
          status: 'Assigned',
          assignedToId: 'emp-1',
          assignedTo: { id: 'emp-1', name: 'Maya Patel', email: 'maya@acme.com' },
        });

      prisma.employee.findUnique.mockResolvedValue({
        id: 'emp-1',
        userId: 'user-emp-1',
        companyId: TENANT_A,
        name: 'Maya Patel',
        email: 'maya@acme.com',
        status: 'Active',
      });

      prisma.companyAsset.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.assignAsset(
        TENANT_A,
        'asset-1',
        { employeeId: 'emp-1', condition: 'Good' },
        mockUser,
      );

      expect(prisma.companyAsset.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'asset-1',
          companyId: TENANT_A,
          status: 'Available',
        },
        data: expect.objectContaining({
          status: 'Assigned',
          assignedToId: 'emp-1',
        }),
      });

      expect(prisma.assetHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          assetId: 'asset-1',
          employeeId: 'emp-1',
          action: 'ASSIGNED',
        }),
      });

      expect(prisma.systemNotification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            company: TENANT_A,
            recipientId: 'user-emp-1',
            category: 'assets',
          }),
        }),
      );

      expect(result.status).toBe('Assigned');
    });

    it('should throw ConflictException on concurrent assignment race condition (count === 0)', async () => {
      prisma.companyAsset.findUnique.mockResolvedValue({
        id: 'asset-1',
        companyId: TENANT_A,
        status: 'Available',
      });

      prisma.employee.findUnique.mockResolvedValue({
        id: 'emp-1',
        companyId: TENANT_A,
        name: 'Maya Patel',
        status: 'Active',
      });

      // Another transaction updated the status before this update ran
      prisma.companyAsset.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.assignAsset(
          TENANT_A,
          'asset-1',
          { employeeId: 'emp-1' },
          mockUser,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject assignment to an Inactive employee', async () => {
      prisma.companyAsset.findUnique.mockResolvedValue({
        id: 'asset-1',
        companyId: TENANT_A,
        status: 'Available',
      });

      prisma.employee.findUnique.mockResolvedValue({
        id: 'emp-inactive',
        companyId: TENANT_A,
        name: 'Ex-Employee',
        status: 'Inactive',
      });

      await expect(
        service.assignAsset(
          TENANT_A,
          'asset-1',
          { employeeId: 'emp-inactive' },
          mockUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject assigning an asset that is already Assigned, in Maintenance, or Retired', async () => {
      prisma.companyAsset.findUnique.mockResolvedValue({
        id: 'asset-1',
        companyId: TENANT_A,
        status: 'Assigned',
      });

      await expect(
        service.assignAsset(
          TENANT_A,
          'asset-1',
          { employeeId: 'emp-1' },
          mockUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('4. Asset Return Lifecycle', () => {
    it('should return an assigned asset back to Available inventory', async () => {
      prisma.companyAsset.findUnique
        .mockResolvedValueOnce({
          id: 'asset-1',
          companyId: TENANT_A,
          name: 'MacBook Pro',
          status: 'Assigned',
          assignedToId: 'emp-1',
          assignedTo: { id: 'emp-1', name: 'Maya Patel' },
        })
        .mockResolvedValueOnce({
          id: 'asset-1',
          companyId: TENANT_A,
          name: 'MacBook Pro',
          status: 'Available',
          assignedTo: null,
        });

      prisma.companyAsset.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.returnAsset(
        TENANT_A,
        'asset-1',
        { condition: 'Good', remarks: 'Returned on project end' },
        mockUser,
      );

      expect(prisma.companyAsset.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'asset-1',
          companyId: TENANT_A,
          status: 'Assigned',
        },
        data: expect.objectContaining({
          status: 'Available',
          assignedToId: null,
        }),
      });

      expect(prisma.assetHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          assetId: 'asset-1',
          action: 'RETURNED',
          employeeId: 'emp-1',
          condition: 'Good',
        }),
      });

      expect(result.status).toBe('Available');
    });

    it('should automatically transition a Damaged return to Maintenance status', async () => {
      prisma.companyAsset.findUnique
        .mockResolvedValueOnce({
          id: 'asset-1',
          companyId: TENANT_A,
          name: 'MacBook Pro',
          status: 'Assigned',
          assignedToId: 'emp-1',
          assignedTo: { id: 'emp-1', name: 'Maya Patel' },
        })
        .mockResolvedValueOnce({
          id: 'asset-1',
          companyId: TENANT_A,
          name: 'MacBook Pro',
          status: 'Maintenance',
          assignedTo: null,
        });

      prisma.companyAsset.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.returnAsset(
        TENANT_A,
        'asset-1',
        { condition: 'Damaged', remarks: 'Screen cracked' },
        mockUser,
      );

      expect(prisma.companyAsset.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'asset-1',
          companyId: TENANT_A,
          status: 'Assigned',
        },
        data: expect.objectContaining({
          status: 'Maintenance',
          assignedToId: null,
        }),
      });

      expect(result.status).toBe('Maintenance');
    });

    it('should reject returning an asset that is not in Assigned status', async () => {
      prisma.companyAsset.findUnique.mockResolvedValue({
        id: 'asset-1',
        companyId: TENANT_A,
        status: 'Available',
      });

      await expect(
        service.returnAsset(
          TENANT_A,
          'asset-1',
          { condition: 'Good' },
          mockUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('5. Maintenance & Repair Workflow', () => {
    it('should send an Available asset to Maintenance', async () => {
      prisma.companyAsset.findUnique
        .mockResolvedValueOnce({
          id: 'asset-1',
          companyId: TENANT_A,
          status: 'Available',
        })
        .mockResolvedValueOnce({
          id: 'asset-1',
          companyId: TENANT_A,
          status: 'Maintenance',
        });

      prisma.companyAsset.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.sendToMaintenance(
        TENANT_A,
        'asset-1',
        { reason: 'Battery replacement' },
        mockUser,
      );

      expect(prisma.companyAsset.updateMany).toHaveBeenCalledWith({
        where: { id: 'asset-1', companyId: TENANT_A },
        data: expect.objectContaining({ status: 'Maintenance' }),
      });

      expect(prisma.assetHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'MAINTENANCE',
          remarks: 'Battery replacement',
        }),
      });

      expect(result.status).toBe('Maintenance');
    });

    it('should complete repair and return asset to Available status', async () => {
      prisma.companyAsset.findUnique
        .mockResolvedValueOnce({
          id: 'asset-1',
          companyId: TENANT_A,
          status: 'Maintenance',
        })
        .mockResolvedValueOnce({
          id: 'asset-1',
          companyId: TENANT_A,
          status: 'Available',
          condition: 'Good',
        });

      prisma.companyAsset.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.completeRepair(
        TENANT_A,
        'asset-1',
        { condition: 'Good', remarks: 'New battery installed' },
        mockUser,
      );

      expect(prisma.companyAsset.updateMany).toHaveBeenCalledWith({
        where: { id: 'asset-1', companyId: TENANT_A, status: 'Maintenance' },
        data: expect.objectContaining({ status: 'Available', condition: 'Good' }),
      });

      expect(prisma.assetHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'REPAIRED',
          condition: 'Good',
        }),
      });

      expect(result.status).toBe('Available');
    });

    it('should reject completeRepair on asset not in Maintenance', async () => {
      prisma.companyAsset.findUnique.mockResolvedValue({
        id: 'asset-1',
        companyId: TENANT_A,
        status: 'Available',
      });

      await expect(
        service.completeRepair(TENANT_A, 'asset-1', {}, mockUser),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('6. Asset Retirement & Controlled Deletion Policy', () => {
    it('should retire an Available or Maintenance asset', async () => {
      prisma.companyAsset.findUnique
        .mockResolvedValueOnce({
          id: 'asset-1',
          companyId: TENANT_A,
          status: 'Maintenance',
        })
        .mockResolvedValueOnce({
          id: 'asset-1',
          companyId: TENANT_A,
          status: 'Retired',
        });

      prisma.companyAsset.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.retireAsset(
        TENANT_A,
        'asset-1',
        { reason: 'End of 5-year hardware lifecycle' },
        mockUser,
      );

      expect(prisma.companyAsset.updateMany).toHaveBeenCalledWith({
        where: { id: 'asset-1', companyId: TENANT_A },
        data: expect.objectContaining({ status: 'Retired', assignedToId: null }),
      });

      expect(prisma.assetHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'RETIRED',
          remarks: 'End of 5-year hardware lifecycle',
        }),
      });

      expect(result.status).toBe('Retired');
    });

    it('should reject retiring an asset that is currently Assigned', async () => {
      prisma.companyAsset.findUnique.mockResolvedValue({
        id: 'asset-1',
        companyId: TENANT_A,
        status: 'Assigned',
      });

      await expect(
        service.retireAsset(TENANT_A, 'asset-1', {}, mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow hard-deleting a newly created asset with NO assignment history', async () => {
      prisma.companyAsset.findUnique.mockResolvedValue({
        id: 'asset-unused',
        companyId: TENANT_A,
        name: 'Mistake Asset',
        status: 'Available',
      });

      // No assignment or return records in history
      prisma.assetHistory.count.mockResolvedValue(0);
      prisma.companyAsset.delete.mockResolvedValue({ id: 'asset-unused' });

      const result = await service.deleteAsset(TENANT_A, 'asset-unused', mockUser);

      expect(prisma.companyAsset.delete).toHaveBeenCalledWith({
        where: { id: 'asset-unused' },
      });
      expect(result.success).toBe(true);
    });

    it('should reject hard-deleting an asset that has historical assignment records', async () => {
      prisma.companyAsset.findUnique.mockResolvedValue({
        id: 'asset-historical',
        companyId: TENANT_A,
        name: 'MacBook Pro with History',
        status: 'Available',
      });

      // Asset has 3 assignment/return history records
      prisma.assetHistory.count.mockResolvedValue(3);

      await expect(
        service.deleteAsset(TENANT_A, 'asset-historical', mockUser),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.companyAsset.delete).not.toHaveBeenCalled();
    });

    it('should reject hard-deleting an asset that is currently Assigned', async () => {
      prisma.companyAsset.findUnique.mockResolvedValue({
        id: 'asset-assigned',
        companyId: TENANT_A,
        status: 'Assigned',
      });

      await expect(
        service.deleteAsset(TENANT_A, 'asset-assigned', mockUser),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
