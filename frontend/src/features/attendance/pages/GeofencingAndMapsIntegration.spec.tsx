import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EmployeeClockPage } from '../../employees/pages/EmployeeClockPage';
import { AttendancePage } from './AttendancePage';
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

vi.mock('maplibre-gl', () => {
  const mockMarker = {
    setLngLat: vi.fn().mockReturnThis(),
    setDraggable: vi.fn().mockReturnThis(),
    addTo: vi.fn().mockReturnThis(),
    remove: vi.fn(),
    getLngLat: vi.fn().mockReturnValue({ lng: 73.8567, lat: 18.5204 }),
    on: vi.fn().mockReturnThis(),
  };

  const mockMap = {
    addControl: vi.fn(),
    addSource: vi.fn(),
    addLayer: vi.fn(),
    getSource: vi.fn().mockReturnValue({ setData: vi.fn() }),
    setCenter: vi.fn(),
    flyTo: vi.fn(),
    fitBounds: vi.fn(),
    remove: vi.fn(),
    loaded: vi.fn().mockReturnValue(true),
    isStyleLoaded: vi.fn().mockReturnValue(true),
    on: vi.fn().mockImplementation((event: string, handler: Function) => {
      if (event === 'load') handler();
      return mockMap;
    }),
  };

  return {
    default: {
      Map: vi.fn().mockImplementation(function (this: any) {
        return mockMap;
      }),
      Marker: vi.fn().mockImplementation(function (this: any) {
        return mockMarker;
      }),
      NavigationControl: vi.fn().mockImplementation(function (this: any) {
        return {};
      }),
    },
    Map: vi.fn().mockImplementation(function (this: any) {
      return mockMap;
    }),
    Marker: vi.fn().mockImplementation(function (this: any) {
      return mockMarker;
    }),
    NavigationControl: vi.fn().mockImplementation(function (this: any) {
      return {};
    }),
  };
});

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

