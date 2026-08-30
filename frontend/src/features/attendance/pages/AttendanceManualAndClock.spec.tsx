import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AttendancePage } from './AttendancePage';
import { EmployeeClockPage } from '../../employees/pages/EmployeeClockPage';
import * as employeesQueryModule from '../../../hooks/useEmployeesQuery';
import * as attendanceQueryModule from '../../../hooks/useAttendanceQuery';
import * as orgQueryModule from '../../../hooks/useOrgQuery';

vi.mock('../../../hooks/useEmployeesQuery', () => ({
  useEmployeesQuery: vi.fn(),
}));

vi.mock('../../../hooks/useAttendanceQuery', () => ({
  useAttendanceQuery: vi.fn(),
  useAttendanceMutations: vi.fn(),
  useAttendanceSettingsQuery: vi.fn(),
  useRegularizationRequestsQuery: vi.fn(),
}));

vi.mock('../../../hooks/useOrgQuery', () => ({
  useDepartmentsQuery: vi.fn(),
  useDevicesQuery: vi.fn(),
  useZonesQuery: vi.fn(),
  useOrgMutations: vi.fn(),
}));

vi.mock('../../../store/authStore', () => ({
  useAuthStore: vi.fn((selector) =>
    selector({
      user: {
        id: 'user-emp-1',
        name: 'Maya Patel',
        email: 'maya@acmecorp.com',
        role: 'Employee',
        employeeId: 'EMP-001',
      },
    }),
  ),
}));

describe('Manual Attendance & Employee Clock In/Out Verification', () => {
  const mockToast = vi.fn();
  const mockTriggerConfirm = vi.fn();
  const mockClockInOrOut = {
    mutateAsync: vi.fn(),
    isPending: false,
  };
  const mockCreateRegularizationRequest = {
    mutateAsync: vi.fn(),
    isPending: false,
  };

  const mockEmployees = [
    {
      id: 'EMP-001',
      name: 'Maya Patel',
      email: 'maya@acmecorp.com',
      userId: 'user-emp-1',
      department: 'Engineering',
      designation: 'Software Engineer',
      salary: 90000,
      status: 'Active',
    },
    {
      id: 'EMP-002',
      name: 'Alex Morgan',
      email: 'alex@acmecorp.com',
      userId: 'user-emp-2',
      department: 'Design',
      designation: 'UI Designer',
      salary: 80000,
      status: 'Active',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(employeesQueryModule.useEmployeesQuery).mockReturnValue({
      data: mockEmployees,
      isLoading: false,
    } as any);

    vi.mocked(attendanceQueryModule.useAttendanceQuery).mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    vi.mocked(attendanceQueryModule.useAttendanceMutations).mockReturnValue({
      clockInOrOut: mockClockInOrOut,
      createRegularizationRequest: mockCreateRegularizationRequest,
    } as any);

    vi.mocked(attendanceQueryModule.useAttendanceSettingsQuery).mockReturnValue({
      data: { enableRegularization: true },
      isLoading: false,
    } as any);

    vi.mocked(attendanceQueryModule.useRegularizationRequestsQuery).mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    vi.mocked(orgQueryModule.useDepartmentsQuery).mockReturnValue({
      data: [],
      isLoading: false,
    } as any);
    vi.mocked(orgQueryModule.useDevicesQuery).mockReturnValue({
      data: [],
      isLoading: false,
    } as any);
    vi.mocked(orgQueryModule.useZonesQuery).mockReturnValue({
      data: [],
      isLoading: false,
    } as any);
    vi.mocked(orgQueryModule.useOrgMutations).mockReturnValue({
      createDevice: { mutateAsync: vi.fn() },
      deleteDevice: { mutateAsync: vi.fn() },
      syncDevice: { mutateAsync: vi.fn() },
    } as any);
  });

  describe('1. Manual Attendance Form', () => {
    it('should synchronize employee selection state with loaded employees and save successfully', async () => {
      mockClockInOrOut.mutateAsync.mockResolvedValueOnce({ id: 'att-1' });

      render(
        <AttendancePage
          sub="attendance.manual"
          user={{
            id: 'admin-1',
            name: 'Priya Menon',
            email: 'priya@acmecorp.com',
            role: 'HRAdmin',
            initials: 'PM',
            permissions: ['employees:attendance:regularize', 'employees:attendance:clock'],
          }}
          toast={mockToast}
          triggerConfirm={mockTriggerConfirm}
        />,
      );

      expect(screen.getByText('Manual Attendance')).toBeInTheDocument();
      expect(screen.getByText('Maya Patel')).toBeInTheDocument();

      const saveBtn = screen.getByRole('button', { name: /Save Entry/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(mockClockInOrOut.mutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            employeeId: 'EMP-001',
            status: 'Present',
            inTime: '09:00',
            outTime: '18:00',
          }),
        );
      });

      expect(mockToast).toHaveBeenCalledWith(
        expect.stringContaining('Attendance saved for Maya Patel'),
        'success',
      );
    });

    it('should surface backend error response via toast if clock-in mutation fails', async () => {
      mockClockInOrOut.mutateAsync.mockRejectedValueOnce({
        response: {
          data: {
            message: 'You have already Clocked In today.',
          },
        },
      });

      render(
        <AttendancePage
          sub="attendance.manual"
          user={{
            id: 'admin-1',
            name: 'Priya Menon',
            email: 'priya@acmecorp.com',
            role: 'HRAdmin',
            initials: 'PM',
            permissions: ['employees:attendance:regularize', 'employees:attendance:clock'],
          }}
          toast={mockToast}
          triggerConfirm={mockTriggerConfirm}
        />,
      );

      const saveBtn = screen.getByRole('button', { name: /Save Entry/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          'You have already Clocked In today.',
          'error',
        );
      });
    });
  });

  describe('2. Employee Self Clock In/Out', () => {
    it('should resolve employee account and clock in successfully', async () => {
      mockClockInOrOut.mutateAsync.mockResolvedValueOnce({ id: 'att-self-1' });

      render(
        <EmployeeClockPage
          toast={mockToast}
          user={{
            id: 'user-emp-1',
            name: 'Maya Patel',
            email: 'maya@acmecorp.com',
            role: 'Employee',
            initials: 'MP',
            permissions: ['employees:attendance:clock'],
          }}
        />,
      );

      expect(screen.getByText('Roster Clock Attendance')).toBeInTheDocument();
      const clockBtn = screen.getByRole('button', { name: /Clock In/i });
      expect(clockBtn).not.toBeDisabled();

      fireEvent.click(clockBtn);

      await waitFor(() => {
        expect(mockClockInOrOut.mutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            employeeId: 'EMP-001',
          }),
        );
      });

      expect(mockToast).toHaveBeenCalledWith(
        expect.stringContaining('Successfully clocked in'),
      );
    });

    it('should show notice when user has no linked employee record', () => {
      render(
        <EmployeeClockPage
          toast={mockToast}
          user={{
            id: 'unlinked-admin',
            name: 'External Auditor',
            email: 'auditor@external.com',
            role: 'SuperAdmin',
            initials: 'EA',
            permissions: ['employees:attendance:clock'],
          }}
        />,
      );

      expect(
        screen.getByText(/Attendance clock-in is only available for employee accounts/i),
      ).toBeInTheDocument();
    });
  });
});
