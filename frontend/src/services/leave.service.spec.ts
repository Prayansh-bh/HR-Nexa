import { describe, it, expect, vi, beforeEach } from 'vitest';
import { leaveService } from './leave.service';
import axiosInstance from '../api/axios';

vi.mock('../api/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('leaveService - Paginated Response Envelope & Query Filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Correctly unwraps backend paginated envelope response { data: [...], total, page, limit }', async () => {
    (axiosInstance.get as any).mockResolvedValueOnce({
      data: {
        data: [
          {
            id: 'leave-101',
            type: 'Casual Leave',
            from: '2026-09-01',
            to: '2026-09-03',
            days: 3,
            reason: 'Family event',
            status: 'PENDING',
            employee: {
              id: 'emp-1',
              name: 'Jane Kumari',
              departmentName: 'Recruitment',
            },
          },
        ],
        total: 1,
        page: 1,
        limit: 10,
      },
    });

    const result = await leaveService.getLeaves(undefined, 'PENDING');

    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(10);
    expect(result.totalPages).toBe(1);
    expect(result.data[0]).toEqual({
      id: 'leave-101',
      employee: 'Jane Kumari',
      type: 'Casual Leave',
      from: '2026-09-01',
      to: '2026-09-03',
      days: 3,
      reason: 'Family event',
      status: 'Pending',
      department: 'Recruitment',
    });
  });

  it('2. Handles empty paginated response { data: [], total: 0, page: 1, limit: 10 } safely', async () => {
    (axiosInstance.get as any).mockResolvedValueOnce({
      data: {
        data: [],
        total: 0,
        page: 1,
        limit: 10,
      },
    });

    const result = await leaveService.getLeaves(undefined, 'PENDING');
    expect(result).toEqual({
      data: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    });
  });

  it('3. Supports backward compatibility for legacy flat-array responses', async () => {
    (axiosInstance.get as any).mockResolvedValueOnce({
      data: [
        {
          id: 'leave-102',
          type: 'Sick Leave',
          from: '2026-09-05',
          to: '2026-09-06',
          days: 2,
          reason: 'Doctor appointment',
          status: 'APPROVED',
          employee: {
            id: 'emp-2',
            name: 'Alex Kumar',
            departmentName: 'Engineering',
          },
        },
      ],
    });

    const result = await leaveService.getLeaves('emp-2');
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('Approved');
    expect(result[0].employee).toBe('Alex Kumar');
  });

  it('4. Handles null/invalid response payload safely without throwing', async () => {
    (axiosInstance.get as any).mockResolvedValueOnce({
      data: null,
    });

    const result = await leaveService.getLeaves();
    expect(result).toEqual([]);
  });

  it('5. Preserves query parameters including status, employeeId, page, and limit', async () => {
    (axiosInstance.get as any).mockResolvedValueOnce({
      data: { data: [], total: 0, page: 2, limit: 25 },
    });

    await leaveService.getLeaves('emp-99', 'PENDING', 2, 25);

    expect(axiosInstance.get).toHaveBeenCalledWith(
      expect.stringContaining('employeeId=emp-99'),
    );
    expect(axiosInstance.get).toHaveBeenCalledWith(
      expect.stringContaining('status=PENDING'),
    );
    expect(axiosInstance.get).toHaveBeenCalledWith(
      expect.stringContaining('page=2'),
    );
    expect(axiosInstance.get).toHaveBeenCalledWith(
      expect.stringContaining('limit=25'),
    );
  });
});
