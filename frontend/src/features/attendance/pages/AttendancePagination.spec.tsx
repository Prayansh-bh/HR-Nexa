import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AttendancePage } from './AttendancePage';
import { EmployeeClockPage } from '../../employees/pages/EmployeeClockPage';
import { attendanceService } from '../../../services/attendance.service';
import { useAuthStore } from '../../../store/authStore';

vi.mock('../../../services/attendance.service', () => ({
  attendanceService: {
    getAttendance: vi.fn(),
    getSettings: vi.fn().mockResolvedValue({ enableRegularization: true }),
    getRegularizationRequests: vi.fn().mockResolvedValue({ data: [], total: 0, totalPages: 0, page: 1, limit: 25 }),
  },
}));

vi.mock('../../../services/employee.service', () => ({
  employeeService: {
    getEmployees: vi.fn().mockResolvedValue({
      data: [{ id: 'EMP-001', name: 'Maya Patel', email: 'maya@acmecorp.com' }],
      total: 1,
      totalPages: 1,
      page: 1,
      limit: 20,
    }),
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

describe('Attendance History & Regularization Pagination Specs', () => {
  const mockToast = vi.fn();
  const mockTriggerConfirm = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: {
        id: 'admin-1',
        name: 'HR Admin',
        email: 'admin@acmecorp.com',
        role: 'HRAdmin',
        companyId: 'comp-1',
        permissions: ['employees:attendance:view', 'employees:attendance:regularize'],
      } as any,
    });

    (attendanceService.getAttendance as any).mockResolvedValue({
      data: [
        {
          id: 'att-1',
          employeeId: 'EMP-001',
          employeeName: 'Maya Patel',
          date: '2026-08-26',
          inTime: '09:00',
          outTime: '18:00',
          status: 'Present',
        },
      ],
      total: 55,
      totalPages: 3,
      page: 1,
      limit: 25,
    });
  });

  it('1. Renders Attendance History with server-side pagination controls', async () => {
    renderWithClient(
      <AttendancePage
        sub="attendance.history"
        user={{
          id: 'admin-1',
          name: 'HR Admin',
          email: 'admin@acmecorp.com',
          role: 'HRAdmin',
        }}
        toast={mockToast}
        triggerConfirm={mockTriggerConfirm}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Attendance History')).toBeInTheDocument();
      expect(screen.getByText('55 records found.')).toBeInTheDocument();
    });

    expect(attendanceService.getAttendance).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        limit: 25,
      }),
    );

    // Page 2 button should exist
    const nextBtn = screen.getByRole('button', { name: /Go to next page/i });
    expect(nextBtn).toBeInTheDocument();
    expect(nextBtn).not.toBeDisabled();
  });

  it('2. Resets to page 1 when status filter changes', async () => {
    renderWithClient(
      <AttendancePage
        sub="attendance.history"
        user={{
          id: 'admin-1',
          name: 'HR Admin',
          email: 'admin@acmecorp.com',
          role: 'HRAdmin',
        }}
        toast={mockToast}
        triggerConfirm={mockTriggerConfirm}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Attendance History')).toBeInTheDocument();
    });

    const statusSelect = screen.getByDisplayValue('All Statuses');
    fireEvent.change(statusSelect, { target: { value: 'Present' } });

    await waitFor(() => {
      expect(attendanceService.getAttendance).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'Present',
          page: 1,
        }),
      );
    });
  });

  it('3. /attendance/self (EmployeeClockPage) renders when API returns canonical PaginatedResponse envelope without map error', async () => {
    const today = new Date().toLocaleDateString('en-CA');
    (attendanceService.getAttendance as any).mockResolvedValue({
      data: [
        {
          id: 'att-self-1',
          employeeId: 'EMP-001',
          date: today,
          inTime: '09:15',
          outTime: '18:00',
          status: 'Present',
        },
      ],
      total: 1,
      totalPages: 1,
      page: 1,
      limit: 25,
    });

    renderWithClient(
      <EmployeeClockPage
        toast={mockToast}
        user={{
          id: 'user-emp-1',
          name: 'Maya Patel',
          email: 'maya@acmecorp.com',
          role: 'Employee',
          permissions: ['employees:attendance:clock'],
        } as any}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Roster Clock Attendance')).toBeInTheDocument();
      expect(screen.getByText('Recent Clock-in Logs')).toBeInTheDocument();
      expect(screen.getByText('Completed for Today')).toBeInTheDocument();
    });
  });

  it('4. /attendance/self handles empty paginated response gracefully', async () => {
    (attendanceService.getAttendance as any).mockResolvedValue({
      data: [],
      total: 0,
      totalPages: 0,
      page: 1,
      limit: 25,
    });

    renderWithClient(
      <EmployeeClockPage
        toast={mockToast}
        user={{
          id: 'user-emp-1',
          name: 'Maya Patel',
          email: 'maya@acmecorp.com',
          role: 'Employee',
          permissions: ['employees:attendance:clock'],
        } as any}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Roster Clock Attendance')).toBeInTheDocument();
      expect(screen.getByText('No attendance logs found.')).toBeInTheDocument();
    });
  });
});
