import { describe, it, expect, vi, beforeEach } from 'vitest';
import axiosInstance from '../api/axios';
import { reviewCycleService } from '../services/reviewCycle.service';
import { notificationService } from '../services/notification.service';
import { ticketsService } from '../services/tickets.service';
import { useAuditLogsStore } from '../store/auditLogsStore';
import { exitApi } from '../features/exit/api/exit.api';

vi.mock('../api/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('Phase 2F-E: Pagination Contract Remediation Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Performance Domain', () => {
    it('reviewCycleService.getReviews returns canonical PaginatedResponse', async () => {
      const mockEnvelope = {
        data: [
          {
            id: 'rev-1',
            employeeId: 'emp-1',
            reviewCycleId: 'cycle-1',
            status: 'Self Review',
            finalRating: 4.5,
          },
        ],
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
      };
      (axiosInstance.get as any).mockResolvedValueOnce({ data: mockEnvelope });

      const result = await reviewCycleService.getReviews({ status: 'Self Review' });
      expect(result).toBeDefined();
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('reviewCycleService.getGoals returns canonical PaginatedResponse', async () => {
      const mockEnvelope = {
        data: [
          {
            id: 'goal-1',
            employeeId: 'emp-1',
            title: 'Complete Phase 2F-E',
            progress: 100,
            status: 'Completed',
          },
        ],
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
      };
      (axiosInstance.get as any).mockResolvedValueOnce({ data: mockEnvelope });

      const result = await reviewCycleService.getGoals('emp-1');
      expect(result).toBeDefined();
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });
  });

  describe('2. Exit / Offboarding Domain', () => {
    it('exitApi.getExits returns paginated response and consumer safely unwraps data', async () => {
      const mockEnvelope = {
        data: [
          {
            id: 'exit-1',
            employeeId: 'emp-1',
            stage: 'SUBMITTED',
            status: 'PENDING',
            proposedLastWorkingDay: '2026-09-30T00:00:00.000Z',
            employee: { id: 'emp-1', name: 'John Doe' },
          },
        ],
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
      };
      (axiosInstance.get as any).mockResolvedValueOnce({ data: mockEnvelope });

      const res = await exitApi.getExits();
      const extractedList = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
          ? res.data
          : [];

      expect(extractedList).toHaveLength(1);
      expect(extractedList[0].id).toBe('exit-1');
      expect(extractedList[0].employee.name).toBe('John Doe');
    });
  });

  describe('3. Audit Logs Domain', () => {
    it('notificationService.getAuditLogs returns array and auditLogsStore populates state', async () => {
      const mockEnvelope = {
        data: [
          {
            id: 'log-1',
            userId: 'user-1',
            userName: 'Admin User',
            action: 'LOGIN',
            details: 'Successful login',
            timestamp: '2026-08-27T10:00:00.000Z',
          },
        ],
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
      };
      (axiosInstance.get as any).mockResolvedValueOnce({ data: mockEnvelope });

      await useAuditLogsStore.getState().fetchAuditLogs();
      const logs = useAuditLogsStore.getState().auditLogs;
      expect(Array.isArray(logs)).toBe(true);
      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe('LOGIN');
    });
  });

  describe('4. Support Tickets Domain', () => {
    it('ticketsService.getAllTickets handles both envelope and raw array without crashing', async () => {
      const mockEnvelope = {
        data: [
          {
            id: 'ticket-1',
            company: 'Test Co',
            subject: 'Help required',
            priority: 'High',
            status: 'Open',
            assignedTo: 'Support Agent',
            attachments: 0,
            date: '2026-08-27',
          },
        ],
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
      };
      (axiosInstance.get as any).mockResolvedValueOnce({ data: mockEnvelope });

      const result = await ticketsService.getAllTickets();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
      expect(result[0].subject).toBe('Help required');
    });
  });
});
