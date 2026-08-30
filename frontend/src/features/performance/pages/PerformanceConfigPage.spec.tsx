import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PerformanceConfigPage } from './PerformanceConfigPage';
import * as employeesQueryModule from '../../../hooks/useEmployeesQuery';
import * as performanceQueryModule from '../../../hooks/usePerformanceQuery';

// Mock Lucide icons or child components if necessary
vi.mock('../../../hooks/useEmployeesQuery', () => ({
  useEmployeesQuery: vi.fn(),
}));

vi.mock('../../../hooks/usePerformanceQuery', () => ({
  usePerformanceCyclesQuery: vi.fn(),
  usePerformanceReviewsQuery: vi.fn(),
  usePerformanceCriteriaQuery: vi.fn(),
  usePerformanceMutations: vi.fn(),
}));

describe('PerformanceConfigPage - Frontend Participant Scope & Employee Loading', () => {
  const mockToast = vi.fn();
  const mockCreateCycleMutateAsync = vi.fn();
  const mockRefetchEmployees = vi.fn();

  const mockEmployees = [
    {
      id: 'emp-1',
      name: 'Alice Johnson',
      email: 'alice@test.com',
      department: 'Engineering',
      status: 'Active',
      role: 'Employee',
    },
    {
      id: 'emp-2',
      name: 'Bob Smith',
      email: 'bob@test.com',
      department: 'Design',
      status: 'On Leave',
      role: 'Employee',
    },
    {
      id: 'emp-3',
      name: 'Charlie Inactive',
      email: 'charlie@test.com',
      department: 'Sales',
      status: 'Terminated',
      role: 'Employee',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(performanceQueryModule.usePerformanceCyclesQuery).mockReturnValue({
      cycles: [],
      isLoadingCycles: false,
    } as any);

    vi.mocked(performanceQueryModule.usePerformanceReviewsQuery).mockReturnValue({
      reviews: [],
      isLoadingReviews: false,
    } as any);

    vi.mocked(performanceQueryModule.usePerformanceCriteriaQuery).mockReturnValue({
      criteria: [],
      isLoadingCriteria: false,
    } as any);

    vi.mocked(performanceQueryModule.usePerformanceMutations).mockReturnValue({
      createCycle: {
        mutateAsync: mockCreateCycleMutateAsync,
        isPending: false,
      },
      updateCycle: { mutateAsync: vi.fn(), isPending: false },
      provisionReviews: { mutateAsync: vi.fn(), isPending: false },
    } as any);

    // Default mock: successful employees query
    vi.mocked(employeesQueryModule.useEmployeesQuery).mockReturnValue({
      data: mockEmployees as any,
      isLoading: false,
      isError: false,
      refetch: mockRefetchEmployees,
    } as any);
  });

  const openCreateModal = async () => {
    render(<PerformanceConfigPage toast={mockToast} />);
    const openBtn = screen.getByRole('button', { name: /create cycle/i });
    fireEvent.click(openBtn);
    await waitFor(() => {
      expect(screen.getByText('Create Performance Cycle')).toBeInTheDocument();
    });
  };

  it('1. Fetches employees via useEmployeesQuery on direct navigation / mount', async () => {
    render(<PerformanceConfigPage toast={mockToast} />);
    expect(employeesQueryModule.useEmployeesQuery).toHaveBeenCalled();
  });

  it('2. Shows loading state in participant picker when employee query is loading without displaying "0 matching"', async () => {
    vi.mocked(employeesQueryModule.useEmployeesQuery).mockReturnValue({
      data: [],
      isLoading: true,
      isError: false,
      refetch: mockRefetchEmployees,
    } as any);

    await openCreateModal();

    // Switch to Specific Participants
    const specificScopeBtn = screen.getByRole('button', { name: /specific participants/i });
    fireEvent.click(specificScopeBtn);

    expect(screen.getByText(/loading eligible employees/i)).toBeInTheDocument();
    expect(screen.queryByText(/0 matching/i)).not.toBeInTheDocument();
  });

  it('3. Displays error state with retry button when employee query fails', async () => {
    vi.mocked(employeesQueryModule.useEmployeesQuery).mockReturnValue({
      data: [],
      isLoading: false,
      isError: true,
      refetch: mockRefetchEmployees,
    } as any);

    await openCreateModal();

    const specificScopeBtn = screen.getByRole('button', { name: /specific participants/i });
    fireEvent.click(specificScopeBtn);

    expect(screen.getByText(/failed to load employees/i)).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryBtn);
    expect(mockRefetchEmployees).toHaveBeenCalled();
  });

  it('4. Filters eligible employees (Active and On Leave, excluding Terminated)', async () => {
    await openCreateModal();

    const specificScopeBtn = screen.getByRole('button', { name: /specific participants/i });
    fireEvent.click(specificScopeBtn);

    expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    expect(screen.getByText('Bob Smith')).toBeInTheDocument();
    expect(screen.queryByText('Charlie Inactive')).not.toBeInTheDocument();
  });

  it('5. Supports search and department filtering in participant picker', async () => {
    await openCreateModal();

    const specificScopeBtn = screen.getByRole('button', { name: /specific participants/i });
    fireEvent.click(specificScopeBtn);

    // Search by name
    const searchInput = screen.getByPlaceholderText(/search name/i);
    fireEvent.change(searchInput, { target: { value: 'Alice' } });

    expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    expect(screen.queryByText('Bob Smith')).not.toBeInTheDocument();

    // Clear search and filter by department
    fireEvent.change(searchInput, { target: { value: '' } });
    const selects = screen.getAllByRole('combobox');
    const deptSelect = selects[selects.length - 1];
    fireEvent.change(deptSelect, { target: { value: 'Design' } });

    expect(screen.queryByText('Alice Johnson')).not.toBeInTheDocument();
    expect(screen.getByText('Bob Smith')).toBeInTheDocument();
  });

  it('6. Supports "Select All Filtered" and "Clear All" buttons', async () => {
    await openCreateModal();

    const specificScopeBtn = screen.getByRole('button', { name: /specific participants/i });
    fireEvent.click(specificScopeBtn);

    const selectAllBtn = screen.getByRole('button', { name: /select all filtered/i });
    fireEvent.click(selectAllBtn);

    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(checkboxes[0].checked).toBe(true);
    expect(checkboxes[1].checked).toBe(true);

    const clearAllBtn = screen.getByRole('button', { name: /clear all/i });
    fireEvent.click(clearAllBtn);

    expect(checkboxes[0].checked).toBe(false);
    expect(checkboxes[1].checked).toBe(false);
  });

  it('7. Submits Company-wide (ALL) cycle without requiring participant selection', async () => {
    mockCreateCycleMutateAsync.mockResolvedValueOnce({ id: 'cycle-123' });
    await openCreateModal();

    const nameInput = screen.getByPlaceholderText(/e\.g\. 2026 Q3/i);
    fireEvent.change(nameInput, { target: { value: 'Company-wide Q3 Review' } });

    // Ensure scope is ALL
    const companyWideBtn = screen.getByRole('button', { name: /company-wide \(all\)/i });
    fireEvent.click(companyWideBtn);

    const submitBtns = screen.getAllByRole('button', { name: /^create cycle$/i });
    fireEvent.click(submitBtns[submitBtns.length - 1]);

    await waitFor(() => {
      expect(mockCreateCycleMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Company-wide Q3 Review',
          participantScope: 'ALL',
          participantIds: [],
        }),
      );
      expect(mockToast).toHaveBeenCalledWith('Performance cycle created successfully');
    });
  });

  it('8. Blocks submission of SELECTED scope when zero participants are selected', async () => {
    await openCreateModal();

    const nameInput = screen.getByPlaceholderText(/e\.g\. 2026 Q3/i);
    fireEvent.change(nameInput, { target: { value: 'Selected Review Cycle' } });

    const specificScopeBtn = screen.getByRole('button', { name: /specific participants/i });
    fireEvent.click(specificScopeBtn);

    const submitBtns = screen.getAllByRole('button', { name: /^create cycle$/i });
    fireEvent.click(submitBtns[submitBtns.length - 1]);

    expect(mockCreateCycleMutateAsync).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith('Please select at least one participant for this cycle');
  });

  it('9. Submits SELECTED scope with chosen participant IDs and resets form on success', async () => {
    mockCreateCycleMutateAsync.mockResolvedValueOnce({ id: 'cycle-456' });
    await openCreateModal();

    const nameInput = screen.getByPlaceholderText(/e\.g\. 2026 Q3/i);
    fireEvent.change(nameInput, { target: { value: 'Engineering Lead Cycle' } });

    const specificScopeBtn = screen.getByRole('button', { name: /specific participants/i });
    fireEvent.click(specificScopeBtn);

    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    fireEvent.click(checkboxes[0]); // Select Alice (emp-1)

    const submitBtns = screen.getAllByRole('button', { name: /^create cycle$/i });
    fireEvent.click(submitBtns[submitBtns.length - 1]);

    await waitFor(() => {
      expect(mockCreateCycleMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Engineering Lead Cycle',
          participantScope: 'SELECTED',
          participantIds: ['emp-1'],
        }),
      );
      expect(mockToast).toHaveBeenCalledWith('Performance cycle created successfully');
    });

    // Verify modal is closed after success
    await waitFor(() => {
      expect(screen.queryByText('Create Performance Cycle')).not.toBeInTheDocument();
    });
  });
});
