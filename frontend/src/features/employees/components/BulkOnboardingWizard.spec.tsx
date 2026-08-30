import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BulkOnboardingWizard } from './BulkOnboardingWizard';
import { employeeService } from '../../../services/employee.service';
import { useEmployeesStore } from '../../../store/employeesStore';
import * as excelExporter from '../../../utils/excelExporter';

vi.mock('../../../services/employee.service', () => ({
  employeeService: {
    bulkCreateEmployees: vi.fn(),
  },
}));

vi.mock('../../../utils/excelExporter', () => ({
  parseExcelFile: vi.fn(),
  exportToExcel: vi.fn(),
}));

describe('BulkOnboardingWizard — Phase 3 Truthful UI & Reconciliation Specs', () => {
  const mockOnClose = vi.fn();
  const mockToast = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    useEmployeesStore.setState({
      employees: [],
      isLoading: false,
      error: null,
    });
  });

  const sampleRawRows = [
    {
      'Full Name': 'Alice Cooper',
      'Work Email': 'alice@acme.co',
      Department: 'Engineering',
      Designation: 'Lead Architect',
      'Monthly Salary': '95000',
      'Date of Joining': '2026-06-01',
      Status: 'Active',
    },
    {
      'Full Name': 'Bob Marley',
      'Work Email': 'bob@acme.co',
      Department: 'Product',
      Designation: 'Product Manager',
      'Monthly Salary': '80000',
      'Date of Joining': '2026-06-01',
      Status: 'Active',
    },
    {
      'Full Name': 'Charlie Brown',
      'Work Email': 'charlie@acme.co',
      Department: 'Design',
      Designation: 'UI Designer',
      'Monthly Salary': '70000',
      'Date of Joining': '2026-06-01',
      Status: 'Active',
    },
  ];

  it('Test 1 — Full success: calls bulk API, displays success reconciliation, and enables modal close', async () => {
    vi.mocked(excelExporter.parseExcelFile).mockResolvedValue(sampleRawRows);
    vi.mocked(employeeService.bulkCreateEmployees).mockResolvedValue({
      total: 3,
      successful: 3,
      failed: 0,
      createdEmployees: [
        { id: 'EMP001', name: 'Alice Cooper', email: 'alice@acme.co' } as any,
        { id: 'EMP002', name: 'Bob Marley', email: 'bob@acme.co' } as any,
        { id: 'EMP003', name: 'Charlie Brown', email: 'charlie@acme.co' } as any,
      ],
      errors: [],
    });

    render(<BulkOnboardingWizard onClose={mockOnClose} toast={mockToast} />);

    // Upload file
    const file = new File(['mock'], 'employees.csv', { type: 'text/csv' });
    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input!, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('Alice Cooper')).toBeInTheDocument();
      expect(screen.getByText('3 Valid')).toBeInTheDocument();
    });

    // Click Import
    const importBtn = screen.getByRole('button', { name: /import 3 valid employees/i });
    fireEvent.click(importBtn);

    await waitFor(() => {
      expect(employeeService.bulkCreateEmployees).toHaveBeenCalledTimes(1);
      expect(mockToast).toHaveBeenCalledWith('All 3 employees imported successfully!');
      expect(screen.getByText('Successfully Created')).toBeInTheDocument();
    });

    // Click Done & View Directory
    const doneBtn = screen.getByRole('button', { name: /done & view directory/i });
    fireEvent.click(doneBtn);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('Test 2 — Partial success: accurately reconciles successful count and failed row with backend reason', async () => {
    vi.mocked(excelExporter.parseExcelFile).mockResolvedValue(sampleRawRows);
    vi.mocked(employeeService.bulkCreateEmployees).mockResolvedValue({
      total: 3,
      successful: 2,
      failed: 1,
      createdEmployees: [
        { id: 'EMP001', name: 'Alice Cooper', email: 'alice@acme.co' } as any,
        { id: 'EMP003', name: 'Charlie Brown', email: 'charlie@acme.co' } as any,
      ],
      errors: [
        {
          row: 3,
          index: 1,
          email: 'bob@acme.co',
          name: 'Bob Marley',
          reason: 'Employee with email bob@acme.co already exists',
          code: 'DUPLICATE_RECORD',
        },
      ],
    });

    render(<BulkOnboardingWizard onClose={mockOnClose} toast={mockToast} />);

    const file = new File(['mock'], 'employees.csv', { type: 'text/csv' });
    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input!, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('Bob Marley')).toBeInTheDocument();
    });

    const importBtn = screen.getByRole('button', { name: /import 3 valid employees/i });
    fireEvent.click(importBtn);

    await waitFor(() => {
      expect(screen.getByText('Backend Row Rejections')).toBeInTheDocument();
      expect(
        screen.getByText('Employee with email bob@acme.co already exists'),
      ).toBeInTheDocument();
      expect(mockToast).toHaveBeenCalledWith(
        'Import finished: 2 created, 1 failed.',
      );
    });

    // Ensure modal is NOT auto-closed
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('Test 3 — Complete failure: reports 0 created and retains failure details without false success toast', async () => {
    vi.mocked(excelExporter.parseExcelFile).mockResolvedValue(sampleRawRows.slice(0, 1));
    vi.mocked(employeeService.bulkCreateEmployees).mockResolvedValue({
      total: 1,
      successful: 0,
      failed: 1,
      createdEmployees: [],
      errors: [
        {
          row: 2,
          index: 0,
          email: 'alice@acme.co',
          reason: 'Seat limit reached for company subscription.',
          code: 'SEAT_LIMIT_REACHED',
        },
      ],
    });

    render(<BulkOnboardingWizard onClose={mockOnClose} toast={mockToast} />);

    const file = new File(['mock'], 'employees.csv', { type: 'text/csv' });
    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input!, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('Alice Cooper')).toBeInTheDocument();
    });

    const importBtn = screen.getByRole('button', { name: /import 1 valid employees/i });
    fireEvent.click(importBtn);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        'Import failed: 0 of 1 records could be created.',
      );
      expect(
        screen.getByText('Seat limit reached for company subscription.'),
      ).toBeInTheDocument();
    });

    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('Test 4 — HTTP/Network failure: displays error banner without closing modal', async () => {
    vi.mocked(excelExporter.parseExcelFile).mockResolvedValue(sampleRawRows.slice(0, 1));
    vi.mocked(employeeService.bulkCreateEmployees).mockRejectedValue(
      new Error('Internal Server Error (500)'),
    );

    render(<BulkOnboardingWizard onClose={mockOnClose} toast={mockToast} />);

    const file = new File(['mock'], 'employees.csv', { type: 'text/csv' });
    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input!, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('Alice Cooper')).toBeInTheDocument();
    });

    const importBtn = screen.getByRole('button', { name: /import 1 valid employees/i });
    fireEvent.click(importBtn);

    await waitFor(() => {
      expect(screen.getByText('Server / Request Error')).toBeInTheDocument();
      expect(screen.getByText('Internal Server Error (500)')).toBeInTheDocument();
      expect(mockToast).toHaveBeenCalledWith('Internal Server Error (500)');
    });

    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('Test 5 — Duplicate submission prevention: disables button while importing and only submits once', async () => {
    let resolveApi: any;
    const pendingPromise = new Promise<any>((res) => {
      resolveApi = res;
    });
    vi.mocked(excelExporter.parseExcelFile).mockResolvedValue(sampleRawRows.slice(0, 1));
    vi.mocked(employeeService.bulkCreateEmployees).mockReturnValue(pendingPromise);

    render(<BulkOnboardingWizard onClose={mockOnClose} toast={mockToast} />);

    const file = new File(['mock'], 'employees.csv', { type: 'text/csv' });
    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input!, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('Alice Cooper')).toBeInTheDocument();
    });

    const importBtn = screen.getByRole('button', { name: /import 1 valid employees/i });
    
    // Rapid clicks
    fireEvent.click(importBtn);
    fireEvent.click(importBtn);
    fireEvent.click(importBtn);

    expect(employeeService.bulkCreateEmployees).toHaveBeenCalledTimes(1);

    // Resolve promise
    resolveApi({
      total: 1,
      successful: 1,
      failed: 0,
      createdEmployees: [{ id: 'EMP001' }],
      errors: [],
    });

    await waitFor(() => {
      expect(screen.getByText('Successfully Created')).toBeInTheDocument();
    });
  });

  it('Test 6 — Canonical payload: sends "joined" and NOT "joinedDate" in the bulk request', async () => {
    vi.mocked(excelExporter.parseExcelFile).mockResolvedValue([
      {
        'Full Name': 'Diana Prince',
        Email: 'diana@themyscira.co',
        Department: 'Security',
        Designation: 'Director',
        Salary: 120000,
        'Joining Date': '2026-07-01',
      },
    ]);
    vi.mocked(employeeService.bulkCreateEmployees).mockResolvedValue({
      total: 1,
      successful: 1,
      failed: 0,
      createdEmployees: [{ id: 'EMP001' } as any],
      errors: [],
    });

    render(<BulkOnboardingWizard onClose={mockOnClose} toast={mockToast} />);

    const file = new File(['mock'], 'employees.csv', { type: 'text/csv' });
    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input!, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('Diana Prince')).toBeInTheDocument();
    });

    const importBtn = screen.getByRole('button', { name: /import 1 valid employees/i });
    fireEvent.click(importBtn);

    await waitFor(() => {
      expect(employeeService.bulkCreateEmployees).toHaveBeenCalledTimes(1);
    });

    const submittedPayload = vi.mocked(employeeService.bulkCreateEmployees).mock.calls[0][0];
    expect(submittedPayload).toHaveLength(1);
    expect(submittedPayload[0].joined).toBe('2026-07-01');
    expect((submittedPayload[0] as any).joinedDate).toBeUndefined();
    expect(submittedPayload[0].departmentName).toBe('Security');
  });
});
