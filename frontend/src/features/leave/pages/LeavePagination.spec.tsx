import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LeavePage } from './LeavePage';
import { leaveService } from '../../../services/leave.service';
import { useAuthStore } from '../../../store/authStore';

vi.mock('../../../services/leave.service', () => ({
  leaveService: {
    getLeaves: vi.fn(),
    getLeaveTypes: vi.fn().mockResolvedValue([]),
    getEvents: vi.fn().mockResolvedValue([]),
    updateLeaveStatus: vi.fn(),
  },
}));

vi.mock('../../../services/attendance.service', () => ({
  attendanceService: {
    getAttendance: vi.fn().mockResolvedValue({ data: [], total: 0, totalPages: 0, page: 1, limit: 25 }),
  },
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('Leave History Pagination Specs', () => {
  const mockToast = vi.fn();
  const mockTriggerConfirm = vi.fn();
  const mockOnApply = vi.fn();
  const mockSetActive = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: {
        id: 'admin-1',
        name: 'HR Admin',
        email: 'admin@acmecorp.com',
        role: 'HRAdmin',
        companyId: 'comp-1',
        permissions: ['leaves:requests:view', 'leaves:requests:approve', 'leaves:view'],
      } as any,
    });

    (leaveService.getLeaves as any).mockResolvedValue({
      data: [
        {
          id: 'leave-1',
          employee: 'Maya Patel',
          type: 'Annual Leave',
          from: '2026-09-01',
          to: '2026-09-05',
          days: 5,
          reason: 'Vacation',
          status: 'Approved',
        },
      ],
      total: 30,
      totalPages: 2,
      page: 1,
      limit: 25,
    });
  });

  it('1. Renders Leave History with server-side pagination and controls', async () => {
    renderWithClient(
      <LeavePage
        sub="leave.history"
        user={{
          id: 'admin-1',
          name: 'HR Admin',
          email: 'admin@acmecorp.com',
          role: 'HRAdmin',
        }}
        toast={mockToast}
        triggerConfirm={mockTriggerConfirm}
        onApplyLeave={mockOnApply}
        setActive={mockSetActive}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Leave Requests')).toBeInTheDocument();
      expect(screen.getByText(/Annual Leave/i)).toBeInTheDocument();
    });

    expect(leaveService.getLeaves).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        limit: 25,
      }),
    );

    // Next Page button should be present
    expect(screen.getByRole('button', { name: /Go to next page/i })).toBeInTheDocument();
  });
});
