import { Test, TestingModule } from '@nestjs/testing';
import { RecruitmentService } from './recruitment.service';
import { RecruitmentRepository } from '../repositories/recruitment.repository';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmployeesService } from '../../employees/services/employees.service';
import { SalaryComponentCalculatorService } from '../../payroll/services/salary-component-calculator.service';
import { StatutoryRulesService } from '../../payroll/services/statutory-rules.service';
import { StorageService } from '../../../common/storage/storage.service';
import { DocumentsRepository } from '../../documents/repositories/documents.repository';
import { OfferLetterTemplateService } from '../../../common/documents/offer-letter-template.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TenantScope } from '../../../common/tenant/tenant-scope.interface';

describe('RecruitmentService - Offer Letter Generation & Compensation', () => {
  let service: RecruitmentService;
  let recruitmentRepository: jest.Mocked<RecruitmentRepository>;
  let prisma: any;
  let employeesService: jest.Mocked<EmployeesService>;
  let salaryCalculator: SalaryComponentCalculatorService;
  let statutoryRulesService: jest.Mocked<StatutoryRulesService>;
  let storageService: jest.Mocked<StorageService>;
  let documentsRepository: jest.Mocked<DocumentsRepository>;
  let offerLetterTemplateService: OfferLetterTemplateService;

  const mockScope: TenantScope = {
    companyId: 'comp-123',
    isSuperAdmin: false,
    isPlatformBypass: false,
  };

  const mockCandidate = {
    id: 'cand-1',
    name: 'Jane Doe',
    email: 'jane@example.com',
    jobId: 'job-1',
    jobTitle: 'Fullstack Engineer',
    stage: 'Interview',
    experienceYears: 4,
  };

  const mockStatutoryRules = {
    pfRate: 12,
    esiRate: 0.75,
    ptAmount: 200,
    basicPercentage: 50,
    hraPercentage: 40,
  };

  const mockSalaryComponents = [
    {
      id: 'comp-basic',
      name: 'Basic Salary',
      type: 'EARNING',
      calculationMethod: 'PERCENTAGE',
      value: 50,
      calculationBase: 'GROSS',
    },
    {
      id: 'comp-hra',
      name: 'House Rent Allowance (HRA)',
      type: 'EARNING',
      calculationMethod: 'PERCENTAGE',
      value: 40,
      calculationBase: 'BASIC',
    },
    {
      id: 'comp-pt',
      name: 'Professional Tax',
      type: 'DEDUCTION',
      calculationMethod: 'FIXED',
      value: 200,
      calculationBase: null,
    },
  ];

  beforeEach(async () => {
    const mockRecruitmentRepo = {
      getCandidateById: jest.fn().mockResolvedValue(mockCandidate),
      getOfferByCandidateId: jest.fn().mockResolvedValue(null),
      upsertOffer: jest.fn().mockImplementation((_cid, _scope, data) =>
        Promise.resolve({
          id: 'offer-1',
          ...data,
        }),
      ),
      updateCandidateStage: jest.fn().mockResolvedValue({ ...mockCandidate, stage: 'Offer' }),
    };

    const mockPrisma: any = {
      jobRequisition: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'job-1',
          jobTitle: 'Fullstack Engineer',
          minSalary: 600000,
          maxSalary: 1200000,
          departmentId: 'dept-1',
          designationId: 'desig-1',
        }),
        create: jest.fn().mockResolvedValue({ id: 'job-1' }),
        update: jest.fn().mockResolvedValue({ id: 'job-1' }),
      },
      department: {
        findFirst: jest.fn().mockResolvedValue({ id: 'dept-1', name: 'Engineering' }),
        create: jest.fn().mockResolvedValue({ id: 'dept-1', name: 'Engineering' }),
      },
      designation: {
        findFirst: jest.fn().mockResolvedValue({ id: 'desig-1', name: 'Software Engineer', departmentId: 'dept-1' }),
        create: jest.fn().mockResolvedValue({ id: 'desig-1', name: 'Software Engineer' }),
      },
      salaryComponent: {
        findMany: jest.fn().mockResolvedValue(mockSalaryComponents),
      },
      company: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'comp-123',
          name: 'Acme Corp Technologies',
          settings: { address: 'Outer Ring Road, Bangalore' },
        }),
      },
      candidate: {
        findUnique: jest.fn().mockResolvedValue(mockCandidate),
        update: jest.fn().mockResolvedValue({ ...mockCandidate, stage: 'Hired' }),
      },
      offer: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'offer-1',
          annualCTC: 900000,
          designation: 'Senior Fullstack Engineer',
          joiningDate: '2026-09-01',
          status: 'GENERATED',
        }),
        update: jest.fn().mockResolvedValue({ id: 'offer-1', status: 'ACCEPTED' }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'user-1', email: 'jane@example.com' }),
      },
      employee: {
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(2),
        create: jest.fn().mockResolvedValue({ id: 'EMP003' }),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => callback(mockPrisma)),
    };

    const mockEmployeesService: any = {
      create: jest.fn().mockResolvedValue({ id: 'EMP003', name: 'Jane Doe' }),
      generateNextEmployeeId: jest.fn().mockResolvedValue('EMP003'),
      employeeUserLinkService: {
        passwordService: {
          hash: jest.fn().mockResolvedValue('hashed-password'),
        },
      },
    };

    const mockStatutoryRulesService = {
      getStatutoryRules: jest.fn().mockResolvedValue(mockStatutoryRules),
    };

    const mockStorageService = {
      saveFile: jest.fn().mockResolvedValue({
        path: 'uploads/offer-letters/comp-123/offer_letter_jane_doe.html',
        url: '/uploads/offer-letters/comp-123/offer_letter_jane_doe.html',
      }),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };

    const mockDocumentsRepository = {
      create: jest.fn().mockResolvedValue({
        id: 'doc-1',
        title: 'Offer Letter - Jane Doe',
        docType: 'Offer',
        category: 'HR_LETTER',
      }),
      findById: jest.fn().mockResolvedValue({
        id: 'doc-old-1',
        filePath: 'uploads/offer-letters/comp-123/old_offer.html',
      }),
      delete: jest.fn().mockResolvedValue({ id: 'doc-old-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecruitmentService,
        SalaryComponentCalculatorService,
        OfferLetterTemplateService,
        { provide: RecruitmentRepository, useValue: mockRecruitmentRepo },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EmployeesService, useValue: mockEmployeesService },
        { provide: StatutoryRulesService, useValue: mockStatutoryRulesService },
        { provide: StorageService, useValue: mockStorageService },
        { provide: DocumentsRepository, useValue: mockDocumentsRepository },
      ],
    }).compile();

    service = module.get<RecruitmentService>(RecruitmentService);
    recruitmentRepository = module.get(RecruitmentRepository);
    prisma = module.get(PrismaService);
    employeesService = module.get(EmployeesService);
    salaryCalculator = module.get(SalaryComponentCalculatorService);
    statutoryRulesService = module.get(StatutoryRulesService);
    storageService = module.get(StorageService);
    documentsRepository = module.get(DocumentsRepository);
    offerLetterTemplateService = module.get(OfferLetterTemplateService);
  });

  describe('previewOfferCompensation', () => {
    it('should calculate compensation breakdown accurately based on HR NEXA compensation engine', async () => {
      const preview = await service.previewOfferCompensation('cand-1', mockScope, {
        annualCTC: 800000,
        designation: 'Senior Fullstack Engineer',
      });

      expect(preview.annualCTC).toBe(800000);
      expect(preview.monthlyCTC).toBe(66666.67);
      expect(preview.breakdown).toBeDefined();
      expect(preview.breakdown.length).toBeGreaterThan(0);

      const basic = preview.breakdown.find((b: any) => b.name === 'Basic Salary');
      const hra = preview.breakdown.find((b: any) => b.name === 'House Rent Allowance (HRA)');
      const employerPf = preview.breakdown.find((b: any) => b.name === 'Employer Provident Fund (EPF)');

      expect(basic).toBeDefined();
      expect(basic?.monthly).toBeGreaterThan(0);
      expect(hra).toBeDefined();
      expect(employerPf).toBeDefined();
      expect(preview.netTakeHomeMonthly).toBeGreaterThan(0);
    });

    it('should reject CTC below JobRequisition minimum budget', async () => {
      await expect(
        service.previewOfferCompensation('cand-1', mockScope, {
          annualCTC: 500000, // Below minSalary of 600,000
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject CTC exceeding JobRequisition maximum budget', async () => {
      await expect(
        service.previewOfferCompensation('cand-1', mockScope, {
          annualCTC: 1500000, // Above maxSalary of 1,200,000
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('generateOfferLetter', () => {
    it('should generate branded document, save to storage, create immutable Offer snapshot, and update stage without emailing', async () => {
      const result = await service.generateOfferLetter('cand-1', mockScope, {
        annualCTC: 900000,
        designation: 'Senior Fullstack Engineer',
        joiningDate: '2026-09-01',
        expiryDate: '2026-08-30',
        terms: 'Standard 3 months probation.',
      });

      expect(storageService.saveFile).toHaveBeenCalledWith(
        expect.objectContaining({
          mimetype: 'text/html',
          originalname: expect.stringContaining('offer_letter'),
        }),
        'offer-letters',
        'comp-123',
      );

      expect(documentsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          docType: 'Offer',
          category: 'HR_LETTER',
          companyId: 'comp-123',
        }),
      );

      expect(recruitmentRepository.upsertOffer).toHaveBeenCalledWith(
        'cand-1',
        mockScope,
        expect.objectContaining({
          annualCTC: 900000,
          designation: 'Senior Fullstack Engineer',
          joiningDate: '2026-09-01',
          status: 'GENERATED',
          documentId: 'doc-1',
        }),
      );

      expect(recruitmentRepository.updateCandidateStage).toHaveBeenCalledWith(
        'cand-1',
        mockScope,
        'Offer',
      );

      expect(result.offer).toBeDefined();
      expect(result.document).toBeDefined();
    });

    it('should safely clean up superseded Document record and physical storage file upon offer regeneration (F05)', async () => {
      recruitmentRepository.getOfferByCandidateId.mockResolvedValueOnce({
        id: 'offer-1',
        status: 'GENERATED',
        documentId: 'doc-old-1',
      } as any);

      await service.generateOfferLetter('cand-1', mockScope, {
        annualCTC: 950000,
        designation: 'Senior Fullstack Engineer',
        joiningDate: '2026-09-15',
      });

      expect(documentsRepository.findById).toHaveBeenCalledWith('doc-old-1', mockScope);
      expect(storageService.deleteFile).toHaveBeenCalledWith('uploads/offer-letters/comp-123/old_offer.html');
      expect(documentsRepository.delete).toHaveBeenCalledWith('doc-old-1', mockScope);
    });
  });

  describe('updateCandidateStage to Hired with Offer', () => {
    it('should use offered CTC and designation as authoritative salary for the new employee record', async () => {
      recruitmentRepository.getOfferByCandidateId.mockResolvedValueOnce({
        id: 'offer-1',
        candidateId: 'cand-1',
        annualCTC: 950000,
        designation: 'Staff Engineer',
        joiningDate: '2026-09-15',
        status: 'GENERATED',
      } as any);

      await service.updateCandidateStage('cand-1', mockScope, 'Hired');

      expect(prisma.employee.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Jane Doe',
            salary: 75000, // P8-01: Monthly Base Salary (900000 / 12)
            joined: '2026-09-01',
          }),
        }),
      );

      expect(prisma.offer.update).toHaveBeenCalledWith({
        where: { id: 'offer-1' },
        data: expect.objectContaining({ status: 'ACCEPTED' }),
      });
    });
  });

  describe('createJobPosting & updateJobPosting Department-Designation Integrity', () => {
    beforeEach(() => {
      prisma.department = {
        findFirst: jest.fn().mockImplementation(({ where }) => {
          if (where.id === 'dept-eng' && (where.subscriptionId === 'comp-123' || !where.subscriptionId)) {
            return Promise.resolve({ id: 'dept-eng', name: 'Engineering', subscriptionId: 'comp-123' });
          }
          if (where.id === 'dept-hr' && (where.subscriptionId === 'comp-123' || !where.subscriptionId)) {
            return Promise.resolve({ id: 'dept-hr', name: 'HR', subscriptionId: 'comp-123' });
          }
          return Promise.resolve(null);
        }),
      };

      prisma.designation = {
        findFirst: jest.fn().mockImplementation(({ where }) => {
          if (where.id === 'desig-swe' && (where.subscriptionId === 'comp-123' || !where.subscriptionId)) {
            return Promise.resolve({ id: 'desig-swe', name: 'Software Engineer', departmentId: 'dept-eng', subscriptionId: 'comp-123' });
          }
          if (where.id === 'desig-global' && (where.subscriptionId === 'comp-123' || !where.subscriptionId)) {
            return Promise.resolve({ id: 'desig-global', name: 'Consultant', departmentId: null, subscriptionId: 'comp-123' });
          }
          if (where.id === 'desig-hr' && (where.subscriptionId === 'comp-123' || !where.subscriptionId)) {
            return Promise.resolve({ id: 'desig-hr', name: 'HR Specialist', departmentId: 'dept-hr', subscriptionId: 'comp-123' });
          }
          return Promise.resolve(null);
        }),
      };

      recruitmentRepository.createJobPosting = jest.fn().mockResolvedValue({ id: 'job-new' });
      recruitmentRepository.updateJobPosting = jest.fn().mockResolvedValue({ id: 'job-1' });
    });

    it('CREATE: should succeed when departmentId and matching designationId are provided', async () => {
      await expect(
        service.createJobPosting(mockScope, {
          title: 'Senior Dev',
          department: 'Engineering',
          departmentId: 'dept-eng',
          designationId: 'desig-swe',
        }),
      ).resolves.toEqual({ id: 'job-new' });
    });

    it('CREATE: should succeed when designation is global (departmentId = null)', async () => {
      await expect(
        service.createJobPosting(mockScope, {
          title: 'Lead Advisor',
          department: 'Engineering',
          departmentId: 'dept-eng',
          designationId: 'desig-global',
        }),
      ).resolves.toEqual({ id: 'job-new' });
    });

    it('CREATE: should throw BadRequestException when designation does not belong to selected department', async () => {
      await expect(
        service.createJobPosting(mockScope, {
          title: 'Invalid Pair',
          department: 'Engineering',
          departmentId: 'dept-eng',
          designationId: 'desig-hr',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('CREATE: should throw NotFoundException when department belongs to another tenant or non-existent', async () => {
      await expect(
        service.createJobPosting(mockScope, {
          title: 'Unknown Dept',
          department: 'Unknown',
          departmentId: 'dept-other-tenant',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('UPDATE: should clear stale designationId when department changes without providing new designation', async () => {
      prisma.jobRequisition.findFirst.mockResolvedValueOnce({
        id: 'job-1',
        departmentId: 'dept-eng',
        designationId: 'desig-swe',
      });

      await service.updateJobPosting('job-1', mockScope, {
        departmentId: 'dept-hr',
      });

      expect(recruitmentRepository.updateJobPosting).toHaveBeenCalledWith(
        'job-1',
        mockScope,
        expect.objectContaining({
          departmentId: 'dept-hr',
          designationId: null,
        }),
      );
    });

    it('UPDATE: should preserve global designation when department changes', async () => {
      prisma.jobRequisition.findFirst.mockResolvedValueOnce({
        id: 'job-1',
        departmentId: 'dept-eng',
        designationId: 'desig-global',
      });

      await service.updateJobPosting('job-1', mockScope, {
        departmentId: 'dept-hr',
      });

      expect(recruitmentRepository.updateJobPosting).toHaveBeenCalledWith(
        'job-1',
        mockScope,
        expect.objectContaining({
          departmentId: 'dept-hr',
        }),
      );
      expect(recruitmentRepository.updateJobPosting).not.toHaveBeenCalledWith(
        'job-1',
        mockScope,
        expect.objectContaining({
          designationId: null,
        }),
      );
    });
  });
});
