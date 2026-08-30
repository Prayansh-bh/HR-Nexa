import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AttendancePage } from './AttendancePage';
import { attendanceService } from '../../../services/attendance.service';
import * as employeesQueryModule from '../../../hooks/useEmployeesQuery';
import * as attendanceQueryModule from '../../../hooks/useAttendanceQuery';
import * as orgQueryModule from '../../../hooks/useOrgQuery';

vi.mock('../../../services/attendance.service', () => ({
  attendanceService: {
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
    getAttendance: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../../hooks/useEmployeesQuery', () => ({
  useEmployeesQuery: vi.fn().mockReturnValue({ data: [] }),
}));

vi.mock('../../../hooks/useAttendanceQuery', () => ({
  useAttendanceQuery: vi.fn().mockReturnValue({ data: [] }),
  useAttendanceMutations: vi.fn().mockReturnValue({ clockInOrOut: { mutateAsync: vi.fn() } }),
  useAttendanceMatrixQuery: vi.fn().mockReturnValue({ data: {} }),
  ATTENDANCE_QUERY_KEYS: {
    all: ['attendance'],
    settings: ['attendance', 'settings'],
  },
}));

vi.mock('../../../hooks/useOrgQuery', () => ({
  useDepartmentsQuery: vi.fn().mockReturnValue({ data: [] }),
  useDevicesQuery: vi.fn().mockReturnValue({ data: [] }),
  useZonesQuery: vi.fn().mockReturnValue({ data: [] }),
  useOrgMutations: vi.fn().mockReturnValue({}),
}));

const mockUser = {
  id: 'user-admin-1',
  name: 'Admin User',
  email: 'admin@acmecorp.com',
  role: 'HRAdmin',
  permissions: ['employees:attendance:edit'],
};

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('AttendanceSettingsPage - Geofencing Policy Settings Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Loads existing settings with enableGeofencing=true and geofenceOnClockOut=true', async () => {
    (attendanceService.getSettings as any).mockResolvedValueOnce({
      gracePeriod: 15,
      halfDayThreshold: 240,
      otMultiplier: 1.5,
      enableRegularization: true,
      selfRegularization: false,
      enableGeofencing: true,
      geofenceOnClockOut: true,
      shiftName: 'General',
      shiftStart: '09:00',
      shiftEnd: '18:00',
      weekOffs: 'Saturday,Sunday',
    });

    renderWithClient(
      <AttendancePage
        sub="attendance.settings"
        user={mockUser}
        toast={vi.fn()}
        triggerConfirm={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Geofencing Policy')).toBeInTheDocument();
      expect(screen.getByText('Enforced')).toBeInTheDocument();
    });

    const geofenceToggle = screen.getByTestId('toggle-enable-geofencing');
    expect(geofenceToggle).toBeInTheDocument();
  });

  it('2. Loads existing settings with enableGeofencing=false', async () => {
    (attendanceService.getSettings as any).mockResolvedValueOnce({
      gracePeriod: 15,
      halfDayThreshold: 240,
      otMultiplier: 1.5,
      enableRegularization: true,
      selfRegularization: false,
      enableGeofencing: false,
      geofenceOnClockOut: false,
      shiftName: 'General',
      shiftStart: '09:00',
      shiftEnd: '18:00',
      weekOffs: 'Saturday,Sunday',
    });

    renderWithClient(
      <AttendancePage
        sub="attendance.settings"
        user={mockUser}
        toast={vi.fn()}
        triggerConfirm={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Geofencing Policy')).toBeInTheDocument();
      expect(screen.queryByText('Enforced')).not.toBeInTheDocument();
    });
  });

  it('3. Toggles enableGeofencing and saves persisted state', async () => {
    (attendanceService.getSettings as any).mockResolvedValueOnce({
      gracePeriod: 15,
      halfDayThreshold: 240,
      otMultiplier: 1.5,
      enableRegularization: true,
      selfRegularization: false,
      enableGeofencing: false,
      geofenceOnClockOut: false,
      shiftName: 'General',
      shiftStart: '09:00',
      shiftEnd: '18:00',
      weekOffs: 'Saturday,Sunday',
    });
    (attendanceService.updateSettings as any).mockResolvedValueOnce({ success: true });

    const mockToast = vi.fn();
    renderWithClient(
      <AttendancePage
        sub="attendance.settings"
        user={mockUser}
        toast={mockToast}
        triggerConfirm={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Geofencing Policy')).toBeInTheDocument();
    });

    // Toggle Geofencing ON
    const geofenceToggle = screen.getByTestId('toggle-enable-geofencing');
    fireEvent.click(geofenceToggle);

    expect(screen.getByText('Enforced')).toBeInTheDocument();

    // Click Save Settings
    const saveBtn = screen.getByRole('button', { name: /Save Settings/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(attendanceService.updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          enableGeofencing: true,
          geofenceOnClockOut: false,
          gracePeriod: 15,
        }),
      );
      expect(mockToast).toHaveBeenCalledWith('Attendance settings saved successfully!');
    });
  });

  it('4. Toggles geofenceOnClockOut when geofencing is enabled', async () => {
    (attendanceService.getSettings as any).mockResolvedValueOnce({
      gracePeriod: 15,
      halfDayThreshold: 240,
      otMultiplier: 1.5,
      enableRegularization: true,
      selfRegularization: false,
      enableGeofencing: true,
      geofenceOnClockOut: false,
      shiftName: 'General',
      shiftStart: '09:00',
      shiftEnd: '18:00',
      weekOffs: 'Saturday,Sunday',
    });
    (attendanceService.updateSettings as any).mockResolvedValueOnce({ success: true });

    renderWithClient(
      <AttendancePage
        sub="attendance.settings"
        user={mockUser}
        toast={vi.fn()}
        triggerConfirm={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Geofencing Policy')).toBeInTheDocument();
    });

    // Toggle Clock-Out Geofencing ON
    const clockOutToggle = screen.getByTestId('toggle-geofence-clock-out');
    fireEvent.click(clockOutToggle);

    const saveBtn = screen.getByRole('button', { name: /Save Settings/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(attendanceService.updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          enableGeofencing: true,
          geofenceOnClockOut: true,
        }),
      );
    });
  });

  it('5. Displays active GeoZone empty state warning when geofencing is enabled but no zones configured', async () => {
    (attendanceService.getSettings as any).mockResolvedValueOnce({
      gracePeriod: 15,
      halfDayThreshold: 240,
      otMultiplier: 1.5,
      enableRegularization: true,
      selfRegularization: false,
      enableGeofencing: true,
      geofenceOnClockOut: false,
      shiftName: 'General',
      shiftStart: '09:00',
      shiftEnd: '18:00',
      weekOffs: 'Saturday,Sunday',
    });

    // Empty zones list
    vi.mocked(orgQueryModule.useZonesQuery).mockReturnValue({ data: [] } as any);

    renderWithClient(
      <AttendancePage
        sub="attendance.settings"
        user={mockUser}
        toast={vi.fn()}
        triggerConfirm={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('geozone-empty-warning')).toBeInTheDocument();
      expect(
        screen.getByText(/no active GeoZones are configured/i),
      ).toBeInTheDocument();
    });
  });

  it('6. Unauthorized users cannot edit the geofencing toggles or save settings', async () => {
    (attendanceService.getSettings as any).mockResolvedValueOnce({
      gracePeriod: 15,
      halfDayThreshold: 240,
      otMultiplier: 1.5,
      enableRegularization: true,
      selfRegularization: false,
      enableGeofencing: false,
      geofenceOnClockOut: false,
      shiftName: 'General',
      shiftStart: '09:00',
      shiftEnd: '18:00',
      weekOffs: 'Saturday,Sunday',
    });

    const unauthorizedUser = {
      id: 'user-emp-2',
      name: 'Regular Employee',
      email: 'employee@acmecorp.com',
      role: 'Employee',
      permissions: ['employees:attendance:view'],
    };

    renderWithClient(
      <AttendancePage
        sub="attendance.settings"
        user={unauthorizedUser}
        toast={vi.fn()}
        triggerConfirm={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('toggle-enable-geofencing')).toBeDisabled();
      expect(screen.queryByRole('button', { name: /Save Settings/i })).not.toBeInTheDocument();
    });
  });
});
