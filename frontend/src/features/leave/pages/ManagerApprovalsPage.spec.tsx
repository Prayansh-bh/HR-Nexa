import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ManagerApprovalsPage } from './ManagerApprovalsPage';
import { leaveService } from '../../../services/leave.service';
import { useAuthStore } from '../../../store/authStore';

vi.mock('../../../services/leave.service', () => ({
  leaveService: {
    getLeaves: vi.fn(),
    updateLeaveStatus: vi.fn(),
  },
}));

vi.mock('../../../services/attendance.service', () => ({
  attendanceService: {
    getRegularizationRequests: vi.fn().mockResolvedValue({ data: [] }),
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

describe('ManagerApprovalsPage - Leave Approvals Center UI Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (leaveService.getLeaves as any).mockResolvedValue([]);
  });

  it('1. Displays pending leave request returned from unwrap in Approvals Center', async () => {
    useAuthStore.setState({
      user: {
        id: 'manager-1',
        name: 'Manager Bob',
        email: 'manager@acmecorp.com',
        role: 'Manager',
        companyId: 'comp-1',
        permissions: ['leaves:requests:approve', 'leaves:requests:view', 'leaves:view'],
      } as any,
    });

    (leaveService.getLeaves as any).mockResolvedValueOnce([
      {
        id: 'leave-101',
        employee: 'Jane Kumari',
        type: 'Casual Leave',
        from: '2026-09-01',
        to: '2026-09-03',
        days: 3,
        reason: 'Family wedding event',
        status: 'Pending',
        department: 'Recruitment',
      },
    ]);

    renderWithClient(<ManagerApprovalsPage toast={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Approvals Center')).toBeInTheDocument();
      expect(screen.getByText('Casual Leave Leave Request')).toBeInTheDocument();
      expect(screen.getByText(/Jane Kumari — 3 Day\(s\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Reason: Family wedding event/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Approve/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Reject/i })).toBeInTheDocument();
    });
  });

  it('2. Approves pending leave request and triggers status update mutation', async () => {
    useAuthStore.setState({
      user: {
        id: 'manager-1',
        name: 'Manager Bob',
        email: 'manager@acmecorp.com',
        role: 'Manager',
        companyId: 'comp-1',
        permissions: ['leaves:requests:approve', 'leaves:requests:view', 'leaves:view'],
      } as any,
    });

    (leaveService.getLeaves as any).mockResolvedValueOnce([
      {
        id: 'leave-101',
        employee: 'Jane Kumari',
        type: 'Casual Leave',
        from: '2026-09-01',
        to: '2026-09-03',
        days: 3,
        reason: 'Family wedding event',
        status: 'Pending',
        department: 'Recruitment',
      },
    ]);
    (leaveService.updateLeaveStatus as any).mockResolvedValueOnce({ success: true });

    const mockToast = vi.fn();
    renderWithClient(<ManagerApprovalsPage toast={mockToast} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Approve/i })).toBeInTheDocument();
    });

    const approveBtn = screen.getByRole('button', { name: /Approve/i });
    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(leaveService.updateLeaveStatus).toHaveBeenCalledWith('leave-101', 'Approved');
      expect(mockToast).toHaveBeenCalledWith('Leave request approved successfully');
    });
  });

  it('3. Rejects pending leave request and triggers status update mutation', async () => {
    useAuthStore.setState({
      user: {
        id: 'manager-1',
        name: 'Manager Bob',
        email: 'manager@acmecorp.com',
        role: 'Manager',
        companyId: 'comp-1',
        permissions: ['leaves:requests:approve', 'leaves:requests:view', 'leaves:view'],
      } as any,
    });

    (leaveService.getLeaves as any).mockResolvedValueOnce([
      {
        id: 'leave-101',
        employee: 'Jane Kumari',
        type: 'Casual Leave',
        from: '2026-09-01',
        to: '2026-09-03',
        days: 3,
        reason: 'Family wedding event',
        status: 'Pending',
        department: 'Recruitment',
      },
    ]);
    (leaveService.updateLeaveStatus as any).mockResolvedValueOnce({ success: true });

    const mockToast = vi.fn();
    renderWithClient(<ManagerApprovalsPage toast={mockToast} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Reject/i })).toBeInTheDocument();
    });

    const rejectBtn = screen.getByRole('button', { name: /Reject/i });
    fireEvent.click(rejectBtn);

    await waitFor(() => {
      expect(leaveService.updateLeaveStatus).toHaveBeenCalledWith('leave-101', 'Rejected');
      expect(mockToast).toHaveBeenCalledWith('Leave request rejected successfully');
    });
  });

  it('4. Renders "No pending leave requests." when array is empty', async () => {
    useAuthStore.setState({
      user: {
        id: 'manager-1',
        name: 'Manager Bob',
        email: 'manager@acmecorp.com',
        role: 'Manager',
        companyId: 'comp-1',
        permissions: ['leaves:requests:approve', 'leaves:requests:view', 'leaves:view'],
      } as any,
    });

    (leaveService.getLeaves as any).mockResolvedValueOnce([]);

    renderWithClient(<ManagerApprovalsPage toast={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('No pending leave requests.')).toBeInTheDocument();
    });
  });
});
