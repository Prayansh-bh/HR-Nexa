import { Test, TestingModule } from '@nestjs/testing';
import { EmployeesService } from './employees.service';
import { EmployeesRepository } from '../repositories/employees.repository';
import { EmployeeUserLinkService } from './employee-user-link.service';
import { EmployeeDepartmentSyncService } from './employee-department-sync.service';
import { SeatLimitService } from '../../subscriptions/services/seat-limit.service';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { StorageService } from '../../../common/storage/storage.service';

describe('EmployeesService', () => {
  let service: EmployeesService;

  const mockEmployee = {
    id: 'emp-1',
    name: 'Jane Doe',
    email: 'jane@company.com',
    departmentName: 'Engineering',
    designation: 'Software Engineer',
    status: 'Active',
  };

  const mockEmployeesRepository = {
    findMany: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    findByIdAndTenant: jest.fn(),
    findByEmail: jest.fn(),
    findByEmployeeId: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockEmployeeUserLinkService = {
    ensureUserForEmployee: jest.fn(),
    getOrCreateUserForEmployee: jest.fn(),
  };

  const mockEmployeeDepartmentSyncService = {
    syncDepartmentHeadName: jest.fn(),
  };

  const mockSeatLimitService = {
    verifyCanAddEmployee: jest.fn(),
    syncEmployeeCounts: jest.fn(),
  };

  const mockStorageService = {
    saveFile: jest.fn().mockResolvedValue({
      path: 'tenants/C1/employee-photos/avatar-123.png',
      url: '/uploads/tenants/C1/employee-photos/avatar-123.png',
      filename: 'avatar-123.png',
    }),
    deleteFile: jest.fn().mockResolvedValue(true),
    validateFile: jest.fn(),
    getFileStream: jest.fn().mockResolvedValue(Buffer.from('fake-image-data')),
  };

  const mockPrismaService = {
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
    user: { update: jest.fn().mockResolvedValue({}) },
    employee: {
      create: jest.fn(),
      update: jest.fn().mockResolvedValue({
        id: 'emp-1',
        name: 'Jane Doe',
        avatar: 'tenants/C1/employee-photos/avatar-123.png',
      }),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    subscription: { findFirst: jest.fn(), findUnique: jest.fn() },
    department: { findFirst: jest.fn(), create: jest.fn() },
    designation: { findFirst: jest.fn(), create: jest.fn() },
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  const mockTenantContextService = {
    isPlatform: jest.fn().mockReturnValue(false),
    getCompanyId: jest.fn().mockReturnValue('C1'),
    getSubscriptionId: jest.fn().mockReturnValue('SUB1'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeesService,
        { provide: EmployeesRepository, useValue: mockEmployeesRepository },
        {
          provide: EmployeeUserLinkService,
          useValue: mockEmployeeUserLinkService,
        },
        {
          provide: EmployeeDepartmentSyncService,
          useValue: mockEmployeeDepartmentSyncService,
        },
        { provide: SeatLimitService, useValue: mockSeatLimitService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: TenantContextService, useValue: mockTenantContextService },
        { provide: StorageService, useValue: mockStorageService },
      ],
    }).compile();

    service = module.get<EmployeesService>(EmployeesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return array of employees', async () => {
      mockEmployeesRepository.findMany.mockResolvedValue([mockEmployee]);

      const result = await service.findAll();
      expect(result).toHaveLength(1);
      expect(result[0].email).toBe('jane@company.com');
    });
  });

  describe('findOne', () => {
    it('should return an employee by ID', async () => {
      mockEmployeesRepository.findByIdAndTenant.mockResolvedValue(mockEmployee);

      const result = await service.findOne('emp-1');
      expect(result.id).toBe('emp-1');
    });

    it('should throw NotFoundException if employee not found', async () => {
      mockEmployeesRepository.findByIdAndTenant.mockResolvedValue(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should throw ConflictException if email exists', async () => {
      mockEmployeesRepository.findByEmail.mockResolvedValue(mockEmployee);

      const dto = {
        id: 'EMP002',
        name: 'Jane Doe',
        email: 'jane@company.com',
        phone: '1234567890',
        departmentName: 'Engineering',
        designation: 'Software Engineer',
        joined: '2026-01-01',
        salary: 100000,
        status: 'Active',
        avatar: 'JD',
      };

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('uploadAvatar', () => {
    it('should successfully upload avatar and update employee record with storage reference', async () => {
      const mockUser = {
        id: 'user-1',
        role: 'Employee',
        employee: { id: 'emp-1' },
        companyId: 'C1',
      };
      const mockFile = {
        originalname: 'photo.jpg',
        mimetype: 'image/jpeg',
        buffer: Buffer.from('image-bytes'),
        size: 1024,
      };

      mockEmployeesRepository.findByIdAndTenant.mockResolvedValue({
        ...mockEmployee,
        avatar: 'tenants/C1/employee-photos/old-avatar.png',
      });

      const result = await service.uploadAvatar(mockUser, 'emp-1', mockFile);

      expect(mockStorageService.validateFile).toHaveBeenCalledWith(
        mockFile,
        'employee-photos',
      );
      expect(mockStorageService.saveFile).toHaveBeenCalledWith(
        mockFile,
        'employee-photos',
        'C1',
      );
      expect(mockPrismaService.employee.update).toHaveBeenCalledWith({
        where: { id: 'emp-1' },
        data: {
          avatar: 'tenants/C1/employee-photos/avatar-123.png',
          photoData: null,
          photoRotation: 0,
        },
        select: {
          id: true,
          name: true,
          avatar: true,
        },
      });
      expect(mockStorageService.deleteFile).toHaveBeenCalledWith(
        'tenants/C1/employee-photos/old-avatar.png',
      );
      expect(result.avatar).toBe('tenants/C1/employee-photos/avatar-123.png');
      expect(result.url).toBe('/api/employees/emp-1/avatar');
    });

    it('should reject upload if an employee tries to update another employee avatar', async () => {
      const mockUser = {
        id: 'user-1',
        role: 'Employee',
        employee: { id: 'emp-2' },
        companyId: 'C1',
      };
      const mockFile = {
        originalname: 'photo.jpg',
        mimetype: 'image/jpeg',
        buffer: Buffer.from('image-bytes'),
        size: 1024,
      };

      await expect(
        service.uploadAvatar(mockUser, 'emp-1', mockFile),
      ).rejects.toThrow();
    });
  });

  describe('getAvatarStream', () => {
    it('should return stream and mimeType for a storage avatar reference', async () => {
      mockPrismaService.employee.findFirst.mockResolvedValue({
        id: 'emp-1',
        avatar: 'tenants/C1/employee-photos/photo.png',
        photoData: null,
      });

      const result = await service.getAvatarStream('emp-1');
      expect(result).toBeDefined();
      expect(result?.mimeType).toBe('image/png');
      expect(mockStorageService.getFileStream).toHaveBeenCalledWith(
        'tenants/C1/employee-photos/photo.png',
      );
    });
  });
});
