import { AttendanceRepository } from './attendance.repository';

describe('AttendanceRepository Pagination', () => {
  let repository: AttendanceRepository;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      extended: {
        attendance: {
          count: jest.fn(),
          findMany: jest.fn(),
          findFirst: jest.fn(),
          create: jest.fn(),
          updateMany: jest.fn(),
        },
      },
    };
    repository = new AttendanceRepository(mockPrisma);
  });

  it('calculates canonical pagination with totalPages and clamped page/limit', async () => {
    mockPrisma.extended.attendance.count.mockResolvedValue(125);
    mockPrisma.extended.attendance.findMany.mockResolvedValue([
      { id: 'att-1', employeeId: 'emp-1', date: '2026-08-01', status: 'Present' },
    ]);

    const result = await repository.findMany({
      companyId: 'comp-1',
      page: 2,
      limit: 50,
      status: 'Present',
    });

    expect(mockPrisma.extended.attendance.count).toHaveBeenCalledWith({
      where: {
        status: 'Present',
        employee: {
          OR: [
            { companyId: 'comp-1' },
            { subscriptionId: 'comp-1' },
          ],
        },
      },
    });

    expect(mockPrisma.extended.attendance.findMany).toHaveBeenCalledWith({
      where: {
        status: 'Present',
        employee: {
          OR: [
            { companyId: 'comp-1' },
            { subscriptionId: 'comp-1' },
          ],
        },
      },
      skip: 50,
      take: 50,
      include: expect.any(Object),
      orderBy: { date: 'desc' },
    });

    expect(result).toEqual({
      data: [{ id: 'att-1', employeeId: 'emp-1', date: '2026-08-01', status: 'Present' }],
      total: 125,
      page: 2,
      limit: 50,
      totalPages: 3,
    });
  });

  it('clamps limit to max 100 and handles empty dataset with totalPages 0', async () => {
    mockPrisma.extended.attendance.count.mockResolvedValue(0);
    mockPrisma.extended.attendance.findMany.mockResolvedValue([]);

    const result = await repository.findMany({
      companyId: 'comp-1',
      page: 1,
      limit: 500, // should clamp to 100
    });

    expect(mockPrisma.extended.attendance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 100,
      }),
    );

    expect(result).toEqual({
      data: [],
      total: 0,
      page: 1,
      limit: 100,
      totalPages: 0,
    });
  });
});