describe('Google Maps & Geofencing Integration Forensic Test Suite', () => {
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
  const mockCreateZone = {
    mutateAsync: vi.fn(),
    isPending: false,
  };
  const mockUpdateZone = {
    mutateAsync: vi.fn(),
    isPending: false,
  };
  const mockDeleteZone = {
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
  ];

  const mockZones = [
    {
      id: 'zone-1',
      name: 'Pune HQ Office',
      latitude: 18.5204,
      longitude: 73.8567,
      radiusMeters: 150,
      enabled: true,
      address: 'Shivajinagar, Pune',
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
      data: { enableGeofencing: true, enableRegularization: true },
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
      data: mockZones,
      isLoading: false,
    } as any);

    vi.mocked(orgQueryModule.useOrgMutations).mockReturnValue({
      createZone: mockCreateZone,
      updateZone: mockUpdateZone,
      deleteZone: mockDeleteZone,
    } as any);
  });

  it('1. Valid Location: Captures browser GPS coordinates and passes numeric values to clockIn mutation', async () => {
    mockClockInOrOut.mutateAsync.mockResolvedValueOnce({ id: 'att-1' });

    // Mock navigator.geolocation success
    const mockGeolocation = {
      getCurrentPosition: vi.fn().mockImplementationOnce((success) =>
        success({
          coords: {
            latitude: 18.5204,
            longitude: 73.8567,
            accuracy: 12,
          },
        }),
      ),
    };
    vi.stubGlobal('navigator', { geolocation: mockGeolocation });

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

    const clockBtn = screen.getByRole('button', { name: /Clock In/i });
    fireEvent.click(clockBtn);

    await waitFor(() => {
      expect(mockClockInOrOut.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          employeeId: 'EMP-001',
          latitude: 18.5204,
          longitude: 73.8567,
          accuracy: 12,
        }),
      );
    });

    expect(mockToast).toHaveBeenCalledWith(expect.stringContaining('Successfully clocked in'));
  });

  it('2. Outside-Radius Location: Surfaces backend geofence rejection message clearly in toast', async () => {
    mockClockInOrOut.mutateAsync.mockRejectedValueOnce({
      response: {
        data: {
          message: 'Clock-in rejected: You are outside the authorized office location (2450m away).',
        },
      },
    });

    const mockGeolocation = {
      getCurrentPosition: vi.fn().mockImplementationOnce((success) =>
        success({
          coords: {
            latitude: 18.5500, // 3km away
            longitude: 73.9000,
            accuracy: 15,
          },
        }),
      ),
    };
    vi.stubGlobal('navigator', { geolocation: mockGeolocation });

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

    const clockBtn = screen.getByRole('button', { name: /Clock In/i });
    fireEvent.click(clockBtn);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        'Clock-in rejected: You are outside the authorized office location (2450m away).',
      );
    });
  });

  it('3. GPS Denied / Unavailable: Handles geolocation permission rejection gracefully and warns user', async () => {
    mockClockInOrOut.mutateAsync.mockRejectedValueOnce({
      response: {
        data: {
          message: 'Location verification is required to clock in because your company has enabled attendance geofencing.',
        },
      },
    });

    // Mock geolocation error (e.g. User denied Geolocation prompt)
    const mockGeolocation = {
      getCurrentPosition: vi.fn().mockImplementationOnce((_, error) =>
        error({
          code: 1,
          message: 'User denied Geolocation',
        }),
      ),
    };
    vi.stubGlobal('navigator', { geolocation: mockGeolocation });

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

    const clockBtn = screen.getByRole('button', { name: /Clock In/i });
    fireEvent.click(clockBtn);

    await waitFor(() => {
      expect(mockClockInOrOut.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          employeeId: 'EMP-001',
        }),
      );
      expect(mockToast).toHaveBeenCalledWith(
        'Location verification is required to clock in because your company has enabled attendance geofencing.',
      );
    });
  });

  it('4. Invalid Coordinates: Form validation rejects out-of-bounds latitude and longitude on zone creation', async () => {
    render(
      <AttendancePage
        sub="attendance.geo"
        user={{
          id: 'admin-1',
          name: 'HR Admin',
          email: 'hr@acme.com',
          role: 'HRAdmin',
          initials: 'HR',
          permissions: ['employees:attendance:edit', 'attendance:geo:config'],
        }}
        toast={mockToast}
        triggerConfirm={mockTriggerConfirm}
      />,
    );

    const addBtn = screen.getByRole('button', { name: /Add Zone/i });
    fireEvent.click(addBtn);

    expect(screen.getByText('Configure Geo-Fencing Zone')).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText('e.g. Pune Head Office');
    const latInput = screen.getByPlaceholderText('18.5204');
    const lngInput = screen.getByPlaceholderText('73.8567');
    const saveBtn = screen.getByRole('button', { name: /Create Zone/i });

    // Enter invalid coordinates
    fireEvent.change(nameInput, { target: { value: 'Invalid Zone' } });
    fireEvent.change(latInput, { target: { value: '95.5' } }); // > 90
    fireEvent.change(lngInput, { target: { value: '200.0' } }); // > 180
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText('Latitude must be a decimal between -90 and 90')).toBeInTheDocument();
      expect(screen.getByText('Longitude must be a decimal between -180 and 180')).toBeInTheDocument();
      expect(mockCreateZone.mutateAsync).not.toHaveBeenCalled();
    });
  });

  it('5. Manual & Fallback Operationality: Saves valid numeric coordinates without requiring external maps script', async () => {
    mockCreateZone.mutateAsync.mockResolvedValueOnce({ id: 'zone-new' });

    render(
      <AttendancePage
        sub="attendance.geo"
        user={{
          id: 'admin-1',
          name: 'HR Admin',
          email: 'hr@acme.com',
          role: 'HRAdmin',
          initials: 'HR',
          permissions: ['employees:attendance:edit', 'attendance:geo:config'],
        }}
        toast={mockToast}
        triggerConfirm={mockTriggerConfirm}
      />,
    );

    const addBtn = screen.getByRole('button', { name: /Add Zone/i });
    fireEvent.click(addBtn);

    const nameInput = screen.getByPlaceholderText('e.g. Pune Head Office');
    const latInput = screen.getByPlaceholderText('18.5204');
    const lngInput = screen.getByPlaceholderText('73.8567');
    const radiusInput = screen.getByPlaceholderText('150');
    const saveBtn = screen.getByRole('button', { name: /Create Zone/i });

    fireEvent.change(nameInput, { target: { value: 'Mumbai Branch' } });
    fireEvent.change(latInput, { target: { value: '19.0760' } });
    fireEvent.change(lngInput, { target: { value: '72.8777' } });
    fireEvent.change(radiusInput, { target: { value: '250' } });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockCreateZone.mutateAsync).toHaveBeenCalledWith({
        name: 'Mumbai Branch',
        latitude: 19.076,
        longitude: 72.8777,
        radiusMeters: 250,
        address: undefined,
        enabled: true,
      });
    });

    expect(mockToast).toHaveBeenCalledWith('Zone "Mumbai Branch" created successfully', 'success');
  });

  it('6. Delete Zone: Clicking trash icon triggers confirmation and executes deleteZone.mutateAsync', async () => {
    mockDeleteZone.mutateAsync.mockResolvedValueOnce({ success: true });
    let confirmedCallback: (() => Promise<void>) | null = null;
    mockTriggerConfirm.mockImplementation((msg, callback) => {
      confirmedCallback = callback;
    });

    render(
      <AttendancePage
        sub="attendance.geo"
        user={{
          id: 'admin-1',
          name: 'HR Admin',
          email: 'hr@acme.com',
          role: 'HRAdmin',
          initials: 'HR',
          permissions: ['employees:attendance:edit', 'attendance:geo:config'],
        }}
        toast={mockToast}
        triggerConfirm={mockTriggerConfirm}
      />,
    );

    const deleteBtn = screen.getByTitle('Delete zone');
    fireEvent.click(deleteBtn);

    expect(mockTriggerConfirm).toHaveBeenCalledWith(
      expect.stringContaining('Delete geo-fencing zone "Pune HQ Office"?'),
      expect.any(Function),
      'Delete Zone',
    );

    // Simulate user confirming dialog
    expect(confirmedCallback).not.toBeNull();
    await (confirmedCallback as any)();

    expect(mockDeleteZone.mutateAsync).toHaveBeenCalledWith('zone-1');
    expect(mockToast).toHaveBeenCalledWith('Zone "Pune HQ Office" removed', 'success');
  });
});
