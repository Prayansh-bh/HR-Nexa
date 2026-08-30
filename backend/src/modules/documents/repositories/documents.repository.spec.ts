import { Test, TestingModule } from '@nestjs/testing';
import { DocumentsRepository } from './documents.repository';
import { PrismaService } from '../../../prisma/prisma.service';

describe('DocumentsRepository', () => {
  let repository: DocumentsRepository;
  let prismaService: jest.Mocked<Partial<PrismaService>>;

  const mockScope = { companyId: 'company-99', isPlatformBypass: false };

  beforeEach(async () => {
    prismaService = {
      document: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({} as any),
        delete: jest.fn().mockResolvedValue({} as any),
      } as any,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsRepository,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    repository = module.get<DocumentsRepository>(DocumentsRepository);
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('findMany', () => {
    it('should filter soft-deleted documents and enforce companyId scope', async () => {
      await repository.findMany(mockScope as any, 'EMPLOYEE', undefined, 'PENDING');

      expect(prismaService.document!.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
            companyId: 'company-99',
            verificationStatus: 'PENDING',
          }),
        }),
      );
    });

    it('should calculate skip/take and return canonical PaginatedResponse', async () => {
      (prismaService.document!.count as jest.Mock).mockResolvedValue(55);
      (prismaService.document!.findMany as jest.Mock).mockResolvedValue([
        { id: 'doc-1', title: 'Offer Letter' },
      ]);

      const result = await repository.findMany(
        mockScope as any,
        'HR_LETTER',
        'emp-1',
        undefined,
        'Offer',
        2,
        25,
        'Offer',
        'VALID',
      );

      expect(prismaService.document!.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          deletedAt: null,
          companyId: 'company-99',
          category: 'HR_LETTER',
          employeeId: 'emp-1',
          docType: 'Offer',
          status: 'VALID',
          OR: expect.arrayContaining([
            { title: { contains: 'Offer', mode: 'insensitive' } },
            { docType: { contains: 'Offer', mode: 'insensitive' } },
            { fileName: { contains: 'Offer', mode: 'insensitive' } },
            { employee: { name: { contains: 'Offer', mode: 'insensitive' } } },
          ]),
        }),
      });

      expect(prismaService.document!.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 25,
          take: 25,
          orderBy: { createdAt: 'desc' },
        }),
      );

      expect(result).toEqual({
        data: [{ id: 'doc-1', title: 'Offer Letter' }],
        total: 55,
        page: 2,
        limit: 25,
        totalPages: 3,
      });
    });

    it('should clamp limit to max 100 and safe page >= 1', async () => {
      await repository.findMany(mockScope as any, undefined, undefined, undefined, undefined, -5, 500);

      expect(prismaService.document!.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 100,
        }),
      );
    });

    it('should use platform bypass scope for platform admin', async () => {
      await repository.findMany({ isPlatformBypass: true, companyId: null } as any);

      expect(prismaService.document!.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
            company: { isDemo: false },
          }),
        }),
      );
    });
  });

  describe('updateVerificationStatus', () => {
    it('should perform atomic update checking pending verification status and company scope', async () => {
      const success = await repository.updateVerificationStatus(
        'doc-100',
        'VERIFIED',
        'actor-1',
        'Valid ID',
        mockScope as any,
      );

      expect(prismaService.document!.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'doc-100',
          companyId: 'company-99',
          verificationStatus: 'PENDING',
          deletedAt: null,
        },
        data: expect.objectContaining({
          verificationStatus: 'VERIFIED',
          verifiedById: 'actor-1',
          verificationNote: 'Valid ID',
        }),
      });

      expect(success).toBe(true);
    });
  });
});
