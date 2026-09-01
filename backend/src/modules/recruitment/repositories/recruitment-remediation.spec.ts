import { Test, TestingModule } from '@nestjs/testing';
import { RecruitmentRepository } from './recruitment.repository';
import { PrismaService } from '../../../prisma/prisma.service';
import { TenantScope } from '../../../common/tenant/tenant-scope.interface';

describe('Recruitment Repository - Company ID vs Subscription ID Remediation', () => {
  let repository: RecruitmentRepository;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      jobRequisition: {
        findMany: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        count: jest.fn(),
      },
      candidate: {
        findMany: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
      },
      offer: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecruitmentRepository,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    repository = module.get<RecruitmentRepository>(RecruitmentRepository);
  });

  const mockScope: TenantScope = {
    companyId: 'COMPANY_A',
    subscriptionId: 'SUB_A',
    isSuperAdmin: false,
    isPlatformBypass: false,
  };

  describe('Job Posting Operations', () => {
    it('getJobPostings queries using Subscription ID (SUB_A) instead of Company ID', async () => {
      mockPrisma.jobRequisition.findMany.mockResolvedValue([]);

      await repository.getJobPostings(mockScope);

      expect(mockPrisma.jobRequisition.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            subscriptionId: 'SUB_A', // MUST NOT be 'COMPANY_A'
          }),
        }),
      );
    });

    it('createJobPosting writes correct subscriptionId (SUB_A)', async () => {
      mockPrisma.jobRequisition.create.mockResolvedValue({ id: 'job-1' });

      await repository.createJobPosting(mockScope, {
        title: 'Software Engineer',
        department: 'Engineering',
      });

      expect(mockPrisma.jobRequisition.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'Software Engineer',
          department: 'Engineering',
          subscriptionId: 'SUB_A', // MUST be 'SUB_A'
        }),
      });
    });
  });

  describe('Candidate Operations', () => {
    it('getCandidates queries using Subscription ID (SUB_A) instead of Company ID', async () => {
      mockPrisma.candidate.findMany.mockResolvedValue([]);

      await repository.getCandidates(mockScope);

      expect(mockPrisma.candidate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            subscriptionId: 'SUB_A', // MUST NOT be 'COMPANY_A'
          }),
        }),
      );
    });

    it('createCandidate writes correct subscriptionId (SUB_A)', async () => {
      mockPrisma.candidate.create.mockResolvedValue({ id: 'cand-1' });

      await repository.createCandidate(mockScope, {
        name: 'John Doe',
        email: 'john@example.com',
        jobId: 'job-1',
      });

      expect(mockPrisma.candidate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'John Doe',
            email: 'john@example.com',
            jobId: 'job-1',
            subscriptionId: 'SUB_A', // MUST be 'SUB_A'
          }),
        }),
      );
    });
  });

  describe('Offer Operations', () => {
    it('getOfferById queries using strict Company ID and Subscription ID scoping', async () => {
      mockPrisma.offer.findFirst.mockResolvedValue(null);

      await repository.getOfferById('offer-1', mockScope);

      expect(mockPrisma.offer.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'offer-1',
          companyId: 'COMPANY_A',
          subscriptionId: 'SUB_A',
        },
        include: {
          candidate: true,
          document: true,
        },
      });
    });

    it('upsertOffer writes correct companyId (COMPANY_A) and subscriptionId (SUB_A)', async () => {
      mockPrisma.offer.findUnique.mockResolvedValue(null);
      mockPrisma.offer.create.mockResolvedValue({ id: 'offer-1' });

      await repository.upsertOffer('cand-1', mockScope, {
        annualCTC: 120000,
        monthlyCTC: 10000,
        annualGross: 110000,
        monthlyGross: 9166,
        designation: 'Senior dev',
        joiningDate: '2026-09-01',
        status: 'Sent',
        compensationSnapshot: {},
      });

      expect(mockPrisma.offer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            candidateId: 'cand-1',
            companyId: 'COMPANY_A',
            subscriptionId: 'SUB_A', // MUST NOT be 'COMPANY_A'
          }),
        }),
      );
    });
  });
});
