import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PayrollInputsPage } from './PayrollPage';
import * as employeesQueryModule from '../../../hooks/useEmployeesQuery';
import * as attendanceQueryModule from '../../../hooks/useAttendanceQuery';
import * as payrollQueryModule from '../../../hooks/usePayrollQuery';

vi.mock('../../../hooks/useEmployeesQuery', () => ({
  useEmployeesQuery: vi.fn(),
}));

vi.mock('../../../hooks/useAttendanceQuery', () => ({
  useAttendanceQuery: vi.fn(),
}));

vi.mock('../../../hooks/usePayrollQuery', () => ({
  usePayrollQuery: vi.fn(),
  usePayrollInputsQuery: vi.fn(),
  usePayrollInputsMutations: vi.fn(),
}));

describe('PayrollInputsPage - Server-Persisted Inputs Frontend Tests', () => {
  const mockToast = vi.fn();
  const mockMutateAsync = vi.fn();
  const mockRefetchInputs = vi.fn();

  const mockEmployees = [
    {
      id: 'EMP-1',
      name: 'Alice Johnson',
      email: 'alice@test.com',
      department: 'Engineering',
      designation: 'Software Engineer',
      salary: 80000,
      status: 'Active',
    },
    {
      id: 'EMP-2',
      name: 'Bob Smith',
      email: 'bob@test.com',
      department: 'Design',
      designation: 'Product Designer',
      salary: 70000,
      status: 'Active',
    },
  ];

  const mockPersistedInputs = [
    {
      id: 'INPUT-1',
      employeeId: 'EMP-1',
      month: '2026-07',
      lopDays: 1.5,
      overtimeHours: 8,
      bonus: 5000,
      deductions: 500,
      remarks: 'Top performer bonus',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(employeesQueryModule.useEmployeesQuery).mockReturnValue({
      data: mockEmployees,
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(attendanceQueryModule.useAttendanceQuery).mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    vi.mocked(payrollQueryModule.usePayrollInputsQuery).mockReturnValue({
      data: mockPersistedInputs,
      isLoading: false,
      isError: false,
      refetch: mockRefetchInputs,
    } as any);

    vi.mocked(payrollQueryModule.usePayrollInputsMutations).mockReturnValue({
      updatePayrollInput: {
        mutateAsync: mockMutateAsync,
      },
    } as any);
  });

  it('1. Loads and renders server-provided payroll inputs in the table', () => {
    render(<PayrollInputsPage toast={mockToast} />);

    expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    expect(screen.getByText('Bob Smith')).toBeInTheDocument();

    // Alice has persisted inputs: 1.5 LOP days (Manual), 8 hrs OT, ₹5,000 bonus, -₹500 deductions
    expect(screen.getByText(/1.5 Day/)).toBeInTheDocument();
    expect(screen.getByText('8 hrs')).toBeInTheDocument();
    expect(screen.getByText('₹5,000')).toBeInTheDocument();
    expect(screen.getByText('-₹500')).toBeInTheDocument();
    expect(screen.getByText('Top performer bonus')).toBeInTheDocument();
  });

  it('2. Shows zero/default dashes for employees with no persisted input record', () => {
    render(<PayrollInputsPage toast={mockToast} />);

    // Bob has no persisted inputs, table displays '-' for OT, bonus, deductions
    const dashes = screen.getAllByText('-');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it('3. Edit modal initializes from server data when clicked', async () => {
    render(<PayrollInputsPage toast={mockToast} />);

    const editButtons = screen.getAllByRole('button', { name: /edit/i });
    fireEvent.click(editButtons[0]); // Edit Alice

    expect(screen.getByText(/Edit Payroll Inputs - Alice Johnson/i)).toBeInTheDocument();

    const lopInput = screen.getByPlaceholderText('e.g. 1.5') as HTMLInputElement;
    const otInput = screen.getByPlaceholderText('e.g. 8') as HTMLInputElement;
    const bonusInput = screen.getByPlaceholderText('e.g. 5000') as HTMLInputElement;

    expect(lopInput.value).toBe('1.5');
    expect(otInput.value).toBe('8');
    expect(bonusInput.value).toBe('5000');
  });

  it('4. Submitting edit form calls updatePayrollInput.mutateAsync with server payload', async () => {
    mockMutateAsync.mockResolvedValueOnce({ id: 'INPUT-1', bonus: 12000 });

    render(<PayrollInputsPage toast={mockToast} />);

    const editButtons = screen.getAllByRole('button', { name: /edit/i });
    fireEvent.click(editButtons[0]);

    const bonusInput = screen.getByPlaceholderText('e.g. 5000');
    fireEvent.change(bonusInput, { target: { value: '12000' } });

    const saveButton = screen.getByRole('button', { name: /save inputs/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        employeeId: 'EMP-1',
        payload: {
          month: '2026-07',
          lopDays: 1.5,
          overtimeHours: 8,
          bonus: 12000,
          deductions: 500,
          remarks: 'Top performer bonus',
        },
      });
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.stringContaining('Payroll inputs saved successfully for Alice Johnson'),
      'success',
    );
  });

  it('5. Failed save displays error toast and does not display false success message', async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error('Period is locked'));

    render(<PayrollInputsPage toast={mockToast} />);

    const editButtons = screen.getAllByRole('button', { name: /edit/i });
    fireEvent.click(editButtons[0]);

    const saveButton = screen.getByRole('button', { name: /save inputs/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith('Period is locked', 'error');
    });

    // Modal stays open so user can rectify
    expect(screen.getByText(/Edit Payroll Inputs - Alice Johnson/i)).toBeInTheDocument();
  });

  it('6. Negative input values are rejected with error toast prior to submission', async () => {
    render(<PayrollInputsPage toast={mockToast} />);

    const editButtons = screen.getAllByRole('button', { name: /edit/i });
    fireEvent.click(editButtons[0]);

    const bonusInput = screen.getByPlaceholderText('e.g. 5000');
    fireEvent.change(bonusInput, { target: { value: '-100' } });

    const saveButton = screen.getByRole('button', { name: /save inputs/i });
    fireEvent.click(saveButton);

    expect(mockToast).toHaveBeenCalledWith('Input values cannot be negative.', 'error');
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('7. Displays loading state while inputs are being fetched from server', () => {
    vi.mocked(payrollQueryModule.usePayrollInputsQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: mockRefetchInputs,
    } as any);

    render(<PayrollInputsPage toast={mockToast} />);

    expect(screen.getByText(/Loading payroll inputs.../i)).toBeInTheDocument();
  });

  it('8. Displays error banner with retry button on query failure', () => {
    vi.mocked(payrollQueryModule.usePayrollInputsQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: mockRefetchInputs,
    } as any);

    render(<PayrollInputsPage toast={mockToast} />);

    expect(screen.getByText(/Failed to load persisted payroll inputs from server/i)).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryBtn);
    expect(mockRefetchInputs).toHaveBeenCalled();
  });
});
