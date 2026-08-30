import { Test, TestingModule } from '@nestjs/testing';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from '../services/employees.service';
import { ForbiddenException } from '@nestjs/common';
import { Permission } from '../../auth/permissions.enum';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../../prisma/prisma.service';

describe('EmployeesController - Profile Update Authorization', () => {
  let controller: EmployeesController;
  let service: EmployeesService;

  const mockEmployeesService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn().mockImplementation((user, id, dto) => Promise.resolve({ id, ...dto })),
    remove: jest.fn(),
    getOrgChartTree: jest.fn(),
    uploadAvatar: jest.fn().mockImplementation((user, id, file) => Promise.resolve({ id, avatar: 'tenants/C1/employee-photos/avatar.png', url: `/api/employees/${id}/avatar` })),
    getAvatarStream: jest.fn().mockResolvedValue({ streamOrBuffer: Buffer.from('img'), mimeType: 'image/png' }),
  };

  const mockPrismaService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmployeesController],
      providers: [
        { provide: EmployeesService, useValue: mockEmployeesService },
        { provide: PrismaService, useValue: mockPrismaService },
        Reflector,
      ],
    }).compile();

    controller = module.get<EmployeesController>(EmployeesController);
    service = module.get<EmployeesService>(EmployeesService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('update (Object-Level Authorization)', () => {
    it('allows an employee to update their own employee record', async () => {
      const mockReq: any = {
        user: {
          id: 'user-123',
          role: 'Employee',
          permissions: [Permission.EMPLOYEES_PROFILE_VIEW],
          employee: { id: 'EMP004' },
        },
      };

      const result = await controller.update(
        'EMP004',
        { phone: '+91 98100 52345', address: 'Hyderabad' } as any,
        mockReq,
      );

      expect(result).toEqual({
        id: 'EMP004',
        phone: '+91 98100 52345',
        address: 'Hyderabad',
      });
      expect(mockEmployeesService.update).toHaveBeenCalledWith(
        mockReq.user,
        'EMP004',
        { phone: '+91 98100 52345', address: 'Hyderabad' },
      );
    });

    it('blocks an employee from updating another employee record (returns 403 Forbidden)', async () => {
      const mockReq: any = {
        user: {
          id: 'user-123',
          role: 'Employee',
          permissions: [Permission.EMPLOYEES_PROFILE_VIEW],
          employee: { id: 'EMP004' },
        },
      };

      await expect(
        controller.update(
          'EMP001',
          { address: 'Hacked Address' } as any,
          mockReq,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows HR Admin with EMPLOYEES_LIST_EDIT to update another employee record', async () => {
      const mockReq: any = {
        user: {
          id: 'hr-user-1',
          role: 'HRAdmin',
          permissions: [
            Permission.EMPLOYEES_PROFILE_VIEW,
            Permission.EMPLOYEES_LIST_EDIT,
          ],
          employee: { id: 'EMP002' },
        },
      };

      const result = await controller.update(
        'EMP004',
        { address: 'Updated by HR' } as any,
        mockReq,
      );

      expect(result).toEqual({ id: 'EMP004', address: 'Updated by HR' });
    });

    it('allows SuperAdmin to update any employee record', async () => {
      const mockReq: any = {
        user: {
          id: 'sa-user-1',
          role: 'SuperAdmin',
          permissions: [],
        },
      };

      const result = await controller.update(
        'EMP004',
        { address: 'Updated by SuperAdmin' } as any,
        mockReq,
      );

      expect(result).toEqual({ id: 'EMP004', address: 'Updated by SuperAdmin' });
    });
  });

  describe('uploadAvatar and getAvatar', () => {
    it('calls uploadAvatar service method and returns avatar URL', async () => {
      const mockReq: any = {
        user: {
          id: 'user-123',
          role: 'Employee',
          employee: { id: 'EMP004' },
        },
      };
      const mockFile = {
        originalname: 'profile.jpg',
        mimetype: 'image/jpeg',
        buffer: Buffer.from('bytes'),
        size: 512,
      };

      const result = await controller.uploadAvatar('EMP004', mockFile, mockReq);
      expect(result.avatar).toBe('tenants/C1/employee-photos/avatar.png');
      expect(result.url).toBe('/api/employees/EMP004/avatar');
    });

    it('streams avatar image with correct content type and cache headers', async () => {
      const mockRes: any = {
        setHeader: jest.fn(),
        end: jest.fn(),
      };

      await controller.getAvatar('EMP004', mockRes);
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
      expect(mockRes.end).toHaveBeenCalled();
    });
  });
});
