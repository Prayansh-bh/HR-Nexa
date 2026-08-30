import { Test, TestingModule } from '@nestjs/testing';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from '../services/documents.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../../auth/permissions.decorator';
import { Permission } from '../../auth/permissions.enum';

describe('DocumentsController', () => {
  let controller: DocumentsController;
  let service: jest.Mocked<Partial<DocumentsService>>;
  let reflector: Reflector;

  const mockReq = {
    user: {
      id: 'usr-1',
      role: 'HRAdmin',
      companyId: 'company-77',
    },
  };

  const mockRes = {
    setHeader: jest.fn(),
    end: jest.fn(),
    download: jest.fn(),
  };

  beforeEach(async () => {
    service = {
      findAll: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({ id: 'doc-1', companyId: 'company-77', employeeId: 'emp-1', category: 'HR_LETTER', fileName: 'offer.pdf' } as any),
      download: jest.fn().mockResolvedValue({ doc: { id: 'doc-1', fileName: 'offer.pdf', filePath: '' }, streamOrBuffer: Buffer.from('data') } as any),
      verifyDocument: jest.fn().mockResolvedValue({ id: 'doc-1', verificationStatus: 'VERIFIED' } as any),
      rejectDocument: jest.fn().mockResolvedValue({ id: 'doc-1', verificationStatus: 'REJECTED' } as any),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [
        { provide: DocumentsService, useValue: service },
        { provide: PrismaService, useValue: {} },
        Reflector,
      ],
    }).compile();

    controller = module.get<DocumentsController>(DocumentsController);
    reflector = module.get<Reflector>(Reflector);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('download (F03 Authorization Tests)', () => {
    it('should allow employee to download their own HR_LETTER document', async () => {
      service.findOne = jest.fn().mockResolvedValue({
        id: 'doc-1',
        employeeId: 'emp-123',
        category: 'HR_LETTER',
        fileName: 'offer.pdf',
      } as any);

      const empReq = {
        user: {
          id: 'usr-emp',
          role: 'Employee',
          companyId: 'company-77',
          employee: { id: 'emp-123' },
        },
      };

      await controller.download('doc-1', mockRes as any, empReq as any);
      expect(service.download).toHaveBeenCalledWith('doc-1', expect.anything());
    });

    it('should throw ForbiddenException if employee attempts to download another employee HR_LETTER document (F03)', async () => {
      service.findOne = jest.fn().mockResolvedValue({
        id: 'doc-2',
        employeeId: 'emp-other',
        category: 'HR_LETTER',
        fileName: 'confidential_offer.pdf',
      } as any);

      const empReq = {
        user: {
          id: 'usr-emp',
          role: 'Employee',
          companyId: 'company-77',
          employee: { id: 'emp-123' },
        },
      };

      await expect(controller.download('doc-2', mockRes as any, empReq as any)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException if employee attempts to download candidate unassigned offer (employeeId = null, category = HR_LETTER)', async () => {
      service.findOne = jest.fn().mockResolvedValue({
        id: 'doc-cand',
        employeeId: null,
        category: 'HR_LETTER',
        fileName: 'candidate_offer.pdf',
      } as any);

      const empReq = {
        user: {
          id: 'usr-emp',
          role: 'Employee',
          companyId: 'company-77',
          employee: { id: 'emp-123' },
        },
      };

      await expect(controller.download('doc-cand', mockRes as any, empReq as any)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow employee to download company-wide COMPLIANCE document', async () => {
      service.findOne = jest.fn().mockResolvedValue({
        id: 'doc-comp',
        employeeId: null,
        category: 'COMPLIANCE',
        fileName: 'policy.pdf',
      } as any);

      const empReq = {
        user: {
          id: 'usr-emp',
          role: 'Employee',
          companyId: 'company-77',
          employee: { id: 'emp-123' },
        },
      };

      await controller.download('doc-comp', mockRes as any, empReq as any);
      expect(service.download).toHaveBeenCalledWith('doc-comp', expect.anything());
    });
  });

  describe('reject (F04 Permission Tests)', () => {
    it('should enforce DOCUMENTS_VERIFY permission on reject endpoint', () => {
      const permissions = reflector.get<string[]>(PERMISSIONS_KEY, controller.reject);
      expect(permissions).toBeDefined();
      expect(permissions).toContain(Permission.DOCUMENTS_VERIFY);
    });

    it('should delegate to rejectDocument with DTO reason', async () => {
      await controller.reject('doc-1', { reason: 'Illegible image copy' }, mockReq as any);
      expect(service.rejectDocument).toHaveBeenCalledWith(
        'doc-1',
        'Illegible image copy',
        expect.objectContaining({ companyId: 'company-77' }),
        { id: 'usr-1', role: 'HRAdmin' },
      );
    });
  });

  describe('remove (Document Deletion Endpoint)', () => {
    it('should enforce EMPLOYEES_PROFILE_DOCS_DELETE permission on remove endpoint', () => {
      const permissions = reflector.get<string[]>(PERMISSIONS_KEY, controller.remove);
      expect(permissions).toBeDefined();
      expect(permissions).toContain(Permission.EMPLOYEES_PROFILE_DOCS_DELETE);
    });

    it('should delegate to service.remove with scoped tenant', async () => {
      service.remove = jest.fn().mockResolvedValue({ id: 'doc-1' } as any);
      await controller.remove('doc-1', mockReq as any);
      expect(service.remove).toHaveBeenCalledWith(
        'doc-1',
        expect.objectContaining({ companyId: 'company-77' }),
      );
    });
  });
});

