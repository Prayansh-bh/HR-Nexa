import { LeaveRepository } from './leave.repository';

describe('LeaveRepository Pagination', () => {
  let repository: LeaveRepository;
  let mockPrisma: any;
  let mockTenantContext: any;

  beforeEach(() => {
    mockPrisma = {
      leaveRequest: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      leaveQuota: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    mockTenantContext = {
      getCompanyId: jest.fn().mockReturnValue('comp-1'),
      isPlatform: jest.fn().mockReturnValue(false),
    };
    repository = new LeaveRepository(mockPrisma, mockTenantContext);
  });

  it('calculates canonical pagination with totalPages and matching count/findMany WHERE clause', async () => {
    mockPrisma.leaveRequest.count.mockResolvedValue(45);
    mockPrisma.leaveRequest.findMany.mockResolvedValue([
      { id: 'leave-1', employeeId: 'emp-1', status: 'PENDING', days: 2 },
    ]);

    const result = await repository.findManyRequests({
      tenantCompanyId: 'comp-1',
      status: 'PENDING',
      page: 1,
      limit: 25,
    });

    expect(mockPrisma.leaveRequest.count).toHaveBeenCalledWith({
      where: {
        status: 'PENDING',
        employee: { companyId: 'comp-1' },
      },
    });

    expect(mockPrisma.leaveRequest.findMany).toHaveBeenCalledWith({
      where: {
        status: 'PENDING',
        employee: { companyId: 'comp-1' },
      },
      skip: 0,
      take: 25,
      include: { employee: true },
      orderBy: { from: 'desc' },
    });

    expect(result).toEqual({
      data: [{ id: 'leave-1', employeeId: 'emp-1', status: 'PENDING', days: 2 }],
      total: 45,
      page: 1,
      limit: 25,
      totalPages: 2,
    });
  });

  it('handles empty results and returns totalPages 0', async () => {
    mockPrisma.leaveRequest.count.mockResolvedValue(0);
    mockPrisma.leaveRequest.findMany.mockResolvedValue([]);

    const result = await repository.findManyRequests({
      tenantCompanyId: 'comp-1',
      page: 1,
      limit: 25,
    });

    expect(result).toEqual({
      data: [],
      total: 0,
      page: 1,
      limit: 25,
      totalPages: 0,
    });
  });
});
