import { Test, TestingModule } from '@nestjs/testing';
import { DocumentsService } from './documents.service';
import { DocumentsRepository } from '../repositories/documents.repository';
import { EmployeesRepository } from '../../employees/repositories/employees.repository';
import { AuditLogsRepository } from '../../system/repositories/audit-logs.repository';
import { StorageService } from '../../../common/storage/storage.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { SalaryComponentCalculatorService } from '../../payroll/services/salary-component-calculator.service';
import { StatutoryRulesService } from '../../payroll/services/statutory-rules.service';
import { OfferLetterTemplateService } from '../../../common/documents/offer-letter-template.service';
import { ConflictException, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';

describe('DocumentsService', () => {
  let service: DocumentsService;
  let repository: jest.Mocked<Partial<DocumentsRepository>>;
  let auditRepo: jest.Mocked<Partial<AuditLogsRepository>>;
  let storageService: jest.Mocked<Partial<StorageService>>;
  let prisma: any;

  const mockScope = { companyId: 'company-101', isPlatformBypass: false };
  const mockActor = { id: 'user-admin-1', role: 'HRAdmin' };
  const mockDoc = {
    id: 'doc-1',
    companyId: 'company-101',
    employeeId: 'emp-55',
    title: 'Aadhaar Card',
    docType: 'ID Proof',
    fileName: 'aadhaar.pdf',
    filePath: 'uploads/aadhaar.pdf',
    size: '1.2 MB',
    status: 'VALID',
    verificationStatus: 'PENDING',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    repository = {
      findById: jest.fn().mockResolvedValue(mockDoc as any),
      updateVerificationStatus: jest.fn().mockResolvedValue(true),
      findMany: jest.fn().mockResolvedValue([mockDoc] as any),
      delete: jest.fn().mockResolvedValue(mockDoc as any),
    };

    auditRepo = {
      create: jest.fn().mockResolvedValue({ id: 'audit-1' } as any),
    };

    storageService = {
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };

    const mockEmployeesRepo = {
      findById: jest.fn().mockImplementation((id: string) => {
        if (id === 'emp-55') {
          return Promise.resolve({
            id: 'emp-55',
            name: 'Maya Patel',
            companyId: 'company-101',
            designation: 'Analyst',
          });
        }
        if (id === 'emp-other-company') {
          return Promise.resolve({
            id: 'emp-other-company',
            name: 'John Doe',
            companyId: 'other-company-999',
            designation: 'Manager',
          });
        }
        return Promise.resolve(null);
      }),
    };

    const mockStatRulesService = {
      getStatutoryRules: jest.fn().mockResolvedValue({
        basicPercentage: 50,
        hraPercentage: 40,
        pfRate: 12,
        ptAmount: 200,
      }),
    };

    const mockSalaryCalc = {
      calculateComponents: jest.fn().mockReturnValue({
        components: [{ name: 'Professional Tax', amount: 200 }],
      }),
    };

    prisma = {
      offer: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      salaryComponent: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        { provide: DocumentsRepository, useValue: repository },
        { provide: EmployeesRepository, useValue: mockEmployeesRepo },
        { provide: AuditLogsRepository, useValue: auditRepo },
        { provide: StorageService, useValue: storageService },
        { provide: PrismaService, useValue: prisma },
        { provide: SalaryComponentCalculatorService, useValue: mockSalaryCalc },
        { provide: StatutoryRulesService, useValue: mockStatRulesService },
        { provide: OfferLetterTemplateService, useValue: {} },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('previewEmployeeOffer (Active Employee Compensation Preview)', () => {
    it('should successfully calculate compensation breakdown for an active employee', async () => {
      const result = await service.previewEmployeeOffer(mockScope as any, {
        employeeId: 'emp-55',
        annualCTC: 600000,
        designation: 'Analyst',
      });

      expect(result).toBeDefined();
      expect(result.employeeId).toBe('emp-55');
      expect(result.employeeName).toBe('Maya Patel');
      expect(result.candidateName).toBe('Maya Patel');
      expect(result.annualCTC).toBe(600000);
      expect(result.monthlyCTC).toBe(50000);
      expect(result.breakdown).toHaveLength(6);
      expect(result.breakdown.find((b) => b.name === 'Basic Salary')).toBeDefined();
    });

    it('should throw NotFoundException when employeeId does not exist', async () => {
      await expect(
        service.previewEmployeeOffer(mockScope as any, {
          employeeId: 'non-existent-emp',
          annualCTC: 600000,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when employee belongs to another tenant', async () => {
      await expect(
        service.previewEmployeeOffer(mockScope as any, {
          employeeId: 'emp-other-company',
          annualCTC: 600000,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when annualCTC is invalid or zero', async () => {
      await expect(
        service.previewEmployeeOffer(mockScope as any, {
          employeeId: 'emp-55',
          annualCTC: 0,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('verifyDocument', () => {
    it('should atomically verify document status and write structured audit log', async () => {
      const result = await service.verifyDocument('doc-1', 'Checked original ID', mockScope as any, mockActor);

      expect(repository.updateVerificationStatus).toHaveBeenCalledWith(
        'doc-1',
        'VERIFIED',
        'user-admin-1',
        'Checked original ID',
        mockScope,
      );

      expect(auditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'user-admin-1',
          actorRole: 'HRAdmin',
          companyId: 'company-101',
          action: 'DOCUMENT_VERIFIED',
        }),
      );

      expect(result).toBeDefined();
    });

    it('should throw ConflictException if atomic update returns false (concurrency collision)', async () => {
      (repository.updateVerificationStatus as jest.Mock).mockResolvedValueOnce(false);

      await expect(
        service.verifyDocument('doc-1', undefined, mockScope as any, mockActor),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('rejectDocument', () => {
    it('should throw BadRequestException if rejection reason is under 5 characters', async () => {
      await expect(
        service.rejectDocument('doc-1', 'bad', mockScope as any, mockActor),
      ).rejects.toThrow(BadRequestException);
    });

    it('should atomically reject document status and write audit log with reason', async () => {
      const result = await service.rejectDocument(
        'doc-1',
        'Document image is blurry and illegible',
        mockScope as any,
        mockActor,
      );

      expect(repository.updateVerificationStatus).toHaveBeenCalledWith(
        'doc-1',
        'REJECTED',
        'user-admin-1',
        'Document image is blurry and illegible',
        mockScope,
      );

      expect(auditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'user-admin-1',
          action: 'DOCUMENT_REJECTED',
        }),
      );

      expect(result).toBeDefined();
    });
  });

  describe('remove (Document Deletion)', () => {
    it('should successfully delete an Offer-linked document and clean up physical storage file', async () => {
      await service.remove('doc-1', mockScope as any);

      expect(storageService.deleteFile).toHaveBeenCalledWith('uploads/aadhaar.pdf');
      expect(repository.delete).toHaveBeenCalledWith('doc-1', mockScope);
    });

    it('should successfully delete unreferenced document and clean up physical storage file', async () => {
      await service.remove('doc-1', mockScope as any);

      expect(storageService.deleteFile).toHaveBeenCalledWith('uploads/aadhaar.pdf');
      expect(repository.delete).toHaveBeenCalledWith('doc-1', mockScope);
    });
  });
});

